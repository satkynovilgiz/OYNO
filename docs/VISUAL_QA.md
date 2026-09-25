# OYNO Visual QA Checklist

A repeatable screenshot pass for the modern (design system v2) UI. Run it
before every beta build, and after any change to shared UI components
(`src/components/ui`, `src/theme`).

## How this is checked

| Where | What it proves | What it does NOT prove |
| --- | --- | --- |
| Web build in headless Chrome at phone sizes (`npx expo start --web`) | Layout, wrapping, truncation, horizontal overflow, clipped rails, KG/RU/EN copy fit | Real fonts/metrics on iOS, safe areas, haptics, scroll physics, GL performance |
| Physical iPhone (EAS preview build) | Everything above plus safe areas, gestures, haptics, FPS, audio | - |

Web screenshots are **not** a substitute for a device check. Tick the
iPhone column only after looking at the screen on a real phone.

Viewports: 375×812 (iPhone mini/SE-class width), 390×844 (iPhone 12-15),
430×932 (Pro Max). Also spot-check 393×852 (iPhone 15/16).
Languages: KG (default, longest words), RU (longest labels), EN.
Ages: at least one of child (6-9) and adult (18+) per pass.

## Screens

Legend: `W` = checked on web at that width · `D` = checked on a real iPhone.

| Screen | Route | 375 | 390 | 430 | iPhone |
| --- | --- | --- | --- | --- | --- |
| Home | `/home` | W | W | W | ☐ |
| Games | `/games` | W | W | W | ☐ |
| Game detail + HUD | `/games/chuko` | W | W | ☐ | ☐ |
| Explore | `/explore` | W | W | W | ☐ |
| Interactive map + sheet | `/explore/map` | W | W | W | ☐ |
| Destination detail | `/explore/son-kol` | W | W | W | ☐ |
| Guided trail | `/trails/horse-culture` | W | W | W | ☐ |
| Culture | `/culture` | W | W | W | ☐ |
| Culture category | `/culture/boz-uy` | W | W | W | ☐ |
| Culture article + audio | `/culture/item/clothing-boy-tumar` | W | W | W | ☐ |
| Collection | `/collections/boz-uy-world` | W | W | W | ☐ |
| Profile | `/profile` | W | W | W | ☐ |
| My Journey | `/journey` | W | W | W | ☐ |
| Achievements | `/achievements` | W | W | W | ☐ |
| Search | `/search` | W | W | W | ☐ |
| Saved (empty + filled) | `/saved` | W | W | W | ☐ |
| Offline (empty + filled) | `/offline` | W | W | W | ☐ |
| Journal (empty + filled) | `/journal` | W | W | W | ☐ |

"W" above reflects the 2026-09-24 web pass (KG teen 390, RU adult 375,
EN child 430; KG/RU/EN across the table). No row is ticked for iPhone yet.

## Per-screen checklist

For every screen and width:

- [ ] No horizontal page scroll; every rail starts on the 16 pt gutter and
      its last card scrolls fully into view (right padding present).
- [ ] No truncated titles/buttons in KG and RU (one-line subtitles on
      cards are intentionally clamped); no single-letter last lines.
- [ ] Text over photos is readable (scrim present, subject not hidden).
- [ ] Images are sharp: no source narrower than ~2× its display width
      (see "Known low-resolution assets").
- [ ] Section rhythm: 24 pt between sections, 12 pt title → content.
- [ ] Content ends above the tab bar; nothing hidden behind it.
- [ ] Tab bar: same height on all 5 tabs, active tab obvious, labels fit.
- [ ] Buttons: CTA hierarchy (gold accent = the one main action),
      loading state keeps the button size.

State checks:

- [ ] Home Today cards: not started / in progress / claimable / claimed -
      card heights stay equal, no jump.
- [ ] Daily OYNO: open vs done.
- [ ] Toasts (Save, Remove, Download, Journal save): above the tab bar,
      not over a CTA, disappear after ~2 s, KG/RU text fits.
- [ ] Empty states: Search (no results), Saved, Offline, Journal, Journey
      (new user).
- [ ] Loading: skeleton size ≈ final content size (Home Daily, Explore).
- [ ] Errors: not-found route, offline-unavailable content, server failure.

iPhone-only checks:

- [ ] Safe areas: Dynamic Island / notch on full-bleed heroes (destination,
      article, trail, collection, category), map header, game HUD; home
      indicator under bottom sheets, map place sheet and tab bar.
