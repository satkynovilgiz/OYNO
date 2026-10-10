# Oymo - Remember the Pattern (2026-10-08)

- **Route:** `/culture/oymo/remember`. The entry is in the Oymo Creator.
- **Code:** `src/features/culture/oymo/symmetry/rememberModel.ts` (pure) and
  `RememberPatternScreen.tsx`.

## What it shares, and what it doesn't

- **Shared with the Symmetry Playground:**
  - the 5 × 5 grid model and its editor reducer (`playgroundReducer`: place,
    remove, move, Undo, with the rule locked to `none`);
  - the (cell, motif) set comparison (`resultSet`);
  - the grids themselves, moved into `PlaygroundGrids.tsx` so both screens
    use the same `SourceGrid` and `ResultGrid`;
  - `getMotifShape` and the unsaved-copy handoff (`toCreatorCopy`,
    `handOffToCreator`).
- **Not shared with Restore the Pattern:** it uses a different slot and
  rotation model, so it wasn't a fit for free positioning.

## Patterns and levels

There are six authored practice patterns, two per level (positions and motif
choices only; no meaning is claimed). Every pattern is validated: cells in
the grid, one motif per cell, piece count within its level.

| Level | Pieces |
| --- | --- |
| Easy | 2–3 |
| Medium | 4–5 |
| Hard | 6–7 |

## Flow

1. Choose a level and a viewing time: untimed by default, or 10 or 20
   seconds.
2. **Look.** The reference grid is shown together with the same pattern
   **described as a list** ("Row 3, column 2: Gül"). That list is the
   screen-reader equivalent.
   - Hide it when ready ("I'm ready - hide it").
   - Timed: a countdown, then it hides. With Reduce Motion it's text only;
     nothing animates.
3. **Rebuild.**
   - Pick a motif: the pattern's own motifs plus one extra, so the picker
     doesn't give the answer away.
   - Tap to place, tap a piece to pick it up and move it, or drag.
   - Remove, Undo, **Check**.
   - Feedback is gentle and counted: how many are right, still missing, in
     the right place with another motif, or not in the pattern.
4. **Show again** is always available. It keeps the rebuild so far and marks
   the attempt **assisted**.
5. **Done:**
   - the rebuilt grid and how many checks it took;
   - "From memory, without looking again" or "With help: you looked again";
   - "A practice game - it doesn't measure memory or anything else about
     you";
   - **Open in Creator** (an unsaved deep copy; no saved pattern is
     touched, and e2e checks for no write requests); Try again; Choose
     another.

Nothing is stored. Works offline; KG/RU/EN; large chips in child mode.

## Tests

- **Unit / screen (`remember.test.ts`):**
  - the patterns are valid and the validator catches problems;
  - matching tells exact, wrong-motif, missing and extra apart, and agrees
    with the playground's set comparison for every pattern;
  - Check feedback, and finishing only on an exact match;
  - Show again marks assisted and keeps the rebuild;
  - Undo and removal; no editing while viewing; the rule stays `none`;
  - restart;
  - the Creator copy is deep and unlinked;
  - untimed viewing stays until hidden; timed viewing hides after 10 s;
    Show again.
- **e2e (`remember-pattern.spec.ts`):**
  - the full reconstruction at 320 px and 412 px with no overflow:
    described reference, hide, wrong check with feedback, Undo, Show again
    (assisted), finish, Creator copy note, no writes;
  - timed viewing offline (KG); axe (RU).

## Device checks: PENDING

- [ ] VoiceOver / TalkBack: the described list is read in order, and the
  grid cells read row, column and motif while rebuilding.
- [ ] Touch drag on the rebuild grid on iOS and Android.
- [ ] The timed countdown keeps time when the app is backgrounded and
  returns.

## Together: two players on one device

`/culture/oymo/remember-together` ("Play together on one device" on the
setup screen). The rules are in `togetherModel.ts`; the solo game's grid,
editor, matching and described list are reused (`RememberViews.tsx`).

1. **Setup.** Optional names (default "Player A" / "Player B"; they live
   only in this screen's state). Viewing is untimed by default; 10 or 20 s
   is optional.
2. **Authoring.**
   - The author places 3-7 pieces with the six supported motifs on the 5 x 5
     grid, with move, remove and Undo.
   - An 8th piece is refused.
   - "Done - pass the device" validates (count, supported motifs, on the grid,
     one per cell, using the solo integrity check) and lists any problem
     instead of continuing.
3. **Privacy screen.** "Pass the device to <name>". Nothing of the pattern
   is rendered (no grid, no list). Only the other player's explicit "Ready"
   continues.
4. **Look, hide, rebuild, Check.** This uses the solo game's state.
   - The reference is a deep copy of the author's pieces, so the rebuild
     can't reach it.
   - The motif picker offers every supported motif, so every valid pattern
     can be rebuilt.
   - "Show again" marks the attempt assisted.
   - Feedback is the same gentle counts (matched, missing, wrong motif,
     extra).
5. **Done.** Shows the result, the number of checks, and assisted or not.
   - **Swap roles:** the other player authors next, with an empty editor;
     reference and attempt are discarded.
   - **Same pattern, try again:** returns to the privacy screen; a fresh
     attempt starts on Ready.
   - **Open in Creator:** the rebuild opens as an unsaved copy.
   - **New game.**

No leaderboard, XP, account or storage. Works offline. KG/RU/EN.

Tests: `together.test.ts` covers:
- phases, including that only Ready leaves the privacy screen;
- swap, retry and new game resets;
- validation;
- deep copies;
- assistance;
- (cell, motif) matching;
- 60 generated valid patterns, all solvable with the offered controls;
- the screen not rendering the reference before Ready.

`e2e/tests/remember-together.spec.ts` (320 and 412 px):
- create, refused pass, valid pass;
- the privacy screen contains no grid or list (axe);
- Ready, described list, hide, rebuild with feedback, Show again
  (assisted), done;
- swap to an empty editor;
- KG offline, then open the rebuild in the Creator.

Pending on device: passing a phone with VoiceOver/TalkBack running. The
privacy screen moves focus to its heading on web; this is unverified on
native.
