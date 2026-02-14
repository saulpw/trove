"""Tests for process_issues.py parsing and processing logic."""

import json
from pathlib import Path

from process_issues import parse_issue_body, process_issue_list


def test_parse_issue_body_basic():
    body = "url: https://example.com\ntags: games retro\nnotes: great site"
    fields = parse_issue_body(body)
    assert fields["url"] == "https://example.com"
    assert fields["tags"] == "games retro"
    assert fields["notes"] == "great site"


def test_parse_issue_body_with_action():
    body = "action: set_title\nurl: https://example.com\ntitle: New Title\nsubmitted_by: alice"
    fields = parse_issue_body(body)
    assert fields["action"] == "set_title"
    assert fields["url"] == "https://example.com"
    assert fields["title"] == "New Title"
    assert fields["submitted_by"] == "alice"


def test_parse_issue_body_rename_tag():
    body = "action: rename_tag\nremove_tag: retro\nadd_tags: classic\nurls: https://a.com https://b.com\nsubmitted_by: bob"
    fields = parse_issue_body(body)
    assert fields["action"] == "rename_tag"
    assert fields["remove_tag"] == "retro"
    assert fields["add_tags"] == "classic"
    assert fields["urls"] == "https://a.com https://b.com"


FIXTURES = Path(__file__).parent / "test_issues"


def load_fixture(name):
    return json.loads((FIXTURES / name).read_text())


def test_process_local_add(tmp_path):
    out = tmp_path / "trove.jsonl"
    issue = load_fixture("add.json")
    process_issue_list([issue], trove_path=out, local=True)
    entries = [json.loads(line) for line in out.read_text().strip().split("\n")]
    assert len(entries) == 1
    assert entries[0]["op"] == "add"
    assert entries[0]["url"] == "https://example.com"
    assert entries[0]["tags"] == "games tools"
    assert entries[0]["title"] == "Example Site"


def test_process_local_delete(tmp_path):
    out = tmp_path / "trove.jsonl"
    # Seed with an add entry
    seed = load_fixture("add.json")
    process_issue_list([seed], trove_path=out, local=True)
    # Process delete
    delete = load_fixture("delete.json")
    process_issue_list([delete], trove_path=out, local=True)
    entries = [json.loads(line) for line in out.read_text().strip().split("\n")]
    assert len(entries) == 2
    assert entries[1]["op"] == "delete"
    assert entries[1]["url"] == "https://example.com"


def test_process_local_add_tag(tmp_path):
    out = tmp_path / "trove.jsonl"
    # Seed with an add entry
    seed = load_fixture("add.json")
    process_issue_list([seed], trove_path=out, local=True)
    # Process add_tag
    add_tag = load_fixture("add_tag.json")
    process_issue_list([add_tag], trove_path=out, local=True)
    entries = [json.loads(line) for line in out.read_text().strip().split("\n")]
    assert len(entries) == 2
    assert entries[1]["op"] == "add_tag"
    assert entries[1]["url"] == "https://example.com"
    assert entries[1]["tags"] == "retro"
