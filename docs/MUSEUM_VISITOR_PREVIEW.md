# Mini Museum: Visitor Preview

Exhibition editing -> **Preview as a visitor**.

## What it shows

A start screen with:
- three starting views: exhibition, guided tour, story;
- the readiness checklist;
- a permanent banner, "Visitor preview - read-only. This is what visitors
  see.", with **Return to editing**.

The starting views are the REAL visitor components, not copies:

| Start | Component |
| --- | --- |
| Exhibition | The same Present view (slides, OYNO content, labelled caption, curator narration) |
| Guided tour | `VisitorTour` |
| Story | `StoryPresent` with `preview`: the export action is replaced by the exported card itself (`StoryCardView`, the component the export captures), scaled to the screen width |

They show only what visitors see:
- the title, introduction and captions (labelled as the curator's);
- OYNO's content;
- reflections and narration.

The collection's private description and the editing controls are not
inputs to these views. The tests check both.

## Read-only

- Nothing in the preview writes the exhibition. Tour responses and the
  "viewed" state live in the tour component; the story position and the
  preview state are kept in memory only.
- Entering and leaving the preview leaves the stored exhibition
  byte-for-byte unchanged (checked in Jest and e2e).

## Returning to editing

- **Return to editing** (or the header Back) scrolls back to where the
  curator was. Any open narration editor is still open.
- Opening a source from the preview and coming back stays in the preview,
  even if the screen is re-created (memory slot bound to owner and
  collection).

## Readiness checklist (`previewModel.readiness`)

Only verifiable conditions are listed:

| Item | Condition | Opens |
| --- | --- | --- |
| No exhibits | The exhibition has none | Exhibit list |
| Unavailable | The exhibit's content is gone from OYNO (catalogue loaded) | That exhibit's row, with recovery guidance: remove it or keep it as a placeholder |
| No picture | Content has no image (visitors see a placeholder) | That exhibit's row |
| Story too short | 1-2 cards (3 needed) | Story section |
| Story card unavailable | Its exhibit is gone | Story section |
| Story card shortened | Its words exceed the card (see below) | Story section |

- Title, introduction, captions, narration and story words are optional and
  never listed.
- While the catalogue is loading, nothing about availability is judged.

## Story cards: fit, never silently cut (`previewModel.fitStoryCard`)

- One rule for the preview and the exported image, since they are the same
  component with the same numbers. The logical card is 360 x 450.
  1. Everything with the full 220 pt picture.
  2. Otherwise the picture shrinks, down to 120 pt.
  3. Otherwise the title is limited to 2 lines and the text to the lines
     left, with an ellipsis AND a visible note on the card ("Long words may
     be shortened to fit this card (ending with …)").
- Text inside the card ignores system font scaling, so the export is the
  same on every device.
- Line counts are a **conservative estimate** (glyphs counted wider than
  average), so real text uses at most the planned lines. With the
  curator's limits (title 40, text 200 characters), every tested KG/RU/EN
  case fits by shrinking the picture. Only an exhibit title longer than 2
  lines gets shortened.

## Tests

- `museum/preview.test.ts`:
  - checklist rules (unavailable, no picture, loading, no exhibits, story
    too short / unavailable / shortened, optional fields never listed);
  - fit cases: short, no words, KG/RU/EN at the maximum length,
    unbreakable words; each card's height is never over 450;
  - the real screen: every start view without the private description and
    without editing controls; saved content unchanged; the story preview
    renders `cardContent(...)`, the same content as the export; a checklist
    item opens editing.
- `e2e/tests/museum-preview.spec.ts`:
  - preview -> exhibition -> open source -> Back (still in preview) ->
    Return to editing (same scroll position) -> checklist item -> exhibit
    row in view -> remove it -> the checklist clears; stored content
    otherwise unchanged; axe; at 320 and 412 px;
  - story preview with the longest KG words at 320 px and in large text
    (child experience): every element inside the card, no text block
    clipped, no export action, no private text.

## Device limitations (PENDING)

- The exported PNG itself is captured natively (view-shot). On web the
  e2e checks the same component's DOM layout, not the captured image.
  Checking a real export on iOS/Android, with system font scaling at
  maximum, remains to do.
- Real font metrics differ by platform. The estimate is deliberately
  conservative, but very wide glyph runs on a specific Android font are
  unverified.
- Restoring the scroll position uses the measured layout; on native, with
  the keyboard open while returning, it is unverified.
