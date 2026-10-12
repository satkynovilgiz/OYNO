# Prepare for offline

**Route:** `/prepare-offline`.
**Entries:** the Offline downloads screen, and My Next Visit ("Prepare this plan for offline").
**Code:** `src/services/offline/preparePlan.ts` and `src/features/offline/PrepareOfflineScreen.tsx`.
It reuses the existing download system: requester-tagged pack claims (`downloadPackItems`,
`cancelPackItems`), the download queue, the offline manifest and the Learning Path pack builder.

## What it does

- **Choose:** your **My Next Visit plan** or a **Learning Path**.
- **Resources** come from stable ids only:
  - **Learning Path:** `buildLearningPathOfflineManifest`, so the same items and requester
    (`path:<id>`) as the path's own offline row.
  - **Plan:** each article needs its `culture_item` download plus the shared `culture_index`.
  - **Bundled activities** (games, labs, map challenge, detective, duel, komuz with bundled audio)
    are *built in*. Their screens import only bundled code and data.
  - **Daily** is *unknown*: it can't be prepared in advance and opens offline only with an article
    it already loaded.
  - **Removed articles and unknown ids** are *unavailable*.
  Nothing private is ever included; only public articles are downloaded.
- **States:** built in, downloaded, downloading, failed, not downloaded yet, unavailable, unknown.
  They come from the real offline manifest and the queue. Readiness ("Ready offline: X of Y")
  counts only built-in and downloaded items.
- **Sizes:** real measurements of what's already stored for this plan (`measureEntriesBytes`, the
  persisted query results). Missing items say **"Size unknown"**, because the system can't know a
  size before downloading.
- **Download / Retry:** claims what's on the device and fetches only the missing or failed items.
  A partial failure keeps the successful downloads.
- **Cancel:** withdraws only this preparation's pending requests. Finished downloads stay, and
  shared items that other packs asked for continue.
- **Interrupted downloads:** the existing persisted queue resumes them after a restart. An item
  is never shown as downloaded until its entry exists.
- **Insufficient storage:** a write failure surfaces as a *failed* item with Retry. The existing
  system doesn't distinguish quota errors, so the screen says storage may be the cause.
- **Manage:** "Manage downloads" opens the existing Offline downloads screen, which handles
  removal and the shared-ownership rules.

## Tests

- `src/services/offline/preparePlan.test.ts`:
  - manifest generation (plan and path; Daily and missing items never promised; stable ids;
    bundled list in the registry);
  - states and readiness;
  - partial failure with retry fetching only missing items;
  - cancellation that never releases or deletes;
  - interruption.
- `e2e/tests/prepare-offline.spec.ts`:
  - plan → readiness (built in / not downloaded / unknown) → download → measured size → **go
    offline → the prepared article opens from the plan**;
  - a journey (RU) and Manage downloads.

## Native storage checks needing a device (PENDING)

- A real device with low free storage: the download fails and Retry works after freeing space.
- Killing the app mid-download, then the resume on next launch.
- Measured sizes compared with Settings → Storage, on iOS and Android.
- The Wi-Fi-only preference with this flow.
