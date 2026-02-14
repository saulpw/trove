# TODO

- edit card tag edit with autocomplete tags

- upvote/downvote applies to the current tagset (so upvotes on /classic/rock only affect the rankings of links on that page)

- move bookmarklet to header
- move help next to signout

! once/day update of trove.jsonl  "todays submission's will be here tomorrow"

- select items, tag multiple

- move trove.jsonl to a separate repo?

- remove auth from bookmarklet?
- make renaming a tag actually creating a tag alias, so that future adds of that tag create the other one instead.
    - delete and recreate to use that tag again in the future

- allow editable tag description
  - show on tag hover
  - heart/spade are "Love" and "Bury"

- delete tag association

- move edit icon to upper right to left of thumbnail

- add @contributor tags

- import bulk lines from web page: include link to source in notes (markdown, converted to html in js?)
- change bookmarklet link text to "add to trove"

- under tag breadcrumb: rename tag (possibly to multiple tags)
   - implementation may be better as an 'action' rather resubmitting all links
   - predictive autocomplete (most popular tags preferentially)

- add fixup to import script:
   - note invalid links
   - note links that are 404 (replace with archive.org links in frontend, but show original link in interface)
   - fold duplicate links by combining their tags
   - where should logs go?

- fixup existing trove with these same fixup rules

- add sort links by # of tags (so /-xyz will show untagged links first)

- sort tags alphabetically

## Discoverability

## Dev/Testing

- run tests from cli outside browser
- tell claude to create unit tests for public functions/interfaces

## Later

- [ ] Per-tag custom item templates
- [ ] Preview images for links

- allow * in tag in url path as text wildcard to filter in/out?
  - so /* yields games
  - so /-* filters out anything with a tag of any kind

   - separate 'personal' tag?

- auto-tag [tagless] links with llm and using current list of tags

- alternative 'backend' to github
  - append-only
  - could be compiled (dedups and title/metadata fetches and removals and vote consolidations) by netlify on deploy or via github action on regular cadence or when new submit
  - queueing/concurrency management

- tag cloud?

- Option to automatically remove tracking attributes from URLs: https://raindropio.canny.io/feature-requests/p/option-to-automatically-remove-tracking-attributes-from-urls

- add local tags
- add local notes (when present, a unicode "note" character is a link to edit them)

- maybe all changes should start local, with button to sync (to keep down on individual issues)


100/day * 300 = ^4.5/year, so ^6 lifetime
1m links, 1k bytes apiece = 1GB.  easily storable in git/hub.



