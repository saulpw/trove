#!/usr/bin/env python3
"""Auto-tag untagged links using AI.

Finds the link with fewest tags (0 first), fetches the page, extracts text,
and asks claude to suggest tags based on the existing tag vocabulary.

Usage:
    python3 autotag.py           # tag one untagged link
    python3 autotag.py --count 5 # tag up to 5 links
"""

import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from trove_utils import TROVE_FILE, load_trove, create_link_entry


def get_tags_md():
    """Read TAGS.md content."""
    return (Path(__file__).parent / "TAGS.md").read_text()


class TextExtractor(HTMLParser):
    """Extract readable text from HTML, skipping script/style/nav."""
    SKIP_TAGS = {"script", "style", "nav", "header", "footer", "noscript", "svg"}

    def __init__(self):
        super().__init__()
        self.text = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)

    def handle_data(self, data):
        if self.skip_depth == 0:
            text = data.strip()
            if text:
                self.text.append(text)

    def get_text(self):
        return "\n".join(self.text)


def fetch_page_text(url):
    """Fetch URL and extract plain text from HTML."""
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "15", "-A",
             "Mozilla/5.0 (compatible; trove-autotag/1.0)", url],
            capture_output=True, text=True, timeout=20
        )
        if result.returncode != 0:
            return None
        html = result.stdout
    except (subprocess.TimeoutExpired, Exception):
        return None

    extractor = TextExtractor()
    try:
        extractor.feed(html)
    except Exception:
        return None

    text = extractor.get_text()
    # Truncate to ~4000 chars to keep prompt reasonable
    if len(text) > 4000:
        text = text[:4000] + "\n[truncated]"
    return text


def ask_claude_for_tags(url, title, notes, page_text, tags_md):
    """Ask claude to suggest tags for a link."""
    prompt = f"""You are tagging a link for a curated link collection (trove.saul.pw).

{tags_md}

---

Tag this link. Return ONLY a space-separated list of tags, nothing else. Typically 2-5 tags.
Key: if this link IS a thing (a game, a video, an essay), use the SINGULAR tag. If it's ABOUT a category or is a collection/platform, use PLURAL.

URL: {url}
Title: {title or "(none)"}
Notes: {notes or "(none)"}

Page content:
{page_text or "(could not fetch)"}"""

    try:
        result = subprocess.run(
            ["claude", "--print", "--model", "haiku", "-p", prompt],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            print(f"  claude error: {result.stderr.strip()}", file=sys.stderr)
            return None
        tags = result.stdout.strip().lower()
        # Clean up: remove punctuation, extra whitespace
        tags = re.sub(r"[^a-z0-9!\$\s]", "", tags)
        tags = " ".join(tags.split())
        return tags
    except (subprocess.TimeoutExpired, Exception) as e:
        print(f"  claude error: {e}", file=sys.stderr)
        return None


def find_untagged_links(entries):
    """Find entries with no tags, sorted by date (oldest first)."""
    untagged = []
    for i, entry in enumerate(entries):
        op = entry.get("op")
        if op and op != "add":
            continue
        tags = entry.get("tags", "").strip()
        if not tags:
            untagged.append((i, entry))
    return untagged


def main():
    count = 1
    if "--count" in sys.argv:
        idx = sys.argv.index("--count")
        count = int(sys.argv[idx + 1])

    entries = load_trove()
    untagged = find_untagged_links(entries)

    if not untagged:
        print("No untagged links found.")
        return

    tags_md = get_tags_md()
    print(f"Found {len(untagged)} untagged links, processing up to {count}.\n")

    tagged_count = 0
    for _, entry in untagged[:count]:
        url = entry.get("url", "")
        title = entry.get("title", "")
        notes = entry.get("notes", "")
        print(f"--- {title or url}")

        page_text = fetch_page_text(url)
        if page_text:
            print(f"  fetched {len(page_text)} chars")
        else:
            print("  could not fetch page")

        tags = ask_claude_for_tags(url, title, notes, page_text, tags_md)
        if not tags:
            print("  no tags returned, skipping")
            continue

        print(f"  tags: {tags}")

        # Write add_tag ops to the log
        new_entry = create_link_entry(url, op="add_tag", tags=tags,
                                      submitted_by="haiku")
        with open(TROVE_FILE, "a") as f:
            f.write(json.dumps(new_entry) + "\n")

        tagged_count += 1
        print(f"  wrote add_tag op")
        print()

    print(f"Tagged {tagged_count}/{min(count, len(untagged))} links.")


if __name__ == "__main__":
    main()
