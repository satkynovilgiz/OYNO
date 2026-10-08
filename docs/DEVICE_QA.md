# OYNO — Device QA Matrix (Release Candidate)

Updated **2026-09-26** against `main`.

## Status legend

| Status | Meaning |
| --- | --- |
| **PASS** | Verified on a physical iPhone running an EAS build |
| **FAIL** | Physical-device bug found |
| **CODE VERIFIED** | Logic / unit tests / web build confirm it — **not** a device result |
| **BLOCKED** | Needs a native iOS build (none exists yet — see `TESTFLIGHT_READINESS.md`) or Apple credentials |
| **N/A** | Not applicable |

**Physical iPhone tested so far: none.** No iOS build has ever been produced
for this project (`eas build:list --platform ios` is empty), so nothing below
is PASS or FAIL yet. Jest, TypeScript and web screenshots are CODE VERIFIED
only — never counted as device results.

Device under test (fill in): model `________` · iOS `________` · EAS build `________` · tester `________`

## Matrix

| # | Area | What to check on device | Status | Evidence so far |
| --- | --- | --- | --- | --- |
| 6 | Cold start | Fresh install → splash → language → onboarding → age → guest; no white flash, no jump, no clipped text | BLOCKED | Splash asset + `backgroundColor #F3E5C9` match; boot waits for session before routing (`auth.test.ts`) |
| 7 | Onboarding | Swipe, Next, Skip, guest path, KG/RU/EN, Reduce Motion, small height, CTA above home indicator | BLOCKED | Web checks 375–430 in earlier passes |
| 8 | Auth | Sign in/up, forgot/reset, guest, guest→sign in, sign out; keyboard, AutoFill, show/hide, double tap, offline error, long RU errors, no raw Supabase text | BLOCKED (device) · CODE VERIFIED (logic) | `auth.test.ts` (15 tests): localized error mapping, offline fail-fast, duplicate-submit guard, session restore, sign-out order; web: guest Settings → Sign in opens `/sign-in` with back button; expired reset hit the real backend and showed "Get a new code" |
| 9 | Account switching | Guest → A → sign out → B: no flash of Journal, achievements, notifications, saved, creations | BLOCKED (device) · CODE VERIFIED | `sync.test.ts`, `generation.test.ts`; unlock queue cleared on account load; **new:** user-scoped query cache cleared on account change (`userScopedCache.test.ts`) |
| 10 | Home | Clipping, spacing, truncation, carousels, bell, Daily/Journey cards | BLOCKED | Web KG 390 / RU 375: no overflow, no errors |
| 11 | Tab bar | 5 tabs × KG/RU/EN, active state, safe area, long RU labels | BLOCKED | Web RU 375: "Исследовать" fits |
| 12 | Explore + map | Landing, cards, map tap/pan/zoom, pin labels, detail, Passport, Save, Offline, Journal link, Audio Guide | BLOCKED | Web: `/explore`, `/explore/son-kol` load clean |
| 13 | Culture | Landing, collections, articles, audio, related, challenge CTA, artwork quality | BLOCKED | Web: `/culture`, culture item load clean |
| 14 | Games hub | Cards, detail, Play, return, no blank areas | BLOCKED | Web `/games` clean |
| 15 | 3D games | Launch, GL, touch, camera, HUD, pause/resume, result, background/foreground, FPS, heat, sound, haptics | BLOCKED | **No performance claim possible without a device** |
| 16 | Daily | Item, takeaway, audio, completion, challenge only where coverage exists, return | BLOCKED | `dailyContent.test.ts` |
| 17 | Challenges | Daily/collection/journey; text + image questions; right/wrong; haptics; result; review; share | BLOCKED | `challenges.test.ts` |
| 18 | Journal | Text/photo memory, picker, HEIC, edit, delete, links, offline edit, relaunch, account switch | BLOCKED | `journal.test.ts`; private text never in search / analytics / notifications (tested) |
| 19 | Journal share | Artwork / photo / no image; Share / Save / Cancel; JPEG 1080×1350; no private note or account info | BLOCKED | Capture size set in code; needs real export check |
| 20 | Share cards | Journey, challenge, achievement, journal: preview = export | BLOCKED | — |
| 21 | Search | KG ң ө ү, RU, EN; exact/prefix/word/partial; zero results; recents; clear; no Journal | BLOCKED (device) · CODE VERIFIED | `globalSearch.test.ts`, `recentSearches.test.ts`; web KG/RU/EN checked |
| 22 | Saved | Save, open, remove, offline badge, Continue Exploring, empty state; remove keeps progress/offline/Journal | BLOCKED (device) · CODE VERIFIED | `savedModel.test.ts`; web 375–430 |
| 23 | Offline downloads | Download → airplane mode → kill → relaunch → open; retry; remove; remove all; reconnect | BLOCKED | `offlineModel.test.ts`, `offline.test.ts` |
| 24 | Interrupted download | Background / kill / network loss mid-download; partial never complete; cleanup | BLOCKED (device) · CODE VERIFIED | Manifest written last; orphan cleanup at startup (tested) |
| 25 | Offline limits | Downloaded text + images open offline; games and komuz audio are bundled; **map offline not claimed** | BLOCKED | — |
| 26 | Notifications | First enable, prompt, allow, deny, Open Settings, delivery, tap when closed/background/foreground | BLOCKED | Permission never re-prompted after deny (tested) |
| 27 | Duplicates | Change reminder settings repeatedly → exactly one Daily reminder | BLOCKED (device) · CODE VERIFIED | `reminderScheduler.test.ts` |
| 28 | Time zone | Scheduling uses device-local time (`setHours`); no hardcoded zone. After travelling, times re-plan on next foreground | BLOCKED (device) · CODE VERIFIED | `reminderPlanner` |
| 29 | Inbox | Daily, gift, challenge, trail, achievement, download done/failed; unread dot; Mark all read; routing; bell count | BLOCKED (device) · CODE VERIFIED | `inbox.test.ts` |
| 30 | Achievements | Locked/earned, detail sheet, gift, level/XP/coins, share; no replay of old unlocks | BLOCKED (device) · CODE VERIFIED | `useProgressStore.test.ts`, `achievementsModel.test.ts` |
| 31 | Multiple unlocks | Sequential modals, never stacked | BLOCKED (device) · CODE VERIFIED | Unlock queue tests |
| 32 | Settings | Every row opens its screen; no dead rows; no debug rows | BLOCKED (device) · CODE VERIFIED | Admin row only for signed-in admins (`settingsModel.test.ts`); web KG clean |
| 33 | Appearance | Wallpapers + Widgets only, no alternate icon | CODE VERIFIED | `/appearance` web |
| 34 | Wallpapers | Browse, favorite, preview, Save to Photos allow/deny, truthful result | BLOCKED | Uses add-only photo permission (`requestPermissionsAsync(true)`) |
| 35 | Widgets | Picker lists OYNO; small/medium/Lock Screen render; matches RN preview | BLOCKED | Needs native build |
| 36 | Widget data | Updates after Daily / Journey / Passport / Trail change via App Group | BLOCKED | App Group chain audited 2026-09-24 |
| 37 | Widget links | Each widget opens the right screen; bad route → not-found | BLOCKED (device) · CODE VERIFIED | `oyno:/` + route; unknown routes → `+not-found` (web) |
| 38 | Audio guide | Play/pause/resume, leave article → mini player keeps it, background pauses / foreground stays paused, language switch stops, sign-out stops, interruption, headphones; no background-audio promise | BLOCKED (device) · CODE VERIFIED (lifecycle) | `enableBackgroundPlayback: false`; `audioGuide2.test.ts`, `integration.test.ts` (sign-out/account switch stops narration) |
| 39 | Haptics | Intended places only, no spam | BLOCKED | — |
| 40 | Photo permissions | Journal picker (no prompt, system picker), share save, wallpaper save — text matches | BLOCKED (device) · CODE VERIFIED | No camera/microphone/Face ID permission configured |
| 41 | Deep links | Daily, trail, challenge, achievement, destination, culture, notification, widget; unknown → not-found | BLOCKED (device) · CODE VERIFIED | Web: unknown route → designed not-found; `/admin/push` for non-admin → not-found (**new**) |
| 42 | Back navigation | From notification, search, saved, widget, share, deep link: no loops or dead ends | BLOCKED | — |
| 43 | Safe areas | Dynamic Island, status bar, home indicator, landscape games | BLOCKED | — |
| 44 | Keyboard | Auth, Journal, Search, Feedback, Account settings | BLOCKED | Auth scroll + KeyboardAvoidingView; Search `automaticallyAdjustKeyboardInsets` |
| 45 | KG / RU / EN | No English fallback, raw keys, truncation | BLOCKED (device) · CODE VERIFIED | `localeParity.test.ts`; web sweep of 20 routes in KG 390 + RU 375: no raw keys, no overflow |
| 46 | VoiceOver | Home, tab bar, Search, Daily, Challenge, Journal, Settings | BLOCKED | Labels present in code |
| 47 | Dynamic Type | CTAs and navigation stay usable at larger sizes | BLOCKED | — |
| 48 | Reduce Motion | Onboarding, transitions, achievement modal, cards | BLOCKED (device) · CODE VERIFIED | `useReducedMotion` used |
| 49 | Dark mode | App stays light (`userInterfaceStyle: light`); system surfaces fine | BLOCKED | — |
| 50 | Network failure | Finite failure states, no endless spinner | BLOCKED (device) · CODE VERIFIED | Auth fails fast offline (tested); detail screens show offline state |
| 51 | Background / foreground | 30 s, minutes, lock/unlock: session, audio, 3D, downloads, Daily, reminders | BLOCKED | — |
| 52 | Memory / performance | Image memory, 3D heat, scroll, Search, wallpaper grid | BLOCKED | Library thumbnails now decoded at display size (expo-image) |
| 53 | Crash audit | Rapid tab / search / back navigation | BLOCKED (device) · CODE VERIFIED | Web sweep: 0 page errors across 40 route loads |
| 54 | Dev-only UI | No debug buttons, diagnostic labels, test content | CODE VERIFIED | Console output gated by `__DEV__`; admin tools role-gated (now incl. deep links) |
| 55 | Analytics / privacy | No Journal text, email, photo path, password, tokens | CODE VERIFIED | **Fixed:** Explore search no longer sends typed text; Sentry `sendDefaultPii: false`; feedback diagnostics allow-listed |

