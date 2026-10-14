# Interaction feedback

## Audit of what already existed (2026-10-14, app UI, games3d excluded)

| Mechanism | Where | Kept? |
| --- | --- | --- |
| Press squeeze (`AnimatedPressable`, `motion.pressSoft` 0.985 / `pressStrong` 0.96, 100–150 ms, no bounce; no motion under Reduce Motion) | Every shared control | Kept: the one press convention |
| Entrances (`ScreenEntrance`, `HeroEntrance`, `FadeSlideIn`, `AgeExperienceTransition`) | Tab screens, Home sections | Kept; they already respect Reduce Motion |
| `Skeleton` pulse (frozen under Reduce Motion) | Loading placeholders | Kept |
| `Toast` (optional success haptic), `CompletionSheet` (notification haptics) | Results and completions | Kept: these are meaningful |
| Plain-tap haptics: `haptic="light"` / `"medium"` on 47 controls, including **every** `Button` (medium on primary) and `IconButton` press, tab-bar taps, cards, tiles and swatches, fired on **press-in** | Everywhere | **Removed.** A buzz on every tap carries no information, repeats on nudges and steppers, and fired even when a touch turned into a scroll. |
| Game feedback haptics (rhythm trainer, image challenge, passport stamp, achievements) | Games and rewards | Kept: they are the feedback |

## Conventions (shared, never per-screen)

- **Pressed.** The fill darkens to the pressed colour from `controlStates` (no longer just opacity), plus the press squeeze. Under Reduce Motion the colour change remains.
- **Selected.** `controlStates.selected` (forest fill, white text), with `aria-checked` / `accessibilityState.selected` on chips, radio groups and segments.
- **Saving → saved / failed.** `useSaveFeedback` + `SaveStatus` (`src/components/feedback`):
  - The status follows the save's **real** boolean result. "Saved" appears only after the write succeeded and fades back after 2.5 s. "Not saved – try again" stays until the next attempt.
  - Every attempt is numbered, so an older, slower result can never overwrite a newer state. There is no stuck "Saving" and no "Saved" over a failure (unit-tested).
  - The status line reserves its height, so the layout doesn't jump. It is announced politely (assertively for a failure), never takes focus, and has `pointerEvents="none"`, so it never blocks controls.
  - Under Reduce Motion it appears without the 180 ms fade.
- **Transitions.** Only where they explain a change (a status appearing, a surface switching). They use `motion.duration` tokens (≤ 220 ms) and never delay navigation; a test checks that no `setTimeout` wraps `router.push` or `router.replace`.
- **Focus.**
  - Controls that become unavailable right after use, like "Move down" at the bottom of the list, use `keepFocusWhenDisabled` (Button already had it; IconButton now does too). They look and announce disabled, but keyboard focus stays put.
  - On web, `aria-disabled` is set on the DOM node, because react-native-web overwrites it.
  - While a save runs, extra presses are ignored rather than disabling the controls, so focus never drops.
- **Haptics** (optional, native only, through `services/comfort/haptics.ts`, so the Comfort setting standard / reduced / off applies):
  - **Allowed:** one notification for the confirmed success or failure of a save (`useSaveFeedback`), completions and achievements, and game feedback.
  - **Not allowed:** ordinary taps, keystrokes, repetitive gestures (nudges, steppers, drags, pans), and selection scrolling.
  - An explicit `AnimatedPressable` haptic now fires on the completed press, never on press-in. A test fails if any app UI file sets `haptic=` again.

The first adopter is the Home shortcuts editor: moves, adds and removes show Saving… → Saved (or Not saved), with one success or error haptic.

## Tests

- **Unit:** `src/components/feedback/feedback.test.ts` covers:
  - the state machine, including rapid and out-of-order results;
  - no plain-tap haptics and no haptic on press-in;
  - a notification-only confirmation haptic that never takes focus and respects Reduce Motion;
  - short shared timings and no delayed navigation;
  - KG, RU and EN strings.
- **E2E:** `e2e/tests/interaction-feedback.spec.ts` covers:
  - keyboard Enter ×3 on "Move down": focus stays on the control, "Saved" appears after each real write, and the control at the bottom is `aria-disabled` but still focused;
  - four rapid clicks: no stuck Saving, and the shown order equals the stored order;
  - Reduce Motion (comfort plus media emulation, KG): every action still works and shows the same states.

## Physical-device haptic checks: PENDING (needs real iOS and Android phones)

1. Tapping buttons, cards, tabs and swatches: no vibration.
2. Scrolling a list that starts on a button: no vibration.
3. Home shortcuts editor:
   - one light success notification per saved change;
   - an error notification when a save fails (simulate by filling storage);
   - none when Comfort → Haptics is Off;
   - only notifications when it is Reduced.
4. Rapid repeated "Move" presses: notifications don't pile into a long buzz; one per completed save.
5. Completion sheets, achievements and game feedback still vibrate as before.
6. VoiceOver / TalkBack read "Saved" or "Not saved" without moving focus.
