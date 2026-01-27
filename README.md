# trove.pw

A simple system to share a list of links at a public mnemonic url.

- trivial for me to add a link and tag it (a list exists for each tag in the system; tags are created spontaneously)
- links can have multiple tags (likely less than 20)
- tags can be on hundreds or thousands of items. few enough that the page always downloads the entire set (<10MB)
- expect low-volume (100 links/day added max)
- anyone can view; only me and my list of N<100 friends can edit
- possible spike in read traffic if list goes viral
- site stored in github, rendered as static site, served via netlify

- auth via github to submit new links to private repo

- should look nice with small amount of css.  compact/list layout on demand.
  - title, date modified, preview image, pullout
- minimal javascript for ux effects
- ff plugin to provide pullout text from selection directly on page
- preview image?


## Design

- interface
    - easy to locally upvote/downvote/hide sites, links, or link-tags (locally)
    - can filter down to links that do/don't have another tag
- each list can have its own div template for its items
- sort by:
   - curator index
   - date tagged
   - random

## Architecture

See ARCHITECTURE.md.

- intended for long-term archival of links (actual content archival outsourced to archive.org)
1. private repo github action cron: call python script 1-100x/day

2. python script: fetch unprocessed links from google sheet, call archive.org api, put data into rss/json, commit.
   - pull out quote or image

3. netlify: on commit to private repo, generates static site.

4. frontend: static html/css/js downloads static rss/json from same site, populates DOM.
   - user can quickly interact with thousands of links.
   - user can locally upvote/downvote/ignore sites (link prefixes), links, linktags
   - google auth'd user can add link, frontend appends to google sheet

5. browser plugin: add current page including pullout

## Example: trove.pw/puzzles

I come across a site like simon's puzzles and i go to trove.pw/puzzles and submit the link.
I'm authorized through google, and so the link gets submitted via client js to be appended to a google sheet.
The nightly Github Action adds all recent rows to the trove.json file which contains all links.

