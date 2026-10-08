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
  - The font steps down 24 → 20 → 17 → 15 → 13 with a line height of 1.4×,
    so accents and descenders are not clipped. The 13 pt step exists only so
    that 80 emoji fit; it is 39 px in the export.
  - Sizing uses ONE conservative width table per character class (bold
    system font, em):

    | Characters | Width |
    | --- | --- |
    | Ж Ш Щ Ю М W M Ф Ы | 1.05 |
    | ж ш щ ю м w m ф ы | 0.9 |
    | other capitals and digits | 0.8 |
    | other letters, including ң ө ү | 0.68 |
    | narrow punctuation and space | 0.4 |
    | emoji | 1.3 |

  - The text is wrapped greedily, the way a text engine does it, and an
    over-long word breaks across lines.
  - `greetingFontSize()` picks the largest size that `fits()` with that same
    table, so the size chosen is the size that was checked. (Before
    2026-10-07 the choice used 0.62 em while the worst-case check used
    0.95 em.)
  - The text box is the greeting box minus 8 pt of padding (296 × 116).
  - Verified two ways:
    - Unit tests: every 80-character string of each widest glyph, Kyrgyz
      letter and emoji fits at the smallest size, and the size chosen for
      representative greetings is the largest that fits.
    - Web e2e test: it renders 80 × Ж, 80 × Ш, 80 × W, Kyrgyz, mixed
      KG/RU/EN and long-word greetings in both formats and all three
      layouts. In the DOM, the font size equals the chosen size and the
      rendered height fits the box: the worst is 112 / 116, the 80 × Ж
      case is 105 / 116.
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
- **Failures and retries.** The preview sheet stays open until the image
  has really been handed over.
  - If the capture or `shareAsync` rejects, the same card stays open, a
    toast says so, the failed file is deleted, and Share can be pressed
    again at once.
  - Only one export runs at a time: a second Share, or Share + Save in the
    same frame, is ignored.
  - The composition lives in the screen and is never reset.
  - All of this is tested through the real hook (`useShareCard.test.ts`)
    and the real screen (`postcardScreen.test.ts`).

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

- [ ] iOS: the system share sheet presents over the open preview sheet (it
  now stays open while sharing); dismissing it closes the preview.
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

## Design set (2026-10-07)

The same composer now makes a matching set from one copy of the saved
pattern. There is no new editor; it uses the same `PostcardView`,
`ShareCard` postcard variant and `useShareCard` export.

| Output | Logical size | Exported |
| --- | --- | --- |
| Square card | 360 × 360 | 1080 × 1080 px |
| Portrait card | 360 × 450 | 1080 × 1350 px |
| Phone wallpaper | 360 × 780 | 1080 × 2340 px (19.5:9) |

Each output's size is shown under its thumbnail and above the preview.

- **Shared:** the greeting and the palette (background), via
  `updateShared`. They apply to every output.
- **Per output:** layout, pattern size and position, via `updatePlacement`.
  Changing one output returns the other outputs' placements as the same
  objects, unchanged. This is tested in the model, the screen and e2e.
- **Wallpaper:**
  - A SUGGESTED clock area (`CLOCK_ZONE`: y 56–292 of 780) and a 96 pt
    bottom reserve are kept free of the greeting in every layout,
    placement and greeting combination (tested).
  - The pattern may sit behind the clock area.
  - The composer draws a dashed "Suggested clock area" guide over its
    preview (it can be switched off). The guide is never part of the export:
    the share sheet shows, and captures, the plain `PostcardView`.
  - The screen says lock screens differ between phones. No compatibility is
    promised.
- **Square and portrait** are laid out exactly as before; the reference boxes
  are pinned in a test.
- **Export:** "Preview, then share or save the <output>" exports only the
  selected output, at its own size × 3. A failure keeps the sheet open,
  retryable, and the whole set is unchanged. The temporary-file rules above
  are unchanged.
- **Web:** compose and preview all three outputs. The image can't be saved
  or shared there; only the greeting text can be shared.

Representative outputs (square, portrait, and wallpaper with and without
the guide, using a Kyrgyz greeting) were rendered in the e2e run and
inspected.

Device checks (PENDING):

- [ ] Set the wallpaper as a lock screen on a few iOS and Android phones and
  confirm the greeting clears the clock.
- [ ] Saving a 1080 × 2340 image to Photos works on both platforms.
