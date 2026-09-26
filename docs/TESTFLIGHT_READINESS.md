# OYNO — EAS iOS Beta / TestFlight Readiness

Status as of **2026-09-26** (release-candidate audit on `main`). Companion to
[`DEVICE_QA.md`](./DEVICE_QA.md) (device QA matrix + issue log),
[`RELEASE_CANDIDATE_CHECKLIST.md`](./RELEASE_CANDIDATE_CHECKLIST.md) (the
per-feature device test script) and [`VISUAL_QA.md`](./VISUAL_QA.md).

## Verdict

**BLOCKED BY:**

1. **`ios.appleTeamId` missing** — REQUIRES APPLE DEVELOPER ACCOUNT ACTION.
   `@bacons/apple-targets` needs it to sign the widget extension; the
   generated Xcode project has no `DEVELOPMENT_TEAM` on any target.
2. **Placeholder app icon and Android icons** — `assets/icon.png`,
   `assets/android-icon-*.png` are the default Expo template art (blue
   chevron). A real 1024×1024 OYNO icon (no transparency) is needed before
   anything goes to testers. No square OYNO icon exists in the repo.
3. **Apple Developer portal setup not verifiable from the repo** — App IDs,
   App Group and Push capability must be registered (see §3).
4. **No iOS build has ever been made** for this project (EAS build history:
   two SDK 54 Android builds and one failed SDK 57 Android build). The
   first iOS build is itself the real test of signing and the widget target.

5. **Sign in with Apple decision (App Store Guideline 4.8)** — the live
   Supabase project has **Google enabled and Apple disabled**; the app shows
   only enabled providers, so testers see Google alone. Enable Apple in
   Supabase (Apple Services ID + key) or disable Google before App Review.
   Does not block an internal preview build.

Re-checked 2026-09-26: `ios.appleTeamId` still absent; `assets/icon.png`
still the Expo template; `eas build:list --platform ios` still empty.

Once 1–3 are done, the repo is **ready for a preview build**. It is not
TestFlight-ready until a production build is generated and the device
checks at the end of this file pass.

## 1. Current configuration (audited)

| Item | Value | Where |
| --- | --- | --- |
| Expo SDK | 57 (`expo ~57.0.25`, React Native 0.86.3) | `package.json` |
| App name / display name | `OYNO` (`CFBundleDisplayName` = OYNO; widget `displayName` = OYNO) | `app.json`, `targets/widget/expo-target.config.js` |
| iOS bundle id | `com.ilgizsatkynov.oyno` | `app.json` `ios.bundleIdentifier` |
| Widget bundle id | `com.ilgizsatkynov.oyno.widget` (derived: `bundleIdentifier: '.widget'`) | `targets/widget/expo-target.config.js` |
| App Group | `group.com.ilgizsatkynov.oyno.widgets` — declared once | `app.json` `ios.entitlements` |
| URL schemes | `oyno`, `com.ilgizsatkynov.oyno` (+ `exp+oyno` for the dev client) | generated |
| Version | `1.0.0` | `app.json` |
| Build number | EAS **remote** versioning (`cli.appVersionSource: remote`); iOS buildNumber on EAS is `1`; `production` auto-increments | `eas.json` |
| Runtime version | `sdkVersion` policy → `exposdk:57.0.0` | `app.json` |
| Updates | `https://u.expo.dev/bad293a4-…`, channels `development` / `preview` / `production` | `app.json`, `eas.json` |
| Encryption export | `ITSAppUsesNonExemptEncryption = false` (HTTPS only) | `app.json` |
| iPad | `supportsTablet: true` — see "Recommendations" | `app.json` |

App Group chain (verified by a temporary `expo prebuild` on 2026-09-24,
not committed):

- App target entitlements: `group.com.ilgizsatkynov.oyno.widgets` (+ `aps-environment`).
- Widget target entitlements: `group.com.ilgizsatkynov.oyno.widgets` (mirrored from `app.json`).
- Swift (`OYNOWidgetData.swift`) derives `group.` + widget bundle id minus last segment + `.widgets` → same group.
- JS (`widgetBridge.ts`) reads the group from `expoConfig.ios.entitlements` → same group, key `oyno.widgetSnapshot.v1` on both sides.

Widget target: WidgetKit + SwiftUI, iOS 16.0 deployment target (app: 16.4),
5 widgets (Daily, Journey, Passport, Trail, Culture of the day) across
`systemSmall/Medium` and Lock Screen `accessory*` families; missing /
unreadable / unknown-version snapshot → OYNO fallback (no crash); daily item
hidden when not today's; journey/passport/trail hidden after 3 days;
`widgetURL` → `oyno://…` routes. Labels come localized from the app snapshot.
**Not proven until a native build installs and the widgets appear in the
widget picker.**

## 2. EAS build profiles (`eas.json`)

