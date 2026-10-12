# Recovery Center

**Route:** `/profile/recovery` (Profile → Recovery Center).
**Code:** `src/features/recovery/` (`recoveryModel.ts`, `recoveryActions.ts`, `RecoveryScreen.tsx`)
and `src/services/drafts/draftRegistry.ts`.

## Draft sources (reused, nothing duplicated)

| Source | Where it lives | Survives a restart |
|---|---|---|
| Design portfolio edits | the portfolio editor's draft map | no (memory) |
| Scrapbook edits | the scrapbook editor's draft map | no |
| New question (section composer), question text/answer edits | My Questions draft map | no |
| Listening Compare note | the compare draft map | no |
| Journal editor drafts | `oyno.journal.drafts.v1` (existing store) | **yes** |
| Getting-started guide: design saved, guide step not recorded | first-use pending marker | no |

The four in-memory maps were moved into one shared registry (`draftMap`). Each editor keeps its
own map and key format; keys are prefixed with the owner. The Oymo Creator has no draft
persistence: its unsaved design ends when you leave it, so it isn't listed.

## Rules

- **Labels:** each entry says whether it is *unsaved edits* or *saved, with one step to record*,
  and whether it survives a restart.
- **Open:** goes to the original editor (portfolio, scrapbook, the question's article section or
  question screen, the comparison, the journal editor, or the guide).
- **Retry is offered only where repeating is safe:** updating a record that still exists
  (portfolio, scrapbook, question edits, comparison note) or recording the guide step. Nothing
  that would create a record is retried from here: a new question, a new journal memory, or a
  draft whose parent was deleted. Those say "open it to finish and save". Nothing is ever retried
  automatically.
- **Newer edits are kept:** retry sends the draft as it is now and clears it only if it's still
  exactly what was sent.
- **Missing parent:** if the saved record a draft belongs to no longer exists, the screen says so
  and the only option is discard.
- **Discard:** removes one draft after confirmation. Saved records and other drafts are untouched.
  For the guide marker, discarding only stops the reminder; the design stays saved.
- **Ownership:** only the current owner's drafts are listed. Retry and discard results aren't
  shown to an account that signed in meanwhile.

## Review fixes in this round (separate commit)

1. **Portfolio save** keeps edits typed while the write was pending (`draftAfterSave`).
2. **First-use guide:** if the design was saved but the step wasn't recorded, Retry records the
   step only. Pressing Save again can't create a second creation (`unrecordedSave`,
   `retryRecording`).
3. **Prepare for offline:** a resource is *downloaded* only when it is actually usable
   (`isDownloadUsable`: health check plus cached results). A listed but unusable one is
   *incomplete* and gets **Repair** (`repairPackItems`).

## Tests

- **Regression tests:**
  - `portfolioDraft.test.ts`;
  - `firstUse.test.ts` (no second save, per-owner marker);
  - `preparePlan.test.ts` (a health-check failure and a cache miss mean incomplete; repair
    re-downloads only those).
- `recovery.test.ts`:
  - each draft maps to the correct editor route;
  - owner scoping;
  - unsaved, pending and survives-restart labels;
  - no retry where it could create a record;
  - a missing parent is explicit;
  - retry saves the current draft and keeps edits typed during the retry;
  - a failed retry keeps the draft;
  - the guide retry never repeats the save;
  - discard removes one draft and leaves saved records.
- `e2e/tests/recovery.spec.ts`:
  - stored journal draft listed as surviving restart → unsaved scrapbook edit → Recovery
    Center → retry (the stored title updates) → confirmed discard of the journal draft, with the
    scrapbook untouched;
  - another owner's drafts hidden (RU).

Device checks: PENDING.