## Issue log

| ID | Sev | Screen | Device / Lang | Steps | Expected | Actual | Fix | Verified after fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RC-1 | P0 | App icon | All | Look at `assets/icon.png` | OYNO icon | Expo template (blue chevron on grid); Android adaptive icons also template, background `#E6F4FE` | **Not fixed — needs the real OYNO brand icon** (1024×1024, no transparency) | — |
| RC-2 | P1 (privacy) | Explore search | All | Search in Explore, submit | Only high-level analytics | Typed query text sent to `analytics_events`, stored per user | Event now sends only `length` + `results` | CODE VERIFIED (tsc, jest) |
| RC-3 | P1 (privacy) | Oymo / shyrdak creations, admin role | All | Account A signs out, B signs in | B never sees A's cached rows | React Query cache never cleared; these keys have no user id | `bindUserScopedCache` drops user-scoped queries on account change | CODE VERIFIED (`userScopedCache.test.ts`) |
| RC-4 | P2 | `/admin/push`, `/admin/<section>` | All | Open by deep link as non-admin | Not-found | Admin tools rendered (server still refused actions) | `AdminGate` → not-found for non-admins | Web: guest `/admin/push` → not-found |
| RC-5 | P2 (review risk) | Sign in | All | Supabase has Google enabled, Apple disabled | — | App Store Guideline 4.8 requires Sign in with Apple alongside Google | **Decision needed:** enable Apple in Supabase or disable Google | — |
| RC-6 | P2 (decision) | iPad | iPad | `supportsTablet: true` | Designed for phone | App Store requires iPad screenshots and review on iPad; layouts are phone-first | **Decision needed:** set `supportsTablet: false` for 1.0, or QA on iPad | — |