- [ ] Scroll: horizontal rails don't steal vertical scroll; snapping rails
      (Explore, trails, collections) feel natural.
- [ ] Map: pinch/pan/double-tap, +/- buttons, pin taps at child size,
      place strip, sheet over the home indicator.
- [ ] Game HUD: pause, tutorial, result sheet don't cover the play area;
      touch controls reachable with one thumb.
- [ ] Audio guide: play/pause, speed, interruption by a call, background.
- [ ] Motion: press feedback subtle; Reduce Motion removes scale/fade.
- [ ] Haptics: light on card/primary taps, success on save/download/journal.

## Known low-resolution assets

These are the only art available today; they render acceptably but will
look soft on 3× screens. Replace when higher-resolution art exists.

| Asset | Size (px) | Where it shows |
| --- | --- | --- |
| `games/*/thumbnail.png` (akTerekKokTerek, arkanTartysh, beshTash, beshbarmak, cookingWorld, toguzKorgool, zholukTashtamay) | 228×146 | Games tiles, Home Play rail |
| `games/{chuko,kyzKuumay,ordo,zhaaAtuu}/thumbnail.png` | 384×256 | Games tiles, Home Play rail |
| `games/art/games_world_hero.jpg`, `zhaa_atuu_featured.jpg` | ~768×512 | Games hero / featured |
| `explore/discovery_*.png` | 300×362 | Discoveries rows, Profile collection |
| `culture/material_*.png` | 155-504 wide | Culture "new materials" rail |
| `culture/cat_games.png` | 535×390 | Culture category grid (Games) |
| `culture/oymo/*.jpg` | 114-306 wide | Oymo motif items - HomeArtwork/MediaImage swap in the category photo when used full-bleed |

Fixed in this pass: Home Explore tiles (500 px banners → 1100-1536 px
photos) and the Clothing / Horse category covers (144 px → 1200-1280 px).

---

# Earlier audit log (pre design system v2)

Kept for history. Items below describe the app before the v2 redesign;
some components mentioned (e.g. CurrencyRow) have since been removed.

## Visual QA pass

Final app-wide visual audit (sizing/spacing, card system, icons, imagery,
typography, buttons/controls). Format per screen/area: issue found → fix
made → anything still needing a real-device check. Business logic,
navigation, game mechanics, and data models were not touched.

### Design tokens (app-wide)

- **Issue**: `colors.ink400` (`textMuted`) measured ~2.7:1 contrast against
  the app background (`colors.background`) and ~3.0:1 against card surfaces
  - below WCAG AA's 4.5:1 for normal-size text. `textMuted` backs captions,
    timestamps, "played"/"wins" counts, and empty-state descriptions across
    every screen, in all three locales.
  **Fix**: darkened `ink400` from `#9C8A73` to `#786550` (still visibly
  lighter than `textSecondary`'s `ink600`, so the two-tier text hierarchy
  is preserved) - now ~4.5:1+ against both the app background and card
  surfaces. See `src/theme/colors.ts`.
- **Issue**: icon "chip" containers were re-implemented per screen with
  slightly different sizes/radii/backgrounds for the same role (a colored
  icon in a circle/rounded square next to text) - e.g. `CurrencyRow`,
  `SettingsRow`, and `NotificationsScreen` each hand-rolled their own
  `iconWrap` style instead of reusing `IconChip`.
  **Fix**: extended `IconChip` with `shape` (`roundedSquare` | `circle`)
  and `tinted` (soft color-derived background) props, and migrated those
  three components onto it. No visual role changed, just de-duplicated.
- **Added**: `src/theme/sizes.ts` - a shared icon-size scale
  (`iconSizes`), icon-container sizes (`iconContainerSizes`), a
  `minTouchTarget` constant, and shared card-image `aspectRatios`, so
  future work has named tokens instead of picking a new pixel value per
  screen. Avatar sizing already had its own named scale
  (`UserAvatarSize` in `src/components/avatar/UserAvatar.tsx`) and wasn't
  touched.
- **Checked, no issue found**: screen horizontal margins are already
  consistent at `spacing.md` (16px) across all 5 main tabs (Home, Games,
  Explore, Culture, Profile). No image anywhere uses
  `resizeMode="stretch"` (full-repo search). No duplicated inline shadow
  definitions exist outside `theme/shadows.ts`.

### Games / Game Detail

