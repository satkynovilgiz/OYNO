# Reading Companion

Extends the existing reading features instead of adding new ones:

| Existing | Extension |
| --- | --- |
| Reader Navigator section keys (`sectionNavigator.ts`) | Bookmarks anchor on the same stable keys |
| Article `?section=<key>` (opened from highlights) | Bookmarks and Continue reading reopen through it; the scroll is now fixed (see below) |
| Continue reading (`ContinueReadingSection`) | Opens the last section by key when there is one, adds **Clear reading position**, and links to your section notes |
| Highlights (whole-passage copies with notes) | Unchanged. Bookmarks mark a SECTION without copying its text |

## Bookmarking a section

- Under every authored section of a culture item article, choose
  **Bookmark section**. You can add a note ("Your note (optional, your own
  words)").
- **Save:** storage is written first; on failure the note stays in the
  field with Retry, which saves what is in the field at that moment.
- The note is shown under the section as "Your note", apart from the
  article text.
- One bookmark per section key (`culture_item:<id>#<sectionKey>`), never a
  position number or a pixel offset.
- A bookmark makes no claim that the section was read or understood.

## Section notes (`/profile/reading-notes`, also from Profile)

- Each entry shows "From the article", the article title and the section,
  then your note. Entries open the section by its anchor
  (`?section=<key>`).
- **Article gone:** "This article isn't available now", with the note kept.
- **Section gone** (the article changed): "This section is no longer in the
  article". The note is kept and is never moved to another section, because
  the status compares the stored key with the article's rendered keys
  (`renderedSectionKeys`).
- Both can be deleted. While the article list is loading, nothing is judged.
- Uses the app's cached article list, so it works offline.

## Fix found on the way

`initialSection` scrolling never ran. Layout events fire child-first, so
the sections were measured before their containers' offsets were known.
This also affected "open from a saved highlight". The scroll is now
retried when the containers are measured.

## Accessibility

- Section labels in the article and in the Then & Now section were below
  WCAG AA contrast (terracotta 3.47:1 / gold 1.91:1 / muted 4.35:1). They
  now use the theme's existing text-safe shades.
- Bookmark toggles name their section and announce saves.

## Storage

- **Writes are serialized per storage key** (`services/storage/serialWrites.ts`).
  All owners share one persisted object, so there is one queue per key.
- Each mutation runs inside the queue and goes through four steps:
  1. it reads the LATEST state;
  2. it computes the change;
  3. it writes to storage;
  4. only then does it publish.
- Two overlapping saves (same or different owners) can't overwrite each
  other.
- **A failed write:**
  - the operation reports failure and nothing is published;
  - the queue moves on, so the next operation still runs;
  - the queue never retries on its own; Retry stays the user's choice,
    with the same messages as before.
- **Account switch while a write is pending:** the write completes for the
  account that started it. The screen doesn't apply its result, such as an
  open editor or an error, to the new account.

- `oyno.sectionBookmarks.v1`: `{ <owner>: { <key>: bookmark } }`, on this
  device, per owner, at most 200.
- Writes go to storage first. A failed or unreadable load is an error state
  with Retry that blocks writes. Not synced, not in the learning-data
  export.

## Scope

- Culture item articles only. Material pages have no named sections in the
  navigator yet.
- Bookmark controls are hidden in the simple (child) depth, which renders
  one summary instead of sections.

## Tests

- `reading/sectionBookmarks.test.ts`:
  - one bookmark per key; invalid anchors refused;
  - the route uses the key;
  - an article change leaves the note on its own, now missing, section;
    missing article; loading;
  - tampered storage;
  - store per owner, restart, failed write, unreadable data blocks writes;
  - control: failure keeps the note, Retry saves the current text, another
    account sees nothing.
- `e2e/tests/reading-companion.spec.ts`:
  - bookmark a section with a note (axe) -> leave -> Culture -> section
    notes (axe) -> an old bookmark for a removed section keeps its note ->
    reopen: the section is in view -> delete the outdated bookmark;
  - KG: Continue reading opens `?section=history`; Clear reading position
    removes the card.
