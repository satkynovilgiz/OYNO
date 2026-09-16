# Design asset audit

Audit of image/artwork usage across OYNO (Home, Games, Explore, Culture,
Profile, Onboarding, Game Detail, Achievements). This lists real gaps found
in the current asset set - it does not invent or generate replacement
artwork; every "fix" below is either a layout/crop/loading change in code,
or a flag for someone to source better source art later.

## Missing artwork

- **Kok Boru has no thumbnail image at all.** `assets/img/games/` has a
  `thumbnail.png` for every other game (chuko, ordo, zhaaAtuu, kyzKuumay,
  toguzKorgool, beshTash, arkanTartysh, akTerekKokTerek, zholukTashtamay,
  beshbarmak, cookingWorld) but none for Kok Boru, and Kok Boru is not even
  listed in `src/features/games/mockData.ts` (`mockGamesList`) - it only
  exists as a playable route (`src/app/games/kok-boru.tsx`). Its new
  `GameDetailScreen` header now falls back to a plain icon chip
  (`Gamepad2`) instead of a photo/illustration. **Needs**: a real thumbnail
  in the same style as the other 3D games, plus a `mockGamesList` entry so
  it's reachable from the Games grid like its siblings.
- **Most Explore discoveries have no dedicated artwork.** `discoveryImages`
  in `src/features/explore/data.ts` only maps 4 ids (`ysyk-kol-shore`,
  `boz-uy`, `too-teke`, `beshbarmak-dish`) to real images; the `discoveries`
  table (see `supabase/migrations/20260901000002_explore_v2.sql`) seeds
  more rows than that. Every discovery without a mapped image renders as a
  flat `colors.discovery[category]` block (`DiscoveriesRow.tsx`,
  `ProfileCollectionRow.tsx`, `CollectionScreen.tsx`) instead of a photo.
  This is an existing, intentional fallback (not a crash), but it means
  most of the collection currently looks like colored tiles rather than
  Kyrgyzstan photography.
- **Avatar customization doesn't yet render composited portraits.**
  `UserAvatar.tsx` / `AVATAR_BUST_ART` render one static illustrated
  portrait per character `base` once a user customizes - hair, headwear,
  clothing, and accessory selections are saved but not yet reflected
  visually (documented in-code; repeating here since it's a real,
  user-visible artwork gap, not a bug to "fix" without new layered art).

## Low-resolution / weak source images

- **`assets/img/OYNO_design/culture/oymo/*.jpg`** (adamdyn_juzu,
  balyk_oyuu, bulak, it_kuiruk, kaz_moyun, kochkor_muyuz, muyuz_kyal,
  teke_muyuz, tort_kulak, umai_ene, umai_oyumu) are each only **2.6-6 KB**,
  roughly two orders of magnitude smaller than every other Culture photo in
  the same folder (`boz_uy/*.jpg` are 300 KB-1 MB, `clothing/*.jpg` are
  200 KB-1.5 MB). These render full-width in the Oymo motif gallery
  (`src/features/culture/data.ts`'s content-image map) - at that size they
  will look visibly soft/blurry compared to everything around them.
  **Flag for replacement** with higher-resolution photography of the same
  motifs; nothing in code can recover detail that isn't in the source file.
- **`assets/img/OYNO_design/hero_banner.png`** (689 KB) and
  **`explore/map_terrain.png`** (2.1 MB) are large PNGs doing photographic
  work - fine visually, but worth converting to JPEG/WebP at some point for
  faster cold loads; not touched here since that's a build/export concern,
  not a design one.

## Fixed this pass (layout/crop/loading, no new art)

- **Game Detail header** (`GameDetailScreen.tsx`): added a 16:9 artwork
  banner reusing each game's existing Games-grid thumbnail (previously the
  screen had no image at all - just text cards). Falls back to an icon
  chip, never a stretched/cropped placeholder, when no art exists (Kok
  Boru, see above).
- Confirmed no image anywhere in the app uses `resizeMode="stretch"`
  (checked via full-repo search) - every image already scales via `cover`/
  `contain`, so no distorted artwork exists today.
- Onboarding, Home, Explore, Culture, Profile card imagery already use
  `resizeMode="cover"` inside a fixed-aspect-ratio or fixed-size container
  (audited this pass) - crops are driven by each container's aspect ratio,
  not by the image's own proportions, so faces/horses/боз үй are cropped
  consistently by container shape rather than randomly per-image.

## Remaining follow-up (needs real content work, not code)

1. Source a Kok Boru thumbnail and add it to `mockGamesList`.
2. Commission or source higher-resolution photography for the 11 Oymo
   motif images listed above.
3. Expand `discoveryImages` coverage as new discovery photography becomes
   available, so fewer collection items fall back to a flat color tile.
