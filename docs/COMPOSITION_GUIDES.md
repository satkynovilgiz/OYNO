# Oymo Creator: composition guides and snapping

Optional editing aids in the Oymo Creator: a grid, the centre lines and a safe margin, with optional snapping when a motif is placed or dragged. They are **never part of the artwork**.

## What existed before

- **Symmetry lines.** Dashed lines in the editing canvas only (`SymmetryGuides`).
- **Zoom/pan** (docs/CANVAS_ZOOM.md). Session-only; every screen point is mapped to artwork units.
- **Position panel.** Numeric X/Y fields and nudges in artwork units, with Undo coalescing for runs of nudges.
- **Layout tools.** There was no grid, no snapping and no drag-to-move. A placed motif could only be moved with the Position panel.

## User flow

1. **Guides** panel under the zoom controls: tick **Grid**, **Centre lines** and/or **Safe margin**. With the grid on, choose its spacing: every **10**, **25** (default) or **50** points.
2. **Snap to guides** is on by default, but only has an effect while at least one guide is shown. Without a guide the option is disabled and says so.
3. **Tap** to place a motif: it snaps to the nearest shown guide within 6 points, on each axis separately. **Select** a motif, then **drag** it (or any of its mirrored copies) to move it with the same snapping.
4. **Free placement:** untick Snap. On web or with a hardware keyboard you can instead hold **Alt** (Option on a Mac) while placing or dragging.
5. **Preview artwork** hides the guides, the symmetry lines, the selection and the editing tools. Taps don't edit while previewing. **Back to editing** returns.

## Rules (`src/features/culture/oymo/guides/compositionGuides.ts`)

- **Separate from the artwork.** Guide settings and preview are Creator `useState`, like zoom/pan. They are not saved, not in history, recipes, layers, saved designs or exports. Toggling them adds no Undo step (E2E checks that Undo stays disabled).
- **Artwork coordinates.** Guide positions, `SNAP_DISTANCE` (6) and snapping all work in 0–300 artwork units. A point is mapped from the screen through the viewport first, so the same artwork position snaps identically at every zoom and pan (unit-tested at every zoom step, with and without pan; E2E checks 200% against 100%).
- **Snapping.**
  - Each axis snaps independently, to shown guides only, within 6 points inclusive.
  - The nearest line wins. A tie goes to the centre line, then the margin, then the grid.
  - The result is clamped to the artwork and rounded to the integer grid that layers use.
- **Spacings.** 10, 25 and 50 all divide 300, so every grid is symmetric about the centre.
- **Safe margin.** 30 points (10%) in from each edge: a motif at normal size is then clear of the frame edge and its rounded corners. It is a layout aid, not a rule of the craft.
- **Symmetry.**
  - Snapping moves the layer's own point, and the mirrored copies follow.
  - Dragging a copy moves the layer by the mirrored movement (`startDrag` picks the reflection of the grabbed copy).
  - All guides are symmetric, so the grabbed copy lands on the mirrored guide (unit-tested).
- **Custom motifs.** A move changes only `point`. Embedded custom geometry, rotation, scale and colour are untouched (unit-tested).
- **History.**
  - A drag is shown live in the canvas and committed **once on release** as one `move` step (`applyMove(..., coalesce = false)`). It is one Undo and one recipe step.
  - Consecutive nudges still merge into one step, as before; a drag ends any run of nudges.
  - A drag that starts anywhere except the selected motif pans the view, as before.
- **No accidental placement.** A drag never places a motif. A tap during a gesture, or in the 250 ms after one, is ignored (see CANVAS_ZOOM.md).

## Snapping indicator

- While snapped, the guide line(s) light up in terracotta at 2 px, mirrored where the symmetry places a copy.
- A line under the canvas says what was snapped to and where, e.g. "Snapped to a centre line: 150, 100". It is a polite live region.
- The indicator clears on the next gesture or when settings change. It is static, so Reduce Motion needs nothing extra; the Creator has no guide animations.
- Guide lines are a light halo under a dark line, so they read on light and dark backgrounds. Their widths are divided by the zoom, so they stay hairlines.

## Accessibility

- Each guide toggle is a labelled **checkbox**. The spacing control is a **radiogroup** of real radios. Preview is a button whose label changes ("Preview artwork" / "Back to editing").
- **Numeric alternative:** the Position panel (X/Y in artwork units, nudges of 1 or 10) gives exact positions without dragging. Its values don't snap, so any position is reachable.
- axe passes on the guides panel and on the preview (E2E).
- Strings are in KG, RU and EN, including Russian plurals for the spacing labels.

## Export exclusion

- `GuidesOverlay` is rendered only by the zoomable editing canvas (`OymoCanvas`), and only outside preview.
- Exports, share cards, postcards and other screens draw through `OymoArtwork`, which has no guides, symmetry lines or selection.
- A unit test walks `src/` and asserts that only `OymoCanvas.tsx` imports `GuidesOverlay`.
- The E2E checks that the share preview card contains no guide, handle or indicator elements.

## Tests

- **Unit:** `guides/compositionGuides.test.ts` covers:
  - spacings, symmetry of the guide lines and defaults;
  - snapping boundaries (exactly 6 snaps, 6.01 doesn't) and tie priority;
  - independent axes, clamping and rounding;
  - zoom/pan independence for taps and drags;
  - dragging a mirrored copy, and mirror-equivalent snapping;
  - custom geometry preserved;
  - settings kept out of `MotifLayer`, and the Creator wiring (useState; one commit per drag);
  - export exclusion;
  - KG/RU/EN key parity.
- **E2E:** `e2e/tests/composition-guides.spec.ts` covers:
  - enable centre lines and a 50-point grid (no Undo step);
  - a tap at (147, 98) snaps to (150, 100), with the indicator shown;
  - select, then drag to around (203, 147), which snaps to (200, 150);
  - holding Alt drags freely to (213, 141);
  - Undo twice returns to (200, 150), then (150, 100);
  - Preview hides guides, handles and Position, and a tap doesn't place;
  - axe, and the share card contains only the artwork;
  - KG: a 200% tap snaps to (100, 100), matching 100%; the safe margin snaps to (30, 270).
- **Screenshots:** `e2e/.results/composition-guides.png` and `composition-guides-preview.png`.

## Pending: physical-device checks (not performed)

1. Dragging the selected motif with a finger on iOS and Android: the motif stays under the finger, and snapping feels right at 1× and 3×.
2. Starting a drag on the selected motif versus beside it (pan) is reliable. The grab area is the motif's drawn size: an 18-point radius at scale 1, in artwork units, so it grows with zoom. Small motifs at 1× may be hard to grab with a finger; the Position panel is the fallback.
3. VoiceOver / TalkBack read the checkbox and radio states and the snapping live region.
4. Alt-to-free with a hardware keyboard on iPad.
