# CHANGELOG

## 2026-02-17

- Move trove.jsonl to orphan `links` branch to keep data commits separate from code commits
- Add `pull-links` / `push-links` Makefile targets for syncing data
- Update add_link.py, GitHub Actions workflow, and Netlify build to use links branch
- Version bump to v0.35

---

## 2026-02-17

- Tag descriptions: optional descriptions for tags, stored as `set_tag_desc` ops in trove.jsonl
- Replace sidebar "rename" with "edit" dialog for tag name and description
- Sidebar tags with descriptions show tooltip on hover
- New `generate_tags.py` build script outputs `tags.jsonl` (replaces inline `tags.json` generation)
- Bookmarklet updated to use `tags.jsonl` format
- Backend (`submit.js`, `process_issues.py`) handles `set_tag_desc` action
- Version bump to v0.34

---

## 2026-02-17

- Move edit icon (✏️) to upper-right corner of link card, visible on hover
- Add delete icon (🗑️) to lower-right corner of link card, deletes link on click
- Consolidate delete logic into single shared `handleDeleteClick` handler
- Version bump to v0.33

---

## 2026-02-15

- Updated help.html: removed sign in/out UI, fixed tag menu docs (two options: `tag` and `~tag`), fixed sidebar position (left, not right)
- Version bump to v0.32

---

## 2026-02-14

- Moved bookmarklet link ("add to trove") from footer to header nav
- Moved help link next to sign out in header auth area
- Tag menu actions now show just `tag` instead of `all ∩ tag` when on root page
- Changed help URL from `/help.html` to `/help` (via netlify redirect)
- Version bump to v0.31

---

## 2026-02-13

- Unified card edit mode: single ✏️ button opens inline panel with title input, tags input, vote-for-deletion, and save/cancel
- Removed separate 💣 delete button and inline title-only editing
- Card tag hover menus now show navigation only (no remove/rename); sidebar tag menus retain rename option
- Version bump to v0.30

---

## 2026-02-13

- Split frontend.ts into modules: auth.ts (91 lines), tags.ts (281 lines), frontend.ts (700 lines)
  - auth.ts: credential management, sign-in UI, password visibility
  - tags.ts: tag sidebar, tag menus, rename/remove/add tag operations
  - frontend.ts: rendering, filtering, ratings, bookmarklet, orchestration
- Fix card layout bug: rate-up button used `<a>` tag nested inside link anchor, causing broken flex layout

---

- Search bar: full-text search over link titles, tags, and notes
  - Text input in the filter bar, results update as you type
  - Case-insensitive, combines with tag filters and time period filters

---

## 2026-02-13

- Local issue processing for testable pipeline:
  - Extracted `process_issue_list(issues, trove_path, local)` from `process_issues.py`
  - `local=True` skips GitHub API calls (close_issue, fetch_title, trigger_archive, fetch_youtube_metadata)
  - New `process_local_issues.py`: CLI to process JSON issue files from a directory
  - Test fixtures in `test_issues/`: add.json, delete.json, add_tag.json
  - Integration tests: test_process_local_add, test_process_local_delete, test_process_local_add_tag
  - Makefile: new `process-local` target

---

## 2026-02-13

- Link delete functionality:
  - 💣 icon next to ✏️ on each card (signed-in only) permanently deletes a link
  - Confirm dialog before deletion; card removed from DOM immediately
  - `delete` op handled by `dedup_trove.py` (marks URL as deleted, skips in output)
  - `process_issues.py` accepts `delete` action in submissions
  - Updated `help.html` with delete button documentation
  - Test added for dedup delete behavior
- Bumped version to 0.27

---

## 2026-02-13

- Build-time dedup for trove.jsonl:
  - trove.jsonl is now an append-only operation log; deduplication happens at build time
  - New `dedup_trove.py`: merges entries per URL with configurable ops (`add`, `set_title`, `set_notes`, `add_tag`, `remove_tag`, `rename_tag`)
  - Merge rules: tag union, sticky `set_title`, combined notes with submitter prefixes, earliest timestamp, last-write-wins for media fields
  - `trove_utils.py`: `create_link_entry()` now accepts `op` and `submitted_by` params
  - `process_issues.py`: removed inline merge logic; now appends op entries for build-time dedup
  - `submit.js`: passes `action` field through to GitHub issues for non-add operations
  - `frontend.ts`: title edits use `set_title` action, tag adds use `add_tag` action
  - New remove-tag UI: tag menu shows "remove" option when signed in, submits `remove_tag` action
  - Makefile: `build` target runs `dedup_trove.py` instead of copying trove.jsonl; new `dedup` target
  - Tests for dedup merge logic in `test_dedup_trove.py`
