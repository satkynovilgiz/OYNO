# Focus view (articles and materials)

Focus view is an optional, calmer reading view. It builds on the existing reader setting `focusMode`, which is a device-level preference stored with text size and line spacing in `oyno.readerSettings.v1`. It only changes the presentation: the article, its reading record and the reader's notes are never touched by switching.

## Entry and exit

- **Floating "Focus" button.** It is reachable from any reading position and comes first in the reading area's tab order. The header toggle scrolls away with the article, and focusing or tapping it brings the reader back to the top, which would lose their place.
- **Header toggle.** It stays visible in Focus view as a pressed button, so the same control also turns Focus view off.
- **Exit bar.** While Focus view is on, a bar sits in the layout under the article (never over the text): "Focus view is on" with an "Exit Focus view" button.
- **Escape** leaves Focus view on web and keyboards.
- **Reader settings sheet.** The existing switch, now named "Focus view", stays.
- **Screen readers** hear "Focus view on / off" through `announceForAccessibility`.

## What stays and what steps back

The lists live in `focusViewRules.ts`.

**Always stays:**
- back, text settings (size and line spacing), contents, and the Focus toggle;
- audio guide and Read and listen;
- section bookmarks (personal notes) and Source Lens;
- inline glossary terms and Key terms;
- Sources & notes, Report, and Mark as read.

**Steps back:**
- share, favourite and add-to-collection;
- section dividers, Save quote, Save question and Then & Now;
- connections, Explain, Next visit, the Board and Compare entries, and the quiz link;
- the gallery, the Journal button and the related rail.

## Position

- **Switching views** restores the section being read, by its key, re-measured in the new layout (`restoreOnSwitch`).
- **The restore is a jump.** It records no progress or completion, and a hand scroll cancels it.
- **Without a current section** (the hero, or a material with a single body), the reading ratio is kept. That is the existing `keepPosition` behaviour.
- **Tracker fix (web).** After any jump (contents or restore), wheel and keyboard scrolling now count as reading once the scroll clearly leaves the settled jump target. Previously only a drag did, so on web nothing was recorded after a jump.

## Completion

In Focus view, scrolling records progress but never marks the article read (`recordPosition(…, { completeByScroll: false })`). Only "Mark as read" does that. The standard view keeps its existing 90% rule, and an article already marked complete stays complete.

## Text scaling

Reader text-size presets multiply the base size, and the system font scale still applies on top. No `allowFontScaling={false}` is used on these screens, and an existing test enforces this.

## Tests

- **Unit:** `src/features/culture/reader/focusView.test.ts` (restore rule, no completion by scrolling, essentials never behind a focus condition, entry and exit wiring, strings) and `reader.test.ts`.
- **E2E:** `e2e/tests/focus-view.spec.ts`:
  - keyboard entry from the middle of the article keeps the same section;
  - essentials stay and secondary actions are hidden;
  - scrolling to the end stores `furthest > 0.9` with `completedAt: null`;
  - Escape leaves and stays in the same section;
  - the exit button works;
  - KG, RU and EN at 320 px with XL text and spacious lines: no overflow and no raw keys.
- **Screenshots** were reviewed: `e2e/.results/focus-view-*.png`.

## Device checks: PENDING

- VoiceOver and TalkBack announcement on toggle.
- The hardware-keyboard Escape key on an iPad.
- Section restore with iOS Dynamic Type at its largest size.
