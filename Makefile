.PHONY: setup serve add test

# Install dependencies
setup:
	npm install -g netlify-cli

# Start a local server to view the site
serve:
	netlify dev

# Add a link: make add URL="https://example.com" TITLE="Example" TAGS="tag1 tag2"
add:
	python3 add_link.py $(URL) $(if $(TITLE),-t "$(TITLE)") $(if $(TAGS),--tags $(TAGS))

# Syntax check all Python files
test:
	python3 -m py_compile *.py && echo "Syntax OK"
