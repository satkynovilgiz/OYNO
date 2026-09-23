# OYNO — Release Candidate Checklist

Real-iPhone verification for the beta build. Every box here must be ticked
**on a physical iPhone running an EAS build** (not Expo Go, not the web
preview, not the simulator). Items verified only by code review, unit tests
or the web build are listed separately at the bottom — they do not count as
device verification.

Build under test: `__________` (EAS build id) · iOS version: `______` ·
Device: `__________` · Tester: `______` · Date: `______`

## Before installing

- [ ] `ios.appleTeamId` set in `app.json` (needed for the widget extension signing)
- [ ] App Group `group.com.ilgizsatkynov.oyno.widgets` registered in the Apple Developer portal and enabled for **both** `com.ilgizsatkynov.oyno` and `com.ilgizsatkynov.oyno.widget`
- [ ] EAS credentials generated for both bundle ids (`eas credentials`)
- [ ] `npx expo install --fix` run (expo-doctor reports 22 patch-level mismatches) **before** the native build — not via an OTA update
- [ ] Fresh native build made (`eas build -p ios --profile preview`); the preview channel's older binaries lack view-shot, sharing, media-library, speech and the widget extension

## Real iPhone verification

- [ ] onboarding — first launch, language pick, age group, welcome slides; no notification or photo permission prompt appears
- [ ] auth — sign up, email code, sign in, sign out, password reset, guest mode
- [ ] Home — journey card, recently explored, Daily entry, safe areas on notch/Dynamic Island
- [ ] games — each game starts, plays, finishes, records a play; back returns to Games
- [ ] Explore — nature sites carousel reaches the last card; region/detail screens
- [ ] map — pinch, pan, double-tap, zoom bounds; Ala-Too / Suusamyr / Son-Köl pins are each tappable without hitting a neighbour; preview opens/closes; VoiceOver focus moves to the preview
- [ ] Culture — categories, items, materials, collections, share from a collection
- [ ] Audio Guide — KG shows an honest "no Kyrgyz voice" state (never reads KG text with a RU/EN voice); RU/EN narrate; leaving the screen, backgrounding and switching language all stop narration; Komuz playlist and the guide never play together
- [ ] Daily — today's discovery, image challenge, completion persists after restart
- [ ] Passport/Journey — visiting Son-Köl updates Explore, Passport, Journey and the map the same way
- [ ] Trails — progress, next step, "Show on map" highlights only the trail's places
- [ ] Challenges — daily/culture/journey runs; VoiceOver announces correct/incorrect; best score kept
- [ ] Search — results for KG/RU/EN queries, trail results open
- [ ] Favorites — add/remove, persists after restart, syncs when signed in
- [ ] Offline — download a place and a collection; they open in airplane mode; undownloaded content shows the offline state (no endless spinner); deleting a download keeps progress
- [ ] Share — share card is a 1080×1350 image with its photo loaded (not blank/black); long KG/RU titles fit; cancelling the sheet is harmless
- [ ] Wallpapers — "Save" asks for photo-library add permission once; saved image appears in Photos; denying shows an honest message; Share works
- [ ] Notifications — no permission request at launch; enabling a reminder asks once; reminder fires at the chosen time, not in quiet hours; completed Daily/trail reminders are skipped; tapping opens the right screen; language change updates the copy
- [ ] Widgets — widget gallery lists OYNO; small/medium/Lock Screen widgets show real progress; tapping opens the right screen; the widget updates after progress changes; a stale snapshot shows the fallback
- [ ] language switching — KG ↔ RU ↔ EN across Home, Culture, Challenges, Reminders; nothing stays in the previous language
- [ ] background/foreground — audio stops on background; reminders re-plan on return; no duplicated modals
- [ ] airplane mode — launch fully offline; the offline pill shows; connection return refreshes downloads
- [ ] app restart — progress, favorites, downloads, challenge scores, reminder settings and wallpaper favorites all survive a force-quit

## Already confirmed by code/tests (not device-verified)

These were checked by TypeScript, Jest, code review or the web build at
375/390/430 px. They still need the device pass above.

- TypeScript: `npx tsc --noEmit` clean
- Jest: full suite green (question bank, pin spreading, error boundaries, offline, reminders, trails, passport, widget snapshot)
- Every route renders at 375/390/430 px on web without horizontal overflow; invalid ids show a not-found screen with a Back button
- Native modules added after the installed builds (`react-native-view-shot`, `expo-sharing`, `expo-media-library`, `expo-speech`, `@bacons/apple-targets`) are required lazily behind availability checks, so Expo Go and older builds fall back instead of crashing
- Feature screens have route-level error boundaries; the widget and reminder background sync are isolated so a crash there can't take the app down
- All Knowledge Challenge questions trace to existing OYNO content
- No secrets are tracked in git
