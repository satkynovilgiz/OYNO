# OYNO UI conventions

The semantic layer lives in `src/theme/ui.ts` and is tested in `src/theme/ui.test.ts`. It is named roles over the existing tokens; it adds no new colours or sizes, apart from naming the overlay values that were already repeated. The palette (cream, forest, gold, terracotta, felt reds) and the oymo ornament stay as they are. This is not a rewrite: the representative screens below use the system now, and the rest of the app migrates as screens are touched.

## Inventory (2026-10-14, 554 screen and component files, games3d excluded)

| What | Found | Decision |
| --- | --- | --- |
| Type scales | Legacy `typography.*` 666 uses; `textStyles.*` 1066 uses | `headings` and `text` roles over `textStyles`. The legacy scale is not used in migrated screens. |
| Literal `fontSize` | 175 in 103 files (18 ×26, 17 ×24, 19 ×21, …) | Use a role instead. Article paragraphs became `text.reading` and `text.readingLarge`. |
| Card padding + radius | `sm` + compact 99×, `md` + compact 91×, plus a handful of others | Three presets: `cards.standard`, `cards.compact`, `cards.feature`, plus `highlighted` and `note`. |
| Literal `borderRadius` | 243 (22 ×35, 12 ×28, 18 ×17, …); most are circles | `medallion(size)` for round icon backgrounds; `cardRadii` / `radii` for everything else. |
| Raw rgba | 199 in 81 files | The 7 repeated forest/gold overlays are now `overlays.*`. 41 occurrences were replaced, with the same values. |
| Raw hex | 36 in 16 files, mostly motif art colours in `motifs.tsx` and `patterns.tsx` | Kept. Those are artwork data, not UI chrome. |
| Button variants | secondary 268, text 142, accent 24, primary 6 (the default, rarely passed explicitly), destructive/danger 5 | One state table: `controlStates`. |
| Icon sizes | 709 literals (16 ×188, 18 ×116, 14 ×85, …) | Use `iconSizes` (14/16/20/24/28). The 18s in migrated screens became `md`. |

## Heading hierarchy

| Role | Style | Use |
| --- | --- | --- |
| `headings.display` | 30 / 36 / 800 | One hero moment only (onboarding, the article hero title) |
| `headings.screen` | 22 / 27 / 800 | The screen's own title, once per screen, `accessibilityRole="header"` |
| `headings.section` | 19 / 24 / 700 | A section inside a screen (for example Home's "What would you like to do?") |
| `headings.card` | 17 / 22 / 700 | A card or row title (Continue card, Create hub rows, Profile quest row) |
| `headings.label` | 11 / 14 / 700, uppercase | Group labels and kickers ("CONTINUE", "MORE IN OYNO"). Not a heading level. |
| `text.body`, `text.emphasis`, `text.meta`, `text.fine` | 15, 15/600, 13, 12 | Body copy, emphasised body, metadata, fine print |

Every role has an explicit line height, so KG and RU titles that wrap stay evenly spaced. This is tested.

## Spacing and cards

- **Layout spacing.** `layout.gutter` 16 is the screen edge, `layout.sectionGap` 24 separates sections, `layout.stackGap` 12 separates items, and `layout.cardGap` 8 separates lines inside a card.
- **Width limit.** `layout.maxContentWidth` 720 caps reading and form content on wide windows. It is used by the article body and the Create hub.
- **Card presets.** The padding ladder is 12, 16, 20, and the radius always comes from `cardRadii`:
  - `cards.standard`: `HomeTodayPair`, Create hub rows, Profile quests row.
  - `cards.compact`: Creator's tool entry rows.
  - `cards.highlighted`: Home's Continue card.
  - `cards.feature` and `cards.note`: large blocks and informational notes.

## Control states (`controlStates`)

| State | How it looks |
| --- | --- |
| Primary | Forest fill, white text. Pressed uses the darker forest (`primaryPressed`). |
| Accent | Gold fill, dark text. Pressed `accentGoldPressed`. Use for the one reward/hero action on a screen. |
| Secondary | Cream surface, forest text, hairline border. Pressed uses the muted cream. |
| Ghost / text | Forest text. Pressed shows the muted cream behind it. |
| Destructive | `dangerFill` with white text (5.05:1). Pressed uses deep terracotta. |
| Disabled | Muted surface with muted text: visibly different, still legible (≥ 3:1, tested). It is no longer just opacity. A disabled text-only control keeps a transparent background with muted text. |
| Selected (chips, segments) | Forest fill, white text. |

`Button`, `IconButton` and `Chip` read this table. The test checks that every enabled, pressed and selected state is ≥ 4.5:1.

## Contrast fixes made during the audit

- **Creator tab labels.** Inactive labels were `textMuted` on `surfaceAlt`, measured 4.36:1, below AA. They now use `textSecondary`.
- **"Read and listen" switch.** It rendered a real `Switch` inside the row that already is the switch. On web that is a nested, unlabeled checkbox (axe: critical `label`, serious `nested-interactive`). It is now a visual-only mark, and the row stays the single switch.
- **Creator entry rows.** They reused the header's centred subtitle style. They now have a left-aligned `restoreMeta` style.

## Migrated (guarded by `ui.test.ts`: no literal font sizes, legacy typography or raw colours)

- **Home:** `HomePrimary`, `CreateHubScreen`, `HomeTodayPair`, `HomeProgressSection`, `ContinueRegionCard`, `RecentlyExploredRow`.
- **Article:** `CultureItemDetailScreen`.
- **Creator:** `OymoCreatorScreen`.
- **Profile:** `ProfileScreen`.

## Checks

- **Unit:** `src/theme/ui.test.ts` (hierarchy, card tokens, contrast pairs, migration guard).
- **E2E:** `e2e/tests/ui-conventions.spec.ts` runs Home, an article, the Creator and Profile at 360 px in KG, RU and EN. It checks for horizontal overflow, raw i18n keys and serious axe issues, and saves screenshots to `e2e/.results/ui-*.png`, which were reviewed.
- **Device check (PENDING):** iOS Dynamic Type and Android font scale at their largest settings on the migrated screens.
