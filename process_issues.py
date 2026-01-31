#!/usr/bin/env python3
"""Process GitHub issues with 'submission' label and add links to trove.jsonl."""

import json
import subprocess
from datetime import datetime, timezone

from add_link import load_trove, save_trove, fetch_title, trigger_archive, TROVE_FILE


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
    """Close a GitHub issue."""
    subprocess.run(
        ["gh", "issue", "close", str(number)],
        check=True
    )
    print(f"Closed issue #{number}")


def process_issues():
    """Process all open submission issues."""
    issues = get_submission_issues()
    if not issues:
        print("No open submission issues found")
        return

    links = load_trove()
    existing_urls = {link["url"] for link in links}
    processed = 0

    for issue in issues:
        number = issue["number"]
        fields = parse_issue_body(issue["body"])

        url = fields.get("url")
        if not url:
            print(f"Issue #{number}: No URL found, skipping")
            continue

        if url in existing_urls:
            print(f"Issue #{number}: URL already exists, closing")
            close_issue(number)
            continue

        print(f"Issue #{number}: Processing {url}")

        # Fetch title
        title = fetch_title(url)
        if title:
            print(f"  Found title: {title}")

        # Build link entry
        link = {
            "url": url,
            "added": datetime.now(timezone.utc).isoformat(),
        }
        if title:
            link["title"] = title
        if fields.get("tags"):
            link["tags"] = fields["tags"]
        if fields.get("notes"):
            link["notes"] = fields["notes"]

        links.append(link)
        existing_urls.add(url)

        # Trigger archive.org
        trigger_archive(url)

        # Close the issue
        close_issue(number)
        processed += 1

    if processed > 0:
        save_trove(links)
        print(f"\nAdded {processed} link(s) to {TROVE_FILE}")
    else:
        print("\nNo new links to add")


if __name__ == "__main__":
    process_issues()
