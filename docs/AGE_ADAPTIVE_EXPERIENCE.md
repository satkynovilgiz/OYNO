# Age-Adaptive Experience

OYNO asks new users which age band they're in during onboarding, then
adapts **presentation, content depth, guidance, and prioritization** across
the app - never a separate app per age. This doc explains the architecture,
what actually adapts today per screen, and what's honestly still shallow or
unbuilt.

## Why age *groups*, never a birth date

Onboarding (`src/features/ageGroup/AgeGroupScreen.tsx`, route
`src/app/age-group.tsx`) asks "Жашың канчада?" and offers four bands - 6-9,
10-13, 14-17, 18+ - as large selectable cards. OYNO never asks for or
stores a birth date; the stored value is always one of the four band
strings. This is deliberate (see `src/services/ageExperience/types.ts`):
storing a birth date would let some future code compute and reason about
an exact age, which the spec explicitly ruled out.

The step is gated into the same place language and onboarding-slides
already are: `decideRouteGuardRedirect` in
`src/services/navigation/routeGuard.ts` inserts an `/age-group` redirect
right after onboarding completes and before the sign-up/sign-in split. The
choice is stored locally in `useAppStore` (`ageGroup`, `hasChosenAgeGroup`,
`setAgeGroup()`, AsyncStorage key `oyno.ageGroup`) - **local-only, no
Supabase sync**, the same simple pattern the store already used for
`hasChosenLanguage`/`hasCompletedOnboarding`, deliberately lighter than
`useAvatarStore`'s server-synced dirty-cache pattern since this is a
presentation preference, not account data.

## The central configuration

`AgeGroup` ('6-9' | '10-13' | '14-17' | '18+') is the user-facing choice.
Every other file maps it once, through `experienceForAgeGroup()`
(`src/services/ageExperience/types.ts`), into an `AgeExperience`:
`child | preteen | teen | adult`. **No screen ever compares a raw
`AgeGroup` or age number** - they all read from one shared config:

```
AGE_EXPERIENCE_CONFIG: Record<AgeExperience, AgeExperienceConfig>
```

(`src/services/ageExperience/config.ts`) with nine small closed-enum
fields - `contentDensity`, `cardScale`, `artworkProminence`,
`textComplexity`, `characterProminence`, `animationIntensity`,
`learningDepth`, `challengeDifficulty`, `navigationDensity` - exactly the
axes the spec asked for. Screens translate these into the existing design
system's own tokens; this file is not a second design system.

