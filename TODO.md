# TODO

- [x] Route handling: `trove.pw/<tag>` filters to that tag
- [ ] Client-side sort: curator index, date tagged, random
- [ ] Client-side filter: include/exclude by additional tags
- [ ] Minimal CSS, compact list layout toggle

- [ ] Netlify site linked to repo with auto-deploy on push

- add tags to existing link

## Risks

- [ ] **Enforce allowlist server-side.** Client-side auth checks are bypassable. The GitHub Action processor must reject (and delete) submissions from unauthorized emails. Decide where the allowlist lives (repo file, sheet tab, environment variable).

## Setup

- [ ] Google Cloud project: enable Sheets API, configure OAuth consent screen, create OAuth client ID
- [ ] Google service account + key for GitHub Actions to read/write the sheet
- [ ] Create the Google Sheet with columns: timestamp, user email, url, tags, pullout, processed
- [ ] GitHub repo secrets for service account credentials
- [ ] GitHub Action workflow (cron schedule, checkout, run processor, commit/push)

## Processing Script

- [ ] Python script: read unprocessed rows from sheet via Sheets API
- [ ] Validate submitter email against allowlist; delete unauthorized rows
- [ ] Mark rows processed (or delete) in sheet

## Frontend

- [ ] Google OAuth login flow (Google Identity Services)
- [ ] Authenticated submit form: append row to Google Sheet via Sheets API
- [ ] Local upvote/downvote/hide (localStorage)

## Later

- [ ] Browser plugin to submit current page + text selection
- [ ] Per-tag custom item templates
- [ ] Preview images for links
