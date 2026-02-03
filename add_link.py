#!/usr/bin/env python3
"""Add a link to trove.jsonl from the command line."""

import argparse
import re
import subprocess
import urllib.request
import urllib.error

from trove_utils import TROVE_FILE, load_trove, save_trove, create_link_entry


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
    """Commit trove.jsonl with a descriptive message."""
    msg = f"Add link: {title or url}"
    try:
        subprocess.run(["git", "add", str(TROVE_FILE)], check=True, cwd=TROVE_FILE.parent)
        subprocess.run(["git", "commit", "-m", msg], check=True, cwd=TROVE_FILE.parent)
        print(f"Committed: {msg}")
    except subprocess.CalledProcessError as e:
        print(f"Warning: Git commit failed: {e}")


def add_link(url, title=None, tags=None, notes=None, no_archive=False, no_commit=False):
    # Auto-fetch title if not provided
    if not title:
        print(f"Fetching title from {url}...")
        title = fetch_title(url)
        if title:
            print(f"Found title: {title}")

    links = load_trove()
    link = create_link_entry(url, title, tags, notes)
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
    parser = argparse.ArgumentParser(description="Add a link to trove.jsonl")
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
