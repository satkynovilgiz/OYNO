# Symmetry Playground (2026-10-08)

- **Route:** `/culture/oymo/symmetry`. The entry is "Symmetry Playground" in
  the Oymo Creator.
- **Code:** `src/features/culture/oymo/symmetry/` (`playgroundModel.ts` is
  pure).

## What it reuses

- **Symmetry modes:** the Creator's three (`none`, `mirror`, `fourWay`).
  Copies come from the Creator's own `computeMirroredPoints`, using 5 × 5
  cell centres in the canvas's 300 × 300 coordinates. A test checks that the
  Creator draws exactly the playground's result for the same layers and
  mode.
- **Motif shapes:** `getMotifShape`. As in the Creator, only POSITIONS are
  reflected; each motif keeps its own direction, and the screen says so.

## Screen

- **Your design:** an editable 5 × 5 source grid.
  - Tap an empty cell to place the chosen motif.
  - Tap a motif to pick it up, then tap a cell to move it, or use Remove.
    This is the tap-based alternative to dragging.
  - Or drag a motif by whole cells. The grid, as the ancestor of the cells,
    takes over the touch once it moves.
  - Each cell is a labelled button: "Row r, column c: motif".
- **Result:** the transformed pattern. Copies are drawn lighter than the
  originals, and the guide lines are the REAL axes: a vertical line for
  Mirror, vertical and horizontal lines for Four-way. A switch hides the
  guides.
- **Undo** steps back one change (up to 50); **Reset** clears the design and
  can itself be undone.
- **The rule (geometry):** a plain explanation of the selected rule, for
  example "Columns 1 and 5 swap…" or "two reflections = half a turn".
- **About the motifs** is a separate, dashed section. The playground explains
  geometry only and invents no motif meanings; it links to OYNO's oymo
  article instead. A test checks that the playground texts make no meaning
  claims.
- **Challenges** (decided by the model, never by screenshots). A challenge is
  solved when the result's (cell, motif) set equals the target exactly, and
  the rule matches when it is fixed. The screen shows how many marks are
  still missing or extra.
  1. **Twin horns:** Mirror.
  2. **Four corners:** Four-way.
  3. **Which rule?:** the player chooses the rule.
- **Open in Creator (unsaved copy):** a deep copy of the SOURCE pieces is
  handed over with the playground's rule.
  - The Creator opens it as a new design, with the note "A copy from the
    Symmetry Playground - it isn't saved yet".
  - It is not linked to any saved creation, and nothing is written; e2e
    checks for no write requests.
  - The handoff now carries the symmetry mode and its source. Restore the
    Pattern still hands over `none`.

## Platform and accessibility

- Fully local: it works offline (e2e).
- KG/RU/EN; large chips in child mode.
- There is no animation, so Reduce Motion has nothing to turn off; dragging
  is direct manipulation only.
- Narrow phones get the grids stacked full width; at 700 pt and wider they
  sit side by side. e2e covers 320 px and 412 px with no horizontal
  overflow.

## Tests

- **Unit (`playground.test.ts`):**
  - transformations, including centre-line cells and bounds;
  - the result matches the Creator;
  - edit validity;
  - undo, reset and the history bound;
  - every challenge solved, a fixed rule enforced, extra or wrong motifs
    rejected;
  - copy isolation;
  - texts.
- **e2e (`symmetry-playground.spec.ts`):**
  - tap, pick-up-and-move, mouse drag, the rules and guides, undo/reset and
    the guide toggle at 320 and 412 px;
  - a challenge solved, then Open in Creator;
  - offline (KG); axe (RU).

## Device checks: PENDING

- [ ] Touch drag on iOS and Android, including inside the scroll view: a
  vertical drag on a motif moves the motif, and on an empty cell scrolls
  the page.
- [ ] VoiceOver / TalkBack: the cells read row, column and content; picking
  up and moving works by double-tap.
- [ ] The largest Dynamic Type: the chips wrap and the grid stays usable.
