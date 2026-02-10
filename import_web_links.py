#!/usr/bin/env python3
"""Bulk import links from a webpage into trove.jsonl.

Two-phase workflow:
  1. Extract: fetch a webpage, parse links, output a reviewable PSV file
  2. Import: read the reviewed PSV file and add entries to trove.jsonl
"""

import argparse
import urllib.request
from html.parser import HTMLParser

from trove_utils import load_trove, save_trove, create_link_entry, slugify
from add_link import trigger_archive, git_commit


SEPARATOR = " | "


class LinkExtractor(HTMLParser):
    """Parse HTML to extract links grouped by nearest preceding header."""

    def __init__(self):
        super().__init__()
        self.links = []  # list of (url, title, header_text, notes)
        self.current_header = ""
        self._in_header = False
        self._header_text = ""
        self._in_link = False
        self._link_href = ""
        self._link_text = ""
        self._in_li = False
        self._li_texts = []  # text segments in current <li>
        self._li_link = None  # (url, title) of link found in current <li>

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._in_header = True
            self._header_text = ""
        elif tag == "a":
            href = attrs_dict.get("href", "") or ""
            if href.startswith("http://") or href.startswith("https://"):
                self._in_link = True
                self._link_href = href
                self._link_text = ""
        elif tag == "li":
            self._in_li = True
            self._li_texts = []
            self._li_link = None

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self._in_header:
            self._in_header = False
            self.current_header = self._header_text.strip()
        elif tag == "a" and self._in_link:
            self._in_link = False
            title = self._link_text.strip()
            if self._in_li:
                self._li_link = (self._link_href, title)
            else:
                self.links.append((self._link_href, title, self.current_header, ""))
            self._link_href = ""
            self._link_text = ""
        elif tag == "li" and self._in_li:
            self._in_li = False
            if self._li_link:
                url, title = self._li_link
                # Build notes from non-link text in the <li>
                notes = " ".join(t.strip() for t in self._li_texts if t.strip())
                # Clean up leading/trailing punctuation
                notes = notes.strip(" \t\n\r-–—:,.")
                self.links.append((url, title, self.current_header, notes))
            self._li_link = None
            self._li_texts = []

    def handle_data(self, data):
        if self._in_header:
            self._header_text += data
        elif self._in_link:
            self._link_text += data
        elif self._in_li and not self._in_link:
            self._li_texts.append(data)


def fetch_page(url):
    """Fetch HTML content from a URL."""
    req = urllib.request.Request(url, headers={"User-Agent": "trove-link-saver/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8", errors="ignore")


def sanitize_field(text):
    """Strip pipe characters from a field value to avoid PSV ambiguity."""
    return text.replace("|", "").strip()


def extract(url, tags, output):
    """Extract links from a webpage and write to a PSV file."""
    print(f"Fetching {url}...")
    html = fetch_page(url)

    parser = LinkExtractor()
    parser.feed(html)

    print(f"Found {len(parser.links)} links")

    with open(output, "w") as f:
        f.write(f"url{SEPARATOR}title{SEPARATOR}tags{SEPARATOR}notes\n")
        for href, title, header, notes in parser.links:
            link_tags = list(tags)
            if header:
                header_tag = slugify(header)
                if header_tag and header_tag not in link_tags:
                    link_tags.append(header_tag)
            tag_str = " ".join(link_tags)
            f.write(f"{sanitize_field(href)}{SEPARATOR}{sanitize_field(title)}{SEPARATOR}{sanitize_field(tag_str)}{SEPARATOR}{sanitize_field(notes)}\n")

    print(f"Wrote {output}")


def do_import(filepath, no_archive, no_commit):
    """Import links from a PSV file into trove.jsonl."""
    links = load_trove()
    existing_urls = {link["url"] for link in links}
    added = 0
    skipped = 0

    with open(filepath) as f:
        lines = f.readlines()

    # Skip header row
    for line in lines[1:]:
        line = line.rstrip("\n\r")
        if not line.strip():
            continue

        parts = line.split(SEPARATOR)
        if len(parts) < 4:
            print(f"Skipping malformed line: {line[:80]}")
            continue

        url = parts[0].strip()
        title = parts[1].strip()
        tags = parts[2].strip()
        notes = parts[3].strip()

        if url in existing_urls:
            print(f"Duplicate, skipping: {url}")
            skipped += 1
            continue

        entry = create_link_entry(
            url,
            title=title or None,
            tags=tags or None,
            notes=notes or None,
        )
        links.append(entry)
        existing_urls.add(url)
        added += 1
        print(f"Added: {url}")

        if not no_archive:
            trigger_archive(url)

    if added:
        save_trove(links)
        print(f"\nAdded {added} links ({skipped} duplicates skipped)")

        if not no_commit:
            git_commit(filepath, f"Import {added} links from {filepath}")
    else:
        print(f"\nNo new links to add ({skipped} duplicates skipped)")


def main():
    parser = argparse.ArgumentParser(description="Bulk import links from a webpage")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Extract subcommand
    extract_parser = subparsers.add_parser("extract", help="Extract links from a webpage to a PSV file")
    extract_parser.add_argument("url", help="URL of the webpage to extract links from")
    extract_parser.add_argument("tags", nargs="*", help="Tags to apply to all extracted links")
    extract_parser.add_argument("-o", "--output", default="web_import.psv", help="Output PSV file (default: web_import.psv)")

    # Import subcommand
    import_parser = subparsers.add_parser("import", help="Import links from a PSV file into trove.jsonl")
    import_parser.add_argument("file", help="PSV file to import")
    import_parser.add_argument("--no-archive", action="store_true", help="Skip archive.org snapshots")
    import_parser.add_argument("--no-commit", action="store_true", help="Skip git commit")

    args = parser.parse_args()

    if args.command == "extract":
        extract(args.url, args.tags, args.output)
    elif args.command == "import":
        do_import(args.file, args.no_archive, args.no_commit)


if __name__ == "__main__":
    main()
