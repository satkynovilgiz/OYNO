# OYNO - Accessibility of the main journeys

Audit date **2026-10-05**. Scope: Home, Search, Learning Paths, Game Stats,
Downloads and Memory Book, with the shared UI primitives they use (Button,
Chip, IconButton, TextButton, TextField, Toggle, MediaImage, ConfirmationModal,
ScreenHeader, SectionHeader, library rows, Toast).

**Where this was verified:** the web export in Chromium (Playwright,
Pixel 7 emulation), using axe-core 4.13 (`@axe-core/playwright`) and
keyboard-driven tests (`e2e/tests/accessibility.spec.ts`), plus Jest guards
(`src/services/a11y/a11y.test.ts`). **No VoiceOver or TalkBack testing was
done.** Every physical-device row below is PENDING.

## Measured findings (before the fixes)

axe was run with the WCAG 2.0/2.1 A + AA and best-practice tags. Contrast
ratios were computed from the actual theme tokens (`src/theme/colors.ts`).

| Finding | Impact | Where | Measured |
| --- | --- | --- | --- |
| `textMuted` (ink400 `#786550`) on background | serious | Search, Game Stats | 4.47:1 (needs 4.5). An older comment said it cleared 4.5; it did not. |
| Terracotta overline text (`#B9622F`) | serious | Path kicker/step verb, section headers, Game Stats, Search type label, Home | 3.48:1 on background, 3.92:1 on surface |
| Gold eyebrow text (`#C79A2E`) | serious | Downloads ("Your OYNO"), every ScreenHeader eyebrow | 2.08:1 |
| Trail type label (`#8B6B3D`) | serious | Search / library rows | 3.95:1 |
| White label on the destructive button (`#D64545`) | serious | Downloads "Remove all" | 4.38:1 |
| `<img>` without `alt` | critical | Home, Search, Path, Game Stats | expo-image 57 (web) only puts `accessibilityLabel` on the loaded image, never `alt` |
| `aria-label` on a `div` with no role | serious | Home avatar | - |
| `role="search"` on the search `<input>` | minor | Search | "search" is the landmark role on web |
| Selected / disabled / checked / expanded states missing | (not detected by axe) | Filter chips, buttons, toggles, path step checkbox, Memory Book, round rows | react-native-web 0.21 **ignores `accessibilityState`**; only `aria-*` props reach the DOM |
| Retry download has no disabled state | (not detected by axe) | Learning Path offline row | it is disabled offline but did not say so |
| Announcements silent on web | (not detected by axe) | Toasts, download check, Memory Book | react-native-web's `announceForAccessibility` is a no-op |
| Confirmation dialog has no name | (not detected by axe) | Downloads and Memory Book dialogs | `role="dialog"` with no label |

## Fixes

- **Contrast.** `ink400` changed to `#74614C` (4.74 on background, 5.35 on surface). Added text-only shades `accentTerracottaText` `#9B5227` (4.65 / 5.24) and `accentGoldText` `#7E621D` (4.62 / 5.21). Content-type labels now use `textTone` (trail `#7A5C33`, 4.95). The destructive button fill is now `dangerFill` `#C53F3F` (5.05 with white). Brand shades stay unchanged for fills, icons and marks. Jest keeps these pairs at AA or above.
- **Images.** `MediaImage` and the library thumbnails are decorative (`alt=""`); the card or button around them carries the name. The article hero is decorative too, because the title follows directly.
- **Roles and states.** Shared primitives and the audited screens now set `aria-selected`, `aria-disabled`, `aria-busy`, `aria-checked` and `aria-expanded` alongside `accessibilityState`. RN 0.86 maps these on native as well. The avatar has the image role, and the search field uses `role="searchbox"` (the search trait on native).
- **Dialogs.** `ConfirmationModal` is named by its title, and the title is a heading. react-native-web's Modal already moves focus into the dialog (to Cancel, the safe action), traps Tab, closes on Escape and returns focus to the trigger. All of this is now covered by a test.
- **Announcements.** `announce()` (`src/services/a11y/announce.ts`) uses the platform API on native and a persistent, visually hidden polite live region on web. It is used for toasts, download-check completion and Memory Book preparation ("Preparing…" / "prepared"; KG/RU/EN).
- **Reduced motion.** The newly audited image fades (library thumbnails, article hero) are skipped under Reduce Motion, as `MediaImage` already did. The new Learning Path card has no animation.

## Explained remaining findings

- **`region` (moderate, best-practice):** react-native-web renders no landmark elements for the expo-router navigator, so axe reports content outside landmarks. Every audited screen exposes an `h1` heading. This rule is disabled in the smoke check with this reason. Fixing it would mean restructuring the root layout, which is outside this scope.
- `cream200` (surfaceAlt): muted and accent TEXT colours measure about 4.25 to 4.36 on it. Avoid small muted or accent text on that surface. None was flagged on the audited screens.
- Memory Book PDF creation is phone-only. On web the screen shows an explanation, so the selection checkboxes are covered by code (aria-checked / aria-disabled) and by a device check, not by a browser run.

## Automated checks (`npm run e2e`)

- axe: no serious or critical findings on Home, Search (with results), Learning Path, Game Stats list and detail, Downloads, Memory Book (web state), and the open "Remove all" dialog.
- Keyboard: Search → result → article, Path Start, and the Game Stats filters (`aria-selected` follows the selection) all work without a pointer, with a visible focus outline on each focused control.
- The chart keeps its text alternative (`role="img"` with the values and average).
- Modal focus in / trap / Escape / return, and the dialog is named.
- The download-check result reaches the live region.
- The disabled state is exposed (Retry download while offline).
- At 320 px with Reader XL and Larger controls, the primary actions on Downloads, Search and Path are on screen, not squeezed, and cause no horizontal scroll.

## Device checks still PENDING (VoiceOver / TalkBack)

| Check | iOS VoiceOver | Android TalkBack |
| --- | --- | --- |
| Home → Search → article: each control has a meaningful name; decorative images skipped | PENDING | PENDING |
| Game Stats filters announce "selected"; round rows announce expanded/collapsed; the chart is read as one summary | PENDING | PENDING |
| Downloads: "Check downloads" result is announced; the Remove dialog takes focus and returns it | PENDING | PENDING |
| Memory Book: checkboxes announce checked/disabled (max entries); "Preparing… / prepared" are announced; the missing-photos dialog | PENDING | PENDING |
| Learning Path: "Continue learning" card is read with the next step's type and title; the manual "Mark step complete" checkbox | PENDING | PENDING |
| Largest Dynamic Type / font scale: primary actions stay visible on Home, Search, Path, Game Stats, Downloads, Memory Book | PENDING | PENDING |
| Reduce Motion on: no image fades or sheet scale animations | PENDING | PENDING |
| Toasts announced once (not twice) | PENDING | PENDING |
