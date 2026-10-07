# Map Challenge (2026-10-07)

Route `/explore/map-challenge`, reached from the target button on `/explore/map`.
Code: `src/features/explore/mapChallenge/`. Results: `src/store/useMapChallengeStore.ts`
(`oyno.mapChallenge.v1`, per owner). Playing never records a visit and never
changes the Discovery Passport, region progress or official game records.

## Data (existing, verified - nothing new)

- **Map:** the existing illustrated atlas (`illustratedMap.ts`). No other map
  library or geometry was added.
- **Marker positions:** `REGION_MAP_ANCHORS` for regions and
  `ILLUSTRATED_MAP_COORDINATES` for places. A region marker stands for the
  whole region, so no border is drawn or implied.
- **Names:** `explore_regions.name_kg / name_ru / name_en`.
- **Explanations:** the row's `facts`. Kyrgyz comes from the source rows
  (`20260824000001_content.sql`, with the Соң-Көл spelling fix from
  `20260926000001`). RU/EN come from `content/translations/explore_facts_batch1.json`.
- **Asked about:** only destinations whose facts hold no claim awaiting
  verification (docs/CONTENT_AUDIT.md §5). That is the regions Chüy, Naryn,
  Osh and Jalal-Abad, and the places Suusamyr and Arslanbob, so 6 questions
  with 5 different ones per session. Talas, Ysyk-Kol and Batken are markers
  (possible answers) but are never asked about.

## Play

- The painted names that would give answers away (Talas, Bishkek, Jalal-Abad,
  Naryn, Osh, Karakol, Issyk-Kul) are covered while a question is open. The
  covers are boxes in percentages of the art, checked against the 1448×1086
  source.
- Markers are numbered, never named, during a question, and screen readers
  read "Map marker n".
- Three ways to answer: tap a marker; tap the map, which picks the nearest
  marker within 6% of the map width, measured in the art's own percentages so
  the result is the same on every screen size; or choose from an
  alphabetical list.
- Marker and touch-box sizes come from the real distance between markers on
  the current screen, so boxes never overlap and a close neighbour can't
  take the tap. That's 44 px where there's room. On the narrowest phones,
  Suusamyr and Ala-Too are about 15 px apart, so those two targets are
  small; tapping the map still picks the nearest marker, and the list is
  the comfortable alternative.
- Feedback marks the right marker with its name and restores the labels. A
  wrong pick is also marked. Two facts are shown, with a link to the Region
  Hub or the place page.
- Results show the score, a review of mistakes (each linking to its page),
  Replay, and Practise the missed ones. There is no timer and no motion.

Device checks (PENDING): tap accuracy with a finger on a small phone and on
a tablet in landscape; VoiceOver / TalkBack read the prompt, markers as
numbers, the list, then the feedback; largest Dynamic Type keeps the list
usable.