## Audio Guide 2.0 / Admin Studio 2.0 / Feedback 2.0 - device checks still to do (2026-09-29)

Verified so far: TypeScript, Jest, and web (Chrome) only. Not yet on an iPhone or Android device. Re-checked in the 2026-09-29 integration pass (still web-only).

| Area | Check on a real device | Why web can't prove it |
| --- | --- | --- |
| Audio | Start Kyrgyz narration on a phone with a Kyrgyz voice; RU/EN narration only on translated items | Voice lists differ per device; web Chrome has no Kyrgyz voice |
| Audio | Incoming call / Siri / another app's audio while narrating -> shows Paused, resumes from the same sentence | OS audio-session interruptions |
| Audio | Unplug headphones mid-narration | Route-change behaviour of device TTS is OS-controlled (speech may continue on the speaker) |
| Audio | Background the app -> paused; return -> still paused at the same place | AppState on device |
| Audio | Leave the article while listening -> mini player continues; open the same article -> mini player hides, full player shows | Navigation + host registration on device |
| Audio | Switch app language mid-narration -> narration stops; sign out mid-narration -> narration and mini player gone, no old title left | Store + auth events on device |
| Audio | Mini player sits above the tab bar (never over tab buttons or the home indicator) on phones with different safe-area heights; hidden on games, labs, full map, challenges, auth/onboarding and admin | Safe-area insets |
| Audio | Speed 1x / 1.25x / 1.5x with device TTS | Rate mapping differs per platform |
| Admin | Sign in as a content_editor: search/filter, edit a culture item, save translations RU/EN, review note, preview, unsaved-changes prompt on swipe-back / Android back | Needs an admin account; not testable as guest |
| Admin | Long textareas with the keyboard open; Save bar stays reachable | Keyboard behaviour |
| Feedback | Send a content report online and offline (queued, sends on reconnect); it should arrive in the structured columns (migration 20260929000001 is live) and show in /admin/feedback for an admin account | Real submission was deliberately not sent from web QA |
| Feedback | Account A queues a report offline → signs out → B signs in → reconnect: report arrives unlinked | Real accounts (logic covered by `feedback.test.ts`) |
| Feedback | Attach one screenshot, remove it; screen capture disabled on Journal/account screens | Native capture module |

