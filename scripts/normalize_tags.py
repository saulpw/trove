#!/usr/bin/env python3
"""Normalize tags in trove-log.jsonl according to TAGS.md conventions.

Applies mechanical renames, splits compound tags, deletes deprecated tags.
Run with --dry-run to preview changes without writing.
"""

import json
import sys
from pathlib import Path

TROVE_FILE = Path(__file__).parent / ".links" / "trove-log.jsonl"

# old tag -> new tag(s), space-separated for splits
RENAMES = {
    "open-source": "oss",
    "software-dev": "dev",
    "swdev": "dev",
    "computer-stuff": "computers",
    "computing": "computers",
    "terminals": "terminal",
    "actual-terminal": "terminal",
    "actual-software": "software",
    "lower-fi-software": "lofi software",
    "terminal-on-the-web": "terminal web",
    "terminal-software": "terminal software",
    "retro-computing-history": "retro history",
    "software-community": "dev community",
    "graphic-design": "design",
    "big-ideas": "ideas",
    "human-stuff": "human",
    "people": "person",
    "pointnclick": "adventure",
    "mechkb": "keyboard",
    "lo-fi": "lofi",
    "couch-co-op": "coop",
    "actionfps": "fps",
    "edugames": "edu game",
    "computergames": "computer game",
    "Kentucky-basketball": "kentucky basketball",
    "boardgames": "board games",
    "boardcard-games": "board game",  # default; per-link overrides below
    "classics": "classic",
    "videos": "video",
    "essays": "essay",
    "writing": "essay",
    "strategysim-games": "strategy sim",
    "mewanty": "$saul",
}

# Tags to remove entirely
DELETE = {"pr0n"}

# Per-link overrides: {title: {old_tag: "new tags"}}
PERLINK = {
    "CHEMISTRY SET": {"boardcard-games": "card game"},
}


def normalize_entry(entry):
    """Normalize tags on a single entry. Returns (entry, changes) where
    changes is a list of strings describing what changed, or empty if nothing."""
    raw = entry.get("tags", "")
    if not raw.strip():
        return entry, []

    old_tags = raw.split()
    title = entry.get("title", "")
    new_tags = []
    changes = []

    for tag in old_tags:
        if tag in DELETE:
            changes.append(f"  delete: {tag}")
            continue

        if title in PERLINK and tag in PERLINK[title]:
            replacement = PERLINK[title][tag]
        elif tag in RENAMES:
            replacement = RENAMES[tag]
        else:
            new_tags.append(tag)
            continue

        for nt in replacement.split():
            new_tags.append(nt)
        changes.append(f"  {tag} -> {replacement}")

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for t in new_tags:
        if t not in seen:
            seen.add(t)
            deduped.append(t)

    if deduped != old_tags:
        entry = dict(entry)
        entry["tags"] = " ".join(deduped)

    return entry, changes


def main():
    dry_run = "--dry-run" in sys.argv

    entries = []
    total_changes = 0
    for line in TROVE_FILE.read_text().strip().split("\n"):
        if not line:
            continue
        entry = json.loads(line)
        entry, changes = normalize_entry(entry)
        entries.append(entry)
        if changes:
            total_changes += 1
            title = entry.get("title", entry.get("url", "???"))[:60]
            print(f"{title}")
            for c in changes:
                print(c)

    print(f"\n{total_changes} entries modified")

    if dry_run:
        print("(dry run, no changes written)")
    else:
        with open(TROVE_FILE, "w") as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
        print(f"Wrote {len(entries)} entries to {TROVE_FILE}")


if __name__ == "__main__":
    main()
