# Curator Challenge

My Collections -> **Curator Challenge** (`/profile/my-collections/challenge`).
A guided way into Mini Museum that ends in a **normal** private collection
plus its exhibition. There is no separate exhibition system.

## Flow

1. **Choose a prompt.** These are creative guidance, not cultural claims:
   - "Introduce one topic to someone discovering it for the first time."
   - "Tell a story with a beginning, middle, and ending."
   - "Compare two objects and explain what you noticed."

   Each has a short tip. **Switching prompts keeps all the work.**
2. **Pick 3-5 articles.** Search the app's own localized article list
   (titles and images are the articles' own), or take a suggestion. You
   can reorder or remove them, and open each source.
3. **Sourced connections.** Connections between the chosen articles,
   ONLY from OYNO's dataset, with their evidence, article and section. The
   suggestions are dataset links.
4. **Name, introduction, optional captions.** They are labelled as yours
   ("Your caption (your interpretation)"), apart from "From OYNO".
5. **Checklist.** Only concrete points are checked:
   - 3-5 articles;
   - all available;
   - an introduction;
   - a name.

   Each item jumps to its editing control. Accuracy and quality are never
   judged; there are no scores.
6. **Visitor Preview.** The real `VisitorTour` with the draft exhibition,
   read-only, with the preview banner and "Back to the draft".
7. **Save.** A new private collection holding these articles and its
   exhibition (title, introduction, captions in the existing Exhibition
   shape). It then opens in Mini Museum's editing view, and works in the
   existing Present, Tour, Story and Visitor Preview views.

## Draft

- `oyno.curatorChallenge.v1`: `{ <owner>: draft }`, one per owner, on this
  device.
- Every edit is saved, so opening a source, the preview or restarting
  keeps it.
- Another account never sees it.
- It is cleared after a successful save; "Discard this draft" clears it
  on purpose.

## Saving

- `useMyCollectionsStore.createWithExhibition` writes the collections AND
  the exhibitions in one `AsyncStorage.multiSet` before anything is shown.
- On failure: no new collection, the draft is unchanged, and "Couldn't
  save … try again" offers Retry.
- On web, `multiSet` is not one transaction. A failure between the two
  keys could leave a collection without its exhibition. That collection
  then opens in Mini Museum with the default exhibition (all items, no
  introduction), and the draft is kept so the save can be retried. Not
  observed; noted.

## Unavailable content

- An unavailable article is marked on its row: "This article isn't
  available now. Remove it, or choose another article."
- The checklist blocks saving until it is fixed.
- Offline, articles already loaded keep resolving (the existing offline
  content cache).

## Tests

- `museum/challenge.test.ts`:
  - switching prompts keeps the work;
  - a caption leaves with its pick; reorder;
  - the 5-pick limit;
  - requirements (only the four concrete ones);
  - every connection and suggestion resolves to the dataset;
  - the saved exhibition passes `normalizeExhibition`;
  - tampered drafts;
  - drafts per owner;
  - a failed save changes nothing, and a retry creates the collection,
    items and exhibition;
  - screen: failure -> Retry -> opens the museum and clears the draft; the
    preview is the real tour and returns to the same draft; another
    account sees no draft.
- `e2e/tests/curator-challenge.spec.ts`:
  - at 320 and 412 px: prompt -> search and suggestions -> sourced
    connection -> caption -> switch prompt (kept) -> open source and Back
    (kept) -> checklist link -> introduction -> preview (axe) -> save ->
    museum editing shows it; draft cleared -> reopen from My Collections ->
    Visitor Preview;
  - KG offline editing with cached content; the draft survives a reload.

Pending: VoiceOver/TalkBack on the pick rows; native `multiSet` failure
behaviour.
