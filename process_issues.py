#!/usr/bin/env python3
"""Process GitHub issues with 'submission' label and add links to trove.jsonl."""

import argparse
import json
import subprocess

from trove_utils import TROVE_FILE, load_trove, save_trove, create_link_entry
from add_link import fetch_title, trigger_archive, is_youtube_url, fetch_youtube_metadata


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
    """Process all open submission issues.

    Appends operation entries to trove.jsonl. Deduplication happens at build
    time via dedup_trove.py.
    """
    issues = get_submission_issues()
    if not issues:
        print("No open submission issues found")
        return

    links = load_trove()
    existing_urls = {link["url"] for link in links}
    appended = 0

    for issue in issues:
        number = issue["number"]
        fields = parse_issue_body(issue["body"])
        action = fields.get("action", "add")
        submitted_by = fields.get("submitted_by")

        # Handle rename_tag action
        if action == "rename_tag":
            remove_tag = fields.get("remove_tag")
            add_tags_str = fields.get("add_tags", "")
            urls_str = fields.get("urls", "")
            if not remove_tag or not add_tags_str or not urls_str:
                print(f"Issue #{number}: Invalid rename_tag fields, skipping")
                close_issue(number)
                continue
            entry = {"op": "rename_tag", "remove_tag": remove_tag,
                     "add_tags": add_tags_str, "urls": urls_str,
                     "added": __import__('datetime').datetime.now(
                         __import__('datetime').timezone.utc).isoformat()}
            if submitted_by:
                entry["submitted_by"] = submitted_by
            links.append(entry)
            print(f"Issue #{number}: Appended rename_tag '{remove_tag}' → '{add_tags_str}'")
            close_issue(number)
            appended += 1
            continue

        url = fields.get("url")
        if not url:
            print(f"Issue #{number}: No URL found, skipping")
            continue

        # For set_title, set_notes, add_tag, remove_tag: just append the op
        if action in ("set_title", "set_notes", "add_tag", "remove_tag"):
            entry = create_link_entry(
                url, title=fields.get("title"), tags=fields.get("tags"),
                notes=fields.get("notes"), op=action, submitted_by=submitted_by)
            links.append(entry)
            print(f"Issue #{number}: Appended {action} for {url}")
            close_issue(number)
            appended += 1
            continue

        # Default: add operation
        print(f"Issue #{number}: Processing {url}")

        # Fetch metadata (YouTube-specific or generic title) only for new URLs
        title = fields.get("title")
        yt_meta = {}
        if url not in existing_urls:
            if is_youtube_url(url):
                yt_meta = fetch_youtube_metadata(url)
                if not title:
                    title = yt_meta.get("title")
            elif not title:
                title = fetch_title(url)
            if title:
                print(f"  Found title: {title}")
            trigger_archive(url)

        link = create_link_entry(
            url, title, fields.get("tags"), fields.get("notes"),
            duration=yt_meta.get("duration"), channel=yt_meta.get("channel"),
            thumbnail=yt_meta.get("thumbnail"), op="add",
            submitted_by=submitted_by)

        links.append(link)
        existing_urls.add(url)
        close_issue(number)
        appended += 1

    if appended > 0:
        save_trove(links)
        print(f"Appended {appended} entry/entries to {TROVE_FILE}")
    else:
        print("No new entries to append")


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
