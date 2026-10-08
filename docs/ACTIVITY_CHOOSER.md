# Home activity chooser (2026-10-07)

- **Entry:** Home → under "For You Today" → "Got a few minutes?" → "Find
  something to do". Route: `/activities`.
- **Code:** `src/features/home/chooser/`
  - `activityChooser.ts`: the pure rules and the catalogue.
  - `useActivityChooser.ts`: the signals.
  - `ActivityChooserScreen.tsx`

## Journey

1. Choose your time (2, 5 or 10 minutes) and an interest (Discover, Play,
   Create or Listen).
2. Get up to three suggestions. Each one shows a plain explanation (for
   example "A short creative activity."), a description, an estimate with
   its basis, why it was chosen, and "Works offline" when you are offline.
3. Tap a suggestion to open it, or "Show others" for the next set. When
   there are no more, the screen says so.

## Selection rules (`rankActivities` / `chooseActivities`)

1. Only the chosen interest.
2. Only activities whose estimate is at most the time chosen.
3. Offline: only activities whose screen can open with what is on the
   device. This uses `isRouteAvailableOffline`, the same check as Home's
   main recommendation.
4. Completed learning is handled on purpose:
   - Today's Daily OYNO is not suggested again once it is done.
   - A completed one-time lesson (the komuz lesson) is not suggested.
   - Only the NEXT, unfinished step of a Learning Path is offered.
   - Practice, play and creative activities stay available, after untried
     ones, marked "You've done this before".
5. Order: the next reading of a Learning Path you started (Discover only),
   then activities you have not tried, then the rest. Within each group,
   the estimate that uses more of your time comes first, then catalogue
   order. The result is deterministic, with no randomness.
6. Three at a time. "Show others" pages through the rest and wraps round.
7. When nothing fits, the screen says why:
   - **Needs more time:** names the shortest real option and offers to open
     it.
   - **Offline:** a matching activity exists but can't open offline.
   - **All done:** everything matching is finished.

"Tried" comes from signals that already exist:

- games: the `gameStats.played` count;
- labs: `oymoCreated`, `shyrdakCreated`, `bozUyVisited`, and
  `komuzLessonCompleted`, which also marks the komuz lesson as completed;
- Culture Detective, Map Challenge and Repeat the Rhythm: their local
  session records.

The Learning Path step comes from `pathProgress()`.

## Estimates and their basis

Every minute value is an **estimate**: the activity's own fixed size at a
relaxed pace. The screen shows the basis next to it.

| Activity | Est. | Basis |
| --- | --- | --- |
| Daily OYNO | 3 | one short article |
| Culture Detective | 3 | 5 questions (`SESSION_LENGTH`) |
| Map Challenge | 3 | 6 places (`MAP_QUESTIONS`) |
| Learning Path next reading | 3 | one article |
| Jaa Atuu | 2 | one round of 5 arrows (`TOTAL_ARROWS`) |
| Kyz Kuumai | 2 | one race, at most 90 s (`MAX_ROUND_SECONDS`) |
| Kok Boru | 3 | one 120 s match (`MATCH_DURATION_S`) plus setup |
| Culture Duel | 5 | 3 or 5 questions per player; 2–4 players on one phone |
| Restore the Pattern | 2 | one puzzle, 2–6 pieces |
| Build a boz üy | 5 | 4 build steps (`BOZ_UY_STEPS`) |
| Shyrdak Creator | 5 | colours, pattern, border |
| Oymo Creator | 10 | open-ended (shown as such) |
| Komuz Listening Room | 3 | the bundled tracks run 1.3–4.7 min (median about 3, measured from the MP3 files) |
| Repeat the Rhythm | 4 | 5 short rounds |
| Komuz lesson | 5 | 4 lesson steps with a 4-question quiz |

## Privacy

The time and interest choice exists only in the screen's state. It is not
stored, not synced and not sent anywhere, there is no analytics event, and
no account is needed. A unit test checks that the chooser's files touch
no storage, network or analytics.

## Tests

- **Unit (`activityChooser.test.ts`):**
  - every route resolves to a real Expo Router screen;
  - every label exists in KG, RU and EN;
  - filtering by time and interest;
  - offline filtering;
  - Daily done, completed lesson and tried ordering;
  - Learning Path step first;
  - paging and wrap-round;
  - all three fallbacks;
  - privacy.
- **e2e (`activity-chooser.spec.ts`):**
  - from Home, every one of the 14 activities is opened from the chooser
    and lands on its own URL;
  - estimates and explanations;
  - the needs-more-time fallback opens the shortest option;
  - offline: a "Works offline" suggestion opens and renders;
  - KG/RU; axe.

## Device checks: PENDING

- [ ] VoiceOver / TalkBack: the radio groups and the suggestion cards are
  read out with the estimate and its basis.
- [ ] Airplane mode on a fresh install: only bundled activities are
  suggested, and each one opens.