| Profile | Purpose | Distribution | EAS environment | Update channel |
| --- | --- | --- | --- | --- |
| `development` | dev client, debugging | internal | development | development |
| `preview` | installable beta (ad hoc / internal) | internal | preview | preview |
| `production` | TestFlight / App Store | store (default) | production | production |

All three extend `base`, which sets `SENTRY_DISABLE_AUTO_UPLOAD=true`.
Without it the iOS build fails in the Sentry Xcode phase, because no Sentry
org/project/auth token is configured (verified in
`@sentry/react-native/scripts/sentry-xcode.sh`). Remove it once Sentry is
configured with `SENTRY_AUTH_TOKEN` (an EAS **secret**) plus org/project.

Commands:

```sh
# Internal beta build (install via the EAS link / QR code on registered devices)
npx eas-cli build --platform ios --profile preview

# Later: TestFlight-ready build (do NOT submit automatically)
npx eas-cli build --platform ios --profile production
# then, deliberately:
npx eas-cli submit --platform ios --profile production
```

Internal (ad hoc) distribution only installs on devices registered with
`npx eas-cli device:create`.

## 3. Apple Developer account actions (cannot be done from the repo)

- [ ] Find the Team ID (developer.apple.com → Membership, 10 characters) and add it to `app.json`:
      `"ios": { "appleTeamId": "XXXXXXXXXX", … }`. It is not a secret.
- [ ] App ID `com.ilgizsatkynov.oyno` registered with capabilities **App Groups** and **Push Notifications**.
- [ ] App ID `com.ilgizsatkynov.oyno.widget` registered with **App Groups**.
- [ ] App Group `group.com.ilgizsatkynov.oyno.widgets` created and enabled on both App IDs.
- [ ] `npx eas-cli credentials` — distribution certificate + provisioning profiles for **both** bundle ids (EAS can create these; the first `eas build` prompts for them). Push key for notifications (EAS offers to create one).
- [ ] App Store Connect app record created (for TestFlight).

## 4. Permissions (iOS Info.plist, resolved config)

| Key | Text | Why |
| --- | --- | --- |
| `NSPhotoLibraryUsageDescription` | "OYNO opens your photo library only when you choose a photo - for a journal memory or a feedback screenshot." | Journal photo, beta-feedback screenshot (and the admin-only media upload) |
| `NSPhotoLibraryAddUsageDescription` | "OYNO saves the wallpapers you choose to your Photos, so you can set them as your wallpaper." | Save wallpaper |
| `NSLocalNetworkUsageDescription` | (expo-dev-client) | Development builds only use it to find the dev server |

Removed in this pass (never used by any code): **Camera** and **Microphone**
(added by default by `expo-image-picker` and `expo-audio`), **Face ID**
(default from `expo-secure-store`), and the **background `audio` mode**
(`expo-audio` default; OYNO stops narration when its screen closes).
No location, tracking, contacts or camera access is requested anywhere.

Notifications: permission is requested **only** when the user turns on a
reminder (Settings → Reminders); push-token registration never prompts.
`expo-notifications` is now in `plugins` so native builds carry the
`aps-environment` entitlement — without it push-token registration could
never succeed. Tapped reminders route via `ReminderSync`.

## 5. Environment

| Variable | Kind | development | preview | production |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | public | ✅ set on EAS | ✅ | ✅ |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | public (anon/publishable) | ✅ | ✅ | ✅ |
| `EXPO_PUBLIC_SENTRY_DSN` | public, optional | — | — | — (crash reporting off) |
| `SENTRY_DISABLE_AUTO_UPLOAD` | build flag, not secret | `eas.json` | `eas.json` | `eas.json` |

(Checked by variable **name** only; values were not read or printed.)
`.env` is gitignored and not uploaded to EAS Build — builds read the EAS
environment for their profile. The app throws a clear error at startup if
the Supabase URL/key are missing (`src/services/supabase/client.ts`).
The **service_role** key must never be added anywhere the app or EAS
build can read it.

## 6. Supabase migrations the current app depends on

Apply in filename order (all 36 in `supabase/migrations/`). The newest five
back features added in September; they were confirmed present on the live
project on 2026-09-23/24 by read-only REST checks (no writes):

1. `20260923000001_account_sync.sql` — cross-device sync (visits, daily, challenges, favorites)
2. `20260923000002_beta_feedback.sql` — beta feedback reports + screenshots bucket
3. `20260923000003_journal.sql` — private journal entries + photos bucket
4. `20260924000001_journal_photo_versions.sql` — immutable versioned journal photos
5. `20260924000002_beta_feedback_hardening.sql` — feedback dedupe / validation

Older migrations are assumed applied because the features they back
(progress, content, favorites, push tokens) already work against the live
project; confirm with the Supabase dashboard's migration history before a
public release.

## 7. Checks run (2026-09-24)

