#!/usr/bin/env python3
"""Deduplicate trove.jsonl by merging entries per URL in chronological order.

Treats trove.jsonl as an append-only operation log. Each entry has an optional
'op' field (default: 'add'). Merge rules per URL:

- Tags: union of all add/add_tag tags, minus remove_tag tags
- Title: last add's title, unless a later set_title exists (sticky)
- Notes: concatenated from all adds (prefixed with "username: " when
  submitted_by is present); set_notes replaces accumulated notes
- Other fields (duration, channel, thumbnail): last-write-wins from adds
- added: earliest timestamp

CLI: python3 dedup_trove.py <input> <output>
"""

import sys
from pathlib import Path

from trove_utils import load_trove, save_trove


def dedup(entries):
    """Merge a list of operation entries into deduplicated links.

    Args:
        entries: List of dicts from trove.jsonl (chronological order assumed).

    Returns:
        List of merged link dicts, one per unique URL, sorted by earliest added.
    """
    # Per-URL state, keyed by url
    merged = {}  # url -> dict of merged fields
    url_order = []  # track insertion order

    for entry in entries:
        op = entry.get("op", "add")

        # rename_tag is a bulk operation across multiple URLs
        if op == "rename_tag":
            remove_tag = entry.get("remove_tag", "")
            add_tags = entry.get("add_tags", "").split()
            target_urls = set(entry.get("urls", "").split())
            for url in target_urls:
                if url not in merged:
                    continue
                state = merged[url]
                if remove_tag in state["tags"]:
                    state["tags"].discard(remove_tag)
                    state["tags"].update(add_tags)
            continue

        url = entry.get("url")
        if not url:
            continue

        if url not in merged:
            merged[url] = {
                "tags": set(),
                "title": None,
                "title_sticky": False,
                "notes_parts": [],
                "added": entry.get("added", ""),
                "duration": None,
                "channel": None,
                "thumbnail": None,
            }
            url_order.append(url)

        state = merged[url]

        # Track earliest added timestamp
        entry_added = entry.get("added", "")
        if entry_added and (not state["added"] or entry_added < state["added"]):
            state["added"] = entry_added

        if op == "add":
            # Tags: union
            for t in entry.get("tags", "").split():
                if t:
                    state["tags"].add(t)

            # Title: last add wins, unless sticky set_title exists
            if entry.get("title") and not state["title_sticky"]:
                state["title"] = entry["title"]

            # Notes: accumulate
            note = entry.get("notes", "")
            if note:
                submitter = entry.get("submitted_by")
                if submitter:
                    state["notes_parts"].append(f"{submitter}: {note}")
                else:
                    state["notes_parts"].append(note)

            # Last-write-wins fields
            for field in ("duration", "channel", "thumbnail"):
                if entry.get(field):
                    state[field] = entry[field]

        elif op == "set_title":
            if entry.get("title"):
                state["title"] = entry["title"]
                state["title_sticky"] = True

        elif op == "set_notes":
            # Replace all accumulated notes
            note = entry.get("notes", "")
            submitter = entry.get("submitted_by")
            if submitter and note:
                state["notes_parts"] = [f"{submitter}: {note}"]
            else:
                state["notes_parts"] = [note] if note else []

        elif op == "add_tag":
            for t in entry.get("tags", "").split():
                if t:
                    state["tags"].add(t)

        elif op == "remove_tag":
            for t in entry.get("tags", "").split():
                state["tags"].discard(t)

    # Build output links
    result = []
    for url in url_order:
        state = merged[url]
        link = {"url": url, "added": state["added"]}
        if state["title"]:
            link["title"] = state["title"]
        tags = " ".join(sorted(state["tags"]))
        if tags:
            link["tags"] = tags
        notes = "\n".join(state["notes_parts"])
        if notes:
            link["notes"] = notes
        for field in ("duration", "channel", "thumbnail"):
            if state[field]:
                link[field] = state[field]
        result.append(link)

    return result


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 dedup_trove.py <input> <output>", file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    entries = load_trove(input_path)
    links = dedup(entries)
    save_trove(links, output_path)
    print(f"Deduplicated {len(entries)} entries → {len(links)} links → {output_path}")


if __name__ == "__main__":
    main()
