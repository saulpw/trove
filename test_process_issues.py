"""Tests for rename_tag processing in process_issues.py."""

from process_issues import rename_tag


def test_rename_single_url():
    links = [{"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"}]
    rename_tag(links, "retro", "classic", "https://a.com")
    assert links[0]["tags"] == "classic games"


def test_rename_to_multiple_tags():
    links = [{"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"}]
    rename_tag(links, "retro", "classic vintage", "https://a.com")
    assert links[0]["tags"] == "classic games vintage"


def test_rename_multiple_urls():
    links = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"},
        {"url": "https://b.com", "added": "2025-01-02", "tags": "retro music"},
    ]
    rename_tag(links, "retro", "classic", "https://a.com https://b.com")
    assert links[0]["tags"] == "classic games"
    assert links[1]["tags"] == "classic music"


def test_rename_nonexistent_tag():
    links = [{"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"}]
    rename_tag(links, "missing", "classic", "https://a.com")
    assert links[0]["tags"] == "games retro"


def test_rename_preserves_other_links():
    links = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games retro"},
        {"url": "https://b.com", "added": "2025-01-02", "tags": "retro music"},
    ]
    rename_tag(links, "retro", "classic", "https://a.com")
    assert links[0]["tags"] == "classic games"
    assert links[1]["tags"] == "retro music"
