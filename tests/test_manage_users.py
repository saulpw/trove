import json
import subprocess

import pytest

import manage_users as users


SITE = {"siteData": {"site-id": "test-site"}}


def run_cli(monkeypatch, responses, argv=None):
    calls = []
    pending = iter(responses)

    def run(command, **kwargs):
        calls.append(command)
        assert kwargs["cwd"] == users.PROJECT_ROOT
        response = next(pending)
        if isinstance(response, subprocess.CompletedProcess):
            return response
        return subprocess.CompletedProcess(command, 0, json.dumps(response), "")

    monkeypatch.setattr(users.subprocess, "run", run)
    monkeypatch.setattr(users.sys, "argv", ["manage_users.py", *(argv or ["add", "bob"])])
    monkeypatch.setattr(users.getpass, "getpass", lambda prompt: "new:password")
    return users.main(), calls


@pytest.mark.parametrize("response", [
    {"siteData": None},
    subprocess.CompletedProcess([], 0, "No project id found", ""),
    subprocess.CompletedProcess([], 1, "", "login failed"),
])
def test_missing_project_never_writes(monkeypatch, capsys, response):
    code, calls = run_cli(monkeypatch, [response])
    assert code == 1
    assert len(calls) == 1
    assert "Added" not in capsys.readouterr().out


@pytest.mark.parametrize("response", [
    subprocess.CompletedProcess([], 1, "", "private diagnostic"),
    subprocess.CompletedProcess([], 0, "No project id found", ""),
    {"TROVE_USERS": "alice:old,broken"},
    {"TROVE_USERS": "alice:old,alice:other"},
    {"TROVE_USERS": ["alice:old"]},
])
def test_bad_read_never_writes(monkeypatch, capsys, response):
    code, calls = run_cli(monkeypatch, [SITE, response])
    assert code == 1
    assert len(calls) == 2
    output = capsys.readouterr()
    assert not output.out
    assert "private diagnostic" not in output.err


@pytest.mark.parametrize("write,readback", [
    (subprocess.CompletedProcess([], 1, "new:password", "new:password"), None),
    (subprocess.CompletedProcess([], 0, "No project id found", ""), None),
    ({}, {"TROVE_USERS": "alice:old"}),
    ({}, subprocess.CompletedProcess([], 1, "", "error")),
])
def test_failed_write_or_verification_never_claims_success(monkeypatch, capsys, write, readback):
    responses = [SITE, {"TROVE_USERS": "alice:old"}, write]
    if readback is not None:
        responses.append(readback)
    code, _ = run_cli(monkeypatch, responses)
    assert code == 1
    output = capsys.readouterr()
    assert not output.out
    assert "new:password" not in output.err


def test_add_preserves_users_and_verifies(monkeypatch, capsys):
    expected = {"TROVE_USERS": "alice:old,bob:new:password"}
    code, calls = run_cli(monkeypatch, [SITE, {"TROVE_USERS": "alice:old"}, expected, expected])
    assert code == 0
    assert calls[2][1:4] == ["env:set", "TROVE_USERS", expected["TROVE_USERS"]]
    assert calls[3][1] == "env:get"
    assert "Added user: bob" in capsys.readouterr().out


def test_remove_last_user_refuses_ineffective_empty_write(monkeypatch, capsys):
    code, calls = run_cli(monkeypatch, [SITE, {"TROVE_USERS": "bob:old"}], ["remove", "bob"])
    assert code == 1
    assert len(calls) == 2
    output = capsys.readouterr()
    assert not output.out
    assert "dashboard" in output.err


def test_empty_users_can_be_initialized(monkeypatch):
    code, _ = run_cli(monkeypatch, [SITE, {}, {}, {"TROVE_USERS": "bob:new:password"}])
    assert code == 0


@pytest.mark.parametrize("username,password", [
    ("", "pw"), ("a:b", "pw"), ("a,b", "pw"), (" a", "pw"),
    ("a", ""), ("a", "p,w"), ("a", "pw\n"), ("a", " pw"),
])
def test_invalid_credentials(username, password):
    with pytest.raises(users.UserError):
        users.validate_user(username, password)
