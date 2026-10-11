# Cultural Scrapbook

Profile -> **Cultural scrapbooks** (`/profile/scrapbooks`). Up to 20
entries per scrapbook.

## Entries: LIVE references, all of them

| Kind | Source record (existing) | Opens |
| --- | --- | --- |
| Article | culture item / material (`useConnectionContent`, cached offline) | `/culture/item/<id>` or `/culture/material/<id>` |
| Journal reflection | `useJournalStore` entry (not deleted) | `/journal/<id>` |
| Oymo design | saved creation (`useOymoCreations`, account) | `/culture/oymo/create?creation=<id>` |
| Listening moment | `useListeningNotebookStore` moment | `/culture/komuz/listen?resumeTrack=…&at=…` |

- An entry stores only `{ kind, id }`, a short title snapshot and your
  caption. What is shown comes from the source as it is now.
- The title snapshot is used only to label a **placeholder** when the
  source is gone. The placeholder keeps your caption.
- Rearranging, captioning or removing entries never writes a source record
  (the e2e checks that journal and notebook storage are unchanged).
- Captions are labelled "Your caption", apart from the source's
  information.
- **Time capsules can't be added**, so a sealed capsule's contents can
  never enter a scrapbook. The screen says so.

## Editing and saving

- Edits go to a local draft (kept across source navigation, in memory, per
  owner and scrapbook) and are saved with **Save changes**.
- `useScrapbookStore` is serialized and write-first (the same queue as the
  other private stores): computed from the latest state, written, then
  shown.
- **Edits during a pending save:** the save sends what was on screen when
  it started. If you edit while it is being written, the newer edits stay
  in the draft as "Unsaved changes" and are not discarded; the next save
  stores them (tested with a deferred write).
- A failed save keeps everything with Retry. A load error blocks writes.

## Reading

**Read** mode shows one entry per page (Page N of M, Previous / Next): the
source block, then your caption, then **Open the source**. Whole-book
export is deferred.

## Offline and backup (actual behaviour)

- Metadata is in `oyno.scrapbooks.v1`, on this device per owner. It is not
  synced and not in the learning-data export.
- **Sources keep their own storage:**
  - articles: cached content, readable offline after one load;
  - journal: on device, and private sync when signed in;
  - designs: in the account, and need a load;
  - listening moments: on device.
- While a source can't load, the entry shows "Loading…" or the placeholder;
  nothing is erased.

## Tests

- `scrapbook/scrapbook.test.ts`:
  - live resolution, missing (snapshot + caption) and loading;
  - ordering touches only the scrapbook; 20 maximum; no duplicates;
    capsule references dropped;
  - per-owner storage; a failed write changes nothing;
  - screen: an edit made during a pending (deferred) save survives it, and
    the next save stores both; a failed save keeps the edit; another
    account sees nothing.
- `e2e/tests/scrapbook.spec.ts`:
  - add an article, a journal reflection and a moment -> reorder ->
    caption -> save -> read -> open the article -> Back -> reopen after a
    restart; sources unchanged;
  - RU: a deleted source's placeholder keeps the caption.
