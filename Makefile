.PHONY: setup serve add build test import process-issues

all: build

# Install dependencies
setup:
	npm install -g netlify-cli

# Start a local server to view the site
serve:
	netlify dev

# Add a link: make add URL="https://example.com" TITLE="Example" TAGS="tag1 tag2"
add:
	python3 add_link.py $(URL) $(TAGS) $(if $(TITLE),-t "$(TITLE)")

# Build for Netlify deployment
# Note: config.js provides GOOGLE_CLIENT_ID for local dev only.
# In production, Netlify injects the client ID via snippet injection.
build:
	mkdir -p _build
	cp index.html style.css frontend.js trove.jsonl _build/
	sed -i'' 's/BUILD_TIMESTAMP/$(shell date +%s)/' _build/index.html
	cp config.js _build/ 2>/dev/null || touch _build/config.js

# Syntax check all Python files
test:
	python3 -m py_compile *.py && echo "Syntax OK"

# Import links from markdown files
import:
	python3 import_md_links.py ~/git/saul.pw/posts/links

# Process GitHub issue submissions and add to trove.jsonl
process-issues:
	python3 process_issues.py
