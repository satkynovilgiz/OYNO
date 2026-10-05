# OYNO

A Kyrgyz culture, places and games app for iOS and Android, built with
Expo SDK 57 (React Native 0.86, Expo Router) and Supabase. UI languages:
Kyrgyz (default), Russian and English.

> Expo SDK 57 changed several APIs. Read the versioned docs at
> https://docs.expo.dev/versions/v57.0.0/ before changing Expo code (see `AGENTS.md`).

## Requirements

- Node.js 22 (the version CI uses) and npm
- For device testing: an iOS/Android **development build** of OYNO (Expo Go
  can't load the native modules this app uses - 3D games, widgets, PDF export)
- Optional: `eas-cli` (`npx eas-cli ...`) for builds and updates; an Expo
  account with access to the `oyno` project

## Setup

```sh
git clone https://github.com/satkynovilgiz/OYNO.git
cd OYNO
npm ci
cp .env.example .env   # then fill in the values (see below)
```

### Environment variables

Defined in `.env` (git-ignored) or your shell. Names only - never commit values.

| Name | Required | Where to find it |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Supabase project settings -> API -> Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase project settings -> API -> anon / publishable key |
| `EXPO_PUBLIC_SENTRY_DSN` | no | Sentry project -> Client Keys (DSN). Empty = error reporting off |

`EXPO_PUBLIC_*` values are bundled into the app. Never put the Supabase
`service_role` key anywhere the app can read it. EAS builds/updates read the
same names from the EAS environment (`development`, `preview`, `production`).

## Development

```sh
npx expo start --dev-client   # Metro for an installed development build
npm run ios                    # / npm run android / npm run web
```

The 3D games show a dev-only FPS overlay and print `[FrameStats]` lines
(frame timing during gameplay) to the console - see `docs/3D_GAMES.md`.

## Validation

```sh
npm run typecheck              # npx tsc --noEmit
npx jest --silent --ci         # full test suite (what CI runs)
npx jest src/features/journal  # a targeted subset while working
npm run release:check          # release-readiness report (PASS / FAIL / UNKNOWN)
npm run release:check -- --markdown docs/RELEASE_CHECK.md   # record it, tied to the commit SHA
npm run release:check -- --network                          # + optional live Supabase reachability
```

### Smoke tests (end-to-end, web)

```sh
npx playwright install chromium   # once
npm run e2e:build                 # web export pointed at the FAKE backend (https://oyno-e2e.test)
npm run e2e                       # Playwright journeys + KG/RU/EN, 320 px and large-text sweeps
```

The suite (`e2e/`) runs the web export in Chromium with Pixel 7 emulation.
The fake backend is strict
(`e2e/fixtures/backend.ts`): only registered tables, RPCs and writes are
served (analytics inserts are accepted and discarded); an unknown table,
RPC, write or unsupported query syntax fails the test. The network is
deny-by-default - only the local app server and the fake backend are
reachable; other hosts and all WebSockets are blocked and reported, and
service workers are blocked. No account is used. When a journey needs a new
table or RPC, register it there with deterministic fixture data. Failures leave screenshots, traces, page errors, the
backend request log and any unexpected requests in `e2e/.results`; the HTML report is in `e2e/.report`.
Rebuild with `npm run e2e:build` after app changes. Native-only features
(PDF, widgets, notifications, 3D performance, Dynamic Type) are not covered -
they stay in `docs/DEVICE_QA.md`.

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npx tsc --noEmit` and
`npx jest --silent --ci` on every push / pull request to `main`. Tests mock
Supabase and never touch the network. A second job (`smoke`) builds the web
export and runs the Playwright smoke suite, uploading results on failure.

The release check only reports what the repository can prove. Apple
Developer portal setup, EAS credentials, which migrations are live, and
physical-device QA stay **UNKNOWN** until evidence is recorded in
`docs/release-evidence.json`. It never builds, submits, deploys or applies
migrations, and never prints secret values.

## Database (Supabase)

SQL migrations live in `supabase/migrations/` (applied in filename order via
the Supabase SQL editor or migration pipeline). Applying migrations to the
live project is a deliberate, manual step - see
`docs/TESTFLIGHT_READINESS.md` §6 for what is pending and how to verify it.

## Builds and updates

- `eas.json` profiles: `development` (dev client), `preview` (internal),
  `production` - channels of the same names.
- JavaScript-only changes can ship with `eas update --channel <channel>`;
  anything that adds a native module or changes native config needs a new
  `eas build` (current example: `expo-print` for the Journal Memory Book).
- iOS builds additionally need `ios.appleTeamId` in `app.json` and Apple
  Developer setup for the app and widget targets
  (`docs/TESTFLIGHT_READINESS.md` §3).

## Documentation

- `docs/TESTFLIGHT_READINESS.md` - release blockers, migrations, historical audits
- `docs/DEVICE_QA.md` - real-device checks still to do
- `docs/3D_GAMES.md` - 3D game architecture and performance baseline method
- `docs/WIDGETS_NATIVE_SETUP.md` - iOS widget extension
- `BACKEND_PLAN.md` - backend design
