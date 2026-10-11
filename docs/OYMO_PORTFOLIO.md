# Oymo Design Portfolio

Profile -> **Oymo portfolios** (`/profile/oymo-portfolios`). A separate
feature from "My Learning Portfolio" (`/profile/portfolio`).

## Behaviour: LIVE references (one consistent rule)

- A portfolio stores **metadata only**:
  - title;
  - optional introduction;
  - up to 6 saved-creation **ids** in your order;
  - your captions.
- Designs are always drawn from the saved creation as it is now. If you
  edit a design, the portfolio shows the edit.
- **A deleted or unavailable design** stays in its place as a labelled
  placeholder ("This design is no longer saved"), with its caption, and can
  be removed. It never silently disappears.
- **While designs are still loading**, entries show "Loading…", not
  "missing".
- **Reordering** changes only the portfolio's ids; saved designs are never
  written (the e2e checks there are no writes).
- **Captions** are labelled "Your caption" and kept apart from everything
  else. Designs are the user's own creations, and no traditional meaning is
  given to them.

## Editing and saving

- Edits stay local until **Save changes**; "Unsaved changes" is shown.
- Saves use the serialized, write-first store (`usePortfolioStore`, the
  same queue as the Reading Companion and Listening Notebook): computed
  from the latest state, storage first, then shown.
- A failed save keeps every edit on screen with Retry. Unsaved edits also
  survive leaving the screen (memory, per owner and portfolio).
- A load error is an error state with Retry that blocks writes.
- Portfolios are per owner; another account never sees one.

## Preview

- **Grid:** 2 columns, or 1 column for large-text (child) mode and narrow
  screens.
- **One at a time:** Previous / Next.
- **As a list:** the readable alternative, with names, motif counts and
  captions.
- No animation (Reduce Motion needs nothing).

## Export

- Pick a design and choose whether to include your caption.
- The preview IS the exported card (`PortfolioCardView`, fixed 360 x 450,
  text not scaled). It goes through the existing `useShareCard` flow,
  which provides the export lock, temp-file cleanup and the native capture.
- **Fields** (`portfolioCardContent`): the portfolio title, the design's
  name and drawing, and the caption if included.
  - Never the recipe, the account, creation ids, the introduction or other
    designs (a unit test checks the keys).
- **If the share fails**, nothing in the portfolio changes: export reads
  the portfolio and never writes it.

## Device-only and offline behaviour

- Saved designs live in the account (signed in) and need a connection the
  first time. After that, the app's query cache serves them while offline.
- Without loaded designs, entries show as loading or unavailable, but their
  captions and order are kept.
- Portfolio metadata is local to this device and not synced or exported.
- On web the card is downloaded as an image. On iOS/Android it opens the
  system share sheet.

## Tests

- `portfolio/portfolio.test.ts`:
  - reordering never changes the designs;
  - the 6-design limit; a caption goes with its design;
  - missing vs loading placeholders; tampered data;
  - export card keys only (no intro, ids, account or recipe); caption
    toggle; independent artwork copy;
  - per-owner storage and restart;
  - screen: a failed save keeps the edits and Retry saves them; the
    exported content equals the previewed card; another account sees
    nothing.
- `e2e/tests/oymo-portfolio.spec.ts`:
  - create -> pick 2 -> reorder -> caption -> save -> grid (axe) -> one at
    a time -> list -> export card fields -> reopen after a restart; no
    writes to saved designs;
  - RU: a deleted design is a placeholder with its caption and can be
    removed.

## Pending native checks

- The captured PNG on iOS/Android (view-shot) at 3x; the e2e checks the
  same component's DOM, not the image.
- Share sheet cancel and failure paths on a device, and the temp-file
  cleanup there.
- Large system font sizes. The card ignores font scaling by design; the
  surrounding screens follow it.
