BUILDDIR := _build

.PHONY: setup setup-worktrees serve add build typecheck test dedup compact compact-fast import process-issues process-local fill-titles add-user remove-user list-users web-extract web-import pull-links push-links create-build-hook normalize-tags autotag rewrite-amazon

COUNT ?= 1

all: build

# Install dependencies
setup: setup-worktrees
	npm install
	npm install -g netlify-cli
	pip3 install pytest yt-dlp

# Create persistent worktrees for orphan branches
setup-worktrees:
	@test -d .links || git worktree add .links links
	@test -d .meta || git worktree add .meta meta

# Start a local server to view the site
serve:
	netlify dev

# Add a link: make add URL="https://example.com" TITLE="Example" TAGS="tag1 tag2"
add:
	python3 scripts/add_link.py ${URL} ${TAGS} $(if ${TITLE},-t "${TITLE}")

# Ensure .links worktree exists and is up to date
pull-links:
	@test -d .links || git worktree add .links links
	@cd .links && git pull --ff-only origin links 2>/dev/null || true

# Commit changes in .links worktree
push-links:
	@cd .links && git add -A && \
	if git diff --cached --quiet; then \
		echo "No changes to commit"; \
	else \
		git commit -m "${MSG}" && echo "Committed to links branch: ${MSG}"; \
	fi

# Build for Netlify deployment
build: pull-links
	mkdir -p ${BUILDDIR}
	npx esbuild src/bookmarklet.ts --bundle --minify --outfile=${BUILDDIR}/bookmarklet-code.txt
	npx esbuild src/frontend.ts --bundle --loader:.txt=text --outfile=${BUILDDIR}/frontend.js
	npx esbuild src/bookmarklet.ts --bundle --outfile=${BUILDDIR}/bookmarklet.js
	cp src/index.html src/help.html src/submit.html src/style.css ${BUILDDIR}/
	python3 scripts/generate_tags.py > ${BUILDDIR}/tags.jsonl
	python3 scripts/dedup_trove.py .links/trove-log.jsonl ${BUILDDIR}/trove.jsonl
	sed -i='' 's/BUILD_TIMESTAMP/$(shell date +%s)/' ${BUILDDIR}/index.html

# Type check TypeScript (no output)
typecheck:
	npx tsc --noEmit


# Syntax check all Python files, then run tests
test:
	python3 -m py_compile scripts/*.py && echo "Syntax OK"
	python3 -m pytest tests/ -v

# Deduplicate trove-log.jsonl (standalone)
dedup:
	python3 scripts/dedup_trove.py .links/trove-log.jsonl .links/trove-log.jsonl

# Import links from markdown files
import:
	python3 scripts/import_md_links.py ~/git/saul.pw/posts/links

# Process GitHub issue submissions and add to trove-log.jsonl
process-issues:
	python3 scripts/process_issues.py

# Process local JSON issue files (offline, for testing)
process-local:
	python3 scripts/process_local_issues.py --issues-dir ${ISSUES_DIR} --output ${OUTPUT}

# Fill in missing titles for existing links
fill-titles:
	python3 scripts/process_issues.py --fill-titles

# User management: manage TROVE_USERS env var on Netlify
add-user:
	python3 scripts/manage_users.py add ${NAME} ${PASS}

remove-user:
	python3 scripts/manage_users.py remove ${NAME}

list-users:
	python3 scripts/manage_users.py list

# Extract links from a webpage into a reviewable PSV file
import-url:
	python3 scripts/import_web_links.py extract ${URL} ${TAGS}

# Import links from a reviewed PSV file into trove-log.jsonl
import-psv:
	python3 scripts/import_web_links.py import ${PSV}

# Create a Netlify build hook and save it as a GitHub Actions secret
create-build-hook:
	@SITE_ID=$$(netlify status --json | jq -r '.siteData.id') && \
	HOOK_URL=$$(netlify api createSiteBuildHook --data "{\"site_id\": \"$$SITE_ID\", \"body\": {\"title\": \"links-updated\", \"branch\": \"main\"}}" | jq -r '.url') && \
	gh secret set NETLIFY_BUILD_HOOK --body "$$HOOK_URL" && \
	echo "Build hook created and saved as GitHub secret"

# Normalize tags according to TAGS.md conventions
normalize-tags:
	python3 scripts/normalize_tags.py

# Auto-tag untagged links using AI
autotag: build
	python3 scripts/autotag.py --count ${COUNT}

# Rewrite Amazon book URLs to OpenLibrary (dry run; use APPLY=--apply to write)
rewrite-amazon:
	python3 scripts/rewrite_amazon.py ${APPLY}

# Compact trove-log: strip tracking params, dedup, health-check dead links
compact:
	python3 scripts/compact_trove.py

# Compact without health checks or commit (fast, local-only)
compact-fast:
	python3 scripts/compact_trove.py --no-health-check --no-commit

clean:
	rm -f ${BUILDDIR}/*
