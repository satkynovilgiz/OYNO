# Culture Detective - content sources (2026-10-06)

Route: `/culture/detective` (entry on the Culture tab, next to Topic Quizzes).
Code: `src/features/detective/` · results: `src/store/useDetectiveStore.ts`
(`oyno.detective.v1`, per owner, separate from official game records,
progress, achievements and learning completion).

## Where the text comes from

Every clue and explanation restates a field of an existing culture item.
Nothing is added:

- Kyrgyz: the item's own text (`supabase/migrations/*`, table `culture_items`)
- Russian / English: its reviewed translation
  (`content/translations/culture_batch1.{ru,en}.json`)
- Pictures: the item's bundled artwork (`cultureItemImages`, Wikimedia
  Commons CC BY / CC BY-SA, as already credited in those rows)

Wrong answers are only the titles of other real items, so they assert
nothing. `src/features/detective/detective.test.ts` checks:

- each source item exists and has bundled artwork;
- each cited field is a reviewed field of that item;
- every number in a clue appears in the field it cites;
- all three languages are complete;
- no clue contains the answer's name.

| Question | Source item (link target) | Clue 1 / 2 / 3 fields | Explanation field |
| --- | --- | --- | --- |
| tunduk | `boz-uy-tunduk` | cultural_meaning, cultural_meaning, modern_status | fun_facts |
| karkas | `boz-uy-karkas` | cultural_meaning, objects_used, traditional_method | traditional_method |
| kiyiz-jabuu | `boz-uy-kiyiz-jabuu` | when_used, objects_used, cultural_meaning | traditional_method |
| ichki-jasalga | `boz-uy-ichki-jasalga` | modern_status, objects_used, cultural_meaning | cultural_meaning |
| eer | `horse-eer` | origin, cultural_meaning, traditional_method | fun_facts |
| kok-boru | `horse-kok-boru` | cultural_meaning, traditional_method, history | origin |
| kyz-kuumai | `horse-kyz-kuumai` | origin, objects_used, traditional_method | cultural_meaning |
| at-chabysh | `horse-at-chabysh` | origin, cultural_meaning, traditional_method | fun_facts |
| oodarysh | `horse-oodarysh` | cultural_meaning, origin, traditional_method | modern_status |
| shyrdak | `shyrdak-craft` | origin, traditional_method, history | fun_facts |
| umai-ene | `oymo-umai-ene` | origin, cultural_meaning, fun_facts | fun_facts |
| kochkor-muyuz | `oymo-kochkor-muyuz` | cultural_meaning, cultural_meaning, cultural_meaning | cultural_meaning |
| boz-uy | `boz-uy-overview` | origin, history, traditional_method | cultural_meaning |
| shyrdak-colors | `shyrdak-tustor` | fun_facts, cultural_meaning, cultural_meaning | cultural_meaning |

## Rules

- 5 different questions per session (14 in the pool); the four answers are
  shuffled each session.
- Points for a correct answer after revealing 0 / 1 / 2 / 3 clues: 4 / 3 / 2 / 1.
  A wrong answer scores 0 and shows the answer and the explanation.
- No timer. Results offer Replay and "Practise the missed ones", a round of
  only the questions missed (kept per owner until answered correctly).
- Offline: text and pictures are bundled. A missing picture shows a note and
  answering still works. "Read the full article" opens the source item; that
  page needs its content cached when offline.
- Accessibility: the answers are a named radio group, and the picture's label
  never names the object. Feedback is announced. There is no motion beyond
  the shared press feedback, so Reduce Motion has nothing to turn off. Large
  text in child mode.

Device checks (PENDING): VoiceOver / TalkBack read clues, answers and
feedback in order; largest Dynamic Type keeps the answers on screen;
airplane mode on a fresh install still plays a full session.

## Expeditions (2026-10-07)

Themed sets built only from the questions above (`src/features/detective/expeditions.ts`).
Each question appears at most once per round. A theme with fewer sourced
questions is simply shorter. The intro screen says so, and nothing is
invented to pad it.

| Expedition | Topic | Questions |
| --- | --- | --- |
| yurt | The yurt, its frame, felts and the life inside | boz-uy, karkas, kiyiz-jabuu, tunduk, ichki-jasalga (5) |
| horse | Horse games, the saddle and racing | eer, kok-boru, kyz-kuumai, at-chabysh, oodarysh (5) |
| ornament | Shyrdak, its colours and oymo motifs | shyrdak, shyrdak-colors, kochkor-muyuz, umai-ene (4) |

Flow:

1. **Learning round.** All three clues are shown and there are no points. Its
   result is "correct of total".
2. **Optional challenge.** Clues start closed and use the normal clue points.
3. **What you discovered.** Each object, with what was actually answered in
   each round, and a link to its source article.

"Practise the missed ones" repeats only that expedition's missed questions.

Records are stored in `oyno.detective.v1` under
`<owner>.expeditions.<id> = { learning, challenge, missedIds }`.

- Learning and challenge are separate categories and are never added together.
- Practice only clears the missed questions it got right.
- Quick-play fields (`bestScore`, `sessions`, `lastMissedIds`) are unchanged.
- Records saved before Expeditions load with `expeditions: {}`.
- Nothing is written to official game records, progress, achievements or
  learning completion.

Device checks (PENDING): VoiceOver / TalkBack read a learning round, with the
three clues open, before the answers.
