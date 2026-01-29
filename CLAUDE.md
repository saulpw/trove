# Link Tagger - Dev Guide

A simple static website to share lists of links at a public mnemonic url.  e.g. trove.pw/games is a list of games

## Project Structure
- `index.html` - Static frontend (loads trove.json, displays links with tag filtering)
- `trove.json` - Canonical link data: `{"links": [{url, added, title?, tags?}]}`
- `add_link.py` - CLI to add links (auto-fetches title, triggers archive.org, commits)
- `Makefile` - Targets: `serve` (dev server :8000), `add` (add link via CLI)
- `ARCHITECTURE.md` - Future design: Google Sheets submissions + GitHub Actions processor
- `TODO.md` - Feature checklist

## Meta Rules
- When something unexpected happens (file empty/missing, command fails strangely), ask the user before proceeding.
- When corrected, add a meta rule to prevent the mistake in the future.
- When learning new info about codebase, update CLAUDE.md immediately.
- When user says "learn to do X", update CLAUDE.md with the rule.
- When a change doesn't work and you fix it elsewhere, revert the failed change.
- Keep implementations minimal - prototype first, polish later.
- Use Makefile targets for any repeatable command, including setup, tests, and builds.
- NEVER run raw pytest/python/etc commands - always use `make test`, `make run`, etc.  Create a new Makefile target FIRST if one doesn't exist, then use it.
- When summarizing completed work, append to CHANGELOG.md with ISO date heading. Use --- between each set of changes. Edit CHANGELOG.md BEFORE committing and stage it with the code changes.
- When writing tests, ask the human to verify test expectations rather than guessing values. Show them the test scenario and ask if the expected behavior is correct.
