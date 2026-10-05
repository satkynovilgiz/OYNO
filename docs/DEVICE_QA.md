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
