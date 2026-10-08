# Mini Museum - guided visitor mode (2026-10-07)

- **Entry:** Mini Museum setup → "Start visitor tour". The screen is the same
  as before: `/profile/my-collections/museum?collection=<id>`.
- **Code:** `src/features/myCollections/museum/tourModel.ts` (pure) and
  `VisitorTour.tsx`.
- **Store:** the existing `oyno.myCollections.museums.v1` exhibition gains
  an optional `reflections` map (exhibit → prompt id). Older exhibitions load
  with none. `normalizeExhibition` keeps only known prompts on exhibits that
  are shown. Removing an exhibit removes its prompt.

## Tour

1. **Welcome:**
   - the exhibition title;
   - "An exhibition from a personal collection";
   - the curator's introduction, labelled "From the curator";
   - how many exhibits;
   - a "Text first" switch (on by default in child mode).
2. **Exhibits, in the curator's order.** The tour is built from `slidesFor`,
   the same order as the presentation.
   - Each exhibit shows OYNO's content, labelled "From OYNO": type, title,
     artwork and source link.
   - The curator's caption is shown separately, labelled "Curator's note".
   - A progress bar reads "Exhibit n of N".
   - A removed exhibit is a clear step ("no longer available") that never
     blocks the tour. Offline, unresolvable content reads "not on this
     device" instead of removed.
3. **Optional reflection** after the exhibits the curator chose.
   - There are 6 AUTHORED open questions (`REFLECTION_PROMPTS`), for example
     "Which detail would you point out to a friend?".
   - Each is marked "An open question written for this tour, not a fact
     about the object".
   - Answering is optional, with "Skip" available. A reflection never
     follows an exhibit that couldn't be shown.
4. **Closing:**
   - every exhibit in order, with Viewed / Not viewed / No longer available;
   - "Open source" for each exhibit that still exists;
   - "Go back to it" for any exhibit not viewed;
   - "Viewing isn't counted as learning or completion."
   - "Start again" and "End tour".

## Rules

- Nothing advances by itself: there is no timer, no auto-play and no
  animation. Next, Previous, Skip and "Go back to it" are all the visitor's
  own taps.
- What was viewed and anything typed live only in the tour's component
  state. Nothing is stored, synced or counted. The model has no store
  access, and the screen test checks that the museum store is unchanged
  after a full tour. No account is needed.
- The tour shows only the exhibition title and intro (the curator's own
  words), each exhibit's OYNO title, type, artwork and source link, the
  curator's captions (labelled) and the authored prompts.
  - Never shown: the collection's private description, Journal text, notes
    or personal photos.
  - The screen test walks the entire tour checking for a private
    description; the e2e test checks the page text.
- Exhibits that are available offline work offline. The artwork is
  bundled; titles come from the cached catalogue.
- KG / RU / EN; text-first larger type; the progress bar is labelled.

## Tests

- **Unit (`tour.test.ts`):**
  - curator order and reordering;
  - reflection placement;
  - removed and offline exhibits;
  - Next / Skip / Previous / jump, and bounds;
  - responses (only on reflections, bounded, cleared by restart);
  - closing rows;
  - prompt normalization and backwards compatibility;
  - prompts in three languages;
  - the real screen, walked end to end: the private description never
    appears and nothing is recorded.
- **e2e (`mini-museum.spec.ts`):**
  - set a reflection in setup;
  - curator order with the curator's note;
  - skip the reflection, go back, the removed exhibit, closing statuses and
    a source link;
  - no progress or learning keys written;
  - KG/RU; axe on welcome, a text-first exhibit and closing.

## Device checks: PENDING

- [ ] VoiceOver / TalkBack read the welcome, each exhibit (OYNO content
  before the curator's note) and the progress.
- [ ] The largest text size with "Text first" on: no clipped text, and the
  buttons stay reachable.
