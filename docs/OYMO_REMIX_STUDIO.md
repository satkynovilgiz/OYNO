# Oymo Remix Studio

`/culture/oymo/remix` - variations of the design open in the Creator
("Explore variations", shown once the canvas has at least one layer).

## What a variation is

The ORIGINAL design with up to three of the Creator's own changes:

| Change | How | Notes |
| --- | --- | --- |
| Palette | The design's distinct colours, in order of first use, become the palette's colours (cycling) | 4 curated palettes from the theme colours; names describe colours only |
| Background | The Creator's `setBackgroundColor` | 4 theme colours (the current one is not offered) |
| Symmetry | The Creator's render-time `computeMirroredPoints` | See below |

Motifs, positions, rotation, scale, visibility and layer order are never
changed. Nothing is generated or given a meaning; the change list states
only what changed ("Background changed: Cream → Dark green", "Mirror
symmetry applied"), computed by comparing the original and the variation.

### Copies already in the layers

Layers normally hold only originals, and the symmetry mode draws the
copies. A design can also contain copies as SEPARATE layers (placed by
hand, or a copy from another lab). `bakedSymmetry` detects that: every layer
has its mirror copies as other layers with the same motif, colour, rotation,
scale and visibility, and at least one copy group lies off the axis.

- A STRONGER mode keeps the first layer of each copy group and lets the
  mode redraw the copies, so nothing is drawn twice. The change says how
  many copy layers were merged.
- A WEAKER mode is not offered: it would mean deleting the user's layers.
- The current effective mode is shown as "how it looks now", not as a
  change.

## The original is preserved

- The Creator hands the studio a deep copy (in memory, bound to the owner;
  another account gets nothing). The studio works only on copies.
- "Open variation in Creator" uses the Creator handoff: a NEW, unsaved
  design with the note "an unsaved copy of a variation". The saved
  creation, the design that was open, and its Pattern Recipe are not
  touched. Going back returns to the original Creator as it was.
- The preview and the handed-off design are the same object
  (`toCreatorState(applyRemix(...))`); a screen test checks they are equal.

## Accessibility, languages, motion

- Original and variation side by side, each with a spoken description, and
  the same comparison as a written list (layers, motifs shown, colours,
  background, symmetry).
- Option buttons carry a text label (plus a small preview); unavailable
  symmetry options explain why. Changes are announced.
- No animation in the studio (Reduce Motion needs nothing extra; pressed
  feedback already follows Reduce Motion).
- KG/RU/EN. All processing is on the device; works offline.

## Tests

- `remix/remix.test.ts`: baked-copy detection, no double drawing, options
  offered, palette mapping, the change list, deep copies, owner-bound
  source, Creator copy = preview.
- `remix/remixScreen.test.ts`: the opened copy equals the previewed
  variation; the original is unchanged.
- `e2e/tests/oymo-remix.spec.ts`: saved design with a mirrored pair ->
  4-way merge, palette, background -> list comparison -> unsaved copy ->
  Back to the original (still the saved design with its recipe, nothing
  written); RU, offline, axe; a direct link shows "no design".

## Pending (not checked on a device)

- iOS/Android rendering of the thumbnails and the side-by-side comparison
  on small phones and with large text.
- VoiceOver/TalkBack reading of the option labels and announcements.
- On web, the BROWSER back button returned to a fresh Creator in the e2e
  run (the in-app Back buttons return to the original Creator with its
  state). The saved design is unaffected either way; native back was not
  checked.
