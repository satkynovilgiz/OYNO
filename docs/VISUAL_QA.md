# Visual QA pass

Final app-wide visual audit (sizing/spacing, card system, icons, imagery,
typography, buttons/controls). Format per screen/area: issue found → fix
made → anything still needing a real-device check. Business logic,
navigation, game mechanics, and data models were not touched.

## Design tokens (app-wide)

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

## Games / Game Detail

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

## Home / Explore / Culture / Profile

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

## Typography

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

## Buttons / controls

- **Checked, no issue found**: `Button` (44pt min height), `IconButton`
  (44pt default, `hitSlop` compensates smaller visual sizes), and
  `AnimatedPressable` (shared press-scale + optional haptic + optional
  hover) are already used everywhere in the 2D UI - no bare
  `TouchableOpacity`/`Pressable` remain in feature screens except three
  canvas/gesture components (`KyrgyzstanMap`, `OymoCanvas`,
  `KomuzInstrumentIllustration`) where a custom pressable is a deliberate
  exception for gesture handling, not a missed conversion.
- **Fixed**: Games category filter chips' touch target (see above).

## Not done in this pass

- No screen was redesigned "just to change it" - fixes above are the only
  changes made.
- Did not touch 3D game canvases/HUDs (Three.js/Skia rendering, not React
  Native View layout) - out of scope for this design-system pass.
- Did not attempt automated screenshot testing across device sizes - this
  environment has no device/simulator access; all findings above come
  from reading code, computed contrast ratios, and full-repo searches, not
  visual screenshots. Real-device verification is still recommended before
  treating this pass as final sign-off.
