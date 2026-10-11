# Mystery Object

`/culture/mystery` (Culture screen, next to Culture Detective). Untimed: read
a clue, reveal more, pick one of four objects. Wrong guesses don't end the
round.

## Content: reviewed, sourced, not generated

- The mysteries are 9 of the reviewed Culture Detective definitions
  (`MYSTERY_IDS`).
- **Clues:** each clue restates a named field of the source article.
  `clueSources(mystery)` gives, per clue, the article id, the field and the
  text key. The texts (`detective.questions.<id>.*`) are Kyrgyz from the
  article and RU/EN from its reviewed translation, as already checked by
  `detective.test.ts`.
- **Answers:** the options are the reviewed NAMES of four real articles
  (`detective.names.*`). Exactly one is the source; a wrong option asserts
  nothing.
- **Spoilers:** `mystery.test.ts` checks, in KG/RU/EN, that no clue
  contains its answer's name. Definitions that would spoil are not listed.
- **During play** a clue shows only its section ("From the article's
  'Cultural meaning' section"), because the article's name would give the
  answer away. **After** the answer, every clue shows its full source.

## Rules

- A round is offered only when its answer AND all three distractors are
  available in the app's article list (cached, so this works offline). If a
  round's articles disappear, the screen says so and offers another.
- Options are the same four, shuffled per round. A wrong guess is marked
  "not this one", is disabled, and the round continues. "Show the answer"
  is always available.
- **The answer:**
  - "Yes - it's …" or "It was …";
  - the evidence, labelled "From the article '…', section '…'";
  - a separate game note (clues used, guesses; "Nothing is scored or
    saved");
  - the article link.
- No timer, score, leaderboard or mastery claim. Text-only clues; no
  images needed.
- **Source navigation:** the attempt (clues revealed, wrong guesses,
  outcome) is kept in memory for the current owner, so opening the article
  and coming back resumes it.

## Tests

- `mystery/mystery.test.ts`:
  - **integrity:** every mystery exists; every clue has a source and KG/RU/EN
    text; no spoilers; exactly one intended answer with four distinct names
    per language;
  - **options:** shuffled, always the same four;
  - **missing content:** removes the mystery, and no round when none fits;
  - **attempt:** reveal up to 3; a wrong guess continues; a repeated or
    unknown guess is ignored; found or shown ends it; resume is per owner.
- `e2e/tests/mystery-object.spec.ts`:
  - the shared fake catalogue has 5 articles, so no mystery is offered
    there, which is tested;
  - with one extra real article ("The felt covers"), the "karkas" mystery
    becomes playable: wrong guess -> reveal -> right guess -> evidence ->
    source -> Back (attempt kept), plus axe;
  - KG.
