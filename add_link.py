#!/usr/bin/env python3
"""Add a link to trove.json from the command line."""

import argparse
import json
import os
import re
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone

TROVE_FILE = Path(__file__).parent / "trove.json"
TOKEN_FILE = Path.home() / ".trove_token.json"
SHEET_ID = "1KY1xS72V7stxCKGOEYeg8w7lYjbsZ45ls_lHtY1l1fY"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def load_trove():
    if TROVE_FILE.exists():
        return json.loads(TROVE_FILE.read_text())
    return {"links": []}


def save_trove(data):
    TROVE_FILE.write_text(json.dumps(data, indent=2) + "\n")


def fetch_title(url):
    """Fetch page title from URL. Returns None on failure."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "trove-link-saver/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            # Read first 64KB - title should be near the top
            html = response.read(65536).decode("utf-8", errors="ignore")
            match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"Warning: Could not fetch title: {e}")
    return None


def trigger_archive(url):
    """Request archive.org to snapshot the URL."""
    save_url = f"https://web.archive.org/save/{url}"
    try:
        req = urllib.request.Request(
            save_url,
            data=b"",  # POST request
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; trove-link-saver/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            print(f"Archive.org snapshot requested (status {response.status})")
    except urllib.error.HTTPError as e:
        print(f"Warning: Archive.org returned {e.code} (snapshot may still be queued)")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"Warning: Archive.org request failed: {e}")


def git_commit(url, title):
    """Commit trove.json with a descriptive message."""
    msg = f"Add link: {title or url}"
    try:
        subprocess.run(["git", "add", str(TROVE_FILE)], check=True, cwd=TROVE_FILE.parent)
        subprocess.run(["git", "commit", "-m", msg], check=True, cwd=TROVE_FILE.parent)
        print(f"Committed: {msg}")
    except subprocess.CalledProcessError as e:
        print(f"Warning: Git commit failed: {e}")


def get_sheets_credentials():
    """Get Google Sheets API credentials via OAuth flow."""
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            client_id = os.environ.get("GOOGLE_CLIENT_ID")
            client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
            if not client_id or not client_secret:
                raise RuntimeError(
                    "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables"
                )
            flow = InstalledAppFlow.from_client_config(
                {
                    "installed": {
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": ["http://localhost"],
                    }
                },
                SCOPES,
            )
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def submit_to_sheet(url, title=None, tags=None):
    """Submit link to Google Sheets."""
    from googleapiclient.discovery import build

    creds = get_sheets_credentials()
    service = build("sheets", "v4", credentials=creds)

    row = [
        datetime.now(timezone.utc).isoformat(),
        url,
        ", ".join(tags) if tags else "",
        "",  # user_email placeholder
    ]

    service.spreadsheets().values().append(
        spreadsheetId=SHEET_ID,
        range="A:D",
        valueInputOption="USER_ENTERED",
        body={"values": [row]},
    ).execute()
    print(f"Submitted to Google Sheet: {url}")


def add_link(url, title=None, tags=None, no_archive=False, no_commit=False, to_sheet=False):
    # Auto-fetch title if not provided
    if not title:
        print(f"Fetching title from {url}...")
        title = fetch_title(url)
        if title:
            print(f"Found title: {title}")

    if to_sheet:
        submit_to_sheet(url, title, tags)
        return

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

    # Trigger archive.org snapshot
    if not no_archive:
        trigger_archive(url)

    # Commit the change
    if not no_commit:
        git_commit(url, title)


def main():
    parser = argparse.ArgumentParser(description="Add a link to trove.json")
    parser.add_argument("url", help="URL to add")
    parser.add_argument("-t", "--title", help="Title for the link (auto-fetched if omitted)")
    parser.add_argument("--tags", nargs="+", help="Tags for the link")
    parser.add_argument("--no-archive", action="store_true", help="Skip archive.org snapshot")
    parser.add_argument("--no-commit", action="store_true", help="Skip git commit")
    parser.add_argument("--sheet", action="store_true", help="Submit to Google Sheet instead of trove.json")

    args = parser.parse_args()
    add_link(args.url, args.title, args.tags, args.no_archive, args.no_commit, args.sheet)


if __name__ == "__main__":
    main()
