#!/usr/bin/env python3
"""Process GitHub issues with 'submission' label and add links to trove.jsonl."""

import argparse
import json
import subprocess

from trove_utils import TROVE_FILE, load_trove, save_trove, create_link_entry
from add_link import fetch_title, trigger_archive


def get_submission_issues():
    """Fetch open issues with 'submission' label."""
    result = subprocess.run(
        ["gh", "issue", "list", "--label", "submission", "--state", "open",
         "--json", "number,body"],
        capture_output=True, text=True, check=True
    )
    return json.loads(result.stdout)


def parse_issue_body(body):
    """Parse issue body into fields (url, tags, notes, submitted_by)."""
    fields = {}
    for line in body.strip().split('\n'):
        if ':' in line:
            key, _, value = line.partition(':')
            fields[key.strip().lower()] = value.strip()
    return fields


def close_issue(number):
    """Close a GitHub issue. Ignores errors (e.g., already closed)."""
    result = subprocess.run(
        ["gh", "issue", "close", str(number)],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"Closed issue #{number}")
    else:
        print(f"Could not close issue #{number}: {result.stdout}\n{result.stderr}")


def process_issues():
    """Process all open submission issues."""
    issues = get_submission_issues()
    if not issues:
        print("No open submission issues found")
        return

    links = load_trove()
    existing_urls = {link["url"] for link in links}
    processed = 0
    merged = 0

    for issue in issues:
        number = issue["number"]
        fields = parse_issue_body(issue["body"])

        url = fields.get("url")
        if not url:
            print(f"Issue #{number}: No URL found, skipping")
            continue

        if url in existing_urls:
            # Merge tags into existing entry
            tags = fields.get("tags")
            if tags:
                for link in links:
                    if link["url"] == url:
                        existing_tags = set(link.get("tags", "").split()) if link.get("tags") else set()
                        new_tags = set(tags.split())
                        merged_tags = existing_tags | new_tags
                        link["tags"] = " ".join(sorted(merged_tags))
                        break
                print(f"Issue #{number}: Merged tags into existing URL")
                merged += 1
            else:
                print(f"Issue #{number}: URL already exists, no new tags")
            close_issue(number)
            continue

        print(f"Issue #{number}: Processing {url}")

        # Fetch title
        title = fetch_title(url)
        if title:
            print(f"  Found title: {title}")

        # Build link entry
        link = create_link_entry(url, title, fields.get("tags"), fields.get("notes"))

        links.append(link)
        existing_urls.add(url)

        # Trigger archive.org
        trigger_archive(url)

        # Close the issue
        close_issue(number)
        processed += 1

    if processed > 0 or merged > 0:
        save_trove(links)
        if processed > 0:
            print(f"Added {processed} link(s) to {TROVE_FILE}")
        if merged > 0:
            print(f"Merged tags for {merged} existing link(s)")
    else:
        print("No new links to add")


def fill_titles():
    """Find links without titles and fetch them."""
    links = load_trove()
    missing = [link for link in links if not link.get("title")]

    if not missing:
        print("All links have titles")
        return

    print(f"Found {len(missing)} link(s) without titles")
    updated = 0

    for link in missing:
        url = link["url"]
        print(f"Fetching title for {url}...")
        title = fetch_title(url)
        if title:
            link["title"] = title
            print(f"  -> {title}")
            updated += 1
        else:
            print("  -> (no title found)")

    if updated > 0:
        save_trove(links)
        print(f"Updated {updated} link(s)")
    else:
        print("No titles found to update")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process link submissions")
    parser.add_argument("--fill-titles", action="store_true",
                        help="Fill in missing titles for existing links")
    args = parser.parse_args()

    if args.fill_titles:
        fill_titles()
    else:
        process_issues()
