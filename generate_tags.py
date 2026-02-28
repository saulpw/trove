#!/usr/bin/env python3
"""Generate tags.jsonl from trove-log.jsonl.

Reads all link entries to collect unique tags, and reads set_tag_desc ops
to collect latest descriptions. Outputs one JSON object per line, sorted
alphabetically by tag name.
"""

import json
from pathlib import Path
from trove_utils import TROVE_FILE


def generate_tags(trove_path=None):
    path = trove_path or TROVE_FILE
    tags = set()
    descriptions = {}

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

    out_path = Path(__file__).parent / "tags.jsonl"
    with open(out_path, 'w') as f:
        for tag in sorted(tags):
            obj = {"tag": tag}
            desc = descriptions.get(tag, "")
            if desc:
                obj["description"] = desc
            f.write(json.dumps(obj) + '\n')

    print(f"Generated {out_path} with {len(tags)} tags")


if __name__ == "__main__":
    generate_tags()
