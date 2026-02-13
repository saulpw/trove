"""Tests for dedup_trove.py merge logic."""

from dedup_trove import dedup


def test_single_add():
    entries = [{"url": "https://a.com", "added": "2025-01-01", "title": "A", "tags": "games"}]
    result = dedup(entries)
    assert len(result) == 1
    assert result[0] == {"url": "https://a.com", "added": "2025-01-01", "title": "A", "tags": "games"}


def test_duplicate_adds_union_tags():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"},
        {"url": "https://a.com", "added": "2025-01-02", "tags": "retro free"},
    ]
    result = dedup(entries)
    assert len(result) == 1
    assert result[0]["tags"] == "free games retro"


def test_duplicate_adds_earliest_timestamp():
    entries = [
        {"url": "https://a.com", "added": "2025-01-05"},
        {"url": "https://a.com", "added": "2025-01-01"},
    ]
    result = dedup(entries)
    assert result[0]["added"] == "2025-01-01"


def test_duplicate_adds_last_title_wins():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "title": "First"},
        {"url": "https://a.com", "added": "2025-01-02", "title": "Second"},
    ]
    result = dedup(entries)
    assert result[0]["title"] == "Second"


def test_set_title_sticky():
    """set_title should not be overwritten by a later add."""
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "title": "Auto Title"},
        {"op": "set_title", "url": "https://a.com", "added": "2025-01-02", "title": "Manual Title"},
        {"url": "https://a.com", "added": "2025-01-03", "title": "New Auto Title"},
    ]
    result = dedup(entries)
    assert result[0]["title"] == "Manual Title"


def test_notes_combined():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "notes": "first note"},
        {"url": "https://a.com", "added": "2025-01-02", "notes": "second note"},
    ]
    result = dedup(entries)
    assert result[0]["notes"] == "first note\nsecond note"


def test_notes_with_submitted_by():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "notes": "no user"},
        {"url": "https://a.com", "added": "2025-01-02", "notes": "with user", "submitted_by": "alice"},
    ]
    result = dedup(entries)
    assert result[0]["notes"] == "no user\nalice: with user"


def test_set_notes_replaces():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "notes": "old note"},
        {"op": "set_notes", "url": "https://a.com", "added": "2025-01-02", "notes": "replacement"},
    ]
    result = dedup(entries)
    assert result[0]["notes"] == "replacement"


def test_add_tag():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games"},
        {"op": "add_tag", "url": "https://a.com", "added": "2025-01-02", "tags": "retro free"},
    ]
    result = dedup(entries)
    assert result[0]["tags"] == "free games retro"


def test_remove_tag():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games retro free"},
        {"op": "remove_tag", "url": "https://a.com", "added": "2025-01-02", "tags": "retro"},
    ]
    result = dedup(entries)
    assert result[0]["tags"] == "free games"


def test_rename_tag():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"},
        {"url": "https://b.com", "added": "2025-01-01", "tags": "retro music"},
        {"op": "rename_tag", "added": "2025-01-02", "remove_tag": "retro",
         "add_tags": "classic vintage", "urls": "https://a.com https://b.com"},
    ]
    result = dedup(entries)
    a = next(r for r in result if r["url"] == "https://a.com")
    b = next(r for r in result if r["url"] == "https://b.com")
    assert a["tags"] == "classic games vintage"
    assert b["tags"] == "classic music vintage"


def test_rename_tag_ignores_unknown_urls():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"},
        {"op": "rename_tag", "added": "2025-01-02", "remove_tag": "retro",
         "add_tags": "classic", "urls": "https://unknown.com"},
    ]
    result = dedup(entries)
    assert result[0]["tags"] == "games retro"


def test_last_write_wins_for_media_fields():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "duration": "3:00", "channel": "OldChan"},
        {"url": "https://a.com", "added": "2025-01-02", "duration": "5:00", "channel": "NewChan", "thumbnail": "http://img.jpg"},
    ]
    result = dedup(entries)
    assert result[0]["duration"] == "5:00"
    assert result[0]["channel"] == "NewChan"
    assert result[0]["thumbnail"] == "http://img.jpg"


def test_preserves_url_order():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01"},
        {"url": "https://b.com", "added": "2025-01-02"},
        {"url": "https://a.com", "added": "2025-01-03"},
    ]
    result = dedup(entries)
    assert [r["url"] for r in result] == ["https://a.com", "https://b.com"]


def test_add_without_op_field():
    """Entries without op field should be treated as add."""
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "title": "A", "tags": "foo"},
    ]
    result = dedup(entries)
    assert result[0]["title"] == "A"
    assert result[0]["tags"] == "foo"


def test_empty_input():
    assert dedup([]) == []
