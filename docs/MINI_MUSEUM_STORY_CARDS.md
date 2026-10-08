# Mini Museum - Story Cards (2026-10-08)

- **Entry:** the "Story Cards" section of the Mini Museum setup.
- **Code:** `src/features/myCollections/museum/storyModel.ts` (pure) and
  `StoryCards.tsx`.
- **Store:** an optional `story` on the existing exhibition, in the same
  owner-bound museums store. Older exhibitions load with none, and nothing
  new is created.

## Authoring

- Add 3–6 of the exhibition's exhibits as cards.
  - Only exhibits that can be shown can be added; removed content is
    disabled.
  - Reorder with up/down and remove as needed. Each exhibit can appear
    once.
- The parts follow the order: the first card is the **Beginning**, the
  last the **Ending**, the rest the **Middle**.
- Per card, the curator can add an optional title (≤ 40 characters) and
  optional words (≤ 200, with a counter).
- Everything is re-checked on read (`normalizeStory`):
  - only exhibits still in the exhibition;
  - no duplicates;
  - at most six;
  - text bounded and stripped of markup.

## Presentation

- Manual Previous/Next, "Card n of N", and a **list alternative** that shows
  the whole story at once.
- Nothing advances on its own and nothing animates.
- Each card shows:
  - its part;
  - OYNO's information, labelled "From OYNO": artwork, title and source
    link;
  - the curator's title and words, labelled **"Curator's words"**.
- A removed exhibit is a clear card, "no longer available - the story
  carries on", and never blocks the rest.
- Opening a source and coming back returns to the same card and view. The
  place is kept in memory only.
- Never shown: the collection's private description, Journal entries and
  notes.

## Export: one card at a time

- "Preview and share this card" uses the existing `useShareCard` flow,
  with the `postcard` variant at 360 × 450, captured at 1080 × 1350.
  - The existing temporary-file cleanup applies.
  - So does one-export-at-a-time.
  - A failed export keeps the preview open and retryable.
  - The selected card and all edits are untouched (tested).
- The card's ONLY inputs are its part, the curator's title and words, and
  the exhibit's OYNO title and picture (`cardContent`). The exported tree
  equals the previewed one (unit test), and the share sheet shows exactly
  that, with nothing private (e2e).
- **Web:** the card can be previewed, but only shared as text. Saving or
  sharing the image needs the iOS or Android app, and the screen says so.

## Tests

- **Unit / screen (`storyCards.test.ts`):**
  - ordering and parts;
  - the six-card limit, uniqueness and availability;
  - text limits and cleaning of tampered data;
  - a missing exhibit as a clear card;
  - the export tree equals the preview, with only five fields;
  - authoring through the real screen saves to the owner-bound store,
    survives a restart, and is invisible to another account;
  - presenting: Next, the list view, export keeps the place and edits, and
    the private description is never shown;
  - the place survives the screen being re-created.
- **e2e (`mini-museum.spec.ts`):**
  - author (a removed exhibit is disabled), reorder, reload;
  - present: Next, curator words, source and return to the same card, the
    list view;
  - the export preview shows only this card; Cancel keeps the place;
  - KG; a missing exhibit; axe.

## Native export checks: PENDING (need physical devices)

- [ ] iOS / Android: "Share" produces a 1080 × 1350 JPEG matching the
  preview, with the exhibit picture loaded (not blank).
- [ ] Save to Photos with the permission granted and denied; the selected
  card and the edits are kept.
- [ ] Repeated exports leave at most one cached file.
- [ ] VoiceOver / TalkBack read the part, OYNO's information, then the
  curator's words.