## Journal Memory Book PDF - device checks still to do (2026-10-04)

Verified so far: TypeScript and Jest only, with Expo Print / Sharing / FileSystem
replaced by in-memory fakes (`src/features/journal/book/memoryBookExport.test.ts`).
**No native PDF has been rendered and none of the checks below has been performed
yet.** The feature needs a native build that includes `expo-print`; older builds and
web show the "can't create PDFs" state.

| Check on a real device (iOS and Android) | Expected |
| --- | --- |
| Export 3+ memories with photos AND "Include journal text" on | Privacy prompt first; PDF opens in the share sheet; photos and full notes appear |
| Export with text off | No note text anywhere in the PDF |
| A memory whose photo is missing (deleted file, account photo while offline) | Book still created; toast "1 photo could not be included" |
| A very long note (several pages) | Text continues onto following pages; nothing cut off; each memory starts a new page |
| Titles/notes in Kyrgyz (ү ө ң), Russian and English | All characters render (no empty boxes); text is selectable in a PDF viewer |
| Save to Files / send to another app | File is named `OYNO-Memory-Book-YYYY-MM-DD.pdf` and opens |
| Cancel the share sheet | No error toast; nothing left behind in the app cache |
| Sign out / switch account while "Working…" (photos preparing or PDF rendering) | Share sheet never opens; no toast |
| Two exports back to back | Each shares its own PDF |

Known limit: once the system share sheet is open, the file has been handed to the
OS. If the person picks another app, OYNO cannot take that copy back; the app only
guarantees that a stale session never *opens* the sheet.

## 3D games - frame-timing baseline (2026-10-05)

Not yet measured on a phone. Run the scenario in `docs/3D_GAMES.md`
("Performance baseline") on a development build and record the
`[FrameStats]` lines with device, OS and commit. Also check on device:

| Check | Expected |
| --- | --- |
| Pause during the last countdown step ("GO"), wait, resume | Countdown/round does not start by itself while paused |
| Exit a game during the countdown, reopen it | Starts normally; no double countdown, no sound from the old screen |
| Background the app mid-round, return | Pause menu shown; one resume continues; frame stats exclude the background time |
| Open and exit each game 5 times | No slowdown building up across reopenings |

## Web smoke suite - what it does and does NOT cover (2026-10-05)

`npm run e2e:build && npm run e2e` (also the `smoke` CI job) runs Playwright
against the **web export** in **Chromium only**, with Pixel 7 emulation and a
deterministic fake backend. Results are **CODE VERIFIED (web)** - never a
device result.

Covered on web: guest onboarding → Home; Search → article; Learning Path
start → finish article → back to path → progress survives reload; Game
statistics filters (seeded records); Offline Downloads check (ready /
incomplete → Repair shown); not-found states (article, path, game stats);
KG/RU/EN screen sweep with no raw i18n keys; 320 px width (KG, RU) with no
horizontal overflow; Reader XL text + larger controls (RU).

Still device-only: Memory Book PDF (expo-print) and share sheet, widgets,
notifications, 3D games performance, real file-system downloads, iOS Dynamic
Type / Android font scale, Safari/WebKit and Firefox, OAuth and real sign-in.

## Learning Path guided journey - device checks still to do (2026-10-05)

Web smoke (`e2e/tests/path-journey.spec.ts`) covers articles, the glossary
step, the manual-confirmation step, the completion state, direct links,
missing targets and offline. Still device-only (3D games do not run in the
web smoke):

| Check | Status |
| --- | --- |
| Horse Games path → Kok Boru → finish an **official** round → result sheet shows "Continue learning" with "Read: Kyz Kuumai"; Replay and Exit still work | PENDING (device) |
| Same path, **practice** round only → result sheet says practice does not complete the step; no Continue | PENDING (device) |
| Continue from the result sheet replaces the game (sheet does not stay above the next screen); Back returns to the path | PENDING (device) |
| Open a game directly (Games tab) → result sheet shows no path card | PENDING (device) |
| Switch account while a step is open from a path → card and "Back to Learning Path" disappear | PENDING (device) |
| Continue card + pill above the home indicator, not covering the reader's primary actions at the largest Dynamic Type | PENDING (device) |

## Accessibility (VoiceOver / TalkBack) - PENDING (2026-10-05)

Web checks (axe, keyboard, focus, live region, 320 px + Reader XL) pass in
Chromium - see `docs/ACCESSIBILITY.md`. Screen-reader and Dynamic Type
checks on a physical iPhone / Android phone are listed there and are all
**PENDING** - none has been done.

## Onboarding pager - device checks still to do (2026-10-05)