- **Issue**: `GameDetailScreen` (the pre-match "what is this / how to
  play / difficulty / stats" screen used by all 5 3D games) had no artwork
  at all - just stacked text cards - and no entrance animation, unlike
  every other card-based screen in the app.
  **Fix**: added a 16:9 header banner reusing each game's existing
  Games-grid thumbnail (Jaa Atuu, Ordo, Chuko, Kyz Kuumai); added
  `FadeSlideIn` stagger to its cards/stats row and a small oymo accent on
  the "Learn about the tradition" link, matching the rest of the app's
  card language. Kok Boru has no thumbnail asset to reuse, so it falls
  back to a plain icon chip rather than a stretched/invented placeholder
  - see `docs/DESIGN_ASSET_AUDIT.md`.
- **Issue**: category filter chips (`CategoryFilters`, Games screen) had a
  ~32-34px visual height, under the 44pt comfortable touch-target
  guideline, with no compensating hit area.
  **Fix**: added `hitSlop={6}` (chips keep their compact visual size but
  gain a larger effective tap area) and a border + haptic tap, matching
  the app's other filter pills.
- **Remaining / needs real-device check**: whether the 3D games' own
  in-canvas HUD and controls (built on Skia/Three.js, not React Native
  Views) hold up on the smallest current iPhone (SE-class, ~375pt wide) -
  this pass only covered the 2D React Native UI; the 3D scenes themselves
  weren't re-audited here.

### Home / Explore / Culture / Profile

- **Checked, no issue found**: card corner radius, padding, border width,
  and shadow usage are consistent within each screen (all built on the
  shared `Card`/`shadows.card`/`radii` tokens from earlier passes this
  project). No stray nested "box inside box" card patterns were found in
  the 2D feature screens (three-deep nesting was specifically searched
  for and not found outside intentional cases like a card containing a
  `ProgressRing` or `IconChip`, which is one visual layer, not a nested
  card).
  - "See all" chevron icon size was inconsistent (14px in most card
    headers, 16px in two Profile cards) - already caught and fixed in the
    prior polish pass (`AchievementsPreviewCard`, `FavoriteGamesCard`).
- **Remaining / needs real-device check**: none of this session's layout
  work has been verified on an actual small/standard/large iPhone or
  Android device or simulator - only `tsc`, Jest, and static code reading.
  Bottom-tab-bar clearance (whether the last card in a long scroll is ever
  hidden behind the tab bar) should be spot-checked on a real device,
  since it depends on runtime `ScrollView` sizing behavior that static
  analysis can't fully confirm.

### Typography

- **Checked, no issue found**: card/list titles that render user- or
  locale-variable text (game names, achievement titles, discovery titles)
  already use `numberOfLines` truncation (spot-checked `GameCard`,
  `Button`, `AchievementsScreen`, `DiscoveriesRow`), so long Russian
  compound words shouldn't break card layouts. Kyrgyz-specific characters
  (ң, ө, ү) render through the system sans-serif font (`typography.body`/
  `h1`/`h2` etc. all use `fontFamily: sans`) - the serif `wordmark` font is
  only ever used for the literal "OYNO" logotype, never for translated
  content, so there's no glyph-support risk for Kyrgyz text.
- **Remaining / needs real-device check**: actual rendered line-height for
  Kyrgyz diacritics (ң/ө/ү ascenders/descenders) on both iOS and Android
  system fonts - not verifiable without a device.

### Buttons / controls

- **Checked, no issue found**: `Button` (44pt min height), `IconButton`
  (44pt default, `hitSlop` compensates smaller visual sizes), and
  `AnimatedPressable` (shared press-scale + optional haptic + optional
  hover) are already used everywhere in the 2D UI - no bare
  `TouchableOpacity`/`Pressable` remain in feature screens except three
  canvas/gesture components (`KyrgyzstanMap`, `OymoCanvas`,
  `KomuzInstrumentIllustration`) where a custom pressable is a deliberate
  exception for gesture handling, not a missed conversion.
- **Fixed**: Games category filter chips' touch target (see above).

### Not done in this pass

- No screen was redesigned "just to change it" - fixes above are the only
  changes made.
- Did not touch 3D game canvases/HUDs (Three.js/Skia rendering, not React
  Native View layout) - out of scope for this design-system pass.
- Did not attempt automated screenshot testing across device sizes - this
  environment has no device/simulator access; all findings above come
  from reading code, computed contrast ratios, and full-repo searches, not
  visual screenshots. Real-device verification is still recommended before
  treating this pass as final sign-off.
