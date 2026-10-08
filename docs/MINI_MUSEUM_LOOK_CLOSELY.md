# Mini Museum - Look Closely (2026-10-08)

An optional observation game that a curator builds inside their Mini Museum
setup, for someone looking at the museum on the same phone.

- **Code:** `src/features/myCollections/museum/lookCloselyModel.ts` (pure)
  and `LookClosely.tsx`.
- **Store:** an optional `lookClosely` field on the existing exhibition, in
  the same museums store, per owner. Nothing new is created: no new
  collection and no new resolver.

## Curator

- Picks up to **3** of the exhibition's exhibits.
  - Only exhibits that can be shown now can be picked; removed content is
    disabled.
  - Removing an exhibit from the game, or from the exhibition, drops the
    clues that pointed at it.
- Writes up to **3** clues of up to 120 characters, and chooses each clue's
  target among the picked exhibits. A target outside the game is rejected.
- Saved data is re-checked on every read by `normalizeLook`:
  - exhibits must still be in the exhibition;
  - targets must be among the picked exhibits;
  - ids must be valid and unique;
  - text is bounded and stripped of markup.
- "Play Look Closely" needs at least 2 exhibits and 1 written clue.

## Visitor

- Each clue is labelled **"Curator's clue - written by the curator, not a
  verified OYNO fact"**.
- **Answer gallery:** the picked exhibits that can be shown, each with its
  picture and title, as a radio group.
- **Wrong answer:** "Not this one - look again. No points and no score."
  The tile is marked as tried; there is no penalty.
- **Right answer:** the target, the curator's clue again, and "Open the
  source", the exhibit's own OYNO article.
- **Unavailable target:** a clue whose exhibit can't be shown says so and
  can be skipped. The rest of the game carries on.
- **End:** "Found n of N", Play again, Back to the museum, and "This game
  isn't counted as learning or quiz results, and answers aren't saved".

## Privacy and state

- The visitor's answers live in the game state.
- The game in progress is also kept in MEMORY, never on disk, in one slot
  bound to the owner and collection. Opening a source article can re-create
  the museum screen, and the visitor comes back to the clue they were on.
- The slot is cleared by Back, by starting a new game, and for any other
  owner or collection.
- Never shown: collection descriptions, Journal text and private notes.
- Nothing touches quiz statistics or learning progress; e2e checks that no
  such key is written.

## Tests

- **Unit (`lookClosely.test.ts`):**
  - target validation (limits, availability, stray targets);
  - normalization of tampered data;
  - removing an exhibit removes its clues;
  - the play conditions;
  - removed content is non-blocking;
  - a session: wrong answers with no penalty, found once, only the current
    clue can be answered, bounded navigation, restart;
  - owner isolation;
  - the in-memory session (owner and collection bound, cleared on end,
    never in storage).
- **e2e (`mini-museum.spec.ts`):**
  - create clues (a removed exhibit is disabled), with a reload in between;
  - play: curator label, wrong answer, then right answer and reveal;
  - open the source and return to the same reveal;
  - done; no learning or quiz keys; restart;
  - RU translation; axe on setup and play.

## Device checks: PENDING

- [ ] VoiceOver / TalkBack: the clue label is read before the gallery, and
  each answer's state ("not this one") is announced.
- [ ] Android hardware Back from the source article returns to the game.
