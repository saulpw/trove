# trove.pw

Share curated lists of links at mnemonic urls. `trove.pw/puzzles` is a list of puzzles.

## Constraints

- Tags create lists spontaneously; links can have multiple tags (<20 per link)
- Tags can have thousands of items, but the full set is always downloaded (<10MB)
- Low write volume (~100 links/day max), possible read spikes
- Only an allowlist of <100 users can edit; anyone can view
- Minimal JS, small amount of CSS, compact list layout available

## Features

- Sort by curator index, date tagged, or random
- Local upvote/downvote/hide for sites, links, or link-tags (stored client-side)
- Filter by tag intersection (has/doesn't have another tag)
- Per-list item templates
- Browser plugin to submit current page with a text selection pullout
- Long-term link archival via archive.org

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md).

1. **Google Sheets** — authenticated users submit links from the frontend via Sheets API
2. **GitHub Action** (cron) — python script fetches unprocessed rows, calls archive.org, writes to canonical JSON/RSS, commits
3. **Netlify** — rebuilds static site on commit
4. **Frontend** — static HTML/CSS/JS loads JSON, populates DOM

## Example: trove.pw/puzzles

I find a puzzle site, go to `trove.pw/puzzles`, and submit the link.
I'm authenticated via Google OAuth, so the link is appended to a Google Sheet.
The next GitHub Action run processes it into `trove.json` and commits, triggering a rebuild.
