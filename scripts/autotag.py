#!/usr/bin/env python3
"""Auto-tag untagged links using AI.

Finds links with fewest tags, fetches the page, extracts text,
and asks claude to suggest tags, clean title, and notes.

Usage:
    python3 autotag.py           # tag one link
    python3 autotag.py --count 5 # tag up to 5 links
"""

import hashlib
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from trove_utils import TROVE_FILE, create_link_entry

BUILDDIR = Path("_build")
TAGS_FILE = BUILDDIR / "tags.jsonl"
TROVE_BUILT = BUILDDIR / "trove.jsonl"
PAGE_CACHE = Path(".meta/page-cache")
SKIP_LOG = Path(".meta/autotag-skips.jsonl")

TAG_RULES = """Tags are short, atomic, lowercase words. Each tag is a URL path segment, so brevity matters.

Rules:
- Short tags: `oss` not `open-source`, `dev` not `software-dev`
- Atomic tags: one word per tag. Compose meaning with multiple tags: `board game` not `boardgame`
- No hyphens unless unavoidable
- Singular = specific instance: `game` is a game you can play, `video` is a specific video
- Plural = category/platform/collection: `games` is a game platform or industry, `videos` is a channel
- Novel tags welcome when they add real signal"""


def load_tag_vocab():
    """Load tag vocabulary from built tags.jsonl."""
    tags = []
    for line in TAGS_FILE.read_text().strip().split("\n"):
        if line:
            obj = json.loads(line)
            tag = obj["tag"]
            desc = obj.get("description", "")
            tags.append(f"{tag}" + (f" — {desc}" if desc else ""))
    return "\n".join(tags)


class TextExtractor(HTMLParser):
    """Extract readable text and meta descriptions from HTML."""
    SKIP_TAGS = {"script", "style", "nav", "header", "footer", "noscript", "svg"}

    def __init__(self):
        super().__init__()
        self.text = []
        self.meta = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
        if tag == "meta":
            a = dict(attrs)
            name = a.get("name", "").lower()
            prop = a.get("property", "").lower()
            content = a.get("content", "").strip()
            if content and (name == "description" or prop in
                           ("og:description", "og:title", "twitter:description")):
                self.meta.append(content)

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


def cache_key(url):
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def get_page_text(url):
    """Get page text from cache, or fetch and cache it."""
    if PAGE_CACHE.is_dir():
        cached = PAGE_CACHE / cache_key(url)
        if cached.exists():
            return cached.read_text() or None

    text = fetch_page_text(url)

    if PAGE_CACHE.is_dir() and text and text != "not_html":
        (PAGE_CACHE / cache_key(url)).write_text(text)

    return text


def fetch_page_text(url):
    """Fetch URL and extract plain text from HTML."""
    # Skip non-HTML content (PDFs, images, etc.)
    try:
        head = subprocess.run(
            ["curl", "-sI", "--max-time", "5", "-A",
             "Mozilla/5.0 (compatible; trove-autotag/1.0)", url],
            capture_output=True, text=True, timeout=10
        )
        content_type = ""
        for line in head.stdout.split("\n"):
            if line.lower().startswith("content-type:"):
                content_type = line.split(":", 1)[1].strip().lower()
        if content_type and "html" not in content_type and "text" not in content_type:
            return "not_html"
    except (subprocess.TimeoutExpired, Exception):
        pass

    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "15", "-A",
             "Mozilla/5.0 (compatible; trove-autotag/1.0)", url],
            capture_output=True, timeout=20
        )
        if result.returncode != 0:
            return None
        html = result.stdout.decode("utf-8", errors="replace")
    except (subprocess.TimeoutExpired, Exception):
        return None

    extractor = TextExtractor()
    try:
        extractor.feed(html)
    except Exception:
        return None

    body = "\n".join(extractor.text)
    meta = "\n".join(extractor.meta)
    # Reject junk pages (Cloudflare challenges, login walls, etc.)
    junk = ["attention required", "just a moment", "access denied",
            "please verify", "enable javascript", "checking your browser"]
    check = (body[:500] + " " + meta).lower()
    if any(phrase in check for phrase in junk):
        return None
    # Need either substantial body text or meta descriptions
    if len(body) < 100 and not meta:
        return None
    text = (meta + "\n\n" + body).strip() if meta else body
    if len(text) > 4000:
        text = text[:4000] + "\n[truncated]"
    return text


