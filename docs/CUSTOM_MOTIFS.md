# Custom motifs (user-created)

- **Entry:** the Oymo Creator → **My motifs**.
- **Routes:** `/culture/oymo/motifs` (list) and `/culture/oymo/motifs/[motifId]` (editor, `new` to
  start one). The editor route is private in the route sanitizer.
- **Code:**
  - `src/features/culture/oymo/customMotif/` (`customMotifModel.ts`, `CustomMotifScreens.tsx`)
  - `src/features/culture/oymo/components/LayerMotif.tsx` (the shared renderer)
  - `src/store/useCustomMotifsStore.ts` (`oyno.customMotifs.v1`)

## Format: `oyno.customMotif` v1

```
{ format: 'oyno.customMotif', v: 1, id: 'cm-…', name, primitives, updatedAt }
primitive = { kind: 'line', x1, y1, x2, y2 }        // not zero-length
          | { kind: 'circle', cx, cy, r }            // r 1..12
          | { kind: 'polygon', points: [[x,y],…] }   // closed, 3..6 distinct corners
```

- Coordinates are integers on the built-in motifs' own 0–24 grid.
- At most 16 primitives, and at most 40 motifs per owner.
- Validation is strict. Anything else is rejected rather than "fixed".

## Rendering (identical geometry everywhere)

- `toGeometry()` turns the primitives into the same primitive type the built-in motifs use
  (`motifGeometry.ts`).
- `GeometryShape` draws them for the editor preview (20, 36 and 72 pt) and, through `LayerMotif`,
  for the Creator canvas, artwork renders, mini previews and the layers list.
- Stencil Studio outlines a custom motif from the same geometry.

## Designs and compatibility

- **Placing** creates a new, unsaved Creator design (handoff `source: 'customMotif'`) with one
  layer: `motifId: 'custom:<id>'` plus `custom: { v: 1, name, primitives }` **embedded in the
  layer**. Designs saved to the account carry their own geometry, and the save RPC stores layers
  as JSON unchanged.
- **Recipes, milestone snapshots, remixes, Color Lab, postcards and exports** copy layers, so they
  keep the embedded motif. A test covers remix, snapshot and handoff.
- **Unsupported or corrupt data** (another version, bad coordinates) renders as a marked
  placeholder labelled "a user-created motif in a format this version can't show". It is never
  replaced by a built-in motif. Stencil reports it as "can't be outlined", and nothing crashes.
- **Time Capsule** keeps the embedded geometry through its snapshot and storage normalization
  (`carryEmbedded`), including embeds it can't read, which stay placeholders (docs/TIME_CAPSULE.md).
- **Built-in motifs and existing saved designs are unchanged:** layers without `custom` render
  exactly as before.

## Editing

- **Tools:** line (two taps), circle (centre, then an edge point) and closed shape (3–6 corner
  taps, then Close). Every tap snaps to the grid.
- **Accessible parts list:** each part is described in words (for example "Line from (2, 3) to
  (20, 3)"), can be selected, moved one step with labelled arrow buttons, or removed.
- **Undo / Redo:** keep whole motif snapshots, so undo restores the complete previous motif.
- **Labels:** every view says *user-created*, and that OYNO gives the motif no traditional
  meaning.
- **Storage:** on this device per owner, not synced. Writes are serialized and write-first. A
  failed save keeps the drawing with Retry, and invalid stored motifs are skipped on load. It
  works offline.

## Tests

- `customMotif.test.ts`:
  - format validation (grid, integer, zero-length, radius, polygon size and duplicates, unknown
    kind, version, limits, garbage);
  - deterministic rendering inputs, and the embedded copy matching the drawing;
  - add, move and remove bounds;
  - undo restoring the complete previous motif;
  - immutability;
  - persistence round-trip per owner, invalid stored motifs skipped, failed writes;
  - compatibility: remix, snapshot, handoff, Stencil, invalid embedded motif reported, built-in
    layers untouched.
- `e2e/tests/custom-motif.spec.ts`: draw a line, a circle and a closed shape → undo/redo → move
  → save → place (the Creator draws the same path data as the preview) → reload → reopen with the
  same parts.

Device checks: PENDING. This includes grid tapping precision on touch screens.