- Bumped version to 0.26

---

## 2026-02-13

- Inline bookmarklet to bypass CSP:
  - Bookmarklet code is now fully inlined in the `javascript:` URL instead of injecting an external `<script>` tag
  - Fixes bookmarklet on CSP-strict sites (YouTube, etc.) that block external script loading
  - Build step minifies `bookmarklet.ts` → `bookmarklet-code.txt`, imported as text by `frontend.ts`
  - Bookmarklet reads closure variables (`__TROVE_ORIGIN__`, `__TROVE_URL__`, etc.) instead of `script.dataset.*`
  - Added `text.d.ts` for TypeScript `.txt` import support
- Bumped version to 0.25

---

## 2026-02-13

- Simplified auth UI:
  - Sign in form now a centered popup panel (matches bookmarklet design)
  - Auth links ("Sign in" / "Sign out") styled as proper links with underline on hover
  - Removed dropdown menu and username display
  - Close popup with Escape, overlay click, or close button
  - `showSignIn(bool)` replaces separate show/hide functions
- Strengthened meta rule: NEVER implement code changes in response to questions

---

## 2026-02-13

- Converted frontend.js and bookmarklet.js to TypeScript
  - New `autocomplete.ts`: shared tag autocomplete logic extracted from both files (~70 duplicate lines removed)
  - `frontend.ts`: typed all functions, interfaces (`Link`, `PageConfig`, `Credentials`), DOM element casts
  - `bookmarklet.ts`: typed with shared autocomplete import
  - Build uses esbuild to bundle TS → JS (two entry points → two output files)
  - `tsconfig.json`: strict mode, noEmit (type checking only)
  - `package.json`: devDependencies for esbuild and typescript
  - Makefile: `make build` runs esbuild, new `make typecheck` target, `make setup` runs `npm install`
- Bumped version to 0.24

---

## 2026-02-12

- Friendlier link-adding experience:
  - Notes field changed from single-line input to resizable textarea
  - Tag autocomplete: typing in the tags field shows matching suggestions from existing tags, fetched from `/tags.json`
  - `tags.json` generated during `make build` from `trove.jsonl`
  - New bookmarklet (`bookmarklet.js`): injects a floating shadow-DOM panel on external pages instead of opening a popup window
    - Pre-fills URL from current page, selected text as notes
    - Tag autocomplete works in the widget
    - Credentials embedded in bookmarklet if signed in on trove
  - Footer updated: "drag to bookmark bar: + trove"
  - Updated help.html with bookmarklet and autocomplete documentation
- Bumped version to 0.23

---

## 2026-02-11

- Card layout: thumbnail/image now appears smaller on the right side of the card, with title/URL/tags left-aligned
- Unified thumbnail mechanism in frontend.js: `link.thumbnail` and image-URL detection merged into single `imgSrc` variable
- Cards maintain consistent height regardless of whether they have a thumbnail
- Rating icons repositioned: ❤️ upper-left, value middle-left, 💣 lower-left as a vertical strip
- Thumbnail/image stretches full card height, flush with card edge
- Title moved to top of card; domain, date, duration, channel merged into single meta line below title
- Duration format changed from "M:SS" to compact form: "45s", "3m", "1h45m"
- Bumped version to 0.22

---

## 2026-02-11

- Unified favorites and hidden links into a numeric rating system:
  - Rating widget on each card: 💣 [number] ❤️ (click to rate down/up)
  - Links with rating < 0 are hidden by default (replaces separate Hide button)
  - Pseudo-tags `_favs` (rating > 0) and `_peeves` (rating < 0) in tag sidebar
  - Removed "My favorites" menu item, `isFavoritesPage()`, old favorites/hidden localStorage keys
  - Single `trove_ratings` localStorage key stores `{ url: number }` map
  - Updated help.html with new rating documentation
