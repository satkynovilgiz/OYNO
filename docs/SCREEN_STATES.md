# Screen states

This page sets one vocabulary for screen states (`src/components/state/stateRules.ts`) and shared components for them (`src/components/state/ScreenState.tsx`, `ContentQueryGate.tsx`).

| State | Meaning | What it shows |
| --- | --- | --- |
| loading | The data is on its way | A skeleton, only when it has the shape of the coming layout (the article), otherwise a labelled indicator. After 8 s it says it is taking longer and offers **Try again**, so it never spins without explanation. |
| empty | Loaded fine; nothing there yet | What to do next (one action) |
| notFound | Loaded fine; this record or item does not exist | A way back |
| unavailable | Can't show here and now, for a known reason (offline and not downloaded, signed out) | What would make it work (open downloads, try again once online, sign in) |
| error | Loading failed | That it failed, that nothing saved changed, and **Try again**. Never shown as "not found" or "empty". |

**Rule (`resolveScreenState`):** content that is already on screen stays when a refresh fails, and the failed part gets its own inline `SectionError`. A failure counts as an error only when there is nothing to show.

The messages are plain and concise in KG, RU and EN (`states.*`). The state blocks have no illustrations, so nothing obscures the recovery instructions. The error block has a red outline, using the text-safe `dangerText`.

## Audit (2026-10-14)

| Screen | Before | Now |
| --- | --- | --- |
| Article `/culture/item/[id]` | Bare spinner, no timeout; a failed load was shown as Not Found with no retry | `ContentQueryGate` covers four states: (1) offline and not downloaded: unavailable, with Open downloads, or Try again when online; (2) loading: an article-shaped skeleton, slow notice after 8 s, then Try again; (3) failed: an error with Try again and Back; (4) a missing id: Not Found. Cached content shows even if a refresh fails. |
| Material `/culture/material/[id]` | Same as the article | Same gate |
| My OYNO Shelf | Already a per-source state (loading, error with Retry, signed out, empty with Create) | Kept. Designs paused offline are now "unavailable (offline)" instead of a "loading" that never ends. A failing source never hides the others (tested). |
| Scrapbook detail | A failed load showed Not Found; loading was a blank screen | Error with Try again (`retryLoad`); loading is a labelled state with the slow notice |
| Scrapbook list, My motifs list | Error with Retry | Unchanged (already distinct) |
| My Questions (list and detail) | Error with Retry; plain "Loading" text | Shared `StateMessage` and `LoadingState` (slow notice, Try again) |
| Custom motif editor | A failure showed plain text with no retry | Error with Try again; loading uses the shared state; Not Found is separate |
| Oymo Creator, saved designs | Loading and failure both rendered an empty gallery ("no designs") | Loading text; failure shows `SectionError` with Retry ("the design on the canvas is not affected"); a design opened from the Shelf that no longer exists says so. The gallery renders only once loaded. |
| Offline downloads | Already distinguishes downloading / failed with no usable copy (Retry) / incomplete (Repair) / empty | Unchanged |
| Prepare for offline | Already distinguishes ready / incomplete / downloading / failed | Unchanged |

## Edits are kept during failures

- No failure path resets an editor. The Creator canvas, scrapbook drafts, question drafts and other in-memory drafts sit outside the load states, and the Recovery Center lists them.
- The Creator test places a motif, fails the designs request, and retries: the motif stays throughout.

## Tests

- **Unit:** `src/components/state/stateRules.test.ts`. It checks:
  - the rule, including that a failure is never "not found" or "empty";
  - store mapping;
  - the slow-loading notice;
  - that each audited screen uses the defined behaviour;
  - KG, RU and EN strings.
- **E2E:** `e2e/tests/screen-states.spec.ts`. It covers:
  - an article that fails (503) → error with Try again, not Not Found → Retry opens the article;
  - a slow article in KG → skeleton → slow notice → Try again → article;
  - an unreadable scrapbook → error → storage fixed → Retry opens the book;
  - a Shelf board source that fails while a capsule still shows → Retry;
  - a Creator designs failure with the canvas motif kept → Retry clears it.
- **Screenshots** reviewed: `e2e/.results/state-*.png`.

## Not migrated yet

41 files still use an inline `ActivityIndicator`. Most are small in-button or row spinners for an action already in progress, which are fine. Remaining full-screen spinners should move to `LoadingState` as those screens are touched.
