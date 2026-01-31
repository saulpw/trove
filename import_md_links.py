#!/usr/bin/env python3
"""Import links from markdown files into trove.json."""

import json
import re
import sys
from pathlib import Path

def slugify(text):
    """Convert header text to tag slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return text.strip('-')

def parse_md_file(filepath):
    """Parse a markdown file and extract links with metadata."""
    links = []
    current_headers = []  # Stack of headers at different levels

    with open(filepath) as f:
        content = f.read()

    # Skip frontmatter
    if content.startswith('---'):
        _, _, content = content.split('---', 2)

    for line in content.split('\n'):
        line = line.strip()

        # Track headers (## or ###)
        header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if header_match:
            level = len(header_match.group(1))
            header_text = header_match.group(2)
            # Keep headers at this level or higher, replace lower
            current_headers = [(l, h) for l, h in current_headers if l < level]
            current_headers.append((level, slugify(header_text)))
            continue

        # Find markdown links: [title](url)
        link_match = re.search(r'\[([^\]]+)\]\(([^)]+)\)', line)
        if not link_match:
            continue

        title = link_match.group(1).strip()
        url = link_match.group(2).strip()

        # Skip invalid URLs
        if not url.startswith('http'):
            continue

        # Get text after the link as notes
        after_link = line[link_match.end():].strip()
        # Remove leading colon/punctuation
        after_link = re.sub(r'^[:\-\s]+', '', after_link).strip()

        # Extract inline hashtags from notes
        inline_tags = re.findall(r'#(\w+)', after_link)
        # Remove hashtags from notes
        notes = re.sub(r'\s*#\w+', '', after_link).strip()

        # Build tags from headers + inline hashtags
        tags = [h for _, h in current_headers if h]
        tags.extend([t.lower() for t in inline_tags])
        # Dedupe while preserving order
        seen = set()
        tags = [t for t in tags if not (t in seen or seen.add(t))]

        link_data = {
            'url': url,
            'title': title,
        }
        if notes:
            link_data['notes'] = notes
        if tags:
            link_data['tags'] = tags

        links.append(link_data)

    return links

def main():
    links_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'git/saul.pw/posts/links'
    trove_path = Path(__file__).parent / 'trove.jsonl'

    # Load existing trove (JSONL format)
    existing_links = []
    if trove_path.exists():
        for line in trove_path.read_text().strip().split('\n'):
            if line:
                existing_links.append(json.loads(line))

    existing_urls = {link['url'] for link in existing_links}

    # Parse all md files
    new_links = []
    for md_file in sorted(links_dir.glob('*.md')):
        print(f"Parsing {md_file.name}...")
        for link in parse_md_file(md_file):
            if link['url'] not in existing_urls:
                # Add timestamp based on filename (YYYY-MM.md)
                date_match = re.match(r'(\d{4})-(\d{2})\.md', md_file.name)
                if date_match:
                    year, month = date_match.groups()
                    link['added'] = f"{year}-{month}-15T12:00:00+00:00"
                new_links.append(link)
                existing_urls.add(link['url'])

    print(f"\nFound {len(new_links)} new links to add")

    if new_links:
        existing_links.extend(new_links)
        with open(trove_path, 'w') as f:
            for link in existing_links:
                f.write(json.dumps(link) + '\n')
        print(f"Updated {trove_path}")

if __name__ == '__main__':
    main()
