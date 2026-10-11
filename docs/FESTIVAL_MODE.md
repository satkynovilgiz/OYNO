# Festival Mode

`/festival` (entry: the activity chooser, "Festival mode for a group"). A short curated
session of existing OYNO activities for a classroom, a family table or an event.

- **Setup:** choose about 5 / 10 / 15 minutes, a session language (KG/RU/EN), and one of the
  curated sets (`FESTIVAL_SETS` in `src/features/festival/festivalModel.ts`, 2-3 activities each).
  Minutes are the activity chooser's estimates, labelled as such - never timers or deadlines.
- **Guest only:** sets use `GUEST_ACTIVITIES` - repeatable activities that need no account and
  show nothing private (Daily, the Komuz lesson and the Oymo Creator are excluded).
- **Session:** explicit controls only. "Open this activity" opens it (status *Open now*);
  coming back shows the overview; "Next activity" marks it *Explored*; "Skip this one" marks
  it *Skipped*. Next is disabled until the current activity has been opened.
- **End session:** if a shared-device activity (e.g. the Culture Duel) has been opened and not
  finished, ending asks for confirmation. The summary lists only the names of explored
  activities - no scores, notes, creations or learning claims - and is not saved.
- **Unavailable activities** (offline without cached data, via `isRouteAvailableOffline`) are
  replaced by an available guest activity of the same interest, labelled "Instead of ...";
  if none exists the item is shown as unavailable with Skip / End as the alternatives.
- **State:** the session lives in a memory slot (`keepSession`) so it survives opening an
  activity; ending clears it. Nothing is written to storage.
- **Language:** the session language is applied with `changeLanguageTemporarily`
  (`src/i18n/index.ts`), which writes the user's saved choice back immediately. Ending the
  session switches back to the previous language; an app restart mid-session also starts in the
  user's own language. Age group and other preferences are never touched.

Tests: `src/features/festival/festival.test.ts`, `src/i18n/temporaryLanguage.test.ts`,
`e2e/tests/festival.spec.ts` (two-activity session; confirmation before ending a shared-device
activity).

Device checks: PENDING (no physical device run).
