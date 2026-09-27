import json

import pytest

from compact_trove import compact
from dedup_trove import dedup
from process_issues import process_issue_list


URL = "https://example.com/artist"
AUTO = "https://example.com/auto.jpg"
MANUAL = "https://example.com/art.png"


@pytest.mark.parametrize("thumbnail", [MANUAL, ""])
def test_explicit_add_survives_readd_and_compaction(thumbnail):
    entries = [
        {"url": URL, "thumbnail": thumbnail, "thumbnail_explicit": True},
        {"url": URL, "thumbnail": AUTO},
        {"url": URL, "thumbnail": AUTO, "thumbnail_explicit": True},
    ]
    result = compact(entries)
    assert result[0]["thumbnail"] == thumbnail
    assert result[0]["thumbnail_explicit"] is True
    assert dedup(result + [{"url": URL, "thumbnail": AUTO}]) == result
    assert compact(result) == result


@pytest.mark.parametrize("thumbnail", [MANUAL, ""])
def test_thumbnail_only_edit_preserves_other_fields(thumbnail):
    original = {"url": URL, "title": "Artist", "tags": "person pixelart",
                "notes": "Portfolio", "added": "2026-01-01", "thumbnail": AUTO}
    result = compact([
        original,
        {"op": "set_thumbnail", "url": URL, "thumbnail": thumbnail,
         "added": "2026-02-01"},
        {"url": URL, "thumbnail": AUTO, "added": "2026-03-01"},
    ])
    assert result == [{**original, "thumbnail": thumbnail, "thumbnail_explicit": True}]
    assert dedup(result + [{"url": URL, "thumbnail": AUTO}]) == result
    replaced = dedup(result + [{"op": "set_thumbnail", "url": URL, "thumbnail": AUTO}])
    assert replaced[0]["thumbnail"] == AUTO


def test_omitted_thumbnail_is_not_a_clear():
    original = {"url": URL, "thumbnail": MANUAL, "thumbnail_explicit": True}
    result = dedup([original, {"url": URL}, {"url": URL, "op": "set_thumbnail"}])
    assert result[0]["thumbnail"] == MANUAL


@pytest.mark.parametrize("action", ["add", "set_thumbnail"])
@pytest.mark.parametrize("thumbnail", [MANUAL, ""])
def test_issue_processing_preserves_explicit_thumbnail(tmp_path, action, thumbnail):
    path = tmp_path / "links.jsonl"
    body = f"action: {action}\nurl: {URL}\nthumbnail: {thumbnail}\nsubmitted_by: alice"
    process_issue_list([{"number": 1, "body": body}], trove_path=path, local=True)
    entry = json.loads(path.read_text())
    assert entry["op"] == action
    assert entry["thumbnail"] == thumbnail
    assert entry["submitted_by"] == "alice"
    result = dedup([entry])
    assert result[0]["thumbnail"] == thumbnail
    assert result[0]["thumbnail_explicit"] is True


def test_issue_without_thumbnail_preserves_automatic_metadata(tmp_path, monkeypatch):
    path = tmp_path / "links.jsonl"
    monkeypatch.setattr("process_issues.is_youtube_url", lambda url: True)
    monkeypatch.setattr("process_issues.fetch_youtube_metadata", lambda url: {"thumbnail": AUTO})
    monkeypatch.setattr("process_issues.trigger_archive", lambda url: None)
    monkeypatch.setattr("process_issues.close_issue", lambda number: None)
    process_issue_list([{"number": 1, "body": f"url: {URL}"}], trove_path=path)
    entry = json.loads(path.read_text())
    assert entry["thumbnail"] == AUTO
    assert "thumbnail_explicit" not in entry
