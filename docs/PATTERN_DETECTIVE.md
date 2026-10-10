# Pattern Detective

`/culture/oymo/pattern-detective` (entry in the Oymo Creator). Spot the
changed squares between an original pattern and a changed copy.

## Challenges (`detectiveModel.ts`)

- Built from the authored Remember the Pattern patterns (validated by
  `validatePattern`), on the same 5 x 5 grid, with the same motifs.
  Motifs start green; colours are theme colours (green, terracotta, gold,
  brown).
- Changed squares: **Easy 1, Medium 2, Hard 3.**
- Kinds of change: add, remove, replace the motif, recolour, and move. A move
  changes two squares: the old one is empty and the new one is filled.
- Every change is **tracked explicitly**.
- A challenge is used only when:
  - the tracked squares equal the squares whose content differs (comparing
    the two models cell by cell, never pixels);
  - the count is exactly the level's;
  - no square is changed twice.
- The original is never modified; changes apply to a copy.

## Playing

- Untimed. Mark squares by tapping either grid or a row of the list, and
  tap again to unmark.
- **Check** gives counts: found, still to find, marked but unchanged.
- **Hint** names the row of one change not found yet, and marks the attempt
  "With help".
- Done: the explanation lists every change ("row 2, column 3: Müyüz, green
  was recoloured - now Müyüz, gold"; moves name both squares). Either
  pattern opens in the Creator as an independent unsaved copy.
- The accessible list gives every square that has a motif in either version,
  with its original and modified motif and colour, as checkbox rows.
- No animation (Reduce Motion needs nothing extra). Offline. Nothing is
  stored; no scores.

## Tests

- `detective.test.ts`:
  - 300 seeded challenges per level, each with the exact count, tracked
    squares = model diff, changes reproduce the copy, one motif per square;
  - the original equals its authored pattern;
  - all five kinds of change occur, and moves change both squares;
  - the explanation covers every changed square exactly once;
  - wrong -> hint (assisted) -> corrected -> solved; marks are locked when
    done; restart;
  - list rows differ exactly where squares changed;
  - Creator copies are independent.
- `e2e/tests/pattern-detective.spec.ts`:
  - Medium at 320 and 412 px: wrong answer, feedback, hint, correction on
    the grid, done, explanation, axe, open the copy in the Creator;
  - RU, offline, reduced motion.

Pending on device: VoiceOver/TalkBack with 25 checkbox cells per grid.
