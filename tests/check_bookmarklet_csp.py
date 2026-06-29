#!/usr/bin/env python3
"""Headless check: the bookmarklet's new-tab fallback escapes archive.org's
wombat.js window.open rewriting.

Loads a real Wayback Machine page, then:
  1. control: calls the page's window.open (wombat-hijacked) -> the URL is
     rewritten with a web.archive.org/web/<ts>/ prefix (proves wombat is active).
  2. fix: replicates the blob-popup fallback from src/bookmarklet.ts -> a blob:
     document (no wombat, runs our own meta-refresh) navigates itself to live
     trove, unrewritten.

No issue is created: the popup lands on trove.saul.pw/submit with dummy creds.
Network to web.archive.org and trove.saul.pw is required.
"""

import glob
import os
import sys
from playwright.sync_api import sync_playwright


def find_chromium():
    """Bundled playwright build may not match the cached browser version; pick
    any installed chrome-headless-shell so a minor version skew doesn't block us."""
    env = os.environ.get("PLAYWRIGHT_CHROMIUM")
    if env:
        return env
    cache = os.path.expanduser("~/.cache/ms-playwright")
    hits = sorted(glob.glob(f"{cache}/chromium_headless_shell-*/*/chrome-headless-shell")) \
        + sorted(glob.glob(f"{cache}/chromium-*/*/chrome"))
    return hits[-1] if hits else None


WAYBACK_URL = "https://web.archive.org/web/20250716092935/https://jcmit.net/memoryprice.htm"
SUBMIT_URL = "https://trove.saul.pw/submit?url=test&u=x&p=y"

OPEN_VIA_PAGE = f"() => window.open({SUBMIT_URL!r}, '_blank')"

# Verbatim mechanism from src/bookmarklet.ts fallback branch.
OPEN_VIA_BLOB = f"""() => {{
  const esc = {SUBMIT_URL!r}.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const blobUrl = URL.createObjectURL(new Blob(
    ['<!doctype html><meta charset=utf-8><meta http-equiv=refresh content="0;url=' + esc + '">'],
    {{ type: 'text/html' }}));
  window.open(blobUrl, '_blank');
}}"""


def capture_popup(page, fn, settle_url=None):
    with page.expect_event("popup", timeout=15000) as popup_info:
        page.evaluate(fn)
    popup = popup_info.value
    if settle_url:
        try:
            popup.wait_for_url(settle_url, timeout=10000)
        except Exception:
            pass
    url = popup.url
    popup.close()
    return url


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=find_chromium())
        page = browser.new_page()
        print(f"Loading {WAYBACK_URL}")
        page.goto(WAYBACK_URL, wait_until="domcontentloaded", timeout=60000)

        control = capture_popup(page, OPEN_VIA_PAGE)
        print(f"  page window.open   -> {control}")

        fixed = capture_popup(page, OPEN_VIA_BLOB, settle_url="**trove.saul.pw**")
        print(f"  blob popup         -> {fixed}")

        browser.close()

    ok = True
    if "web.archive.org/web/" in control:
        print("PASS: control confirms wombat rewrites the page's window.open")
    else:
        print("WARN: control was NOT rewritten -- wombat may be absent; test is inconclusive")
        ok = False

    if fixed.startswith("https://trove.saul.pw/submit") and "web.archive.org" not in fixed:
        print("PASS: blob popup reaches live trove (escapes wombat)")
    else:
        print(f"FAIL: blob popup did not reach live trove: {fixed}")
        ok = False

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
