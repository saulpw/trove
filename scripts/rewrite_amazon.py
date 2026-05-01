#!/usr/bin/env python3
"""Rewrite Amazon book/media URLs to OpenLibrary.

Scans trove-log.jsonl for Amazon product URLs, extracts ISBN,
verifies it exists on OpenLibrary, and rewrites the URL in-place.

Usage:
    python3 rewrite_amazon.py           # preview changes
    python3 rewrite_amazon.py --apply   # rewrite the log
"""

import re
import sys
import time
import urllib.request
import urllib.error

from trove_utils import TROVE_FILE, load_trove, save_trove

AMAZON_RE = re.compile(r'https?://(?:www\.)?amazon\.com/(?:.*/)?dp/(\w{10})')


def extract_asin(url):
    """Extract ASIN from an Amazon product URL."""
    m = AMAZON_RE.search(url)
    return m.group(1) if m else None


def check_openlibrary(isbn):
    """Check if ISBN exists on OpenLibrary. Returns canonical URL or None."""
    url = f"https://openlibrary.org/isbn/{isbn}.json"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return f"https://openlibrary.org/isbn/{isbn}"
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        pass
    return None


def main():
    apply = "--apply" in sys.argv

    entries = load_trove()
    rewrites = []

    for i, entry in enumerate(entries):
        url = entry.get("url", "")
        asin = extract_asin(url)
        if not asin:
            continue

        title = entry.get("title", "")
        print(f"  {title or url}")
        print(f"    asin: {asin}")

        new_url = check_openlibrary(asin)
        if new_url:
            print(f"    -> {new_url}")
            rewrites.append((i, new_url))
        else:
            print(f"    not found on OpenLibrary")
        time.sleep(1)

    print(f"\n{len(rewrites)} URLs to rewrite")

    if not rewrites:
        return

    if not apply:
        print("(dry run, use --apply to rewrite)")
        return

    for i, new_url in rewrites:
        entries[i]["url"] = new_url

    save_trove(entries)
    print(f"Rewrote {len(rewrites)} URLs in {TROVE_FILE}")


if __name__ == "__main__":
    main()
