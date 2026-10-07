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

## Rules

- 5 different questions per session (12 in the pool); the four answers are
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
