#!/usr/bin/env python3
"""Generate tags.jsonl from trove-log.jsonl and TAGS.md.

Collects unique tags from the log, merges descriptions from TAGS.md
and set_tag_desc ops. Outputs one JSON object per line to stdout,
sorted alphabetically by tag name.
"""

import json
import re
import sys
from pathlib import Path
from trove_utils import TROVE_FILE

TAGS_MD = Path("TAGS.md")


def parse_tags_md():
    """Parse tag descriptions from the TAGS.md markdown table."""
    descriptions = {}
    if not TAGS_MD.exists():
        return descriptions
    for line in TAGS_MD.read_text().split("\n"):
        m = re.match(r'^\|\s*(\S+)\s*\|\s*(.+?)\s*\|$', line)
        if m and m.group(1) not in ("Tag", "-----", "---"):
            descriptions[m.group(1)] = m.group(2).strip()
    return descriptions


def generate_tags(trove_path=None):
    path = trove_path or TROVE_FILE
    tags = set()
    descriptions = parse_tags_md()

    for line in path.read_text().strip().split('\n'):
        if not line:
            continue
        entry = json.loads(line)
        op = entry.get("op", "add")

        if op == "set_tag_desc":
            tag = entry.get("tag", "")
            desc = entry.get("description", "")
            if tag:
                descriptions[tag] = desc
        elif op in ("add", "add_tag"):
            for t in entry.get("tags", "").split():
                if t:
                    tags.add(t)
        elif op == "rename_tag":
            for t in entry.get("add_tags", "").split():
                if t:
                    tags.add(t)

    for tag in sorted(tags):
        obj = {"tag": tag}
        desc = descriptions.get(tag, "")
        if desc:
            obj["description"] = desc
        sys.stdout.write(json.dumps(obj) + '\n')


if __name__ == "__main__":
    generate_tags()