def ask_claude(url, title, notes, page_text, tag_vocab):
    """Ask claude to suggest tags, cleaned title, and notes for a link."""
    prompt = f"""You are tagging a link for a curated link collection (trove.saul.pw).

{TAG_RULES}

Existing tags:
{tag_vocab}

---

Respond with EXACTLY three lines:
Line 1 (tags): space-separated tags (typically 2-5). Use SINGULAR if this link IS a thing, PLURAL if it's a collection of things, or ABOUT a category.
Line 2 (title): the cleaned-up title. Remove platform suffixes like "- YouTube", "| Reddit", "on Vimeo", etc. Keep blog name/author/channel if it's part of the title (e.g. "My Post - John's Blog" is fine). If the title does not reflect the content, offer a better title.  Return the original title if it's already clean and accurate.
Line 3 (notes): a brief description (5-20 words). Do not duplicate the title. Write NONE if the notes are sufficient.

URL: {url}
Title: {title or "(none)"}
Notes: {notes or "(none)"}

Page content:
{page_text}"""

    try:
        result = subprocess.run(
            ["claude", "--print", "--model", "haiku", "-p", prompt],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            print(f"  claude error: {result.stderr.strip()}", file=sys.stderr)
            return None, None, None
        lines = result.stdout.strip().split("\n")
        tags = lines[0].strip().lower() if lines else ""
        tags = re.sub(r"[^a-z0-9!\$\s]", "", tags)
        tags = " ".join(tags.split())
        # Reject if Claude returned prose instead of tags
        if not tags or len(tags.split()) > 8 or any(len(t) > 20 for t in tags.split()):
            return None, None, None
        new_title = lines[1].strip() if len(lines) > 1 else ""
        suggested_notes = lines[2].strip() if len(lines) > 2 else ""
        if suggested_notes.upper() == "NONE":
            suggested_notes = ""
        return tags, new_title, suggested_notes
    except (subprocess.TimeoutExpired, Exception) as e:
        print(f"  claude error: {e}", file=sys.stderr)
        return None, None, None


def log_skip(url, title, reason):
    """Append a skip record to the skip log."""
    if not SKIP_LOG.parent.is_dir():
        return
    from datetime import datetime, timezone
    record = {"url": url, "title": title, "reason": reason,
              "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    with open(SKIP_LOG, "a") as f:
        f.write(json.dumps(record) + "\n")


def find_least_tagged():
    """Return all links sorted by tag count (fewest first), shuffled within tiers."""
    import random
    links = []
    for line in TROVE_BUILT.read_text().strip().split("\n"):
        if not line:
            continue
        entry = json.loads(line)
        tag_count = len(entry.get("tags", "").split()) if entry.get("tags", "").strip() else 0
        links.append((tag_count, entry))

    if not links:
        return []

    # Group by tag count, shuffle within each tier, return in order
    from itertools import groupby
    links.sort(key=lambda x: x[0])
    result = []
    for _, group in groupby(links, key=lambda x: x[0]):
        tier = [entry for _, entry in group]
        random.shuffle(tier)
        result.extend(tier)
    return result


def main():
    count = 1
    if "--count" in sys.argv:
        idx = sys.argv.index("--count")
        count = int(sys.argv[idx + 1])

    if not TROVE_BUILT.exists() or not TAGS_FILE.exists():
        print(f"Error: {BUILDDIR}/ not found. Run 'make build' first.")
        raise SystemExit(1)

    candidates = find_least_tagged()

    if not candidates:
        print("No links found.")
        return

    tag_vocab = load_tag_vocab()
    print(f"Processing up to {count} of {len(candidates)} links (fewest tags first).\n")

    tagged_count = 0
    for entry in candidates:
        if tagged_count >= count:
            break

        url = entry.get("url", "")
        title = entry.get("title", "")
        notes = entry.get("notes", "")
        print(f"--- {title or url}")
        print(f"  {url}")

        page_text = get_page_text(url)
        if page_text == "not_html":
            print("  not HTML, skipping")
            log_skip(url, title, "not_html")
            continue
        if not page_text:
            print("  could not fetch page, skipping")
            log_skip(url, title, "fetch_failed")
            continue

        tags, new_title, suggested_notes = ask_claude(url, title, notes, page_text, tag_vocab)
        if not tags:
            print("  no tags returned, skipping")
            log_skip(url, title, "bad_claude_response")
            continue

        print(f"  tags: {tags}")
        add_notes = suggested_notes if suggested_notes and not notes else None
        add_title = new_title if new_title and new_title != title else None
        if add_title:
            print(f"  title: {title} -> {add_title}")
        if add_notes:
            print(f"  notes: {add_notes}")

        entry = create_link_entry(url, tags=tags, title=add_title,
                                  notes=add_notes, submitted_by="haiku")
        with open(TROVE_FILE, "a") as f:
            f.write(json.dumps(entry) + "\n")

        tagged_count += 1
        print()

    print(f"Tagged {tagged_count} links.")


if __name__ == "__main__":
    main()
