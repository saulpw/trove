"""Tests for process_issues.py parsing logic."""

from process_issues import parse_issue_body


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
