.PHONY: serve add

# Start a local server to view the site
serve:
	python3 -m http.server 8000

# Add a link: make add URL="https://example.com" TITLE="Example" TAGS="tag1 tag2"
add:
	python3 add_link.py $(URL) $(if $(TITLE),-t "$(TITLE)") $(if $(TAGS),--tags $(TAGS))
