.PHONY: setup serve add build typecheck test dedup import process-issues process-local fill-titles add-user remove-user list-users web-extract web-import pull-links push-links

all: build

# Install dependencies
setup:
	npm install
	npm install -g netlify-cli
	pip3 install pytest yt-dlp

# Start a local server to view the site
serve:
	netlify dev

# Add a link: make add URL="https://example.com" TITLE="Example" TAGS="tag1 tag2"
add:
	python3 add_link.py ${URL} ${TAGS} $(if ${TITLE},-t "${TITLE}")

# Fetch trove-log.jsonl from links branch
pull-links:
	git show links:trove-log.jsonl > trove-log.jsonl

# Commit and push local trove-log.jsonl to links branch (without checkout)
push-links:
	@BLOB=$$(git hash-object -w trove-log.jsonl) && \
	TREE=$$(printf "100644 blob %s\ttrove-log.jsonl\n" "$$BLOB" | git mktree) && \
	PARENT=$$(git rev-parse links) && \
	COMMIT=$$(git commit-tree "$$TREE" -p "$$PARENT" -m "$(MSG)") && \
	git update-ref refs/heads/links "$$COMMIT" && \
	echo "Committed to links branch: $(MSG)"

# Build for Netlify deployment
build: pull-links tags.jsonl
	mkdir -p _build
	npx esbuild bookmarklet.ts --bundle --minify --outfile=_build/bookmarklet-code.txt
	npx esbuild frontend.ts --bundle --loader:.txt=text --outfile=_build/frontend.js
	npx esbuild bookmarklet.ts --bundle --outfile=_build/bookmarklet.js
	cp tags.jsonl index.html help.html style.css _build/
	python3 dedup_trove.py trove-log.jsonl _build/trove.jsonl
	sed -i='' 's/BUILD_TIMESTAMP/$(shell date +%s)/' _build/index.html

# Type check TypeScript (no output)
typecheck:
	npx tsc --noEmit

# Build tags file
tags.jsonl: pull-links
	python3 generate_tags.py

# Syntax check all Python files, then run tests
test:
	python3 -m py_compile *.py && echo "Syntax OK"
	python3 -m pytest test_process_issues.py test_dedup_trove.py -v

# Deduplicate trove-log.jsonl (standalone)
dedup:
	python3 dedup_trove.py trove-log.jsonl trove-log.jsonl

# Import links from markdown files
import:
	python3 import_md_links.py ~/git/saul.pw/posts/links

# Process GitHub issue submissions and add to trove-log.jsonl
process-issues:
	python3 process_issues.py

# Process local JSON issue files (offline, for testing)
process-local:
	python3 process_local_issues.py --issues-dir ${ISSUES_DIR} --output ${OUTPUT}

# Fill in missing titles for existing links
fill-titles:
	python3 process_issues.py --fill-titles

# User management: manage TROVE_USERS env var on Netlify
add-user:
	python3 manage_users.py add ${NAME} ${PASS}

remove-user:
	python3 manage_users.py remove ${NAME}

list-users:
	python3 manage_users.py list

# Extract links from a webpage into a reviewable PSV file
import-url:
	python3 import_web_links.py extract ${URL} ${TAGS}

# Import links from a reviewed PSV file into trove-log.jsonl
import-psv:
	python3 import_web_links.py import ${PSV}

clean:
	rm -f _build/* tags.jsonl
