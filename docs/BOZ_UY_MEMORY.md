# Boz üy - Build from Memory (2026-10-08)

- **Route:** `/culture/boz-uy/memory`.
- **Entries:** "Build from Memory" in the guided builder, and on its
  completion screen. The guided builder itself is unchanged; an e2e test
  walks its four steps to completion.
- **Code:** `src/features/culture/bozUy/memoryModel.ts` (pure) and
  `BuildFromMemoryScreen.tsx`.

## Content: nothing new

- **Order:** the guided builder's own authored sequence, `BOZ_UY_STEPS`:
  kerege → uuk → tündük → bosogo, from `boz-uy-overview`.
- **Parts:** the builder's own names, descriptions and illustrations
  (`BozUyPartIllustration`).
- **Wrong pick:** explained with THAT part's authored tip. For example,
  picking the tündük first shows "…the uuk ends are fitted into it".
- **Hint:** the next step's authored tip.

## Flow

1. **Introduction:** how it works, the four parts, and a mode choice.
   - **Practice:** choices also show each part's description.
   - **Challenge:** names only.
   - Both modes are untimed and both offer hints.
2. **Play:**
   - "Step n of 4", with the parts built so far.
   - "Which part comes next?" offers the parts left, at most four, in an
     order shuffled per attempt and never already in the right order.
   - Tap to choose; a wrong pick is explained and places nothing. Optional
     hint.
   - "Read about the boz üy" opens the source article. The attempt is kept
     in memory, so coming back resumes it, and so does any re-creation of
     the screen.
3. **Final reconstruction:**
   - each step with its illustration and tip, marked "first time", "needed
     a hint" or "tried first: …";
   - "Placed first time, without a hint: n of 4";
   - "This is practice in the app - not a measure of real-world building
     skill";
   - Start again and Change mode.

No XP, achievement or global score: the screen never touches the progress
store. A unit test makes any access fail, and e2e checks that nothing was
written. Tap controls only; large text in child mode; no animations. Works
offline (bundled), KG/RU/EN.

## Tests

- **Unit (`memory.test.ts`):**
  - the order matches the builder, and choices are never pre-ordered;
  - correct order completes;
  - a wrong choice is explained, recorded once and places nothing;
  - hints counted once and shown in the review;
  - restart;
  - the screen: a full challenge with nothing awarded, and an interrupted
    attempt resumed after the screen is re-created.
- **e2e (`boz-uy-memory.spec.ts`):**
  - the guided builder unchanged;
  - a complete challenge (wrong pick → explanation, hint, source and back,
    review, summary, restart);
  - offline (KG); axe on intro, play and review (RU).

## Device checks: PENDING

- [ ] VoiceOver / TalkBack read each choice (with its description in
  practice), then the explanation after a wrong pick.
- [ ] Android hardware Back from the article resumes the attempt.
