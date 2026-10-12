# Discovery Recap

**Route:** `/profile/discovery-recap` (Profile → Discovery Recap). This is separate from the
existing shareable OYNO Recap at `/profile/recap`.
**Code:** `src/features/discoveryRecap/` (`discoveryRecapModel.ts`, `DiscoveryRecapScreen.tsx`).

It is a **private** look back over explicit saves, read directly from the existing stores.
Nothing is copied, nothing is sent to analytics or any other service, and a test checks that the
feature imports no analytics module.

## What's included, and which date is used

| Type | Source | Date |
|---|---|---|
| Reading notes | Reading Companion section bookmarks | `createdAt` (when saved) |
| Questions | My Questions | `createdAt` |
| Listening moments | Listening Notebook | `createdAt` |
| Oymo designs | the account's saved creations (signed-in only, as on the Shelf) | `created_at` |
| Scrapbooks | Cultural Scrapbook | `createdAt` |

- **Time capsules are not included**, so sealed messages stay sealed.
- A record without a valid save timestamp is left out rather than given a guessed date.
- Saving is never presented as learning. There are no scores, streaks or rankings.

## Dates

- **Presets:** last 7 days, last 30 days, this month, or chosen dates (YYYY-MM-DD).
- **Time zone:** the range uses the **device's local time zone**, with both days included,
  from local midnight to the next local midnight. The offset is taken at that local time, so
  daylight-saving days are 23 or 25 hours long. Tests cover UTC+6 (Bishkek) and the New York
  autumn change.

## Behaviour

- **Loading:** each source has its own loading, error (with Retry) or "designs need an account"
  state. A failing source never hides the others.
- **Missing articles:** a record whose article is gone stays as a placeholder with the person's
  own words. It can't be added to the plan.
- **Search:** covers titles and the person's own words only.
- **Ownership:** every source is read for the current owner only. On an account change the
  selection, search and results reset.
- **Adding to My Next Visit:**
  - **Supported:** articles (from notes and questions with an origin) and the Listening Room
    activity (from moments). Designs and scrapbooks can't be added, and the screen says why.
  - **Duplicates** are skipped.
  - **The five-item limit** is respected one item at a time, and the result says how many were
    added, skipped, unsupported or failed.

## Tests

- `discoveryRecap.test.ts`:
  - adapters (own timestamps, invalid dates dropped, plannable targets);
  - no capsule or analytics imports;
  - local-day boundaries (UTC+6), DST (25-hour day), invalid and reversed ranges, presets;
  - private search;
  - grouping;
  - distinct targets and the queue limit.
- `e2e/tests/discovery-recap.spec.ts`:
  - range filtering;
  - another owner's records hidden;
  - a sealed capsule never shown;
  - a missing-article placeholder;
  - a broken source not hiding the others;
  - search;
  - select → add (2 added, 1 unsupported, no duplicates) → My Next Visit → open the article;
  - an invalid custom range (KG).

Device checks: PENDING. This includes real time-zone changes and DST on a device.
