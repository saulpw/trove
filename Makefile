.PHONY: setup serve add build typecheck test import process-issues fill-titles add-user remove-user list-users web-extract web-import

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

# Build for Netlify deployment
build: tags.json
	mkdir -p _build
	npx esbuild bookmarklet.ts --bundle --minify --outfile=_build/bookmarklet-code.txt
	npx esbuild frontend.ts --bundle --loader:.txt=text --outfile=_build/frontend.js
	npx esbuild bookmarklet.ts --bundle --outfile=_build/bookmarklet.js
	cp tags.json index.html help.html style.css trove.jsonl _build/
	sed -i='' 's/BUILD_TIMESTAMP/$(shell date +%s)/' _build/index.html

# Type check TypeScript (no output)
typecheck:
	npx tsc --noEmit

# Build tags file
tags.json: trove.jsonl
	python3 -c "import json; import fileinput; tags=sorted(set(t for line in fileinput.input() for t in json.loads(line).get('tags','').split() if t)); print(json.dumps(tags))" < $< > $@

# Syntax check all Python files, then run tests
test:
	python3 -m py_compile *.py && echo "Syntax OK"
	python3 -m pytest test_process_issues.py -v

# Import links from markdown files
import:
	python3 import_md_links.py ~/git/saul.pw/posts/links

# Process GitHub issue submissions and add to trove.jsonl
process-issues:
	python3 process_issues.py

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

# Import links from a reviewed PSV file into trove.jsonl
import-psv:
	python3 import_web_links.py import ${PSV}

clean:
	rm -f _build/* tags.json
