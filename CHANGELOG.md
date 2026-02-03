# CHANGELOG

## 2026-02-03

- Added bookmarklet support for quick link submission from any page:
  - Bookmarklet opens popup with URL pre-filled
  - Popup mode: compact form UI, user fills in tags/notes and submits
- Bumped version to 0.12

---

## 2026-02-03

- Added hidden links feature:
  - Link count now shows "(X hidden)" when links are hidden on current page
  - Hidden count is a clickable link that toggles to show only hidden links
  - In hidden view, "Hide" button becomes "Unhide" to restore links
  - Counts update immediately when hiding/unhiding (no page reload needed)

---

## 2026-02-02

- Auto sign-in: silently authenticates on page load if previously authorized (no click needed)
- Auto token refresh: schedules refresh 5 minutes before expiry to maintain session

---

## 2026-02-02

- Added '+' button to links for adding tags inline:
  - Only visible when signed in
  - Click '+' → shows inline input field
  - Enter tags → optimistically appends to UI, submits to backend
  - Escape/blur → cancels input
- Backend now merges tags for duplicate URLs instead of rejecting
- Bumped version to 0.11

---

## 2026-02-02

- Simplified tag hover menu: inline CSS-only show/hide
  - Menu renders inline with each tag (no global menu element)
  - CSS `:hover` controls visibility (no JS timeouts/positioning)
  - Shows immediately on hover (no 300ms delay)
  - Click tag → replace navigation, click menu option → that path
  - Removed touch long-press support (tap navigates directly)
- Bumped version to 0.10

---

## 2026-02-02

- Added tag hover menu with navigation options:
  - Click tag → immediate replace navigation (`/tag`)
  - Hover 300ms → menu appears with Replace, Add, Exclude options
  - Add → intersection (`/currentFilters/tag`)
  - Exclude → negation (`/currentFilters/-tag`)
  - Mobile: tap = replace, long-press (500ms) = show menu
- Menu hides on scroll or click outside
- Bumped version to 0.9

---

## 2026-02-02

- Date formatting now uses strict ISO format (YYYY-MM-DD), with HH:MM appended for same-day

---

## 2026-02-02

- Client-side tag navigation: clicking tags updates URL via History API without page reload
  - Links data loaded once, filtered/rendered client-side
  - Browser back/forward buttons work via popstate listener
  - Front page tag list also uses client-side navigation
- Bumped version to 0.8

---

## 2026-02-02

- Split `index.html` into separate files:
  - `style.css` - CSS styles extracted from `<style>` tag
  - `frontend.js` - JavaScript extracted from `<script>` tags
  - `index.html` - now just HTML structure
- Updated Makefile `build` target to copy new files
- Bumped version to 0.7

---

## 2026-02-01

- Codebase simplification:
  - Created `trove_utils.py` with shared functions: `load_trove()`, `save_trove()`, `create_link_entry()`
  - Removed dead Google Sheets code from `add_link.py` (~60 lines)
  - Removed Google API dependencies from `requirements.txt`
  - Updated `import_md_links.py` and `process_issues.py` to use shared utilities
  - CLI uses positional tags: `add_link.py URL tag1 tag2` (removed `--tags` flag)
  - Removed empty `.link .tags` CSS class from `index.html`
  - Simplified Google auth initialization (removed polling fallback, use `onload`)
  - Removed `add-sheet` Makefile target
  - Updated ARCHITECTURE.md to document current GitHub Issues flow
  - Documented that `config.js` is for local dev only (Netlify injects client ID in production)
- Bumped version to 0.6

---

## 2026-02-01

- Redesigned links as cards: title centered, domain below, date in upper left, tags in lower left
- Click anywhere on card to open link (JS-based navigation instead of anchor tags)
- Notes now displayed on cards when present
- Date formatting always includes context (e.g., "Jan 14" instead of just "14", "Jan 14 14:30" for today)
- Bumped version to 0.5

---

## 2026-02-01

- Reorganized header: home link on left, sign in button on right
- Added link count above link list when viewing filtered links
- Smart date formatting: shows only YYYY if different year, MMM DD if different month, DD if same month, HH:MM if same day
- Added footer with "a saul.pw project" link and privacy policy link
- URLs missing :// are auto-prepended with https:// when loading
- Imported 50 links from onetab.txt
- Bumped version to 0.4

---

## 2026-01-31

- Added sort options to link list: newest first, oldest first, alphabetical, random
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
