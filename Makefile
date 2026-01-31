.PHONY: setup serve add add-sheet build test import process-issues

# Install dependencies
setup:
	npm install -g netlify-cli
	pip install -r requirements.txt

# Start a local server to view the site
serve:
	netlify dev

# Add a link: make add URL="https://example.com" TITLE="Example" TAGS="tag1 tag2"
add:
	python3 add_link.py $(URL) $(if $(TITLE),-t "$(TITLE)") $(if $(TAGS),--tags $(TAGS))

# Add a link via Google Sheet: make add-sheet URL="https://example.com" TAGS="tag1 tag2"
add-sheet:
	python3 add_link.py $(URL) --sheet $(if $(TITLE),-t "$(TITLE)") $(if $(TAGS),--tags $(TAGS))

# Build for Netlify deployment
build:
	rm -rf _build
	mkdir -p _build
	cp index.html trove.jsonl _build/
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
