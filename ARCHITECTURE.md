# Static Site Comment System Architecture

## Overview

A zero-backend architecture for a static site where authenticated users submit data via Google Sheets, which is periodically processed into static JSON/RSS files that serve as canonical storage.

## Components

### 1. Static Frontend (GitHub Pages / Netlify / etc.)

- Hosts the UI
- Loads canonical data from JSON/RSS file(s) in the repo
- Implements Google OAuth for user authentication
- Writes submissions directly to Google Sheets via Sheets API

### 2. Google Sheets (Temporary Queue)

- Acts as a submission queue, not permanent storage
- One row per submission
- Columns: timestamp, user email (from auth), submission content, processed flag
- Shared with a service account for GitHub Actions access

### 3. GitHub Actions (Scheduled Processor)

- Runs on cron (e.g., every 15 minutes, or hourly—tune to your needs)
- Reads unprocessed rows from the Sheet via Sheets API
- Appends new entries to canonical JSON/RSS file in repo
- Marks rows as processed (or deletes them)
- Commits and pushes, triggering site rebuild

### 4. Canonical Data (JSON/RSS in Repo)

- Source of truth for displayed content
- Loaded by frontend JS to populate the DOM
- Version-controlled history of all submissions

## Authentication Flow

1. User visits static site
2. Site loads Google Identity Services library
3. User clicks login, Google OAuth popup appears
4. If already signed into Google, single click to authorize
5. Frontend receives access token (1hr expiry, silent refresh if session active)
6. Token used for Sheets API writes

## Google Cloud Console Setup

1. Create project
2. Enable Google Sheets API
3. Configure OAuth consent screen (can remain "unverified" for personal use; shows warning to users)
4. Create OAuth 2.0 Client ID (Web application type)
5. Add authorized JavaScript origins (your site's domain)
6. Create service account + key for GitHub Actions to read/write the Sheet

## Data Flow

```
User (browser)
    │
    ▼
Google OAuth (get token)
    │
    ▼
Google Sheets API (append row)
    │
    ▼
Google Sheet (queue)
    │
    ▼
GitHub Actions (cron)
    │
    ├──► Read unprocessed rows
    ├──► Append to JSON/RSS
    ├──► Mark rows processed
    └──► Commit + push
            │
            ▼
        Site rebuild
            │
            ▼
        Frontend loads updated JSON/RSS
```

## Security Considerations

- OAuth consent screen shows your app name and requested scopes to users
- Sheet should be restricted: only the service account and your personal account have access
- Frontend only has write access scoped to that specific Sheet
- Validate/sanitize submission content in the GitHub Action before writing to canonical files

## Tradeoffs Accepted

- Latency: submissions appear on site after next cron run + rebuild (minutes, not seconds)
- Google dependency: users must have Google accounts
- Unverified app warning: users see "Google hasn't verified this app" unless you go through verification

## Implementation Notes

- Google Identity Services (`google.accounts.oauth2`) is the modern library; avoid deprecated `gapi.auth2`
- Sheets API v4 for read/write operations
- GitHub Actions can use `google-github-actions/auth` for service account authentication
- Consider a "pending" state in the UI if you want to show users their submission was received before it appears in canonical data
