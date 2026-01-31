# CHANGELOG

## 2026-01-31

- Added sort options to link list: newest first, oldest first, alphabetical
- Sort controls appear when viewing filtered links (not on tag directory)
- Bumped version to 0.3

---

## 2026-01-31

- Front page now shows tag directory with counts (sorted by most links first)
- Added tags input field to submit form, pre-populated with current page's tags
- Bumped version to 0.2

---

## 2026-01-31

- Added version number (v0.1) displayed in frontend footer
- Version stored in `version.txt`, loaded async by frontend

---

## 2026-01-31

- Added GitHub Actions workflow to auto-process submissions when issues are created

---

## 2026-01-31

- Added `process_issues.py` to read GitHub issue submissions and append to trove.jsonl
- Fetches titles, triggers archive.org, closes issues after processing
- Added `make process-issues` target

---

## 2026-01-31

- Replaced Google Sheets submission with GitHub Issues via Netlify Function
- Created `netlify/functions/submit.js` to handle submissions
- Google OAuth now only requests `email` scope (identity only, no Sheets access)
- Added notes input field for user-provided summary/pullout quote
- Submissions create GitHub Issues with url, tags, notes, and submitter email
- Updated README with GitHub token setup instructions

---

## 2026-01-29

- Added path-based tag filtering: `/foo` shows #foo links, `/foo/bar` shows links with both #foo AND #bar tags
- Added hash-based routing as alternative: `#foo/bar` works the same way (for local dev)
- Updates page title and heading to reflect active filters
- Added `netlify.toml` with SPA fallback routing
- Changed `make serve` to use `netlify dev`, added `make setup` for netlify-cli

---

## 2026-01-29

- Enhanced `add_link.py`: auto-fetches page title if not provided, triggers archive.org snapshot, auto-commits to git
- Added `--no-archive` and `--no-commit` flags to skip those steps
- Added `make test` target for Python syntax checking
- Updated CLAUDE.md with project structure overview

---

## 2026-01-29

- Created minimal prototype: static page + CLI add script
- `index.html`: loads `trove.json` and renders links with tags to DOM
- `add_link.py`: CLI script to add URLs with optional title and tags
- `trove.json`: initial data file structure
- `Makefile`: `serve` and `add` targets

---

## 2026-01-26

- Cleaned up README: removed contradictions, structured constraints and features, removed speculative items
- Created TODO.md with complete task list for v1: setup, processing script, frontend, and identified allowlist enforcement as key risk
- Documented architectural concerns: Google Sheets rate limits and transactionality, OAuth scope leakage, unverified app warning, archive.org unreliability

---
