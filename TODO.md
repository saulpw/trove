# TODO

! once/day update of trove.jsonl  "todays submission's will be here tomorrow"

- move trove.jsonl to a separate repo?

- convert login dropdown to signout link only.

- make link adding box more friendly:
   - autopull title of page into title field (editable)
   - autocomplete tags, possibly using a separate smaller aggregated tags.jsonl


   - in widget, auto select tags field (so just typing and enter submits the link)

bug: two different links with same url posted, they should have already been unified.

- make renaming a tag actually creating a tag alias, so that future adds of that tag create the other one instead.
    - delete and recreate to use that tag again in the future

- allow editable tag description
  - show on tag hover
- add local tags
   - maybe all tags should start local and then be synced to the server?

- show number 
  - omit favs/peeves from tag list if none of the elements on the page are on it

- delete tag association

- /help.html -> /help URL

- add a #u/contributor tag

- import bulk lines from web page: include link to source in notes (markdown, converted to html in js?)

- under tag breadcrumb: rename tag (possibly to multiple tags)
   - implementation may be better as an 'action' rather resubmitting all links
   - predictive autocomplete (most popular tags preferentially)

- delete button to delete link entirely

- add local notes (when present, a unicode "note" character is a link to edit them)

- add fixup to import script:
   - note invalid links
   - note links that are 404 (replace with archive.org links in frontend, but show original link in interface)
   - fold duplicate links by combining their tags
   - where should logs go?

- fixup existing trove with these same fixup rules

- add sort links by # of tags (so /-xyz will show untagged links first)

## Discoverability

## Dev/Testing

- convert to typescript
- run tests from cli outside browser
- tell claude to create unit tests for public functions/interfaces

## Later

- [ ] Browser plugin to submit current page + text selection
- [ ] Per-tag custom item templates
- [ ] Preview images for links

- allow * in tag in url path as text wildcard to filter in/out?
  - so /* yields games
  - so /-* filters out anything with a tag of any kind

   - separate 'personal' tag?

- remove tag: regarded as a downvote for that link/tag combo
- remove link entirely: moderator action (do not implement right now) for "bad" links

- auto-tag [tagless] links with llm and using current list of tags

- alternative 'backend' to github
  - append-only
  - could be compiled (dedups and title/metadata fetches and removals and vote consolidations) by netlify on deploy or via github action on regular cadence or when new submit
  - queueing/concurrency management

- tag cloud?


- Option to automatically remove tracking attributes from URLs: https://raindropio.canny.io/feature-requests/p/option-to-automatically-remove-tracking-attributes-from-urls