Web (`e2e/tests/onboarding.spec.ts`, Chromium) covers one tap per slide, a
burst of taps (with and without Reduce Motion), a trackpad/wheel swipe there
and back, keyboard Enter/Tab with focus kept during the transition, and guest
access from the last slide. Model rules: `src/features/onboarding/onboardingPager.test.ts`.
There is no in-screen Back; onboarding is reached with `router.replace`.

| Check | Status |
| --- | --- |
| iOS / Android: swipe through all slides; dots, the "1 / 3" label, Next → Get Started and the guest link follow the slide shown | PENDING (device) |
| Rapid double / triple tap on Next (each slide, especially slide 2): exactly one slide per burst, never leaves onboarding | PENDING (device) |
| Same with Reduce Motion / Remove animations on (instant page change) | PENDING (device) |
| Tap Next, then swipe back mid-transition: the pager settles on the slide shown and Next works again | PENDING (device) |
| Rotate (iPad / Android tablet) on slide 2: stays on slide 2 | PENDING (device) |
| VoiceOver / TalkBack: Next reads as dimmed during the transition, then "Next" / "Get Started"; guest link reachable on the last slide | PENDING (device) |
| Android hardware Back on onboarding: leaves the app (no previous screen); no crash | PENDING (device) |

## Learning Path progress & recovery audit (2026-10-05)

Automated where the browser allows (`e2e/tests/path-journey.spec.ts`,
`src/store/learningPathStore.test.ts`, `src/features/learn/pathJourney.test.ts`).

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Path → activity → complete → back to path | OK (existing e2e: article done → next incomplete step, progress 2/5 kept) |
| 2 | Close / reopen before and after completion | **Defect fixed.** On a cold start the path screen first rendered "0 of 5 / Start path" for a path at 3/5 (signal stores not loaded; Start reopened step 1) and the manual "Mark step complete" was live. Now a loading state until every signal store is loaded (Home card waits, Culture list shows no status). Manual step persists across reload (e2e). |
| 2b | Mark step complete before the store loaded | **Defect fixed (data loss).** The write persisted over the unread storage and erased every saved manual completion, all owners. Writes now wait for the load; concurrent loads share one read (Jest). |
| 3 | Offline while opening / recording | OK. Completion is local (reading, glossary, challenge, records, manual); the card says when the next step is not saved offline and offers the way back (existing e2e). Cloud sync of the result when back online: device check. |
| 4 | Unavailable / removed content | **Defect fixed.** A removed article showed as "Read: …" (same as loading) and Start opened a not-found screen. Now "No longer available", not openable, and Continue moves to the next step that exists with a note (e2e). Article catalogue failed to load: retry row (e2e). |
| 5 | Account change | OK by code review: reading, glossary, manual steps, game records are per owner; challenge results are cleared on sign-out / another account (accountLifecycle); the path card context is dropped for another account (pathJourney.test). Device check below. |
| 6 | Practice game does not count | OK (pathJourney.test: practice alone ≠ official round). 3D result sheet: device check (see the guided-journey table above). |
| 7 | Reopening a completion screen | OK: reading keeps the first completedAt, challenge results are recorded only on final submit, manual confirm keeps the first time (Jest); path progress is derived (yes/no), so nothing is double counted. |

Observed once, not reproduced in 6 reruns: the step list announced "Unavailable offline" while online (web, `navigator.onLine` true). Not treated as a defect; worth watching on device.

Still to check on a device (PENDING):

| Check | Status |
| --- | --- |
| Cold start (kill app) with a half-done path: brief loading placeholder, then correct progress and "Continue path" - never "Start path" | PENDING (device) |
| Tap "Mark step complete" immediately after a cold start: earlier confirmations (other paths) still there after another restart | PENDING (device) |
| Signed-in: confirm a manual step offline, reconnect, sign in on a second device: step is complete there | PENDING (device) |
| Sign out A, sign in B on the same device: B sees none of A's path progress; A's returns after signing back in | PENDING (device) |
| Airplane mode, open a path with unsaved articles: notes and Continue choose a saved step; Retry row when titles cannot load | PENDING (device) |
| VoiceOver / TalkBack: loading state read as "Loading…", removed step read as unavailable and dimmed | PENDING (device) |

## Journal editor - unsaved changes & draft recovery (2026-10-06)

Automated: `e2e/tests/journal-editor.spec.ts` (web: leave unchanged without a
warning, Save / Discard / Keep editing, browser back held, restore after a
reload = restart, one entry after restoring, Discard keeps the saved
version) and `src/features/journal/editor/journalDrafts.test.ts` (dirty
rules, stored-draft validation, owner scoping and account clean-up, guest
-> account adoption, temp-photo references, idempotent create, failed
saves change nothing, account switch mid-save).