`cardScale` and `artworkProminence` are each a full four-step ladder -
`large/medium/compact/dense` and `dominant/high/cinematic/balanced` - one
distinct value per `AgeExperience`, specifically so preteen and teen never
render identically (an early version shared `medium`/`high` between them;
tightened after a review pass asked for the four modes to be "immediately
noticeable" against each other, not just against their neighbors).
`src/services/ageExperience/scale.ts`'s `resolveByCardScale()` is the one
place a screen turns that tier into an actual pixel value (font size, icon
size, card width...), and `resolveTouchTargetSize()` scales touch targets
from 56pt (child) down to a floor of 44pt (never below the accessible
minimum, even at the `dense` adult tier).
`src/services/ageExperience/cardGradient.ts`'s `GRADIENT_BY_ARTWORK_PROMINENCE`
does the same for the bottom-gradient overlay every full-bleed-artwork card
uses, so `cinematic` (teen) reads darker/more dramatic than `high`
(preteen) without a screen inventing its own gradient stops.

`useAgeExperience()` (`src/services/ageExperience/useAgeExperience.ts`) is
the one hook every adapting screen calls. It returns
`{ ageGroup, hasChosenAgeGroup, experience, config }`, defaulting to
`18+`/`adult` (the least-adapted, most information-dense experience)
before a choice has been made, rather than guessing a child down.

Changing the group later (Settings > Experience /
Жаш режими, `src/features/settings/SettingsExperienceScreen.tsx`) just
calls `setAgeGroup()` again - it only ever touches the `ageGroup` key,
never progress/coins/streak/achievements/game history/favorites/
discoveries, and every screen re-renders with the new config immediately
because they all read the same zustand store reactively.

## What adapts per screen today

Every adaptation below reorders, resizes, or re-verbosifies **existing**
components and data - none of it forks a screen or duplicates business
logic. `navigationIndex.md`-style per-screen tables below name the actual
files.

### Home (`src/features/home/HomeScreen.tsx`)

One screen, six sections (hero art, profile/streak card, the daily-
challenge+gift row, the games carousel, the culture grid, the daily-play
progress card). `homeSections.ts` defines a pure
`getHomeSectionOrder(experience)` permutation of the same six section ids;
`HomeScreen` just maps over it. Child leads with a character-forward hero
and a big games carousel ("Continue Playing"); adult leads with the
culture grid ("featured cultural story") and pushes games toward the end
without ever hiding them.

Beyond ordering, the section components themselves read `cardScale`/
`artworkProminence` directly: `ProfileSummaryCard`'s avatar ring and name
grow from 40pt/13px (adult) to 68pt/19px (child); `GamesCarousel` scales
its thumbnails 80→148pt and adds a real Play-button badge (icon-only for
teen/adult, an icon+"Play" label for child - previously there was no Play
affordance on this row at all); `CultureGrid`'s tiles go from three-per-row
(adult) to one-per-row (child); `DailyChallengeCard`/`DailyGiftCard`/
`DailyProgressCard` scale their icon chips and title/description type
along the same ladder. Same cards, same data, same claim/press handlers -
only size, type, and grid density change.

### Games (`src/features/games/components/GameCard.tsx`)

Same games, same routes, same `mockGamesList`. `GameCard` reads
`cardScale` for card width (one per row for child, three per row for
adult - "fewer items visible at once" vs. "denser layout"), aspect ratio,
title size, and fallback-icon size; `artworkProminence` for the bottom-
gradient treatment (`cinematic` for teen goes noticeably darker/more
dramatic than preteen's `high`); and `textComplexity` for whether the
difficulty/duration/players meta line shows, and whether it's abbreviated,
plus the played-count "gamification" pill (dropped for `rich` - adult -
per "reduced gamification clutter"). Child gets a visibly larger card and
a labeled "Play" pill instead of an icon-only badge, for an unambiguous
tap target. `ComingSoonCard` shares the exact same width/aspect-ratio
table so it never breaks the grid's column rhythm at any age. No game is
ever hidden by age.

### Culture (`src/features/culture/CultureScreen.tsx`) and Explore (`src/features/explore/ExploreScreen.tsx`)

Same section-reordering technique as Home
(`cultureSections.ts`/`exploreSections.ts`), applied to the sections that
can safely move without changing loading-state behavior - `CultureHero`
and the map (with its own filter-result list) stay pinned in their
existing spot since they render even while data is still loading. Child
leads with the hands-on creators (Oymo/Boz Üy builders) and the guided
Explore quest; adult leads with the day's featured discovery/new
materials and curated nature sites, with the more playful creator tools
and the fetch-quest pushed toward the end - present, never removed.

`EditorialCard` (Culture's category cards, both the Home culture grid and
Culture's own categories grid) reads `cardScale` for its title size
(13→23px across the four tiers) and `artworkProminence` for its gradient,
the same shared helpers `GameCard` uses. `CurrentQuestCard` (Explore's
quest banner) scales from a tall 1.7:1 card with 24px title text (child)
to a short 2.9:1 strip with 16px text (adult); `RegionProgressCard`'s
progress rings shrink from 64pt to 40pt along the same ladder.

**Honesty note**: Culture/Explore's per-age ordering wasn't given as a
literal bullet list the way Home's was - it was derived from the same
`AgeExperienceConfig` axes (artwork/character prominence, content
density), following Home's own reasoning. If real usage data later
suggests a different order, it's a one-line change in either file.

### Profile (`src/features/profile/`)

Lighter touch, per the spec's "where appropriate": `ProfileHero`'s banner
aspect ratio and name size, and `ProfileStatsGrid`'s progress-ring size,
scale along the same `cardScale` ladder as everywhere else. Achievements/
collection/currency rows were left as-is - they're already dense,
number-driven surfaces that don't read as noticeably "childish" or
"adult" the way artwork-forward cards do.

### Content depth (`src/features/culture/CultureItemDetailScreen.tsx`)

`ContentDepth` is `simple | standard | advanced`, deliberately not 1:1
with `AgeExperience` - it's `AgeExperienceConfig.learningDepth` used as a
*default* (child/preteen → simple, teen → standard, adult → advanced).

**The hard constraint the spec called out**: no cultural fact is ever
generated by AI at runtime. `culture_items` has three new nullable
columns - `simple_summary_kg`, `simple_summary_ru`, `simple_summary_en`
(migrations `20260917000001_culture_items_simple_summary.sql`,
`20260918000001_content_depth_locale_columns.sql`) - the same kg/ru/en
column shape `culture_categories`/`discoveries` already use for other
localized text, so the architecture genuinely *supports* per-language
depth variants rather than being Kyrgyz-only by accident.
`CultureItemDetailScreen.tsx`'s `localizedSimpleSummary()` picks the
column matching `i18n.language`, then
`resolveContentByDepth()` (`src/services/ageExperience/contentDepth.ts`)
decides whether to show it: if the resolved depth's field is missing (in
that language), it falls back to the full field-by-field breakdown that's
always been there (this doubles as "standard" and "advanced", since OYNO
doesn't yet have a separately-authored advanced tier beyond its existing
full research write-up). A row with no summary in the reader's language at
all behaves exactly as before this feature shipped.

Populated today (migrations `20260917000001`/`20260918000002`), one
flagship item per category - the most fully-researched row, same standard
as "Бешбармак is the food category's one fully-researched example" from
this table's original seed comment:

| Category | Flagship item(s) |
| --- | --- |
| Боз үй | all 6 items (tunduk, frame, felt, interior, ak-orgoo, overview) |
| Оймо | `oymo-overview` |
| Шырдак | `shyrdak-craft` |
| Комуз | `komuz-overview` |
| Улуттук кийим | `clothing-ak-kalpak`, `clothing-elechek` |
| Кыргыз тамактары | `food-meat-01` (Бешбармак) |
| Ат маданияты | `horse-kok-boru`, `horse-kyz-kuumai`, `horse-at-chabysh` |
| Улуттук оюндар | none - see honesty note below |

**Honesty note - languages**: every `simple_summary_*` value shipped so
far is in `simple_summary_kg` only; `_ru`/`_en` are null everywhere. Real
KG/RU/EN content-depth variants would need native-language content
authored per row - the columns exist and the app already knows how to
read them per-language, but filling in `_ru`/`_en` with anything other
than a real, verified translation would violate the same "never AI-
generate/fake cultural facts or translations" constraint this feature
exists to uphold. RU/EN readers get the same full-breakdown-in-Kyrgyz
experience they already had before this feature (no worse), and will
start seeing localized simple summaries the moment real translations are
authored and written to those columns - no code change needed. The
onboarding/Settings copy *around* the feature (the age-group question, the
Experience setting) is fully KG/RU/EN.

**Honesty note - coverage**: most rows in every category (all of food and
clothing beyond the two flagships above, and every item this table
doesn't name) are still either "sourced name only" (no history/
cultural_meaning to distill a summary from) or simply don't have a
`simple_summary` yet - they behave exactly as they did before this
feature, showing the full field breakdown at every age. Улуттук оюндар
(games, category id `games`) has **no `culture_items` row at all** for
Ordo/Chuko/Toguz Korgool - checked directly against every migration that
touches this table - so nothing was added there rather than inventing a
first pass of "history" text to fill the gap.

### Guide characters (`src/components/character/GameIntroScreen.tsx`)

Every game already has a designated host character with dialogue lines
(`games/gameHostCharacters.ts` - e.g. Айдана hosts Ordo and Beш Ташы).
`GameIntroScreen` is the shared pre-game intro that plays those lines.
`guideCharacterGating.ts`'s `resolveGameIntroPresentation()` decides how
much of it plays, from `characterProminence` plus a per-game "have they
met this host before" flag (`gameIntroSeen.ts`, AsyncStorage):

| characterProminence | first visit to a game | repeat visits |
| --- | --- | --- |
| `primary` (child) | full multi-line intro | full, every time |
| `frequent` (preteen) | full multi-line intro | skipped |
| `occasional` (teen) | one condensed line | skipped |
| `subtle` (adult) | one condensed line | skipped |

The host character, its dialogue lines, and its voice never change by
age - only how often the intro interrupts. Adults still meet the guide
once per game (never fully removed), just minimally.

**Honesty note**: `GameIntroScreen` currently has exactly one real call
site (`src/app/games/besh-tash.tsx`); the other games in
`gameHostCharacters.ts` have hosts configured but aren't wired through
this screen yet. The age-gating logic benefits every game the moment it's
wired up, but it doesn't retroactively add intros to games that don't call
it today.

### Game detail screen (`src/features/games/GameDetailScreen.tsx`)

The pre-entry "what is this / how to play / difficulty / stats" screen
used by the 5 3D games (`jaa-atuu`, `ordo`, `chuko`, `kyz-kuumai`,
`kok-boru`) now reads `useAgeExperience()` directly:

- **Child** (`textComplexity === 'minimal'`): a taller 1.5:1 banner, the
  description clamped to 2 lines, the game's own host character
  (`gameHostCharacters.ts`, same one `GameIntroScreen` uses) shown next to
  "How to play", no difficulty picker, no stats row at all ("avoid
  overwhelming statistics"), and a visibly bigger Play button (2x the flex
  width of Practice, plus a Play icon).
- **Preteen**: full difficulty picker, full stats row (best score/games
  played/achievements), and a modest cultural-context note when one exists
  for the game (see below) - "moderate cultural context".
- **Teen**: same as preteen but the host character next to "How to play"
  drops out (`characterProminence === 'occasional'`) - "less character
  guidance", standard-density everything else.
- **Adult** (`characterProminence === 'subtle'`): when a verified
  cultural-context row exists, it's promoted to its own card right after
  the banner, above "What is this" - "cultural origin/context more
  prominent". The footer gets tighter padding ("compact Play CTA"); every
  other section (complete tutorial steps, full stats) stays at full
  density - "complete rules available".

**Cultural context, without inventing any**: a new optional
`culturalContextItemId` prop names a real, already-researched
`culture_items` row id; `GameDetailScreen` fetches it with the existing
`useCultureItem()` hook and shows its `history`/`cultural_meaning` fields
verbatim - the exact same verified content `CultureItemDetailScreen`
would show, never new text written for this screen. Wired today for
`kyz-kuumai.tsx` (`horse-kyz-kuumai`) and `kok-boru.tsx` (`horse-kok-boru`)
- the two 3D games with a real culture_items row. `jaa-atuu`, `ordo`, and
`chuko` have no such row yet (checked - Улуттук оюндар has no researched
content at all, see the content-depth section above), so the prop is
omitted for them and the cultural-context section simply doesn't render -
no placeholder or invented text fills the gap.

## Culture Category Detail

`src/features/culture/CultureCategoryDetailScreen.tsx` is the single reusable
screen behind every category route (`src/app/culture/[categoryId].tsx`) -
Боз үй, Оймо, Шырдак, Комуз, Улуттук кийим, Ат маданияты, Ашкана, Улуттук
оюндар, Каада-салт, Музыка all render the same component driven by category
data, replacing the old flat icon-tile grid (`CultureCategoryScreen.tsx`,
deleted). Layout, top to bottom:

- Full-bleed hero (`categoryImage`, real category photography) with a
  gradient, back button, title, and a `current/total` progress `Pill` -
  never a flat icon tile.
- An optional intro paragraph from `pickCategoryIntro()`
  (`src/features/culture/categoryIntro.ts`), which only ever surfaces real
  `history`/`cultural_meaning` text already in `culture_items` (picked from
  the richest, lowest-`sort_order` item with any content, resolved through
  `resolveContentByDepth` for the current age's `learningDepth`) - no
  category gets invented copy, and one with no researched items yet simply
  has no intro section.
- An optional featured interactive-experience card
  (`interactiveExperienceForCategory()`,
  `src/features/culture/interactiveExperiences.ts`) for the four categories
  that actually have one (Оймо/Боз үй/Шырдак/Комуз) - never a dead button
  for the rest.
- The item list itself, `resolveByCardScale`-driven between a 1-column
  full-width list (child, and adult's denser row variant) and a 2-column
  grid (preteen/teen), using each item's own photo from `cultureItemImages`
  when one exists and falling back to the same type-keyed icon tile the old
  screen used otherwise.

## Explore Destination Detail

`src/features/explore/LocationDetailScreen.tsx` is the one shared "enter
this place" page for every `/explore/[id]` route, region or nature site
alike. `heroImage` is a real photo reused from one of the location's own
`discoveries` when bundled art exists for it; when it doesn't, the hero
falls back to a flat tone color plus `OymoOrnament` rather than a
mismatched or generic photo. Facts render as a numbered list (no bordered
boxes), the existing `DiscoveriesRow` is untouched, and a "Part of your
quest" card only appears when `src/app/explore/[id].tsx` finds a genuine
match between the player's next incomplete quest step and this location
(`findNextIncompleteStep` + `resolveStepRoute`) - never shown
speculatively. `config.characterProminence` decides whether that quest card
sits near the top (child/preteen) or after the facts (teen/adult), and
`isChild`/`isAdult` trim the fact list to 2 items or tighten it into denser
caption text, respectively.

## The motion system

A small, deliberately restrained set of shared motion primitives under
`src/services/motion/` and `src/components/ui/`, built so most screens opt
in by using an existing component rather than hand-rolling animation:

- `useReducedMotion()` (`src/services/motion/useReducedMotion.ts`) reads
  `AccessibilityInfo.isReduceMotionEnabled()` and subscribes to
  `reduceMotionChanged`. Every animated primitive below checks it and skips
  straight to the end state - no partial fade, no transform - when it's on.
- `MOTION_BY_INTENSITY` (`src/services/motion/motionTokens.ts`) maps the
  existing `config.animationIntensity` (`playful`/`moderate`/`calm`) to a
  concrete `{ pressScale, enterDistance, enterDurationMs, spring }` tuple,
  giving child mode slightly stronger, snappier motion and teen/adult a
  calmer, smaller one from the *same* components.
- `FadeSlideIn` and `AnimatedPressable` (both pre-existing) now read those
  tokens instead of hardcoded constants, so every screen already using them
  for card entrance and press feedback got age-adaptive, reduced-motion-safe
  motion for free.
- `ProgressBar` and `ProgressRing` animate their fill/stroke toward the
  target value with `withTiming` (an `Animated.createAnimatedComponent` /
  `useAnimatedProps` wrapper around `react-native-svg`'s `Circle` for the
  ring) - once from 0 on mount, smoothly between later values, never
  replaying from 0 on every re-render, and jumping straight to the target
  under Reduce Motion.
- `AgeExperienceTransition` (`src/components/ui/AgeExperienceTransition.tsx`)
  wraps each screen's age-ordered section list (`HomeScreen`,
  `CultureScreen`, `ExploreScreen`) in an `Animated.View` keyed by
  `experience`, so switching age groups in Settings crossfades the new
  section order/content in instead of jump-cutting to it. Skipped entirely
  under Reduce Motion.
- `useHeroParallax()` (`src/services/motion/useHeroParallax.ts`) gives
  `CultureCategoryDetailScreen` and `LocationDetailScreen`'s hero image a
  subtle scroll-linked drift (slower than the scroll) plus a slight
  overscroll zoom, computed entirely on the UI thread via a Reanimated
  scroll handler - no JS work per frame, no-op under Reduce Motion.
- The 6 home/culture/explore/profile horizontal carousels
  (`GamesCarousel`, `DiscoveriesRow`, `NatureSitesRow`,
  `InteractiveExperiencesRow`, `NewMaterialsRow`, `ProfileCollectionRow`)
  use plain smooth horizontal scrolling, not `snapToInterval` - an earlier
  pass added per-card snapping here, but `snapToInterval` computes its snap
  grid from content-origin (x=0), not from the row's own leading
  `paddingHorizontal` gutter. That mismatch made every snap after the first
  land `paddingHorizontal` short of the true card boundary (a sliver of the
  previous card left showing) and could leave the final card's fully-
  scrolled position unreachable. Removed rather than patched, per the
  "prefer normal smooth horizontal scrolling" guidance for rows where
  snapping isn't essential - all six are small thumbnail strips, not a
  primary swipe-through experience.
- Game Play/Practice CTAs already routed through the shared `Button`
  component, which already wraps `AnimatedPressable` with a real haptic
  (`medium` for primary, `light` for secondary) - no separate change was
  needed for "satisfying press feedback" there.
- Navigation transitions between every Culture/Explore card and its detail
  screen are already consistent by construction: the whole app is one flat
  `expo-router` `<Stack screenOptions={...}>` in `src/app/_layout.tsx` with
  no per-route animation override anywhere, so every push uses the same
  platform-default transition.
- **Not done**: game physics/3D rendering were not touched, per the
  explicit instruction; no continuous/looping JS-thread animation was
  added anywhere - every animation here is either gesture-driven (press,
  scroll) or runs once on mount/enter/value-change and then stops.

## What was intentionally not built

- **No four separate screens or forked business logic anywhere.** Every
  adaptation above is a reorder, a resize, or a text-verbosity switch on
  the *same* component tree reading the *same* data.
- **No AI-generated cultural content at runtime**, anywhere, for any age.
- **No game, culture category, or cultural fact is hidden by age** - only
  its presentation, ordering, or explanatory depth changes.
- **Admin panel editing for `simple_summary_*`** was not wired up (the
  existing `admin_upsert_culture_item` RPC and its admin-panel field list
  weren't extended) - new simple summaries ship via migration, the same
  way most `culture_items` content already does.
- **No RU/EN translations of any cultural fact or simple summary were
  authored or faked** - the columns exist, every value in them today is
  Kyrgyz.
- **Улуттук оюндар (games) has no age-adaptive content depth** - there is
  no verified `culture_items` content for it to adapt yet.
- **Button, IconButton, and other truly global shared components were
  deliberately left non-age-reactive** - only the CTAs living inside Home/
  Games/Culture/Explore/Profile/GameDetailScreen were made age-aware, so
  Settings, auth, and other screens outside this feature's explicit scope
  render identically regardless of age.

## Testing

Every pure decision function above has unit tests, run with `npx jest`:

- `src/services/ageExperience/config.test.ts` - all four configs populated,
  sane relative ordering (child < adult content density, etc).
- `src/services/ageExperience/useAgeExperience.test.ts` - hook defaults and
  mapping, driven through a small `react-test-renderer` harness (no
  `@testing-library/react-native` dependency in this project).
- `src/services/ageExperience/contentDepth.test.ts` - fallback-to-standard
  behavior.
- `src/services/ageExperience/guideCharacterGating.test.ts` - the
  presentation table above.
- `src/services/ageExperience/scale.test.ts` - `resolveByCardScale` picks
  the right tier, `resolveTouchTargetSize` shrinks child→adult but never
  below the 44pt accessibility floor.
- `src/store/useAppStore.ageGroup.test.ts` - persistence, reload, and
  "changing groups later" (Task 9's explicit ask).
- `src/services/navigation/routeGuard.test.ts` - the `/age-group` redirect
  rule and its ordering relative to language/onboarding/sign-in.
- `src/features/{home,culture,explore}/*Sections.test.ts` - every section
  order is a full permutation of the same section set, for every
  experience (proof no section silently disappears for any age).
- `src/services/ageExperience/config.test.ts` also asserts every
  experience gets its **own distinct** `cardScale` and `artworkProminence`
  tier (`new Set(...).size === 4`) - a regression guard against two ages
  quietly sharing a tier again.
- `src/features/culture/categoryIntro.test.ts` - `pickCategoryIntro` picks
  the richest, lowest-`sort_order` item, prefers `simple_summary` at the
  `simple` depth, falls back to `history`/`cultural_meaning`, and never
  resolves a null RU/EN summary.
- `src/services/motion/motionTokens.test.ts` - each intensity tier is
  distinct and internally consistent (e.g. `playful` never ends up calmer
  than `calm`).

`npx tsc --noEmit` and the full `npx jest` suite were run clean after every
step in this feature (324 tests passing at the time of writing). Live
device/simulator visual QA across all four modes was **not** performed as
part of this pass - this environment's browser tooling has repeated
memory/rendering limitations noted elsewhere in this project's history, so
this doc makes no claim about on-device visual polish beyond what the code
and its tests can verify. "Switching 6-9 → 18+ without restarting the app"
was verified architecturally, not by hand on a device: every adapting
component calls `useAgeExperience()`, which subscribes to `useAppStore`
reactively - `setAgeGroup()` (Settings > Experience) triggers a normal
React re-render of every mounted screen with the new config, the same way
any other zustand-backed preference in this app already updates live,
with no cache to invalidate or screen to remount. A manual pass on a real
device per age group is still worth doing before calling this feature done
end-to-end.