- Bumped version to 0.20

---

## 2026-02-11

- YouTube link support: YouTube URLs now get special treatment with thumbnail images, duration, and channel metadata displayed on cards
- `add_link.py`: Added `is_youtube_url()`, `fetch_youtube_metadata()` using `yt-dlp` to fetch title, duration, channel, and thumbnail
- `trove_utils.py`: `create_link_entry()` accepts `duration`, `channel`, `thumbnail` optional fields
- `process_issues.py`: YouTube URLs processed via `yt-dlp` instead of generic title fetch
- `frontend.js`: Cards with `thumbnail` field show the image; duration/channel shown as `.yt-meta` row
- `style.css`: Added `.yt-meta`, `.yt-duration`, `.yt-channel` styles
- `Makefile`: Added `yt-dlp` to `setup` target

---

## 2026-02-11

- Removed separate `#/tags` page and all associated special cases (nav links, `isTagsPage()`, tag-list rendering/CSS). The front page tag sidebar now serves this purpose.

---

## 2026-02-11

- Moved help page to standalone `help.html`:
  - Separate page without add-link form or filter widgets
  - TOC sidebar on the left with anchor links to each section
  - Retains sign-in/user menu from shared `frontend.js`
  - Removed `isHelpPage()` and inline help rendering from `frontend.js`
  - Added favorites documentation section

---

## 2026-02-11

- Added favorite links feature:
  - Heart icon in lower-right corner of each link card
  - Click to toggle favorite (red = favorited, empty = not)
  - Favorites stored in localStorage (`trove_favorites`)
- Bumped version to 0.18

---

## 2026-02-11

- Reorganized page layout: sort/time dropdowns in horizontal row (right-justified), link count on same line (left-justified)
- Moved add form, filter bar, and links into content-wrapper alongside tag sidebar to eliminate empty space above sidebar

---

## 2026-02-11

- Added help page (#/help) explaining the UI:
  - Tag browsing, intersections, and exclusions
  - Tag hover menu and sidebar behavior
  - Sorting, time filtering, hiding links, and adding links
- Bumped version to 0.17

---

## 2026-02-11

- Added tag sidebar on tag filter pages:
  - Shows all other tags present in the current filtered linkset, sorted by count
  - Reuses existing tag hover menu (replace/add/exclude navigation)
  - Hidden on front page, /tags page, and mobile (<900px)
  - Body max-width widened to 1100px to accommodate sidebar
  - Extracted `renderTag()` to standalone function for reuse
- Bumped version to 0.16

---

## 2026-02-07

- Added dedicated /tags page:
  - New #/tags route shows all tags with time period filtering (day/week/month/year/all-time)
  - Tags filtered by when links were added (counts only tags from links in selected period)
  - Default sort by link count (most popular first)
  - Added "all tags" link in header navigation
- Changed front page to show recent links (50 most recent) with time period filtering
- Time period filter now available on all pages (front page, /tags, and tag filter pages)
- Bumped version to 0.15

---

## 2026-02-07

- Added title editing for existing links:
  - Pencil icon (✏️) appears next to title for authenticated users
  - Click to replace title with inline input field
  - Enter to save, Escape to cancel
  - Backend deduplicates and merges submissions: updates title and/or tags for existing URLs
  - Submissions for existing URLs now update title if provided (via GitHub issues or direct submission)
  - Fixed: Netlify submit function now includes `title` field in GitHub issue body
- Bumped version to 0.14

---

## 2026-02-07

- Replaced Google OAuth with per-user password authentication:
  - Users sign in with username + password, stored in localStorage (persists across refreshes)
  - Netlify Function verifies credentials against `TROVE_USERS` env var (format: `alice:pw1,bob:pw2`)
  - Username recorded as `submitted_by` in GitHub issues (replaces email)
  - Removed Google Identity Services script, `config.js` dependency
  - Added sign-in form with username/password fields, sign-out button
  - Added `manage_users.py` CLI + Makefile targets (`add-user`, `remove-user`, `list-users`)
  - Updated docs: auth.md, README.md, CLAUDE.md
- Bumped version to 0.13

---

## 2026-02-03

- Added `--fill-titles` option to process_issues.py to fetch missing titles for existing links
- Added `make fill-titles` target

---

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