How it works: a dirty editor (title, note, date, photo or link differs from
the saved entry / the blank form) writes a draft 600 ms after typing
pauses, at once when the app goes to the background, and on unmount.
Drafts live in `oyno.journal.drafts.v1`, per owner (`guest` / user id) and
target (`new` / entry id); never synced. They are dropped exactly when that
owner's journal files are (synced sign-out, account deleted, another
account's leftovers) and kept while the owner's unsynced state is stashed
for them. A new memory's id is pre-allocated in the draft, so saving a
restored draft twice updates one entry.

Behaviour changes worth knowing:
- A photo that cannot be copied into the journal folder now FAILS the save
  (before: the entry was saved without it and "Saved" was shown).
- A storage write failure now fails the save and rolls the journal back
  (before: ignored, "Saved" was shown).
- Web: on browser Back the address bar changes before the dialog appears
  (react-navigation web behaviour); the screen itself stays until the
  person chooses. Keep editing leaves the URL showing the previous page.

Still to check on a device (PENDING):

| Check | Status |
| --- | --- |
| Android hardware Back on a dirty new memory / edit: Save, Discard, Keep editing dialog; Back inside the dialog = Keep editing | PENDING (device) |
| iOS: swipe-back is disabled while there are unsaved changes, works again after Save / Discard | PENDING (device) |
| Type a note, force-quit within 1 s (no pause): reopen offers Restore with the text (background write) | PENDING (device) |
| Pick a photo, force-quit, reopen: Restore brings back the photo; after the OS clears the cache, Restore says the photo is gone and keeps the text | PENDING (device) |
| Restore a new memory with a photo, Save: one entry, photo shown; temp file gone from cache | PENDING (device) |
| Storage full (or photo copy failure): "Couldn't save…" shown, text and photo stay, draft still offered after restart | PENDING (device) |
| Signed in as A with an unsaved draft, sign out (synced), sign in as B: B is never offered A's draft; editor open during the switch closes with the account-changed message | PENDING (device) |
| Sign out A while offline (state stashed), sign back in as A: A's draft is offered again | PENDING (device) |
| VoiceOver / TalkBack: dialog title read first, three buttons named; "Unsaved changes restored" / "Changes discarded" announced once | PENDING (device) |

## Global Search - loading, partial and offline states (2026-10-06)

Automated: `e2e/tests/search-status.spec.ts` (slow catalogue = "still
loading", never "No results"; failed culture items keep culture-category
and local results; Retry keeps the query and the group filter; empty while
a source failed is not final; "Available offline" ignores a listed download
whose data is missing; clearing / rapid edits settle on the last query; RU
status text) and `src/services/search/searchStatus.test.ts`.

Rules: a catalogue with data is usable even if its refresh failed; "No
results" is final only when every catalogue relevant to the current group
filter answered; a failed one shows "couldn't load" + Retry (re-runs only
the failed catalogue queries); offline (query paused) says it can't be
searched offline. "Available offline" = manifest entry + not incomplete in
the last check + its stored results present in the query cache; the
filter runs the local "Check downloads" once if it never ran. Results are
announced once they settle (900 ms), not per keystroke. Ranking and
transliteration are unchanged.

Known: a server 503 is retried by the Supabase client itself (up to 3x,
with backoff) on top of react-query's 2 retries, so a 503 outage shows
"still loading" for ~20-30 s before "couldn't load". Honest, but slow; the
retry policy was left as it is.

Still to check on a device (PENDING):

| Check | Status |
| --- | --- |
| Airplane mode, cold start, search a downloaded article: found, "Available offline" keeps it; places / culture list say they can't be searched offline | PENDING (device) |
| Delete one downloaded item's data (or interrupt a download), search with "Available offline": not listed | PENDING (device) |
| Slow 3G: typing shows "still loading", results fill in without the list jumping back to "No results" | PENDING (device) |
| VoiceOver / TalkBack: typing "komuz" quickly gives ONE results announcement; a failed source is mentioned once | PENDING (device) |
| Change app language, return to Search: chips, status text and result titles in the new language | PENDING (device) |

## Audio guide - lifecycle hardening (2026-10-06)

Automated with controlled player / speech mocks:
`src/services/audioGuide/audioLifecycle.test.ts` - a released player's
late or synchronous updates never touch the next session; stopped speech
callbacks are ignored; a seek that resolves after switching never plays
the old track; one engine at a time; resume = load -> seek -> play;
rejected seeks / throwing play-pause handled (no unhandled rejections);
load timeout (15 s) and player errors become a recoverable error; Try
again builds a NEW engine at the same position / section; paused while
loading never starts by itself; language change and account change stop
the session and no listening is written for the next account; full and
mini player share one status line; reduced motion kept.

Policy unchanged: backgrounding pauses; returning never auto-resumes.
New visible states: "Loading audio…", "Try again" (play button becomes a
retry icon) with a recording / device-speech specific message, and a
quiet note instead of nothing when the device has no speech engine or no
voice for the language.

NOT performed on hardware - every row below is PENDING:

iOS

| Check | Status |
| --- | --- |
| Recording playing, incoming phone call: shows Paused; after the call it stays paused until Play | PENDING (device) |
| Speech (TTS) playing, incoming call: stops at the sentence, shows Paused, Resume re-reads that sentence | PENDING (device) |
| Unplug wired / disconnect Bluetooth headphones while playing: playback pauses, UI shows Paused (not Playing) | PENDING (device) |
| Swipe home while playing, return after 30 s: Paused at the same position, no auto-resume | PENDING (device) |
| Lock screen while playing: paused on return (no background playback) | PENDING (device) |
| Silent switch on: recording audibility as designed; speech still audible or clearly silent - note which | PENDING (device) |
| Resume from history / bookmark at 1:30: playback starts at 1:30, not 0:00 | PENDING (device) |
| Tap A then B quickly 5x: B's title, progress and audio only | PENDING (device) |
| No Kyrgyz voice installed: "no voice for this language" note; installing one makes Listen appear (after restart) | PENDING (device) |

Android

| Check | Status |
| --- | --- |
| Incoming call during recording / speech: paused, stays paused after the call | PENDING (device) |
| Headphones unplugged / Bluetooth off (becoming-noisy): pauses, UI shows Paused | PENDING (device) |
| Home / recent apps while playing, return: Paused at the same position | PENDING (device) |
| Another app takes audio focus (music app): ours pauses, UI agrees | PENDING (device) |
| Hardware Back from the screen while playing: mini player continues with the same title | PENDING (device) |
| No TTS engine (or disabled): "isn't available on this device" note, no Play button | PENDING (device) |
| TTS engine killed mid-sentence (Settings -> force stop): error with Try again; Try again re-reads the section | PENDING (device) |
| Resume from bookmark: starts at the saved second after load | PENDING (device) |

## Journal drafts - writing-and-photo recovery review (2026-10-06)

Automated (`src/features/journal/editor/journalDraftPhotos.test.ts`, on the
in-memory file system):

| # | Scenario | Result |
| --- | --- | --- |
| 1 | New draft + photo, restart, restore | **Defect fixed.** The draft only pointed at the temp cache file, so an OS cache purge lost the photo. A draft now owns a copy (`journal/<owner>/draft-<target>-<v>.jpg`), reused for repeated writes; after restore + save the draft copy is removed and the entry keeps its own file. |
| 2 | Edit, replace photo, discard | OK. Saved fields and photo come back; only the replacement temp file and draft copy are deleted; an edit draft that keeps the entry's photo never deletes it. |
| 3 | Failed save, leave, recover | OK. Nothing saved, a useful error, and the draft (text + photo) is there after a restart; the failed save's own photo copy is cleaned up. |
| 4 | Account switch with a write / photo copy pending | **Defect fixed.** A draft write still in flight when an account was cleared could store that account's draft again afterwards. Each owner now has a drop generation; a stale write (or a copy that finishes late) stores nothing and deletes its file. A guest's draft photo now moves into the account's folder on sign-in. |
| 5 | Delete an entry that has a draft | **Defect fixed.** Deleting from elsewhere, or by a sync tombstone, left the draft (text + photo) behind. The journal store now tells the draft store about every removal; a draft for an entry that hasn't synced yet is kept. |
| 6 | Restore with the temp photo missing | OK. The text is restored, the photo falls back to the saved one, and the editor says the photo was lost. |

Still to check on a device (PENDING):

