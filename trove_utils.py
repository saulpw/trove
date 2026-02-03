#!/usr/bin/env python3
"""Shared utilities for trove link management."""

import json
from datetime import datetime, timezone
from pathlib import Path

TROVE_FILE = Path(__file__).parent / "trove.jsonl"


def load_trove(trove_path=None):
    """Load all links from JSONL file."""
    path = trove_path or TROVE_FILE
    links = []
    if path.exists():
        for line in path.read_text().strip().split('\n'):
            if line:
                links.append(json.loads(line))
    return links


def save_trove(links, trove_path=None):
    """Save all links to JSONL file (one JSON object per line)."""
    path = trove_path or TROVE_FILE
    with open(path, 'w') as f:
        for link in links:
            f.write(json.dumps(link) + '\n')


def create_link_entry(url, title=None, tags=None, notes=None, added=None):
    """Create a link entry dict with optional fields.

    Args:
        url: The URL (required)
        title: Page title (optional)
        tags: Space-separated tag string or list of tags (optional)
        notes: Notes about the link (optional)
        added: ISO timestamp string (defaults to now)

    Returns:
        dict with url, added, and any provided optional fields
    """
    link = {
        "url": url,
        "added": added or datetime.now(timezone.utc).isoformat(),
    }
    if title:
        link["title"] = title
    if tags:
        # Accept either a list or space-separated string
        if isinstance(tags, list):
            link["tags"] = " ".join(tags)
        else:
            link["tags"] = tags
    if notes:
        link["notes"] = notes
    return link
