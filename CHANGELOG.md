# CHANGELOG

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
