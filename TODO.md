# TODO

- [ ] the sorting Algorithm
- [ ] cli: remove --tags argument; everything after url is tags

- [ ] Client-side sort: curator index, date tagged, random

- [ ] add tags to existing link (resubmit with new tags)
- [ ] combine same links in compile step

## Risks

- [ ] **Enforce allowlist server-side.** Client-side auth checks are bypassable. The GitHub Action processor must reject (and delete) submissions from unauthorized emails. Decide where the allowlist lives (repo file, sheet tab, environment variable).

## Setup

- [ ] GitHub Action workflow (cron schedule, checkout, run processor, commit/push)

## Processing Script

- [ ] Python script: read unprocessed rows from github repo
- [ ] Validate submitter email against allowlist; delete unauthorized rows
- [ ] close the issue

## Frontend

- [ ] Local upvote/downvote/hide (localStorage)

## Later

- [ ] Browser plugin to submit current page + text selection
- [ ] Per-tag custom item templates
- [ ] Preview images for links
