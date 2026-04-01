#!/usr/bin/env python3
"""Compact trove-log.jsonl: strip tracking params, dedup, health-check, archive fallback.

CLI: python3 compact_trove.py [--no-health-check] [--no-commit]
"""

import argparse
import json
import subprocess
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dedup_trove import dedup
from trove_utils import load_trove, save_trove

LINK_CHECK_LOG = Path(__file__).parent / ".meta" / "link-check-log.jsonl"

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "utm_source_platform", "utm_creative_format", "utm_marketing_tactic",
    "fbclid", "gclid", "gclsrc", "msclkid", "twclid", "dclid", "yclid",
    "mc_eid", "mc_cid", "_ga", "_gl", "s_kwcid",
}


def strip_tracking_params(url):
    """Remove tracking query parameters from a URL."""
    parsed = urllib.parse.urlparse(url)
    if not parsed.query:
        return url
    params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    cleaned = {k: v for k, v in params.items()
               if k not in TRACKING_PARAMS and not k.startswith("utm_")}
    new_query = urllib.parse.urlencode(cleaned, doseq=True)
    return urllib.parse.urlunparse(parsed._replace(query=new_query))


def compact(entries):
    """Strip tracking params from all entries, then dedup."""
    for entry in entries:
        if "url" in entry:
            entry["url"] = strip_tracking_params(entry["url"])
        # Also clean URLs in rename_tag ops
        if entry.get("urls"):
            urls = entry["urls"].split()
            entry["urls"] = " ".join(strip_tracking_params(u) for u in urls)
    return dedup(entries)


def load_check_log():
    """Load link health check log as {url: record}."""
    records = {}
    if LINK_CHECK_LOG.exists():
        for line in LINK_CHECK_LOG.read_text().strip().split("\n"):
            if line:
                rec = json.loads(line)
                records[rec["url"]] = rec
    return records


def save_check_log(records):
    """Save link health check log."""
    with open(LINK_CHECK_LOG, "w") as f:
        for rec in records.values():
            f.write(json.dumps(rec) + "\n")


def check_link(url):
    """Check if a URL is alive. Returns (status_code, alive)."""
    headers = {"User-Agent": "trove-link-checker/1.0"}
    # Try HEAD first
    try:
        req = urllib.request.Request(url, method="HEAD", headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, 200 <= resp.status < 400
    except urllib.error.HTTPError as e:
        if e.code == 405:
            # HEAD not allowed, fall back to GET
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return resp.status, 200 <= resp.status < 400
            except urllib.error.HTTPError as e2:
                return e2.code, False
            except (urllib.error.URLError, TimeoutError, OSError):
                return 0, False
        return e.code, False
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, False


def health_check(links, check_log):
    """Check link health, skipping recently checked URLs. Mutates check_log."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    to_check = []
    for link in links:
        url = link["url"]
        rec = check_log.get(url)
        if rec and rec.get("last_checked", "") > cutoff:
            continue
        to_check.append(url)

    if not to_check:
        print("All links checked within 30 days, skipping health check.")
        return

    print(f"Checking {len(to_check)} links...")
    for i, url in enumerate(to_check):
        status_code, alive = check_link(url)
        check_log[url] = {
            "url": url,
            "last_checked": datetime.now(timezone.utc).isoformat(),
            "status_code": status_code,
            "alive": alive,
        }
        status = "OK" if alive else f"DEAD ({status_code})"
        print(f"  [{i+1}/{len(to_check)}] {status} {url}")
        time.sleep(1)


def archive_fallback(links, check_log):
    """For dead links, query archive.org for snapshots and add archive_url."""
    dead_urls = [link for link in links
                 if not check_log.get(link["url"], {}).get("alive", True)]
    if not dead_urls:
        print("No dead links found.")
        return

    print(f"Checking archive.org for {len(dead_urls)} dead links...")
    for i, link in enumerate(dead_urls):
        url = link["url"]
        api_url = f"https://archive.org/wayback/available?url={urllib.parse.quote(url, safe='')}"
        try:
            req = urllib.request.Request(api_url, headers={"User-Agent": "trove-link-checker/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                snapshot = data.get("archived_snapshots", {}).get("closest", {})
                if snapshot.get("available"):
                    link["archive_url"] = snapshot["url"]
                    print(f"  [{i+1}/{len(dead_urls)}] ARCHIVED {url}")
                else:
                    print(f"  [{i+1}/{len(dead_urls)}] NO ARCHIVE {url}")
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as e:
            print(f"  [{i+1}/{len(dead_urls)}] ERROR {url}: {e}")
        time.sleep(2)


def main():
    parser = argparse.ArgumentParser(description="Compact trove-log.jsonl")
    parser.add_argument("--no-health-check", action="store_true",
                        help="Skip link health checks and archive.org fallback")
    parser.add_argument("--no-commit", action="store_true",
                        help="Skip git commit")
    args = parser.parse_args()

    # Phase 1+2: Strip tracking params and compact
    entries = load_trove()
    original_count = len(entries)
    links = compact(entries)
    print(f"Compacted {original_count} entries → {len(links)} links")
    save_trove(links)

    # Phase 3+4: Health checks and archive fallback
    if not args.no_health_check:
        check_log = load_check_log()
        health_check(links, check_log)
        archive_fallback(links, check_log)
        # Re-save links (archive_url may have been added)
        save_trove(links)
        save_check_log(check_log)

    # Commit
    if not args.no_commit:
        try:
            subprocess.run(
                ["make", "push-links", "MSG=compact trove-log"],
                check=True, cwd=Path(__file__).parent,
            )
        except subprocess.CalledProcessError as e:
            print(f"Warning: push-links failed: {e}")

        if not args.no_health_check and LINK_CHECK_LOG.exists():
            try:
                subprocess.run(
                    ["git", "-C", str(LINK_CHECK_LOG.parent),
                     "add", LINK_CHECK_LOG.name],
                    check=True,
                )
                subprocess.run(
                    ["git", "-C", str(LINK_CHECK_LOG.parent),
                     "commit", "-m", "update link-check-log"],
                    check=True,
                )
            except subprocess.CalledProcessError as e:
                print(f"Warning: meta commit failed: {e}")


if __name__ == "__main__":
    main()
