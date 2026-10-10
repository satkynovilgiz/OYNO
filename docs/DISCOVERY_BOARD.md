# Culture Discovery Board

Article -> **Explore a question** -> `/culture/board?from=culture_item:<id>`
(create a board, or reopen one from the list) -> `/culture/board/<id>`.

## What a board holds

- A name and a question: the user's own words, or one of four neutral
  prompts ("What connects these objects?", "How are these used together?",
  "What would I like to learn more about?", "How are these different?").
- Up to **8 article cards** (culture items or materials), in the user's
  order. Each card remembers the title it had when added.
- Links of two kinds that are never mixed:

| | Sourced connection | Personal observation |
| --- | --- | --- |
| Comes from | An entry of OYNO's curated dataset (`connectionsData.ts`), by id | The user's own text |
| Can be attached | Only when BOTH of its articles are on the board | Always; about 0-2 cards |
| Shown with | Relation label, the entry's exact evidence excerpt, its article and section, links to the connection and the source article | "Your observation - your own words, not a fact checked by OYNO" |
| Look | Solid green bar, "From OYNO's connections" | Dashed brown bar on cream |

Nothing is inferred. Suggested next cards are only articles the dataset
already links to cards on the board, and adding one is the user's choice.
A note that states a relation stays an observation.

## Editing

Add (suggestions or search over the app's own localized article list),
reorder, remove, rename, change the question, attach/remove links, delete the
board (asks first).

- Removing a card removes the sourced connections that need it.
  Observations are kept, no longer pointing at that card.

## Missing content

- **Unavailable article:** the card stays with its remembered title, marked
  "This article isn't available now", and its notes are kept.
  - Sourced connections whose source article is unavailable say so and hide
    the source link.
- **Dataset entry removed:** a stored sourced link that no longer resolves is
  kept as "no longer in OYNO's dataset", never displayed as a connection,
  and can be removed.
- Stored data is re-checked on every read (`normalizeBoard`); tampered
  values are dropped, nothing crashes.

## Storage and accounts

- `oyno.discoveryBoards.v1`: `{ <owner>: Board[] }`, on this device only,
  not synced. At most 20 boards per owner.
- Every read and write goes through the current owner, so another account
  never sees or changes a board.
- A guest's boards are **not** moved to an account on sign-in (they stay
  under "guest").
- Boards are not part of the learning-data export.

## Opening sources

Article, connection and source links push a route, so Back returns to the
board. Edits are saved immediately. An unsent observation (text and chosen
cards) and the Edit/Review mode are kept in memory per owner and board, so
they survive the board screen being re-created, for example after the
browser's Back.

## Tests

- `board/board.test.ts`:
  - only dataset entries between cards can be attached, each resolving;
  - evidence, article and section;
  - observations never become connections;
  - a removed dataset entry is kept but not shown as a connection;
  - the 8-card limit, no duplicates, reorder, rename;
  - removing a card keeps observations;
  - suggestions;
  - an unavailable article keeps its card and notes;
  - tampered storage;
  - per-owner persistence and restart;
  - screen: a source round-trip keeps the draft and mode; observations are
    labelled; another account sees nothing; a missing article is marked.
- `e2e/tests/discovery-board.spec.ts`:
  - article -> prompt -> create -> suggested card -> attach the sourced
    connection (evidence text) -> open the source and come Back (the draft is
    kept) -> observation -> review -> axe -> reopen after a restart, at 320
    and 412 px;
  - KG: an unavailable article is marked and its note kept.

## Pending

VoiceOver/TalkBack reading order of the card rows and link blocks on a
device; large-text layout on a phone.
