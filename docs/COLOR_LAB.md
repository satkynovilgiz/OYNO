# Color Lab

**Entry:** the Oymo Creator → **Color Lab**, shown when the design has motifs.
**Route:** `/culture/oymo/colors`.
**Code:** `src/features/culture/oymo/colorLab/` (`colorLabModel.ts`, `ColorLabScreen.tsx`).

It reuses existing pieces rather than adding another editor:
- `OymoArtwork` for rendering;
- the remix palettes and backgrounds (`remixModel.ts`), plus the Creator swatches as choosable
  colours;
- `applyRemix` / `toCreatorState` and `handOffToCreator` (`source: 'colorLab'`) for the unsaved
  copy.

## Methods (deterministic, offline)

- **Contrast:** WCAG 2.x relative luminance. Each sRGB channel is linearised (threshold
  0.04045), then L = 0.2126 R + 0.7152 G + 0.0722 B, and the ratio is (L1 + 0.05) / (L2 + 0.05),
  rounded to 2 decimals.
  - Every motif-colour pair and every motif colour against the background is listed, weakest
    first.
  - Pairs under **3:1** (the WCAG 1.4.11 non-text threshold) are listed as "may be hard to tell
    apart".
  - The screen says a ratio only measures lightness and **does not certify that artwork is
    accessible**.
- **Grayscale:** derived from the same relative luminance.
- **Colour-vision approximations:** Machado, Oliveira & Fernandes (2009) severity-1.0 matrices
  for protanopia, deuteranopia and tritanopia, applied in linear RGB. They are labelled
  "approx." with a note that real colour vision varies.
- **Text names:** every colour is named from its HSL values (lightness plus hue family, for
  example "Dark green"), always with its hex code, and appears next to its swatch.

## Alternatives

- Nothing is ever recoloured silently. The user changes any colour, one at a time, to one of
  the existing choosable colours.
- A **suggestion** is computed deterministically: of all remix palettes × backgrounds, the
  mapping with the highest weakest-pair contrast. It is shown only if it beats the original,
  and is previewed only when the user taps it.
- Original and alternative are drawn side by side in every view, with the weakest contrast for
  each.
- **Open the alternative in the Creator** hands over exactly the previewed copy (same layers,
  positions, rotation, scale, symmetry and colours) as a new unsaved design. The saved record
  and its recipe are never written.

## Tests

- `colorLab.test.ts`:
  - WCAG reference cases: 21:1, 1:1, #767676 on white 4.54, #777777 4.48, red on white 4.0,
    known luminances;
  - grayscale keeps luminance;
  - matrix invariants (white, black and greys preserved) and the red/green confusion axis;
  - naming;
  - inspect ordering and flags;
  - deep copies with identical geometry;
  - Creator copy equals the preview;
  - deterministic suggestion that is never auto-applied;
  - per-owner source.
- `e2e/tests/color-lab.spec.ts`: saved design → Color Lab → names and hex, hard pairs,
  grayscale and approximation → preview suggestion and a manual change → Creator copy, with no
  writes and the recipe unchanged (320 / 412 px, plus KG direct visit).

Device checks: PENDING.
