# Design asset audit

Audit of image/artwork usage across OYNO (Home, Games, Explore, Culture,
Profile, Onboarding, Game Detail, Achievements). This lists real gaps found
in the current asset set - it does not invent or generate replacement
artwork; every "fix" below is either a layout/crop/loading change in code,
or a flag for someone to source better source art later.

## Missing artwork

- **Kok Boru has no cover art.** `assets/img/games/` has a `thumbnail.png`
  for every other game (chuko, ordo, zhaaAtuu, kyzKuumay, toguzKorgool,
  beshTash, arkanTartysh, akTerekKokTerek, zholukTashtamay, beshbarmak,
  cookingWorld) but none for Kok Boru. It's now listed in
  `src/features/games/mockData.ts` (`mockGamesList`, `id: 'kok-boru'`) so
  it's reachable from the Games grid like its siblings, and both `GameCard`
  and `GameDetailScreen` fall back to a plain icon chip instead of a
  stretched/invented placeholder.

  **Exact spec needed** (once real art is ready, add
  `assets/img/games/kokBoru/thumbnail.png` and wire it into both
  `mockGamesList` and `src/app/games/kok-boru.tsx`'s `imageSource`):
  - **Subject**: a rider on horseback in a Kok Boru match (goat-carcass
    match, not a race) - horse + rider + traditional dress, mid-action,
    outdoor steppe/mountain backdrop.
  - **Style**: same illustrated/painterly digital-art style as
    `kyzKuumay/thumbnail.png` and `ordo/thumbnail.png` - warm, premium,
    not photographic and not cartoonish (no exaggerated proportions or
    cutesy faces).
  - **Aspect ratio**: source at **4:3 or squarer** (e.g. 1024x1024 or
    1200x900) - the art is displayed at 1:1.05 in the Games grid
    (`GameCard`'s `thumbnailWrap`) and 1:1.3 in the 3D-games showcase row
    (`thumbnailWrapFeatured`) and Game Detail's banner is 16:9, so the
    source needs enough vertical headroom to crop to all three without
    losing the horse/rider.
  - **Subject placement**: keep horse+rider centered-to-lower-third, with
    open sky/background above - `GameCard` overlays a bottom gradient +
    title text over the lower ~55% of the image, so avoid putting the
    rider's face or the sport's key action right at the very bottom edge.
  - **Color mood**: warm dusk/golden-hour palette (matches
    `hero_banner.png`, `culture/horse/*` photography's natural tones) -
    avoid cool/blue lighting so it sits comfortably next to the other 3D
    game covers.
- **6 real nature sites have zero photography.** `NatureSitesRow.tsx`
  surfaces Сон-Көл (Song-Kol), Суусамыр (Suusamyr), Алай (Alay),
  Сары-Челек (Sary-Chelek), Арсланбоб (Arslanbob), and Ала-Тоо (Ala-Too) -
  all real, named, verified locations - as flat `colors.discovery.nature`
  color cards with no image at all (by design, per its own code comment:
  "no per-site photo asset yet"). No existing asset in the repo is
  actually a photo of any of these 6 specific places, so none was
  substituted in (would be factually wrong to label an unrelated photo as
  a specific named lake/valley). **Needs**: one representative photo per
  site, landscape-oriented, matching the warm/natural tone of
  `explore/map_terrain.png` and the `culture/horse/*` photography already
  in the app.
  - Correction to an earlier version of this doc: the 4 actual Explore
    **discoveries** (`ysyk-kol-shore`, `boz-uy`, `too-teke`,
    `beshbarmak-dish` - see `supabase/migrations/20260901000002_explore_v2.sql`)
    all already have real images in `discoveryImages`
    (`src/features/explore/data.ts`). The missing-artwork gap in Explore is
    specifically the 6 nature sites above, not the discovery catalog.
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
  200 KB-1.5 MB, `shyrdak/*.jpg` are 78-856 KB). These render full-width in
  the Oymo motif gallery (`src/features/culture/data.ts`'s content-image
  map) - at that size they will look visibly soft/blurry next to Boz Uy,
  Shyrdak, clothing, and horse-culture photography in the same app.
  Checked for an existing higher-resolution version elsewhere in the repo
  (none found) before flagging - nothing in code can recover detail that
  isn't in the source file. **Flag for replacement** with higher-resolution
  photography or close-up scans of the same 11 motifs.
- **`assets/img/OYNO_design/Madaniat_BozUi_OymoTuzu.png`** is an unused
  (not referenced anywhere in `src/`) 2 MB reference mockup - three phone
  screens showing the original Culture/Boz-Uy-Builder/Oymo-Creator design
  intent, with fake status bars and UI chrome baked into the image. It's
  useful as a style reference (see `docs/ART_DIRECTION.md`) but is **not**
  a usable source asset - it can't be cropped into a clean in-app image
  without carrying phone-frame/UI artifacts with it.
- **`assets/img/OYNO_design/hero_banner.png`** (689 KB) and
  **`explore/map_terrain.png`** (2.1 MB) are large PNGs doing photographic
  work - fine visually, but worth converting to JPEG/WebP at some point for
  faster cold loads; not touched here since that's a build/export concern,
  not a design one.

## Fixed this pass (layout/crop/loading, no new art)

- **Game Detail header** (`GameDetailScreen.tsx`): added a 16:9 artwork
  banner reusing each game's existing Games-grid thumbnail. Falls back to
  an icon chip, never a stretched/cropped placeholder, when no art exists
  (Kok Boru).
- **Games grid / Favorites**: `GameCard` and `FavoriteGamesCard` now
  render a plain icon-chip fallback instead of requiring every game to
  have a thumbnail, so Kok Boru can appear in both without a mismatched or
  invented image.
- **Profile avatar**: the large Profile-header `UserAvatar` instance now
  gets a gold ring (the app's existing "special/premium" accent), giving
  the single most prominent avatar instance a slightly more premium
  frame without adding decoration to the 6 smaller avatar instances
  elsewhere (Home/Explore/Culture headers, Boz Uy Builder, Komuz Learn).
- Confirmed no image anywhere in the app uses `resizeMode="stretch"`
  (checked via full-repo search) - every image already scales via `cover`/
  `contain`, so no distorted artwork exists today.
- Onboarding, Home, Explore, Culture, Profile card imagery already use
  `resizeMode="cover"` inside a fixed-aspect-ratio or fixed-size container
  (audited this pass) - crops are driven by each container's aspect ratio,
  not by the image's own proportions, so faces/horses/боз үй are cropped
  consistently by container shape rather than randomly per-image.

## Remaining follow-up (needs real content work, not code)

1. Source a Kok Boru cover illustration per the spec above.
2. Source one representative photo each for Song-Kol, Suusamyr, Alay,
   Sary-Chelek, Arslanbob, and Ala-Too.
3. Commission or source higher-resolution photography/scans for the 11
   Oymo motif images listed above.
4. Build the layered-art pipeline (or source pre-composited portraits) so
   avatar customization actually renders hair/headwear/clothing/accessory
   choices instead of one fixed portrait per base character.
