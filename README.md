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
python3 add_link.py "https://example.com" games puzzles -t "Example Site"
```

## Bookmarklet

Add links from any page with a browser bookmarklet. Drag the "+ bookmarklet" link from the footer to your bookmarks bar.

Click the bookmarklet on any page → popup opens with URL pre-filled → add tags/notes → submit.

## Project Structure

- `index.html` - Static frontend
- `trove.jsonl` - Canonical link data (JSONL format)
- `trove_utils.py` - Shared Python utilities (load/save/create entries)
- `add_link.py` - CLI to add links locally
- `process_issues.py` - Process GitHub issue submissions
- `import_md_links.py` - One-time bulk import from markdown files
- `Makefile` - Build and dev commands
- `config.js` - Local dev config (Google client ID); not used in production

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

### Google OAuth (for user identity)

Google OAuth is used to identify users submitting links. Only the `email` scope is requested.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Configure OAuth consent screen:
   - Go to APIs & Services → OAuth consent screen
   - Choose "External" user type
   - Fill in app name, user support email, developer email
   - Add scope: `email`
   - Add your email as a test user (required while app is unverified)
4. Create OAuth credentials:
   - Go to APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Add Authorized JavaScript origins:
     - `http://localhost:8888` (for local dev)
     - `https://trove.pw` (for production)
   - Copy the **Client ID**

5. Configure the frontend:
   - **Production (Netlify):** Site configuration → Post processing → Snippet injection
     - Add snippet to `<head>` of all pages:
       ```html
       <script>window.GOOGLE_CLIENT_ID = "your-web-client-id";</script>
       ```
   - **Local dev:** Create `config.js` with your client ID:
       ```javascript
       window.GOOGLE_CLIENT_ID = "your-web-client-id";
       ```
     This file is gitignored and only used for local development. In production, Netlify injects the client ID via snippet injection.

### GitHub Token (for submissions)

Submissions create GitHub Issues via a Netlify Function.

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token (classic) with `repo` scope (or `public_repo` if public repo)
3. In Netlify Dashboard → Site settings → Environment variables, add:
   - `GITHUB_TOKEN`: Your personal access token
   - `GITHUB_REPO`: `owner/repo` format (e.g., `saul/26-trove`)
4. For local dev, create `.env` file:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_REPO=saul/26-trove
   ```

### Netlify Deployment

The site auto-deploys from the main branch. Environment variables:
- `GOOGLE_CLIENT_ID` - Web OAuth client ID for frontend submissions
- `GITHUB_TOKEN` - GitHub PAT for creating issues
- `GITHUB_REPO` - Repository in `owner/repo` format

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md).

1. **Netlify Function** — authenticated users submit links, creating GitHub Issues
2. **GitHub Action** (cron) — python script processes issues, calls archive.org, writes to canonical JSON/RSS, commits
3. **Netlify** — rebuilds static site on commit
4. **Frontend** — static HTML/CSS/JS loads JSON, populates DOM

## Example: trove.pw/puzzles

I find a puzzle site, go to `trove.pw/puzzles`, and submit the link.
I'm authenticated via Google OAuth, so the submission goes to a Netlify Function that creates a GitHub Issue.
The next GitHub Action run processes it into `trove.jsonl` and commits, triggering a rebuild.
