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
  dropped. Duplicates are dropped. At most 50 are read.

## Screenshots

A queued report can only upload an image OYNO made for feedback: its kept
copy (`documents/feedback/<id>.jpg`) or a temporary capture
(cache / tmp). A path into the journal folder, a remote URL or a `..`
path is dropped, and the report goes without an image. `screenshotPath`
must be `screenshots/<the report's id>.jpg`. Screen capture remains off on
private screens (sign-in, account, settings data, admin, journal).

## Not covered

- The free-text `message` and a content report's suggested correction are
  what the tester chose to write. They are sent as written (length-capped)
  and are not scanned for secrets.
