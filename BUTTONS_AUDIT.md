# Button Audit

Scope: every tappable element in `src/`, `games/beshTash/`, and their screens.
Read-only pass — no code changed while writing this.

## 1. Existing shared components

| Component | File | Supports | Missing |
|---|---|---|---|
| `AnimatedPressable` | `src/components/ui/AnimatedPressable.tsx` | Scale-down on press (0.94, spring), the base primitive everything else builds on | No color/opacity shift, no haptics, no disabled concept (that's left to callers) |
| `Button` | `src/components/ui/Button.tsx` | Variants `primary`/`secondary`/`danger`, `loading` (spinner, blocks interaction), `disabled` (opacity 0.5, `onPress` set to `undefined`) | No haptics, no pressed color/opacity shift beyond `AnimatedPressable`'s scale, no explicit min-height (relies on padding, ~40px tall — under the 44pt target) |
| `IconButton` | `src/components/ui/IconButton.tsx` | `variant` `surface`/`primary`, `shape` `circle`/`roundedSquare`, default `size=44` (meets touch target by default), `showBadge` | **No `disabled` prop at all** — cannot be disabled today. No haptics. No loading state (not currently needed anywhere, but worth having for consistency). |
| `IconChip` | `src/components/ui/IconChip.tsx` | Decorative rounded-square icon container | Not a button — no `onPress` at all. Used correctly as a non-interactive leading icon on cards (Calendar/Gift chips). Flagging only because the spec's "icon chip" bullet implies it should be tappable somewhere; today it never is. |

`Button` and `IconButton` are already the dominant pattern — 28 `Button` usages and 16 `IconButton` usages found, all via the shared component (see §2). The real gap isn't "raw touchables everywhere," it's **five duplicated ghost/link patterns** and the two gaps above.

Raw `Pressable`/`TouchableOpacity` imports found: only `AnimatedPressable.tsx` itself (expected) and `KyrgyzstanMap.tsx` (invisible hit-target overlays on baked-in map artwork — legitimate exception, no visible button there to style).

## 2. Screen-by-screen catalog

### Using `Button` (primary/secondary/danger pill) — consistent, no action needed
`ConfirmationModal`, `ErrorBoundary`, `SecurityScreen`, `GameIntroScreen`, `HelpScreen`, `AccountSettingsScreen`, `ProfileSetupScreen`, `OnboardingScreen` (x2), `DailyRewardCard`, `AchievementUnlockedModal`, `LanguageSelectScreen`, `CharacterSelectScreen`, `ForgotPasswordScreen`, `VerifyResetCodeScreen`, `SignInScreen` (x3), `VerifyEmailScreen`, `ResetPasswordScreen` (x2), `SignUpScreen` (x3), `GameCard`, `InviteFriendsBanner`, `BeshTashScreen` (x3: start, restart-on-win, restart-on-fail).

### Using `IconButton` (circular/rounded-square icon) — consistent, no action needed
`SettingsScreen`, `SettingsScreenLayout`, `HomeHeader` (x2), `ProfileHeader` (x3), `DailyGiftCard`, `DailyChallengeCard` (the card's own "→" arrow — confirmed it reuses `IconButton variant="primary" size={32}`, not hand-rolled), `CultureGrid`, `NotificationsScreen`, `LocationDetailScreen`, `ExploreHeader` (x2), `CultureHeader` (x2), `BeshTashScreen` (back button).

### Duplicated "ghost/text link" pattern — **not shared, copy-pasted per file**
Same visual/behavioral pattern (`AnimatedPressable` wrapping `Text` + optional `ChevronRight`, styles literally named `seeAll`/`seeAllText` in every file) reimplemented independently in:
- `CultureCategoriesGrid.tsx` ("Баарын көрүү ›")
- `GamesCarousel.tsx` ("Баарын көрүү ›")
- `ProfileCollectionRow.tsx` ("Баарын көрүү ›")
- `NewMaterialsRow.tsx` ("Баарын көрүү ›")
- `DiscoveriesRow.tsx` ("Баарын көрүү ›")
- `AchievementsPreviewCard.tsx` / `FavoriteGamesCard.tsx` (chevron-only variant, no label)
- `CultureCategoryScreen.tsx`, `CultureItemDetailScreen.tsx` (headers I wrote in the Culture-items work — same pattern, same duplication)

Plus two more one-off ghost-button variants:
- `OnboardingScreen.tsx`: `skipButton`/`skipLabel` ("Skip") and `laterButton`/`laterLabel` ("Later") — separate hand-rolled styles, same underlying pattern.
- `SignInScreen.tsx` / `SignUpScreen.tsx`: `forgotLink`, `footerLink` — plain `<Text onPress>`, no `AnimatedPressable` wrapper at all, so **zero press feedback**.
- `VerifyEmailScreen.tsx`: `resendLink` (also raw `<Text onPress>`, no press feedback, though it does at least get a disabled-looking style during cooldown) and `linkText` x2 (change email / back to sign in, also raw `Text`).

This is the single biggest consolidation opportunity: one `TextButton`/ghost variant would replace ~13 duplicated implementations.

### Category/filter chip pattern — consistent within itself, distinct archetype
`CategoryFilters.tsx` (games), plus the equivalent chip styling in `HelpScreen.tsx`'s FAQ category chips and `PrivacySettingsScreen`/`SettingsLanguageScreen`/`LanguageSelectScreen`'s selectable option rows (border+checkmark, not fill). These are legitimately a different archetype (toggle/selection, not an action button) and already behave consistently — not folding these into `Button`, but noting them as their own family per the spec's "PillButton if genuinely structurally different" allowance.

### Settings navigation row — already its own consistent component
`SettingsRow.tsx` is a single shared component used by every Settings screen for "tap to navigate" rows. Not a button per se (no press color change, relies on chevron + `AnimatedPressable` scale), but already consolidated — no duplication problem here.

### `KomuzPlaylist.tsx` — the reported "stuck hover" item
Not a shared-component bug (see conversation) — this file's own "currently loaded track" indicator uses a full `backgroundColor: colors.primary` fill on the active row. Flagged for redesign to a lighter treatment as part of this pass, pending your sign-off on the new look.

## 3. Distinct button archetypes observed

1. **Primary pill** — solid `colors.primary` fill, white text (`Button` default variant). ✅ consolidated.
2. **Secondary pill** — cream/surface fill, bordered, primary-colored text (`Button variant="secondary"`). ✅ consolidated.
3. **Danger pill** — red fill (`Button variant="danger"`, used only in `ConfirmationModal`). ✅ consolidated.
4. **Circular/rounded-square icon action** — `IconButton`, both `primary` (green) and `surface` (cream) fills. ✅ consolidated, but missing `disabled`.
5. **Icon chip** — `IconChip`, decorative only today, never tappable. No action needed unless a screen actually wants a tappable version.
6. **Ghost/text link** — ✅ archetype identified, ❌ not consolidated (13 duplicated implementations, 3 of which have zero press feedback because they're raw `Text`).
7. **Category/selection chip** — consistent within its own files, legitimately separate from action buttons.
8. **Settings row** — consistent, separate archetype (navigation, not action).

## 4. Gaps vs. spec

- **No haptics anywhere** — `expo-haptics` is not a dependency. Needs adding.
- **No explicit pressed color/opacity state** — every button's only press feedback is `AnimatedPressable`'s scale. Spec asks for scale *plus* a subtle opacity/color shift.
- **`IconButton` has no `disabled` prop** — every icon button is always interactive today, even where it conceptually shouldn't be (none currently misused this way, but the capability doesn't exist).
- **Touch targets under 44pt**: `Button`'s pill height (~36-40px depending on font metrics) and every ghost/text-link button (`seeAll`, `skipButton`, `forgotLink`, etc. — typically ~24-29px tall with their current padding) are below the 44pt minimum with no `hitSlop` compensating.
- **Three raw-`Text`-with-`onPress` buttons with zero press feedback**: `SignInScreen`/`SignUpScreen`'s `forgotLink`/`footerLink`, `VerifyEmailScreen`'s `resendLink` and `linkText` x2.
- **OTP screen (`VerifyEmailScreen`) reachability**: checked directly — the submit `Button` sits in a `footer` view at the bottom of a `flexGrow: 1, justifyContent: 'space-between'` scroll container, always rendered (not conditionally hidden), so it's currently always reachable. No repro of the "unreachable/missing" bug in the current code — noting this so the fix effort here is "keep it that way while restyling," not "find and fix a live regression."
- **No reward/result 3-button row (Section 34) currently exists anywhere in the codebase.** `BeshTashScreen`'s win/fail overlay has a single "Play again" button, not a 3-button replay/next/home row. I have not invented one — flagging this as a spec/implementation gap for you to confirm: is a 3-button result row an existing screen I missed, or new UI to design as part of this pass?
- **Dead/no-op buttons found**: none. Every `Button`/`IconButton`/ghost-link instance found has a real `onPress` wired to a real handler (some handlers are intentional placeholders like `handleUnavailableProvider` for Google/Apple sign-in, which correctly shows an "unavailable" alert rather than doing nothing — not a dead button, a deliberate not-yet-implemented feature with honest feedback).