| Check | Status |
| --- | --- |
| Pick a photo in a new memory, force-quit within 1 s, reopen: Restore shows the photo | PENDING (device) |
| Same, then free storage / clear the app cache: Restore still shows the photo (the draft's own copy) | PENDING (device) |
| Edit with a replaced photo, Discard: the saved photo shows; the Files/Storage size drops back | PENDING (device) |
| Delete a memory on phone A that has an unsaved edit on phone B: after B syncs, B offers no restore | PENDING (device) |
| Guest draft with photo, sign in: the draft and photo are offered under the account | PENDING (device) |

## Culture Detective and Culture Duel (2026-10-07)

Automated: `src/features/detective/detective.test.ts`,
`src/features/duel/duel.test.ts`, `e2e/tests/culture-detective.spec.ts`,
`e2e/tests/culture-duel.spec.ts` (full sessions, replay / focus round,
duel turns with concealed handoffs, reveal timing, tie / win, rematch,
leave confirmation, axe, KG/RU). Content sources: `docs/CULTURE_DETECTIVE.md`.

Culture Duel rules: same question, picture, clue and answer order for both
players; 1 point per correct answer; who answers first alternates; nothing
about either answer (or the correct one) shows until both answered; scores
are derived from answers and only count revealed rounds. Backgrounding
mid-turn returns to "Pass the phone" (nothing recorded). Nicknames and
results are never stored or sent; nothing counts as learning progress or
official game records.

Party Mode (2026-10-07): 2-4 players; round r starts with player r mod n
(two players: the same alternation as before); everyone gets the same
question and answer order; every handoff conceals all earlier answers;
answers and points are revealed only after everyone has answered; the final
ranking shares positions for equal scores (1, 1, 3). The "show my question"
button ignores presses for 0.7 s after a handoff appears, so a double tap
on an answer can't open the next player's turn.

Leaving an unfinished match: header Back, Android back and browser Back
all ask "Leave the duel?" (shared `src/hooks/useLeaveGuard.ts`, also used by
the Journal editor). Web: a held Back restores the duel's URL, so the
address bar matches the screen and the next Back is held again. iOS: the
swipe-back gesture is turned off while a match runs, because a native swipe
can't be held halfway. Leaving the app (Home, app switcher) isn't
"leaving": the match stays, and an active turn returns to its handoff.

Native limitations (not testable on web):
- The iOS app-switcher snapshot is taken by the OS. The app hides the turn
  when it goes inactive, but whether the snapshot is taken before or after
  that re-render isn't guaranteed.
- Android predictive back (system gesture preview) may show the previous
  screen behind the dialog before the app holds it.

Still to check on a device (PENDING):

| Check | Status |
| --- | --- |
| Duel: lock the phone / switch apps during a turn, come back: "Pass the phone" shows, not the question | PENDING (device) |
| Duel: iOS app switcher snapshot during a turn - note whether the question is visible in the snapshot (OS-level, not hidden by the app) | PENDING (device) |
| Duel: Android hardware Back mid-match asks "Leave the duel?" | PENDING (device) |
| Duel: iOS swipe-back does nothing during a match, works again after it ends | PENDING (device) |
| Party: four players on one phone, 5 rounds, airplane mode: rotation, handoffs and final ranking | PENDING (device) |
| Party: a quick double tap on an answer never opens the next player's question | PENDING (device) |
| Duel and Detective: largest Dynamic Type / font scale - answers and buttons stay reachable without overlap | PENDING (device) |
| VoiceOver / TalkBack: handoff announced; answers read as a radio group; reveal reads both players' answers | PENDING (device) |
| Reduce Motion on: no motion beyond press feedback in either mode | PENDING (device) |
| Airplane mode, fresh install: a full Detective session and a full Duel work offline | PENDING (device) |

## Mini Museum (2026-10-07)

`/profile/my-collections/museum?collection=<id>`, opened from a collection's
header. It presents an EXISTING private collection: an exhibition title, an
optional introduction, up to 8 of the collection's items in the owner's
order, and private captions. These are stored as an owner-scoped slice of the
My Collections store (`oyno.myCollections.museums.v1`). They are removed with
their collection, forgotten with their owner, and follow a guest into their
account. Exhibitions are re-checked against the collection on every read,
so removed items drop out. A slide whose content was removed from OYNO says
so, and a missing image says it's unavailable. The sourced title, type and
artwork are shown apart from "Your caption". The cover card shares only the
title, the exhibit count and one picture, plus the introduction if switched
on (off by default). Captions, the private description, journal text, notes
and photos are never inputs. The existing share sheet previews exactly that
card. Tests: `museum.test.ts`, `e2e/tests/mini-museum.spec.ts`.

| Check | Status |
| --- | --- |
| Share the cover to Messages / Telegram: the received image matches the preview | PENDING (device) |
| Airplane mode: present a collection of downloaded articles - images and titles show; others say unavailable | PENDING (device) |
| Sign out A, sign in B on the same phone: B's Mini Museum shows none of A's captions | PENDING (device) |
| VoiceOver / TalkBack: exhibit order buttons named, slides announce "Exhibit n of m" | PENDING (device) |

## Culture Detective Expeditions (2026-10-07)

PENDING (not performed on a device):

- [ ] iOS / Android: open an expedition and play the learning round. All three
  clues are visible, and there is no reveal button and no points.
- [ ] Take the challenge. Clues start closed. "What you discovered" lists all
  five objects with both rounds, and each opens its article.
- [ ] Skip the challenge: the summary shows only the learning results.
- [ ] Practise the missed ones: only that expedition's missed questions are
  asked.
- [ ] Sign out and in as another account: the expedition results are not
  shown.
- [ ] Airplane mode on a fresh install: an expedition still plays.
- [ ] VoiceOver / TalkBack and the largest text size: the clues are read before
  the answers, and the answers stay on screen.

## Repeat the Rhythm (2026-10-07)

PENDING (not performed on a device). See docs/REPEAT_THE_RHYTHM.md for:

- latency measurements (speaker, touch, Bluetooth);
- sound and light sync;
- silent switch;
- backgrounding and calls mid-round;
- VoiceOver / TalkBack and the largest text size.
