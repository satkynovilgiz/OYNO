# Oymo postcard (2026-10-07)

Route: `/culture/oymo/postcard?pattern=<saved id>`.

- Entry: open a saved pattern in the Oymo Creator. While it is unchanged,
  "Create postcard" appears. Once the pattern is edited, the button goes
  away, because the postcard is always made from the saved version.
- Code: `src/features/culture/oymo/postcard/`, plus `components/OymoArtwork.tsx`.

## What it does

- **Copy, never the original.** `startPostcard()` deep-copies the saved
  pattern's layers, background and symmetry. The flow makes no write call
  at all; a unit test checks the source, and the e2e test fails on any
  request to the saved-pattern table.
- **Formats.** Portrait 360 × 450 (exported at 1080 × 1350) and square
  360 × 360 (exported at 1080 × 1080).
- **Layouts.**
  - Classic: the pattern on its own background, with the greeting below
    it, or above it when the pattern is placed at the bottom.
  - Banner: a full-width band in the pattern's colour.
  - Border: the pattern tiled in strips at the top and bottom.
- **Placement.** Size (small / medium / large) and position (top / centre /
  bottom). Border centres the pattern itself.
- **Background.** The pattern's own colour, cream, forest or gold.
- **Greeting.** Optional, up to 80 characters, counted in letters (code
  points), so Kyrgyz and Cyrillic letters and emoji are never split.
  - A live counter announces when the limit is reached; newlines become
    spaces.
  - The font steps down 24 → 20 → 17 → 15 with a line height of 1.4×, so
    accents and descenders are not clipped.
  - The worst case is tested: 80 of the widest glyph (Ж) at 15 pt fits the
    box.
  - Text colour is dark ink or white, whichever reaches 4.5:1. On mid-tone
    pattern backgrounds where neither does, the greeting sits on a cream
    plate.
- **Only what is chosen.** The card holds the copied pattern, the background
  and the greeting. It has no pattern name, account, date or OYNO wordmark.
- **Patterns.** Only the existing motifs (`motifs.tsx`) are used, drawn with
  the live canvas's own geometry.

## Preview = export

- The shared share tools are extended rather than duplicated:
  - `ShareCard` has a new `postcard` variant, whose artwork is the whole
    card at its own size.
  - `shareCardSize()` gives each card's logical size.
  - `SharePreviewSheet` previews at that aspect ratio.
  - `useShareCard` captures at that size × 3.
- The screen preview, the sheet preview and the off-screen capture all
  render the same `PostcardView` at the same logical size.
- Tests:
  - The unit test checks that the exported tree equals the preview tree.
  - The e2e test checks that the sheet's card HTML equals the screen's, the
    aspect ratio in both formats, and that the greeting box doesn't
    overflow.
- If an export fails, the preview sheet stays open with a toast. The
  composition lives in the screen and is never reset.

## Temporary files

`services/share/exportFiles.ts` keeps at most one captured file (this
applies to all share cards):

- the previous one is deleted when a new capture starts;
- a saved image is deleted as soon as Photos has its own copy;
- a failed share is deleted;
- a shared file is kept until the next export, because the receiving app
  may read it after the sheet closes.

## Platform support

| | iOS / Android (build with view-shot, expo-sharing, media-library) | Web |
| --- | --- | --- |
| Compose and preview | yes | yes |
| Share image | yes (1080 px JPEG) | no: the greeting is shared as text (existing share fallback; the screen says so) |
| Save to Photos | yes (write-only permission) | no |

Builds made before those native modules were added fall back to sharing
text, the same as every share card.

## Checks

- Unit (`postcard.test.ts`):
  - the original is never mutated or written;
  - every format × layout × size × position × greeting × background combo
    keeps its boxes inside the card with no overlap;
  - the greeting limit, worst-case fit and contrast;
  - the exported tree equals the preview;
  - repeated exports leave at most one file.
- e2e (`oymo-postcard.spec.ts`):
  - the flow from a saved pattern;
  - both formats and all three layouts with a long Kyrgyz greeting;
  - the sheet card is identical to the screen card;
  - no writes; the not-found state; KG/RU; axe.
- Representative images (portrait and square, screen and share preview,
  long Kyrgyz greeting) were captured in the e2e run and inspected: no
  clipped glyphs, the text stays inside the card, and the layouts match.

## Device checks: PENDING (not performed)

- [ ] iOS / Android: Share opens the system sheet with a 1080 × 1350
  (portrait) or 1080 × 1080 (square) JPEG that matches the preview.
- [ ] Save to Photos with the permission granted and denied. When denied,
  you get a message, the composition is kept, and no file is left behind.
- [ ] Repeated exports: the app cache holds at most one `ReactNative-snapshot`
  file.
- [ ] Kyrgyz, Russian and English greetings with system fonts at the largest
  text size: no clipping in the exported image.
- [ ] VoiceOver / TalkBack: the radio groups, the greeting counter and the
  share sheet.
