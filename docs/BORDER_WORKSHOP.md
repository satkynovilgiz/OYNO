# Border Workshop

`/culture/oymo/border` (entry in the Oymo Creator). Arrange motifs in one
tile and repeat it. The result is the user's own creation: no traditional
name or meaning is given to it.

## Tile

- A 3 x 3 grid of cells, using the Creator's motifs (`MotifGrid`) and
  colours (`ColorSwatches`).
- Tap to place; tap a motif to select it, then turn it 45° (the Creator's
  rotation rule), recolour it or remove it.
- Tile sizes: 60-120 pt.
- The tile lives on this screen (memory, per owner) and survives opening the
  Creator and coming back. No saved design is ever touched.

## Repetition (`borderModel.ts`, pure, deterministic)

| Layout | Tiles |
| --- | --- |
| Horizontal strip | `count` tiles in a row, centred vertically |
| Vertical strip | `count` tiles in a column, centred horizontally |
| Square frame | `count` per side; the 4 corner tiles are shared, so 4n - 4 tiles (1 when n = 1) |

- Coordinates are in the Creator's 300 x 300 canvas units, rounded to 0.01.
- Each piece becomes a layer at the centre of its cell, with a scale that
  fits the cell (inside the editor's 0.4-2.5).
- The frame dedupes tile origins, so corners are never doubled. Two layers
  that would land on exactly the same spot (only possible with overlap) are
  drawn once.

## Safe limits

- **Spacing:** from -half a tile to +40 pt, in 5 pt steps. Below 0 the
  tiles overlap: allowed, and explained ("The tiles overlap by N pt").
- **Count:** at most what fits on the canvas, AND what keeps the design
  within the Creator's layer limit. When at the limit, the screen says so.
- **Layer limit:** `MAX_OYMO_LAYERS = 200` in `oymoEditor.ts`. The Creator
  had **no** layer limit before this change. It is now enforced by the
  editor's own `addLayer`/`duplicateLayer`, and shared with the Time
  Capsule snapshot (which already capped at 200).

## Preview and handoff

- The preview renders `buildBorder(...).state` with `OymoArtwork`.
- "Open in the Creator" hands that SAME state over (deep-copied by the
  handoff) as a new unsaved design (`source: 'border'`, symmetry none).
- A readable summary lists the tile's pieces (row, column, motif, colour,
  turn), the settings, and the resulting tile and layer counts.
- No animation (Reduce Motion needs nothing). Offline. KG/RU/EN.

## Tests

- `border/border.test.ts`:
  - strip coordinates (exact values), vertical vs horizontal, everything on
    the canvas;
  - frame 1-5 per side: 4n-4 distinct tiles; no duplicate layers;
  - count capped by the canvas and by the layer limit;
  - the editor now enforces the limit;
  - overlap reported;
  - the tile is unchanged by repetition; edits return new tiles;
  - handed-off state = preview state, and an independent copy.
- `e2e/tests/border-workshop.spec.ts`:
  - at 320 and 412 px: tile with a turned motif -> 60 pt frame, 4 per side
    = 12 tiles / 24 layers -> overlap note appears and disappears -> max
    count (5) disabled with a note -> axe -> Creator copy -> Back keeps the
    tile;
  - RU, offline, reduced motion.

Pending on device: drawing performance of 200 layers on low-end Android.