- `npx tsc --noEmit` — pass
- `npx jest --silent --ci` — 77 suites / 669 tests pass
- `npx expo-doctor` — 21/21 checks pass (after `npx expo install --fix`: patch-level alignment of 24 `expo-*` packages within SDK 57; nothing else upgraded)
- `npx expo prebuild --platform ios --no-install` — succeeds (in a throwaway copy; no `ios/` committed — `/ios` and `/android` are gitignored, Expo CNG)
- CI (`.github/workflows/ci.yml`: `npm ci`, `tsc`, `jest --ci`) — unchanged. `expo-doctor` was **not** added to CI: it calls the network (npm/Expo API) and would make CI flaky.

## 7b. Release-candidate audit (2026-09-26)

| Level | Result |
| --- | --- |
| CODE VERIFIED | `npm ci` clean · `npx tsc --noEmit` pass · `npm test` 85 suites / 747 tests pass · `npx expo-doctor` 21/21 |
| CI VERIFIED | GitHub Actions CI green on `ad34469` (and the three commits before it); re-run on the RC commit |
| Web build | 20 key routes × KG 390 + RU 375: 0 page errors, 0 horizontal overflow, 0 raw i18n keys; unknown route → not-found |
| PHYSICAL IPHONE VERIFIED | **Nothing yet** — no iOS build exists |
| APPLE PORTAL VERIFIED | **Nothing** — no Team ID / App IDs / App Group confirmed |
| BLOCKED | Every device item in `DEVICE_QA.md` |

Fixed in this pass (details in `DEVICE_QA.md` issue log):

- **RC-2 (P1 privacy)** Explore search sent the typed query to analytics → now only length + result count.
- **RC-3 (P1 privacy)** React Query cache was never cleared between accounts; oymo/shyrdak creations and the admin role are cached without a user id → cleared on every account change.
- **RC-4 (P2)** `/admin/push` and `/admin/<section>` rendered for non-admins via deep link → not-found unless the account has an admin role (server already enforced).

## 8. Assets

- Largest bundled images ≈ 1.1 MB; no oversized offenders (bundle audit in `VISUAL_QA.md`).
- Audio: 54 MB (`assets/audio/games`, `assets/audio/komuz`); every `require`d file exists.
- Splash: OYNO wordmark on cream `#F3E5C9` (was the Expo template grid on white); root `backgroundColor` cream as well, to avoid a white flash.
- **Icon: placeholder — blocker** (see Verdict).

## 9. Important: OTA updates vs. installed builds

Every recent `eas update --channel preview` targets runtime `exposdk:57.0.0`.
No installed binary has that runtime yet (the only preview build is SDK 54),
so those updates only reach testers **after** the new preview build is
installed. After that, JS-only changes can ship by `eas update`; anything
touching native modules or config needs a new build.

## 10. Readiness checklist

- [ ] Apple Team ID configured
- [ ] App identifier registered
- [ ] Widget extension identifier registered
- [ ] App Group created
- [x] App + Widget App Group entitlements match *(verified in generated project)*
- [ ] EAS credentials valid
- [x] Supabase migrations applied *(newest five verified live; older assumed — confirm)*
- [x] Environment values configured *(Supabase in all three EAS environments; Sentry optional, off)*
- [ ] Real app icon added
- [ ] Notifications tested
- [ ] Widgets tested
- [ ] Journal tested
- [ ] Cloud sync tested
- [ ] Offline tested
- [ ] Audio tested
- [ ] Screenshot feedback tested
- [ ] KG tested
- [ ] RU tested
- [ ] EN tested
- [ ] Physical iPhone visual QA complete
- [ ] Launch / restart / background tested
- [ ] Preview build installed
- [ ] Production build generated
- [ ] TestFlight upload ready

## 11. Confirmed by code / CI vs. requires a real iPhone

**Confirmed by code / CI / prebuild:** config resolves; permissions list;
App Group identical on app, widget, Swift and JS; widget fallback and
staleness logic; no notification prompt at launch; `console` output is
`__DEV__`-only; error boundaries active in production; invalid deep links
land on a Not Found screen (`src/app/+not-found.tsx`) or the screen's own
not-found state; widget / native-media code paths no-op on web and Expo Go.

**Requires a real iPhone:** widgets visible in the widget picker and their
deep links; notifications (reminder scheduling, tap routing); haptics;
image picker + HEIC → JPEG conversion; audio guide and komuz (silent switch,
interruptions, backgrounding); safe areas; 3D game FPS; map gestures;
offline relaunch; background / foreground sync; journal photo restore;
account switching; beta feedback with screenshot (sent / queued / failed).

## Recommendations (not done — product decisions)

- `supportsTablet: true` means the app installs on iPad and App Review
  may test it there. OYNO is designed and QA'd for iPhone only; consider
  `false` before the App Store submission, or plan iPad QA.
- Configure Sentry (DSN in the EAS environments + `SENTRY_AUTH_TOKEN`
  secret + org/project) before a wider beta, then drop
  `SENTRY_DISABLE_AUTO_UPLOAD`.
