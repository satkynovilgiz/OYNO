# Feedback diagnostics - what is retained, sanitized, omitted (2026-10-06)

Code: `src/services/feedback/diagnostics.ts` (`sanitizeDiagnostics`),
`diagnosticTrail.ts` (`sanitizeRoute`, `sanitizeDiagnosticEvent`),
`feedbackQueue.ts` (`parseQueuedReport`, final boundary in `sendOne`).
Tests: `diagnosticsSafety.test.ts` (adversarial, synthetic secrets only),
`feedback.test.ts`, `feedback2.test.ts`.

## Where validation runs

1. When diagnostics are built (`buildDiagnostics`).
2. When a report is queued (`enqueueFeedback`).
3. Every time the queue is read back from storage (`parseQueuedReport` -
   old versions, interrupted writes, tampering).
4. Right before submission (`sendOne`): the final boundary.

All four use the same functions. None of them throws on bad input.

## Retained (content-free debugging context)

| Field | Rule |
| --- | --- |
| `appVersion`, `buildNumber`, `osVersion`, `channel`, `runtimeVersion` | Short version-like strings only; otherwise null / empty. |
| `updateId` | UUID only. |
| `platform` | `ios` / `android` / `web` / `windows` / `macos`, else `unknown`. |
| `deviceClass` | `phone` / `pad` / `tv` / `carplay` / `vision` / `unspecified` / `desktop`. |
| `deviceModel` | Android manufacturer + model, plain characters, max 60. Never the personal device name. |
| `language` | Language tag shape (`kg`, `ru`, `en-US`). |
| `ageMode` | `child` / `preteen` / `teen` / `adult`. |
| `online`, `embeddedBuild` | Booleans; anything else becomes null. |
| `route` | Sanitized route (below). |
| `errorFingerprint` | `<ErrorName>-<8 hex>` only - grouping of the same crash is unchanged. |
| `trail` | Max 20 events, each re-checked (below). |

## Sanitized

- **Routes**: scheme, host and credentials removed; query string,
  fragment and `;params` removed; max 8 segments / 80 characters. Only
  public route words and content slugs (`boz-uy-tunduk`) survive. UUIDs,
  numbers with 5+ digits, `uc_` collection ids, mixed-case or encoded
  text, emails, tokens and random-looking ids become `:id`.
- **Trail events**: must have a valid time and a known type
  (`route`, `offline`, `online`, `native_unavailable`, `screen_error`,
  `sync_failed`, `playback_error`). Per type: `route` -> sanitized
  route; `online`/`offline` -> no detail; `screen_error` -> fingerprint or
  identifier; `playback_error` -> `recording`/`speech`; others -> a short
  lowercase identifier. Anything else becomes `redacted`. Malformed events
  are dropped and unknown nested fields are never copied.
- **Size**: the whole object stays at or below 6000 JSON characters, with
  the oldest trail events dropped first. The server limit is 16 KB.

## Omitted

- Any key not on the allow-list: tokens, sessions, passwords, user or
  account ids, device name, location, journal text, raw error messages.
- `contactEmail` unless the tester ticked "include my email". The choice
  is stored with the report (`contactConsent`). A report with
  `contactConsent: false` never sends an email, even if one was injected
  later. Reports queued before this field existed keep their email only
  if it is a valid address; the old code only stored one after the opt-in.
- Stored reports that can't be real (no valid id, category or message) are
  dropped, and so are duplicates. Every VALID stored report is read; none
  is cut off to fit a limit.

## Queue capacity and delivery status

- Capacity (50) is enforced when a report is ADDED, inside the same
  serialized step as the write: the new report is refused with
  `queue_full` (the sheet keeps the text and says why) and the stored
  queue is untouched. A queue left larger by an older version is kept
  whole and drains normally.
- A write that fails is `not_saved`, never `queued`.
- `sent` is answered only from a device-side record of SERVER
  CONFIRMATIONS (`oyno.feedback.delivered`, report ids only, last 200),
  written before the report leaves the queue. A report that is neither
  queued nor confirmed is `unknown` ("not confirmed"), never `sent`.
- Flushes: one run at a time. A call during a run gets one shared
  follow-up run, so a report added or retried meanwhile isn't left
  waiting. Queue writes re-read the current queue, so concurrent adds,
  retries and failures don't overwrite each other.
- The server stores each `client_report_id` once, so re-sending after an
  interruption is harmless.
- Permanently refused (`failed`) reports: the newest 5 are kept for Retry;
  older refused ones are removed. They aren't pending, but they are gone.

## Screenshots

A queued report can only upload an image OYNO made for feedback: its kept
copy (`documents/feedback/<id>.jpg`), a temporary capture (cache / tmp),
or - on web - `oyno-attachment:<its own report id>`, a reference to the
JPEG bytes OYNO copied into IndexedDB when the report was queued
(`webAttachments.ts`; the bytes must start with the JPEG marker). A web
`blob:` URL is accepted only at the moment of sending a freshly chosen
image, never from storage.

Web offline / reload: with IndexedDB the image survives a reload and is
sent with the report. Without IndexedDB (private mode, blocked storage)
the bytes are kept in memory, the result screen says the image is kept
only while the page is open, and after a reload the report is sent
without it (`screenshot: not_uploaded`). If the image can't be stored at
all, the result screen says the report was saved without it.

A path into the journal folder, a remote URL, a `data:`/`blob:` URL or a `..`
path read from storage is dropped, and the report goes without an image. `screenshotPath`
must be `screenshots/<the report's id>.jpg`. Screen capture remains off on
private screens (sign-in, account, settings data, admin, journal).

## Not covered

- The free-text `message` and a content report's suggested correction are
  what the tester chose to write. They are sent as written (length-capped)
  and are not scanned for secrets.
