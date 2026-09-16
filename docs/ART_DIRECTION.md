# OYNO art direction

Reference for anyone adding new artwork (game covers, discovery photos,
culture photography, hero/banner art) so new pieces look like they belong
next to what's already shipped, without needing another app-wide design
pass. This documents the style already established by the existing asset
set (`assets/img/OYNO_design/`, `assets/img/games/`) - it doesn't propose a
new direction.

See also `docs/DESIGN_ASSET_AUDIT.md` for the current list of missing/weak
assets that should be sourced against these rules.

## Preferred image style

Two legitimate categories exist today - keep new art in the same category
as what it's replacing/extending, don't mix them on the same screen:

1. **Illustrated / painterly digital art** - the 5 game covers
   (`assets/img/games/*/thumbnail.png`), `hero_banner.png`,
   `home/tile_*.png`. Warm, semi-realistic digital painting, not flat
   vector/cartoon, not photoreal. This is the style for anything
   game-related or "hero" branding.
2. **Real documentary photography** - `culture/boz_uy/*.jpg`,
   `culture/clothing/*.jpg`, `culture/horse/*.jpg`,
   `culture/shyrdak/*.jpg`, `explore/discovery_*.png`. Real places,
   objects, and people, naturally lit. This is the style for anything
   presented as factual cultural/geographic content (Culture, Explore).

Do not use a real photo where an illustrated game cover is expected (or
vice versa) - see `docs/DESIGN_ASSET_AUDIT.md`'s Kok Boru section for why
the existing Kok Boru culture *photos* weren't reused as its game *cover*.

## Preferred aspect ratios

Named tokens live in `src/theme/sizes.ts` (`aspectRatios`) - use them
instead of a new one-off ratio:

| Token             | Ratio  | Used for |
|-------------------|--------|----------|
| `aspectRatios.square` | 1:1    | Square thumbnails, collection/discovery items |
| `aspectRatios.card`   | 4:3    | Standard content-card artwork (Culture/Explore cards) |
| `aspectRatios.banner` | 16:9   | Wide hero/banner artwork (Game Detail header) |
| `aspectRatios.hero`   | 4:5    | Full-bleed onboarding/hero slide artwork |

Game covers specifically are displayed at three different crops from one
source image (Games grid ~1:1.05, 3D showcase row ~1:1.3, Game Detail
banner 16:9) - source new game covers at **4:3 or squarer** with the main
subject in the center-to-lower-third so all three crops keep it in frame.

## Crop rules

- Never use `resizeMode="stretch"`. Every image in the app scales via
  `cover` (fills a fixed-aspect container, crops overflow) or `contain`
  (fits without cropping, used for logos/wordmarks/icons) - keep it that
  way.
- Crop is driven by the **container's** aspect ratio, not the source
  image's own proportions. Before adding an image, check what aspect
  ratio its container actually renders at (see table above) and frame the
  subject so it survives that crop.
- Keep faces, horses, боз үй structures, mountains, and other named
  cultural subjects centered or in the classic upper-two-thirds/lower-third
  rule - never right at an edge that a square or 16:9 crop is likely to
  cut off.
- When an image sits under a bottom text overlay (game cards, hero
  banners), keep the subject's most important detail in the **top ~50%**
  of the frame - the bottom half is expected to carry a dark gradient +
  text.

## Color mood

- Warm, natural light - golden hour, daylight steppe/mountain tones.
  Avoid cool blue/teal lighting or heavy stylized color grading; it reads
  as generic "gaming" rather than Kyrgyz and clashes with the cream/green/
  gold/terracotta UI palette (`src/theme/colors.ts`).
- Text-legibility overlays use a warm near-black, not pure black:
  `rgba(20,14,8,0)` fading to `rgba(20,14,8,0.72-0.85)` (the same value as
  `colors.overlayStart`/`colors.overlayEnd` and `colors.shadow`). New
  overlay gradients should reuse these theme tokens instead of a new
  literal color.
- Gold (`colors.accentGold` / `#E8B93D`) is reserved for special/premium
  states (achievements, rewards, the Profile avatar ring, "is3D" card
  borders) - don't tint new artwork gold just for decoration.

## Subject placement rules

- One clear subject per image - a rider, a yurt, a specific landscape.
  Avoid busy multi-subject compositions that get muddled once cropped
  into a small card.
- Leave visible negative space (sky, ground, background) around the
  subject - cards crop aggressively at multiple aspect ratios (see
  above), and a tightly-cropped source photo/illustration has nowhere to
  go.
- For action shots (horse games), freeze the action at a clear, readable
  pose - mid-gallop with the horse's legs legible, not a motion-blurred
  or awkward mid-stride frame (see `docs/DESIGN_ASSET_AUDIT.md`'s note on
  why the existing `kok_boru_kazan.jpg` action photo isn't a good card
  cover candidate).

## Border / overlay treatment

- Card artwork: rounded corners via `radii.xl`/`radii.xxl`, a 1-1.5px
  border in `colors.surfaceBorder` (or the gold `is3D` variant for 3D
  game cards), and `shadows.card`. Don't add a second inner border/frame
  around the image itself - one border, on the card, is enough.
- Avatars: a plain 2px `colors.surfaceBorder` ring by default; a gold
  ring only for the single largest/most prominent instance (Profile
  header) - see `UserAvatar.tsx`. Don't add rings to every avatar
  instance across the app.
- Oymo ornament accents (`OymoOrnament`) are a decorative accent, not a
  frame - use small (10-16px) and sparingly (one per card at most), never
  as a border around an image.

## What to avoid

- Cartoonish/exaggerated proportions, big anime-style eyes, or flat
  vector-clip-art style - reads too childish for the "kids, teens, and
  adults" audience.
- Neon colors, glassmorphism, or generic "gaming UI" gradients on
  artwork itself (the UI chrome already avoids these; artwork should too).
- Stock-photo-style generic landscapes with no specific Kyrgyz identity -
  every photo should be identifiably *this* place/object/tradition, not
  an interchangeable mountain photo.
- Upscaling a low-resolution source to hide the problem - flag it in
  `docs/DESIGN_ASSET_AUDIT.md` instead (see the Oymo motif images there).
- Mixing the illustrated-game-cover style and documentary-photo style on
  the same card grid or the same screen section.

## Asset categories still missing (see DESIGN_ASSET_AUDIT.md for detail)

- Kok Boru game cover illustration.
- Photography for 6 named nature sites (Song-Kol, Suusamyr, Alay,
  Sary-Chelek, Arslanbob, Ala-Too) shown in Explore's Nature Sites row.
- Higher-resolution photography for 11 Oymo motif images.
- Layered avatar art (hair/headwear/clothing/accessory) so customized
  avatars render as true composites instead of one fixed portrait per
  base character.
