# Static Site Link Submission Architecture

## Overview

A low-maintenance architecture for a static site where authenticated users submit links via a Netlify Function that creates GitHub Issues. A scheduled GitHub Action processes issues into the canonical JSONL file.

## Components

### 1. Static Frontend (Netlify)

- Hosts the UI (index.html)
- Loads link data from `trove.jsonl`
- Implements Google OAuth for user identity (email scope only)
- Submits links via Netlify Function

### 2. Netlify Function (Submission Handler)

- Receives POST requests with URL, tags, notes, and Google access token
- Validates the Google token to get user email
- Creates a GitHub Issue with the `submission` label
- Issue body contains: URL, tags, notes, submitted_by email

### 3. GitHub Issues (Submission Queue)

- Acts as a temporary queue for submissions
- Each submission is an issue with the `submission` label
- Issues are closed after processing

### 4. GitHub Actions (Scheduled Processor)

- Runs on cron schedule (e.g., every 15 minutes)
- Runs `process_issues.py` which:
  - Fetches open issues with `submission` label
  - Fetches page titles, triggers archive.org snapshots
  - Appends entries to `trove.jsonl`
  - Closes processed issues
  - Commits and pushes changes

### 5. Canonical Data (trove.jsonl)

- Source of truth for all links
- JSONL format (one JSON object per line)
- Fields: `url`, `added`, `title?`, `tags?`, `notes?`
- Version-controlled history of all submissions

## Data Flow

```
User (browser)
    │
    ▼
Google OAuth (get access token)
    │
    ▼
Netlify Function (/.netlify/functions/submit)
    │
    ▼
GitHub Issue (submission queue)
    │
    ▼
GitHub Actions (cron)
    │
    ├──► Fetch title from URL
    ├──► Trigger archive.org snapshot
    ├──► Append to trove.jsonl
    ├──► Close issue
    └──► Commit + push
            │
            ▼
        Netlify rebuild
            │
            ▼
        Frontend loads updated trove.jsonl
```

## Configuration

### Frontend (Google OAuth)
- **Production:** Netlify snippet injection sets `window.GOOGLE_CLIENT_ID`
- **Local dev:** `config.js` sets `window.GOOGLE_CLIENT_ID`

### Netlify Function
- `GITHUB_TOKEN`: Personal access token with `repo` scope
- `GITHUB_REPO`: Repository in `owner/repo` format

### GitHub Actions
- Uses repository's built-in `GITHUB_TOKEN` for issue operations
- Commits using GitHub Actions bot identity

## Security Considerations

- Google OAuth validates user identity (email only)
- GitHub token is stored as Netlify environment variable
- Submissions are visible as GitHub Issues (public audit trail)
- Content is sanitized when written to JSONL

## Bookmarklet (Inline)

The bookmarklet is inlined as a `javascript:` URL rather than injecting a `<script src=...>` tag. This bypasses Content Security Policy (CSP) restrictions on sites like YouTube that block external script loading. The entire minified bookmarklet bundle (~6KB, ~9.4KB URL-encoded) is embedded in the href, well within browser limits (~100KB).

At build time, `bookmarklet.ts` is minified into `_build/bookmarklet-code.txt`, then imported as a text string by `frontend.ts` via esbuild's `--loader:.txt=text`. The `updateBookmarkletHref()` function wraps the code in an IIFE with closure variables (`__TROVE_ORIGIN__`, `__TROVE_URL__`, `__TROVE_SEL__`, `__TROVE_USER__`, `__TROVE_PASS__`) that the bookmarklet reads at runtime.

### CSP Hardening

Sites like YouTube enforce strict Content Security Policy directives that would block the bookmarklet widget:

- **`style-src`** — Blocks inline `<style>` elements. Bypassed by using `adoptedStyleSheets` on the shadow root instead.
- **`require-trusted-types-for 'script'`** — Blocks raw `innerHTML` assignments. Bypassed by creating a Trusted Types policy (`trove`) that wraps HTML strings. The policy is a passthrough (no sanitization needed since the HTML is fully constructed by the bookmarklet). The autocomplete module accepts an optional `trustedHTML` wrapper via its options to handle its own `innerHTML` usage.

## Tradeoffs Accepted

- **Latency:** Submissions appear after next cron run + rebuild (minutes, not seconds)
- **Google dependency:** Users must have Google accounts
- **Public queue:** Submissions are visible as GitHub Issues until processed
