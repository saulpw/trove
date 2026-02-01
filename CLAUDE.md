# Link Tagger - Dev Guide

A simple static website to share lists of links at a public mnemonic url.  e.g. trove.pw/games is a list of games

## Project Structure
- `index.html` - Static frontend (loads trove.jsonl, displays links with tag filtering, Google OAuth for submissions)
- `trove.jsonl` - Canonical link data in JSONL format (one JSON object per line): `{url, added, title?, tags?, notes?}`. Tags are space-separated strings (e.g., `"tags": "games retro"`), not JSON arrays.
- `trove_utils.py` - Shared utilities: `load_trove()`, `save_trove()`, `create_link_entry()`
- `add_link.py` - CLI to add links to trove.jsonl (auto-fetches title, triggers archive.org, commits)
- `process_issues.py` - Processes GitHub issue submissions into trove.jsonl
- `import_md_links.py` - One-time bulk import from markdown files
- `config.js` - Local dev only: sets `window.GOOGLE_CLIENT_ID`. In production, Netlify injects this via snippet injection.
- `Makefile` - Targets: `setup`, `serve`, `add`, `build`, `test`, `import`, `process-issues`
- `netlify.toml` - Netlify config (SPA fallback routing)
- `ARCHITECTURE.md` - Design: GitHub Issues submissions + GitHub Actions processor
- `docs/auth.md` - Auth approach options and tradeoffs
- `README.md` - Setup instructions including Google OAuth configuration
- `TODO.md` - Feature checklist
- `version.txt` - Version number shown in frontend footer; bump on major code changes

## Design Decisions
- CLI interface (`add_link.py`) uses positional arguments for tags (not `--tags` flag): `python3 add_link.py URL tag1 tag2`

## Meta Rules
- When the user asks a question, answer it. Don't start implementing a solution without asking first.
- When something unexpected happens (file empty/missing, command fails strangely), ask the user before proceeding.
- When corrected, add a meta rule to prevent the mistake in the future.
- When learning new info about codebase, update CLAUDE.md immediately.
- When user says "learn to do X", update CLAUDE.md with the rule.
- When a change doesn't work and you fix it elsewhere, revert the failed change.
- Keep implementations minimal - prototype first, polish later.
- Use Makefile targets for any repeatable command, including setup, tests, and builds.
- NEVER run raw pytest/python/etc commands - always use `make test`, `make run`, etc.  Create a new Makefile target FIRST if one doesn't exist, then use it.
- After editing source files, run `make build` before testing with `make serve` (netlify dev serves from `_build/`, not source).
- When summarizing completed work, append to CHANGELOG.md with ISO date heading. Use --- between each set of changes. Edit CHANGELOG.md BEFORE committing and stage it with the code changes.
- When writing tests, ask the human to verify test expectations rather than guessing values. Show them the test scenario and ask if the expected behavior is correct.
- Document all setup steps (API keys, external services, environment variables) in README.md in a dedicated section.
- Bump version.txt on major code changes (new features, significant fixes). Always bump minor version for until major is >0.
