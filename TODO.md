# TODO

- straighten up frontend page layout
   - put link to / in header upper left
   - put login/logout in upper right
   - put number of links above links
   - add footer with "a saul.pw project" link to saul.pw and "privacy policy" link to /privacy.

- visually make each link more like a 'card'.  title front and center, notes below, date in the upper left, tags in the lower left.  click anywhere to go to link.

- [ ] date should be as precise as recent
   - only YYYY if different year, YYYY-MM if different month, etc

- use PRs against trove.jsonl instead of issues
   - netlify action should just do direct adding of json

- actions that can be taken on a link:
   - visit link: click anywhere in box ("default" action)
   - hide from me ('seen').  currently "x".
      - toggle "locally hidden" checkbox to see hidden items.
      - 'x' should be to the left of the title
   - add tag: '+' should open a typing box that autocompletes from existing tagset, autocompletion preference order related to 
      - resubmits link with new tags, gets absorbed into trove.jsonl (dedup happens at import time)

   - jump to a different tag of the item at toplevel (clicking on #society when on /fiction goes to /society)
   - jump to a subtag intersection (goes to /fiction/society)
   - jump to a -subtag intersection (goes to /fiction/-society)
   - add local notes (when present, a unicode "note" character is a link to edit them)

- fixup script:
   - note invalid links
     - on import in general, prepend 'https://' to links that don't have '://' in them
   - note links that are 404 (replace with archive.org links in frontend, but show original link in interface)
   - fold duplicate links by adding their tags

- add sort links by # of tags (so /-xyz will show untagged links first)
- import onetab links from onetab.txt

- make link clicks JS actions instead of server fetches

- any tag with only one link becomes a redirect to netlify

## Later

- [ ] Browser plugin to submit current page + text selection
- [ ] Per-tag custom item templates
- [ ] Preview images for links

- allow * in tag in url path as text wildcard to filter in/out?
  - so /* yields games
  - so /-* filters out anything with a tag of any kind

   - add a 'personal' tag
   - remove tag: regarded as a downvote for that link/tag combo
   - remove link entirely: moderator action (do not implement right now) for "bad" links

- auto-tag [tagless] links with llm and using current list of tags
