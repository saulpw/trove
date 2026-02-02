# TODO

- date should always be partial ISO: 2026, 2026-01, 2026-01-01, 2026-01-01 13:43.
- make the div be a proper href so the link shows on the bottom bar
- changing sort drop-down resorts immediately
- fix github action failure
- show full link on hover (at least)

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

- add fixup to import script:
   - note invalid links
   - note links that are 404 (replace with archive.org links in frontend, but show original link in interface)
   - fold duplicate links by combining their tags

- fixup existing trove with these same fixup rules
- use PRs against trove.jsonl instead of issues
   - netlify action should just do direct adding of json

- add sort links by # of tags (so /-xyz will show untagged links first)

- any tag with only one link becomes a redirect by netlify

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
