# TODO

- [ ] add input textbox to add link with current set of tags to google sheet ONLY for now.

- [ ] Netlify site linked to repo with auto-deploy on push

- [ ] Client-side sort: curator index, date tagged, random


- add tags to existing link

## Risks

- [ ] **Enforce allowlist server-side.** Client-side auth checks are bypassable. The GitHub Action processor must reject (and delete) submissions from unauthorized emails. Decide where the allowlist lives (repo file, sheet tab, environment variable).

## Setup

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
