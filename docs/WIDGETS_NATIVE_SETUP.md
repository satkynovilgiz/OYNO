# OYNO iOS Home Screen widget - "Today in OYNO" (1.0)

One widget product (`kind: "OYNOToday"`), two sizes: **systemSmall** and
**systemMedium** (one responsive SwiftUI view). It replaces the earlier
five-widget bundle (Daily / Journey / Passport / Trail / Culture), which
also carried personal progress.

Status: **CODE-LEVEL READY / DEVICE QA STILL REQUIRED.** Nothing here has
been verified on a physical iPhone yet.

## Pieces

| File | Role |
|---|---|
| `targets/widget/expo-target.config.js` | Existing WidgetKit target (@bacons/apple-targets). Unchanged. |
| `targets/widget/OYNOWidgetData.swift` | Snapshot model (v2), App Group read, bundled fallback, timeline provider. |
| `targets/widget/OYNOWidgets.swift` | The single `TodayWidget` (small + medium) in OYNO style. |
| `src/services/widgets/publicWidgetSnapshot.ts` | v2 schema, `buildPublicWidgetSnapshot`, `isWidgetSnapshotPublicSafe`. |
| `src/features/appearance/useWidgetSnapshot.ts` | Builds the snapshot from PUBLIC content only. |
| `src/services/widgets/widgetBridge.ts` | Writes to the App Group (iOS only, debounced, safety-checked). |
| `src/components/system/WidgetSync.tsx` | Mounted once in the root layout; publishes on change. |
| `src/features/appearance/WidgetsScreen.tsx` | In-app preview (same snapshot) + fallback preview. |

## App Group (reused - there is only one)

`group.com.ilgizsatkynov.oyno.widgets`, declared once in app.json
`ios.entitlements`. The target config mirrors it; Swift derives the same id
from its bundle id; JS reads it from `expo-constants`. Key:
`oyno.widgetSnapshot.v2`. On its first write the app **removes the old
`oyno.widgetSnapshot.v1` key** (which held personal progress).

## What the snapshot contains (and never contains)

Only: version, generatedAt, language, localDate, four labels, and up to two
cards `{kind, eyebrow, title, subtitle, url}` where `url` is an
`oyno://open/<type>/<id>` content link. `isWidgetSnapshotPublicSafe()` is an
allow-list (any extra key fails), validates every link with the app's own
`parseOYNODeepLink`, refuses query strings, caps text at 80 chars and
rejects values that look like an email, JWT, UUID or auth token. The bridge
writes nothing that fails it.

Never written: Supabase/session tokens, user id, email, name, age mode,
Journal, notes, highlights, listening, study/challenge history, collections,
Journey/Passport/Trail progress.

## Content priority (decided in the app)

1. Cultural Calendar event today or within 3 days (same rule as Home).
2. Today's Daily OYNO item.
3. Nothing -> the widget's bundled fallback: **"Explore OYNO" /
   "Кыргыз дүйнөсү телефонуңда"** (localized labels when a snapshot exists).

Medium adds a secondary card: Daily (when the primary is a calendar date),
else the newest What's New story, else the curated beginner Learning Path
(`boz-uy`; static, not progress-based).

A snapshot from a past local day is not shown - the fallback appears until
the app is opened. The widget **never** calls Supabase or the network.

## Opening

Small: the whole widget (`widgetURL`). Medium: each card is a `Link`.
URLs are `oyno://open/<type>/<id>?via=widget_small|widget_medium`. The app
validates the link exactly like a shared link (`/open/[type]/[id]`, new
type `calendar_event` checked against the bundled calendar) and reads only
the whitelisted `via` value to record `widget_opened {surface_size,
content_type}` (instead of `content_link_opened`). Unknown or removed
content shows the existing "link not available" screen.

## Localization

Labels and eyebrows come pre-localized (KG/RU/EN) in the snapshot from the
app's i18n (`widget.*`). Only the no-snapshot fallback and the widget-picker
name use bundled strings.

## Device QA checklist (not yet done)

- Add small and medium from the widget gallery on a fresh install -> fallback.
- Open the app once -> today's content appears; tap opens the right screen.
- Switch language KG/RU/EN -> widget follows after the next write.
- Next day without opening the app -> fallback, not yesterday's card.
- Sign out / switch account -> widget content unchanged (no personal data).
- VoiceOver reads eyebrow + title; Dynamic Type does not clip badly.

## Required to build

1. Set your Apple Team ID once in app.json: `"ios": { "appleTeamId": "XXXXXXXXXX" }`
   (Apple Developer account -> Membership). Prebuild warns until it's set.
2. Make sure the App Group exists for the app id in the Apple Developer
   portal - EAS credentials can register it; otherwise add
   `group.com.ilgizsatkynov.oyno.widgets` under Identifiers -> App Groups
   and enable it for both `com.ilgizsatkynov.oyno` and
   `com.ilgizsatkynov.oyno.widget`.
3. Build (Xcode 16+ on the EAS builders):
   - `npx eas-cli build --profile development --platform ios` (dev client)
   - `npx eas-cli build --profile preview --platform ios`
   - local alternative: `npx expo prebuild -p ios --clean && npx expo run:ios`

An EAS **update** cannot add or change the widget extension - it only
changes the JS that writes the snapshot.
