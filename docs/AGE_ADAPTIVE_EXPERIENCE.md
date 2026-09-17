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

### Games (`src/features/games/components/GameCard.tsx`)

Same games, same routes, same `mockGamesList`. `GameCard` reads
`cardScale` (aspect ratio + icon size), `textComplexity` (whether the
difficulty/duration/players meta line shows, and whether it's abbreviated)
and the played-count "gamification" pill (dropped for `rich` text
complexity - i.e. adult - per "reduced gamification clutter"). Child gets
a visibly larger card and a labeled "Play" pill instead of an icon-only
badge, for an unambiguous tap target. No game is ever hidden by age.

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

**Honesty note**: Culture/Explore's per-age ordering wasn't given as a
literal bullet list the way Home's was - it was derived from the same
`AgeExperienceConfig` axes (artwork/character prominence, content
density), following Home's own reasoning. If real usage data later
suggests a different order, it's a one-line change in either file.

### Content depth (`src/features/culture/CultureItemDetailScreen.tsx`)

`ContentDepth` is `simple | standard | advanced`, deliberately not 1:1
with `AgeExperience` - it's `AgeExperienceConfig.learningDepth` used as a
*default* (child/preteen → simple, teen → standard, adult → advanced).

**The hard constraint the spec called out**: no cultural fact is ever
generated by AI at runtime. `CultureItemRow.simple_summary` is a new,
nullable column (migration
`supabase/migrations/20260917000001_culture_items_simple_summary.sql`)
holding a short, pre-authored distillation of that same row's own
`history`/`cultural_meaning`/etc fields - written once, at content-authoring
time, stored like every other field in `culture_items`. Populated today
for all 6 Boz Üy items, the concrete example the spec named.
`resolveContentByDepth()` (`src/services/ageExperience/contentDepth.ts`) is
the one place that picks a variant - if the resolved depth's field is
missing, it falls back to the full field-by-field breakdown that's always
been there (this doubles as "standard" and "advanced", since OYNO doesn't
yet have a separately-authored advanced tier beyond its existing full
research write-up). A row with no `simple_summary` at all behaves exactly
as before this feature shipped.

**Honesty note - languages**: `culture_items` content (including the new
`simple_summary` field) is Kyrgyz-only today, matching how this table
already worked before this feature. Real KG/RU/EN content-depth variants
would need native-language content authored per row - out of scope here,
since fabricating translations of nuanced cultural facts at runtime would
violate the same "never AI-generate cultural facts" constraint this
feature exists to uphold. The onboarding/Settings copy *around* the
feature (the age-group question, the Experience setting) is fully
KG/RU/EN.

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

## What was intentionally not built

- **No four separate screens or forked business logic anywhere.** Every
  adaptation above is a reorder, a resize, or a text-verbosity switch on
  the *same* component tree reading the *same* data.
- **No AI-generated cultural content at runtime**, anywhere, for any age.
- **No game, culture category, or cultural fact is hidden by age** - only
  its presentation, ordering, or explanatory depth changes.
- **Admin panel editing for `simple_summary`** was not wired up (the
  existing `admin_upsert_culture_item` RPC and its admin-panel field list
  weren't extended) - new simple summaries ship via migration, the same
  way most `culture_items` content already does.
- **GameDetailScreen** (the pre-entry "what is this / how to play /
  difficulty / best score" screen used by some 3D games) was not adapted
  by age in this pass - it's a separate, already-existing screen from
  earlier work, out of scope for this feature.

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
- `src/store/useAppStore.ageGroup.test.ts` - persistence, reload, and
  "changing groups later" (Task 9's explicit ask).
- `src/services/navigation/routeGuard.test.ts` - the `/age-group` redirect
  rule and its ordering relative to language/onboarding/sign-in.
- `src/features/{home,culture,explore}/*Sections.test.ts` - every section
  order is a full permutation of the same section set, for every
  experience (proof no section silently disappears for any age).

`npx tsc --noEmit` and the full `npx jest` suite were run clean after every
step in this feature (314 tests passing at the time of writing). Live
device/simulator visual QA across all four modes was **not** performed as
part of this pass - this environment's browser tooling has repeated
memory/rendering limitations noted elsewhere in this project's history, so
this doc makes no claim about on-device visual polish beyond what the code
and its tests can verify. A manual pass on a real device per age group is
still worth doing before calling this feature done end-to-end.
