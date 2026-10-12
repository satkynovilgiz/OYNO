# My Next Visit

**Model:** `src/features/nextVisit/nextVisitModel.ts`.
**Store:** `src/store/useNextVisitStore.ts` (`oyno.nextVisit.v1`, per owner).
**Screen:** `/profile/next-visit` (`NextVisitScreen.tsx`).

**Entries:**
- Profile → My Next Visit.
- "Add to My Next Visit" on every article.
- The plan screen's own "Add to the plan": article title search plus the activity list.

This is a **personal plan of up to five items**, labelled as separate from OYNO's authored
Learning Paths.

## Rules

- **Stored data:** stable ids only (`article:<culture item id>` or `activity:<registry id>`), never
  URLs. The destination is resolved at display time:
  - activities come from the activity chooser's registry (`QUEUEABLE_ACTIVITIES` from
    `ACTIVITY_CATALOG`);
  - articles open `/culture/item/<id>`.
  A unit test checks that every queueable activity route exists as a file in `src/app`. Unknown
  ids and URL-shaped ids are rejected.
- **Order:** you set it with Move up / Move down (labelled buttons) and Remove. Clearing the whole
  plan asks first.
- **"Next up"** is the first *available* item. **Start** opens it, which only marks it *opened*.
  Back on the plan, the item asks "Is it done?":
  - **Finished**, or **Skip it**: takes it off the plan;
  - **Keep for later**: moves it to the end, unopened;
  - **Open it again**.
  Opening a screen never counts as finishing.
- **Missing items:** a removed article or an unknown activity shows "isn't available any more",
  with Remove. It never blocks the rest of the plan.
- **Offline:** when offline, each item shows "Works offline" or "Needs a connection right now",
  using the existing `isRouteAvailableOffline` check. Items that can't open offline have their
  Open button disabled.
- **No time estimates:** the chooser's minutes are rough guesses, not reviewed metadata.
- **Storage:** per owner, on this device only (not synced, not in the export). It survives
  navigation and restarts.
  - Loading is reliable: an unreadable store is an error state with Retry, and blocks writes.
  - Writes are serialized and write-first: a failed change shows an error and nothing changes on
    screen.

## Tests

- `src/features/nextVisit/nextVisit.test.ts`:
  - route validation against `src/app`;
  - id-only storage;
  - limits, reordering, opened ≠ finished, the finish / skip / later choices;
  - missing items, normalisation;
  - persistence across a restart, owner scoping, failed writes, an unreadable store, serialized
    delayed writes.
- `e2e/tests/next-visit.spec.ts`:
  - article → add → plan → add activities → reorder → start → back (opened, not finished) →
    Finished → the next item → keep for later → reload (order kept) → confirmed clear;
  - a missing item (RU) that doesn't block the rest, with other owners' plans hidden.

Device checks: PENDING.
