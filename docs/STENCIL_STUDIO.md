# Stencil Studio

The entry is **Make a stencil** in the Oymo Creator, shown when the design has motifs. It opens
`/culture/oymo/stencil`.

The page is an **outline page for colouring in or tracing. It is not a cut-ready stencil.** No
cutting bridges are generated, so enclosed pieces would fall out if cut. The screen says this
first, and the note can optionally be printed.

## Geometry

The preview and the PDF use the same geometry.
- `motifGeometry.ts` holds every motif's own drawing primitives as data.
  `motifGeometry.test.ts` checks that it matches what each shape component in `motifs.tsx` draws.
- `buildStencilPage` uses the Creator's own placement:
  - `getLayerRenderPoints` for every symmetry copy;
  - the 36 pt shape box;
  - rotation, then uniform scale, about the copy's centre.
  - Hidden layers are not drawn, as in the Creator.
- The SVG transform of each element is tested against `toCanvas` at several rotations and scales.
- Lines are black and the chosen thickness is the same printed width on every motif. Colours and
  the background are never used.
- Filled dots become rings. A dot too small for the chosen line stays solid, and the screen
  explains why.
- An unknown motif id is left out and reported, never replaced. Motifs drawn with open lines are
  named, because they print as lines rather than fillable areas.
- The preview (`StencilPreview`, react-native-svg) and the PDF (`stencilSvg`) render the same
  `StencilPage`. The dashed blue safe-margin line appears only in the preview.

## Page and output

- **Page:** A4 portrait or landscape, with a 36 pt (12.7 mm) safe margin and a band for labels.
- **Line thickness:** thin 0.5 mm, medium 1 mm or thick 1.6 mm.
- **Placement guides** (optional): centre lines and the design frame, in dashed grey.
- **Printed size at 100 % ("Actual size"):** 185 mm square (portrait) or 162 mm square
  (landscape). The screen states this, and that "Fit to page" or printer margins can shrink it.
- **Labels:** only the ticked ones are printed: design name (saved designs only), motif names, and
  the "not cut-ready" note. Nothing else goes on the page.
- **Output:** one PDF page (`OYNO-Stencil-YYYY-MM-DD.pdf`). It uses the shared `printAndSharePdf`
  from `memoryBookService.ts`: expo-print, then the share sheet, then temp-file cleanup in
  `finally`. This is the same flow the Journal Memory Book uses.
- **Where export works:** native builds that include ExpoPrint and ExpoSharing. Web, and builds
  without those modules, show the preview with a plain "PDF export isn't available here".
- **Failures:** a failed export keeps every setting and offers Retry. If sharing is unavailable,
  the screen says so.
- **The original:** the Creator hands over a copy (`setStencilSource`). The saved design, its
  colours and its record are never written.

## Tests

- `src/features/culture/oymo/motifGeometry.test.ts`
- `src/features/culture/oymo/stencil/stencil.test.ts`: transformation geometry, symmetry copies,
  thickness, page layout, label selection, limitations, original untouched.
- `src/features/culture/oymo/stencil/stencilScreen.test.ts`: failed export, then Retry with the
  same page.
- `e2e/tests/stencil-studio.spec.ts`: saved design → stencil preview, element counts, settings,
  labels, the web "unsupported" state, axe, no writes.

## Visual check

Representative pages were printed to PDF with Chromium's PDF engine, which is not expo-print:
- `docs/images/stencil-portrait-fourway.png`: four-way, rotated and scaled motifs, guides, all
  three labels.
- `docs/images/stencil-landscape-mirror.png`: mirror symmetry, thick line, no labels.

Each was a single A4 page with the right orientation, and the copies sat where the Creator puts
them.

## Pending

- expo-print output on iOS and Android, and the share-sheet hand-off.
- Printing on paper: checking at 100 % that the design measures 185 / 162 mm, that the margins
  survive and that line weights are as stated.
