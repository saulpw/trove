#!/usr/bin/env python3
"""Add a link to trove-log.jsonl from the command line."""

import argparse
import json
import re
import subprocess
import urllib.request
import urllib.error

from trove_utils import TROVE_FILE, load_trove, save_trove, create_link_entry


def is_youtube_url(url):
    """Check if URL is a YouTube video link."""
    return bool(re.search(r'(youtube\.com/watch|youtu\.be/|youtube\.com/shorts/)', url))


def format_duration(seconds):
    """Format duration in seconds to human-readable string like '3:45' or '1:02:30'."""
    seconds = int(seconds)
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def fetch_youtube_metadata(url):
    """Fetch YouTube video metadata using yt-dlp. Returns dict with title, duration, channel, thumbnail."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-download", url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            print(f"Warning: yt-dlp failed: {result.stderr.strip()}")
            return {}
        data = json.loads(result.stdout)
        meta = {}
        if data.get("title"):
            meta["title"] = data["title"]
        if data.get("duration"):
            meta["duration"] = format_duration(data["duration"])
        if data.get("uploader"):
            meta["channel"] = data["uploader"]
        if data.get("thumbnail"):
            meta["thumbnail"] = data["thumbnail"]
        return meta
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not fetch YouTube metadata: {e}")
        return {}


def fetch_title(url):
    """Fetch page title from URL. Returns None on failure."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "trove-link-saver/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            # Read first 64KB - title should be near the top
            html = response.read(1024*1024).decode("utf-8", errors="ignore")
            match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"Warning: Could not fetch title: {e}")
    return None


def trigger_archive(url):
    """Request archive.org to snapshot the URL."""
    save_url = f"https://web.archive.org/save/{url}"
    try:
        req = urllib.request.Request(
            save_url,
            data=b"",  # POST request
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; trove-link-saver/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            print(f"Archive.org snapshot requested (status {response.status})")
    except urllib.error.HTTPError as e:
        print(f"Warning: Archive.org returned {e.code} (snapshot may still be queued)")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"Warning: Archive.org request failed: {e}")


def git_commit(url, title):
    """Commit trove-log.jsonl to the links branch (without checkout)."""
    msg = f"Add link: {title or url}"
    try:
        subprocess.run(
            ["make", "push-links", f"MSG={msg}"],
            check=True, cwd=TROVE_FILE.parent,
        )
        print(f"Committed to links branch: {msg}")
    except subprocess.CalledProcessError as e:
        print(f"Warning: Git commit failed: {e}")


def add_link(url, title=None, tags=None, notes=None, no_archive=False, no_commit=False):
    yt_meta = {}
    if is_youtube_url(url):
        print(f"Fetching YouTube metadata from {url}...")
        yt_meta = fetch_youtube_metadata(url)
        if not title and yt_meta.get("title"):
            title = yt_meta["title"]
            print(f"Found title: {title}")
    elif not title:
        print(f"Fetching title from {url}...")
        title = fetch_title(url)
        if title:
            print(f"Found title: {title}")

    links = load_trove()
    link = create_link_entry(url, title, tags, notes,
                             duration=yt_meta.get("duration"),
                             channel=yt_meta.get("channel"),
                             thumbnail=yt_meta.get("thumbnail"))
    links.append(link)
    save_trove(links)
    print(f"Added: {url}")

    # Trigger archive.org snapshot
    if not no_archive:
        trigger_archive(url)

    # Commit the change
    if not no_commit:
        git_commit(url, title)


def main():
    parser = argparse.ArgumentParser(description="Add a link to trove-log.jsonl")
    parser.add_argument("url", help="URL to add")
    parser.add_argument("tags", nargs="*", help="Tags for the link")
    parser.add_argument("-t", "--title", help="Title for the link (auto-fetched if omitted)")
    parser.add_argument("-n", "--notes", help="Notes for the link")
    parser.add_argument("--no-archive", action="store_true", help="Skip archive.org snapshot")
    parser.add_argument("--no-commit", action="store_true", help="Skip git commit")

    args = parser.parse_args()
    add_link(args.url, args.title, args.tags or None, args.notes, args.no_archive, args.no_commit)


if __name__ == "__main__":
    main()
