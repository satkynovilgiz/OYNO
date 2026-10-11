
## Journey: "Inside a boz uy" (`/learn/inside-boz-uy`)

A curated journey built on Learning Paths (no second progress system). It
uses the same screen, the same "Back to Learning Path" pill and the same
Continue rule.

| Step (stable id) | Opens (existing) | Finished when |
| --- | --- | --- |
| `discover` | `/culture/item/boz-uy-overview` | the existing reading completion (about 90% read) |
| `build-from-memory` | `/culture/boz-uy/memory` | **Mark step complete** (Build from Memory records no result) |
| `connection` | `/culture/connections/tunduk-part-of-karkas` (dataset entry; its evidence is quoted on the path) | **Mark step complete** |
| `oymo-design` | `/culture/oymo/create` | the existing `oymoCreated` signal |
| `reflection` (optional) | `/journal/new` | **Mark step complete**, or **Skip** |

New step kinds (`memory`, `connection`, `reflection`), `optional` and
`whyKey` were added to the path config. `validatePaths` checks memory
routes, that the connection is in the dataset, and that reflection steps
are optional. Each "why" is an authored instruction, plus the dataset's
own evidence quote for the connection; no new cultural claims.

**States:**
- *Visited:* opened from the path; shown as "In progress", never finished.
- *Completed:* a real signal or an explicit mark.
- *Skipped:* optional steps only. A skipped step doesn't block finishing,
  can be undone, and counts as completed if finished later.

**Restart** (asks first) clears this path's marks, visits and skips. Steps
finished in their own activity, such as a read article, stay finished,
because those are real records the path only reads.

**Storage:**
- Marks stay in `useLearningPathStore` (synced like other manual steps).
  `setManual` / `clearPath` are now serialized and write-first, and
  resolve `false` on failure.
- Visits and skips are in `useJourneyStore` (`oyno.journeys.v1`, local, per
  owner; serialized, write-first; a load error blocks writes with Retry).
- The screen shows "That change couldn't be saved" on a failed write.
- Removed content keeps its step labelled as removed. Continue skips to a
  step that opens (existing rule). Offline, the existing per-step offline
  availability applies.

**Note:** other surfaces (Home, Study) compute path progress without the
journey's visits and skips. There, the optional reflection reads as "not
started" until it is marked complete.

**Tests:**
- `learn/journey.test.ts`: destinations, signals vs manual steps,
  validation of a missing connection, visited is not finished, skip rules,
  per-owner storage, restart scope, write failures, unreadable data.
- `e2e/tests/inside-boz-uy.spec.ts`: overview -> connection -> pill back ->
  In progress -> mark -> skip -> Continue -> reload -> restart.
