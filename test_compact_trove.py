"""Tests for compact_trove.py."""

from unittest.mock import patch, MagicMock
from compact_trove import strip_tracking_params, compact, check_link, health_check, archive_fallback


# --- strip_tracking_params ---

def test_strip_utm_params():
    url = "https://example.com/page?utm_source=twitter&utm_medium=social&id=42"
    assert strip_tracking_params(url) == "https://example.com/page?id=42"


def test_strip_fbclid():
    url = "https://example.com/?fbclid=abc123"
    assert strip_tracking_params(url) == "https://example.com/"


def test_strip_multiple_trackers():
    url = "https://example.com/?gclid=x&msclkid=y&_ga=z&real=1"
    assert strip_tracking_params(url) == "https://example.com/?real=1"


def test_strip_preserves_ref():
    url = "https://github.com/foo/bar?ref=main"
    assert strip_tracking_params(url) == "https://github.com/foo/bar?ref=main"


def test_strip_no_query():
    url = "https://example.com/page"
    assert strip_tracking_params(url) == "https://example.com/page"


def test_strip_removes_empty_query():
    url = "https://example.com/?utm_source=twitter"
    assert strip_tracking_params(url) == "https://example.com/"


def test_strip_preserves_fragment():
    url = "https://example.com/page?utm_source=x#section"
    assert strip_tracking_params(url) == "https://example.com/page#section"


def test_strip_unknown_utm_variant():
    """Any utm_* param should be stripped, not just the known ones."""
    url = "https://example.com/?utm_foo=bar&keep=1"
    assert strip_tracking_params(url) == "https://example.com/?keep=1"


# --- compact ---

def test_compact_merges_ops():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games"},
        {"url": "https://a.com", "added": "2025-01-02", "tags": "retro"},
    ]
    result = compact(entries)
    assert len(result) == 1
    assert "games" in result[0]["tags"]
    assert "retro" in result[0]["tags"]


def test_compact_drops_deleted():
    entries = [
        {"url": "https://a.com", "added": "2025-01-01", "tags": "games"},
        {"op": "delete", "url": "https://a.com", "added": "2025-01-02"},
    ]
    result = compact(entries)
    assert len(result) == 0


def test_compact_strips_urls_before_merge():
    """Two entries with same URL but one has tracking params should merge."""
    entries = [
        {"url": "https://a.com/page", "added": "2025-01-01", "tags": "games"},
        {"url": "https://a.com/page?utm_source=twitter", "added": "2025-01-02", "tags": "retro"},
    ]
    result = compact(entries)
    assert len(result) == 1
    assert result[0]["url"] == "https://a.com/page"
    assert "games" in result[0]["tags"]
    assert "retro" in result[0]["tags"]


def test_compact_idempotent():
    """Running compact twice should produce the same result."""
    entries = [
        {"url": "https://a.com?utm_source=x", "added": "2025-01-01", "tags": "games"},
        {"url": "https://b.com", "added": "2025-01-02", "tags": "tools"},
    ]
    result1 = compact(entries)
    # Convert back to entries (as if re-read from file)
    result2 = compact(list(result1))
    assert result1 == result2


# --- check_link (mocked) ---

def test_check_link_head_success():
    with patch("compact_trove.urllib.request.urlopen") as mock_open:
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_open.return_value = mock_resp
        status, alive = check_link("https://example.com")
        assert alive is True
        assert status == 200


def test_check_link_dead():
    with patch("compact_trove.urllib.request.urlopen") as mock_open:
        mock_open.side_effect = urllib_error(404)
        status, alive = check_link("https://example.com")
        assert alive is False
        assert status == 404


def test_check_link_head_405_falls_back_to_get():
    """When HEAD returns 405, should retry with GET."""
    call_count = [0]

    def side_effect(req, **kwargs):
        call_count[0] += 1
        if call_count[0] == 1:
            raise urllib_error(405)
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        return mock_resp

    with patch("compact_trove.urllib.request.urlopen", side_effect=side_effect):
        status, alive = check_link("https://example.com")
        assert alive is True
        assert status == 200


# --- health_check (mocked) ---

def test_health_check_skips_recent():
    from datetime import datetime, timezone
    links = [{"url": "https://a.com"}]
    check_log = {
        "https://a.com": {
            "url": "https://a.com",
            "last_checked": datetime.now(timezone.utc).isoformat(),
            "status_code": 200,
            "alive": True,
        }
    }
    with patch("compact_trove.check_link") as mock_check:
        health_check(links, check_log)
        mock_check.assert_not_called()


# --- archive_fallback (mocked) ---

def test_archive_fallback_adds_url():
    links = [{"url": "https://dead.com"}]
    check_log = {"https://dead.com": {"url": "https://dead.com", "alive": False}}
    archive_response = {
        "archived_snapshots": {
            "closest": {"available": True, "url": "https://web.archive.org/web/2024/https://dead.com"}
        }
    }

    with patch("compact_trove.urllib.request.urlopen") as mock_open:
        mock_resp = MagicMock()
        mock_resp.read.return_value = __import__("json").dumps(archive_response).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_open.return_value = mock_resp

        with patch("compact_trove.time.sleep"):
            archive_fallback(links, check_log)

    assert links[0]["archive_url"] == "https://web.archive.org/web/2024/https://dead.com"


def test_archive_fallback_skips_alive():
    links = [{"url": "https://alive.com"}]
    check_log = {"https://alive.com": {"url": "https://alive.com", "alive": True}}
    with patch("compact_trove.urllib.request.urlopen") as mock_open:
        archive_fallback(links, check_log)
        mock_open.assert_not_called()


# --- helpers ---

def urllib_error(code):
    """Create a urllib HTTPError with given status code."""
    import urllib.error
    return urllib.error.HTTPError(
        url="https://example.com", code=code, msg="", hdrs=None, fp=None
    )
