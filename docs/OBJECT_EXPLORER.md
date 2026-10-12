# Object Explorer

A reusable "tap a labelled point" explorer: `src/features/culture/explorer/` (`explorerModel.ts`,
`ObjectExplorer.tsx`).

## Status: no public illustration yet

No bundled boz uy image can carry accurate part points.
- The yurt artworks in `assets/img/culture/` are AI-generated illustrations
  (`docs/CONTENT_AUDIT.md`): they show no verifiable construction, and placing *tunduk*, *uuk* or
  *kerege* points on them would be guessing.
- `BozUyPartIllustration` draws one part at a time, not a whole yurt.

So `EXPLORER_ILLUSTRATIONS` is **empty**, and nothing is published.

The explorer runs only with an **internal labelled fixture**, `FIXTURE_ILLUSTRATION`. It's a simple
schematic drawn in code, shown at `/admin/explorer` behind `AdminGate` (non-admins get the
not-found screen). The fixture's drawing and its points come from the same constants
(`SCHEMATIC`), so the points can't drift. A banner on the screen says it's a schematic and not a
reviewed illustration.

## Asset needed before going public

- **A boz uy illustration or photo** that is licensed for reuse in the app (credit and licence
  recorded), shows the parts clearly, and is reviewed by someone who can confirm where each part
  is. A cutaway or exploded view is ideal.
- **For each point:** a stable id, x/y as a 0–1 fraction of the image, the reviewed name and
  description keys, and the source (article id and section key).
- **To publish:** add the entry to `EXPLORER_ILLUSTRATIONS`. It must pass `validateIllustration`,
  which checks the credit and licence, in-range coordinates, stable unique ids and sources. Then
  add a public route.

## Behaviour

- **Labels and descriptions:** only reviewed content. The fixture uses the Boz Üy Builder's part
  names and descriptions, which are sourced from the verified `boz-uy-overview` article, section
  "objects used". Each part shows "Source: article – section" and an **Open the source article**
  button, which opens `/culture/item/<id>?section=<key>`.
- **Markers:** small numbered dots. The selected part's text appears below the image, so labels
  never cover it.
- **Zoom:** 1×, 1.5× or 2×, with Reset. Points are placed from normalised coordinates at every
  size and zoom, and zooming or resetting keeps the selection.
- **Selection** is kept in memory per illustration and restored after returning from the source.
- **Numbered list:** carries the same name, description and source as the image. Selecting a
  list row selects the same point.
- **Unavailable source:** the button is hidden and the screen says whether the article was
  removed or can't load offline.
- **Offline:** article availability and titles come from the cached article list
  (`useAllCultureItems`). The fixture drawing is in code.

## Tests

- `src/features/culture/explorer/explorer.test.ts`: coordinate mapping at several widths and zooms,
  points sitting on their drawn parts, validation, missing sources, selection memory, source
  route.
- `e2e/tests/object-explorer.spec.ts`:
  - select → zoom (points stay aligned, selection kept) → reset → numbered list → open source →
    back to the same selection, at 320 and 412 px;
  - a removed source (RU);
  - non-admins blocked.

Device checks: PENDING.
