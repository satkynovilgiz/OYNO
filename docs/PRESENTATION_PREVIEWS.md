# Presentation previews (Oymo)

This feature shows the current design as a **visual mockup** on paper, on fabric, or plain. It is not a manufacturing simulation: nothing here says how a real print, felt piece or textile would come out, and the screen says so.

- **Entry:** in the Creator, "Preview on paper or fabric" appears once the design has motifs. It opens `/culture/oymo/preview`.
- **The design never changes.** The screen receives a copy for the current owner (`setPreviewSource` / `previewSource`, in memory). Switching surfaces only changes what is drawn over that copy, and nothing is written back to the Creator, saved designs or recipes.
- **Geometry and colours are preserved.** The design is drawn by the same `OymoArtwork` renderer used elsewhere, and the surface is a separate SVG layer over it (`pointerEvents="none"`).
- **Plain** is always available and shows the colours exactly as saved.
- **Perceived colour is explained** for each textured surface:
  - **Paper:** the grain and edge shading make colours look warmer and darker.
  - **Fabric:** the threads and the light across the cloth make colours look lighter at the top and darker at the bottom.
  - Either way, the saved colours do not change.

## Export

- **One switch:** "Include the surface in the exported image". When it is off, or the surface is Plain, the export is the plain design (`exportSurface`).
- **Same rendering for preview and export.** The share card's `artwork` is the same `SurfacedArtwork` component as the on-screen preview. The existing share flow then shows that exact card before anything is shared, captures it at 1080 × 1350 on native, and cleans up its temporary files as before.
- **Nothing private.** The card shows only the design, the generic title "My design" and the "Oymo" label. There is no design name, account, recipe or notes.
- **Web** keeps the existing text fallback (image sharing needs native modules).

## Texture provenance

All textures are original vector patterns drawn in code by this project. No photographs, scans or third-party files are bundled, so there is nothing to license. The same records are in `surfacesModel.ts` (`TEXTURE_PROVENANCE`), and a test keeps this table in step with them.

| Surface | Source | File | Created | What it is |
| --- | --- | --- | --- | --- |
| paper | Original code (OYNO project) | src/features/culture/oymo/surfaces/SurfaceTexture.tsx | 2026-10-14 | A deterministic speckle tile (fixed seed, no `Math.random`) and a soft radial edge shade |
| fabric | Original code (OYNO project) | src/features/culture/oymo/surfaces/SurfaceTexture.tsx | 2026-10-14 | A plain-weave thread tile (alternating warp and weft lines) and a soft diagonal light gradient |

## Accessibility and motion

- **Description.** The preview has an image description with the surface, the number of motifs and colours, and "a visual mockup".
- **Controls.** The surface choice is a radio group, and the export switch has a label.
- **Reduced motion.** Switching surfaces fades in over 160 ms; with Reduce Motion on, there is no transition.

## Performance

- **Cost is flat.** Each texture is a repeating `<Pattern>` tile (26 dots, or 4 lines) plus one gradient, so the cost does not grow with the image size.
- **Web E2E measurement (headless Chromium, this machine, 2026-10-14).** 12 surface switches took 58–69 ms each, 66 ms on average, measured from the click to the new stage being visible (`e2e/.results/surface-switch-ms.txt`, written by the test). The test fails if the average exceeds 250 ms.

## Tests

- **Unit:** `src/features/culture/oymo/surfaces/surfaces.test.ts` covers:
  - provenance matches this doc and no image assets are bundled;
  - the grain is deterministic;
  - the screen works on a copy, per owner;
  - the overlay sits over the unchanged renderer;
  - export selection, a single rendering path and no private fields;
  - reduced motion;
  - KG, RU and EN strings.
- **E2E:** `e2e/tests/surface-preview.spec.ts` covers:
  - surface switching and the colour notes;
  - the share preview card shows the chosen surface, or plain when it is left out;
  - the Creator's design is unchanged afterwards;
  - axe passes;
  - KG at 320 px.
- **Screenshots** were reviewed: `e2e/.results/surface-*.png`.

## Native export checks: PENDING (needs a physical iOS and Android device)

- The captured 1080 × 1350 image matches the preview for paper, fabric and plain.
- Texture detail is preserved in the JPEG (quality 0.92).
- Save to Photos works.
- The temporary file is removed after sharing.
- Switching speed on a low-end Android phone.
