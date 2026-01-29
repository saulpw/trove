# trove.pw

This trove of links is a record of things that are interesting, or meaningful, or relevant in some context.

It's a fairly basic one-page-app webpage, and hopefully straightforward to implement with modest effort and modern tools.
By virtue of being a static website, it should require virtually no ongoing cost or maintenance.

- User submit links along with tags.
- `trove.pw/puzzles` is a list of links tagged '#puzzles'.
- User can view lists of links by tags, sorted any number of ways.
- The interface feels really snappy because all filtering and data manipulation is done in the user's browser.

## Usage

```bash
# Start local server
make serve

# Add a link
make add URL="https://example.com"

# Add a link with title and tags
make add URL="https://example.com" TITLE="Example Site" TAGS="games puzzles"
```

Or use the script directly:
```bash
python3 add_link.py "https://example.com" -t "Example Site" --tags games puzzles
```

## Features

- Sort by trove algorithm, most recent tag date, or random
- Trove Algorithm: #submissions + votes
- Local upvote/downvote/hide for sites, links, or link-tags (stored client-side)
- Filter by tag intersection (has/doesn't have another tag)
- Tags can have different link templates/styling
- Browser plugin to submit current page with selected text as pullout
- Long-term link archival via archive.org

## Constraints

- The existence of a Tag implies a List; Links can have multiple Tags (likely fewer than 20 per link)
- The same tag can be on thousands of items.
- The full set of links is always downloaded (should be less than 10MB)
- Allowlist of users (less than 100) will be able to submit links and tags initially.
- Anyone on the internet can view.
- Low write volume (max ~100 links/day).
- Read spikes (e.g. if it goes viral) are handled by static hosting.
- Minimal JS, small amount of CSS, compact list layout available.

## Setup

### Google OAuth (for link submissions)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Sheets API**:
   - Go to APIs & Services → Library
   - Search "Google Sheets API" → Enable
4. Configure OAuth consent screen:
   - Go to APIs & Services → OAuth consent screen
   - Choose "External" user type
   - Fill in app name, user support email, developer email
   - Add scope: `https://www.googleapis.com/auth/spreadsheets`
   - Add your email as a test user (required while app is unverified)
5. Create OAuth credentials:
   - Go to APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Add Authorized JavaScript origins:
     - `http://localhost:8888` (for local dev)
     - `https://trove.pw` (for production)
   - Copy the **Client ID**

6. For CLI usage, also create a **Desktop** OAuth client:
   - Create Credentials → OAuth client ID
   - Application type: **Desktop app**
   - Copy both **Client ID** and **Client Secret**
   - Set environment variables:
     ```bash
     export GOOGLE_CLIENT_ID="your-desktop-client-id"
     export GOOGLE_CLIENT_SECRET="your-desktop-client-secret"
     ```

7. Configure the frontend:
   - In Netlify: Site settings → Build & deploy → Post processing → Snippet injection
   - Add snippet to `<head>` of all pages:
     ```html
     <script>window.GOOGLE_CLIENT_ID = "your-web-client-id";</script>
     ```
   - For local dev, add the same snippet to index.html temporarily (don't commit)

8. Share the Google Sheet with users who need write access (or make it public with link)

### Netlify Deployment

The site auto-deploys from the main branch. Environment variables:
- `GOOGLE_CLIENT_ID` - Web OAuth client ID for frontend submissions

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
