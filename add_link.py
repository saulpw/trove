#!/usr/bin/env python3
"""Add a link to trove.json from the command line."""

import argparse
import json
from pathlib import Path
from datetime import datetime, timezone

TROVE_FILE = Path(__file__).parent / "trove.json"


def load_trove():
    if TROVE_FILE.exists():
        return json.loads(TROVE_FILE.read_text())
    return {"links": []}


def save_trove(data):
    TROVE_FILE.write_text(json.dumps(data, indent=2) + "\n")


def add_link(url, title=None, tags=None):
    data = load_trove()

    link = {
        "url": url,
        "added": datetime.now(timezone.utc).isoformat(),
    }
    if title:
        link["title"] = title
    if tags:
        link["tags"] = tags

    data["links"].append(link)
    save_trove(data)
    print(f"Added: {url}")


def main():
    parser = argparse.ArgumentParser(description="Add a link to trove.json")
    parser.add_argument("url", help="URL to add")
    parser.add_argument("-t", "--title", help="Title for the link")
    parser.add_argument("--tags", nargs="+", help="Tags for the link")

    args = parser.parse_args()
    add_link(args.url, args.title, args.tags)


if __name__ == "__main__":
    main()
