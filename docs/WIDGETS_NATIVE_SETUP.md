# OYNO native iOS widgets

Real Home Screen and Lock Screen widgets (WidgetKit + SwiftUI), generated
at `expo prebuild` by the `@bacons/apple-targets` config plugin - there is
still **no committed `ios/` folder** (Continuous Native Generation).

**They do NOT work in Expo Go.** They exist only in a development or
production build that includes the widget extension.

## Pieces

| Piece | Where |
| --- | --- |
| Widget target config | `targets/widget/expo-target.config.js` (type `widget`, iOS 16+, bundle id `<app>.widget`) |
| SwiftUI widgets | `targets/widget/OYNOWidgets.swift` (5 widgets) |
| Snapshot model + timeline | `targets/widget/OYNOWidgetData.swift` |
| App Group (declared once) | `app.json` -> `ios.entitlements['com.apple.security.application-groups']` = `group.com.ilgizsatkynov.oyno.widgets` |
| Snapshot built from app state | `src/services/widgets/widgetSnapshot.ts` (`buildWidgetSnapshot`) + `src/features/appearance/useWidgetSnapshot.ts` |
| Snapshot bridge (JS -> App Group) | `src/services/widgets/widgetBridge.ts` + `src/components/system/WidgetSync.tsx` |

The App Group string appears only in app.json. The widget target mirrors
it from the Expo config; the JS bridge reads it via `expo-constants`; the
Swift side derives it from its own bundle id (`<app>.widget` ->
`group.<app>.widgets`).

## Data flow

1. `WidgetSync` (mounted in the root layout, iOS only) builds the snapshot
   with the same hook the in-app Widget Gallery uses - no progress is
   recalculated anywhere else, and nothing in Swift.
2. `publishWidgetSnapshot` writes it as JSON to the shared
   `UserDefaults(suiteName: group)` under `oyno.widgetSnapshot.v1`, then
   calls `WidgetCenter.shared.reloadAllTimelines()` (via
   `ExtensionStorage.reloadWidget()`). It only writes when something the
   widgets show changed (timestamp ignored) and debounces 1.5 s.
3. Each widget reads the snapshot. Missing/unknown-version snapshot -> an
   "Open OYNO" fallback; Daily from a previous day is never shown as today;
   anything older than 3 days falls back too. Timelines also refresh just
   after local midnight.

## Widgets and families

| Widget | Families | Tap opens |
| --- | --- | --- |
| Daily OYNO | systemSmall, systemMedium, accessoryRectangular, accessoryInline | `/daily` |
| Continue Journey | systemSmall, systemMedium, accessoryRectangular | Home recommendation route |
| Discovery Passport | systemSmall, accessoryCircular, accessoryRectangular, accessoryInline | `/journey` |
| Guided Trail | systemSmall, accessoryRectangular | `/trails/<id>` (or `/explore`) |
| Culture of the Day | systemSmall, systemMedium | `/culture/material/<id>` |

Deep links use the app scheme: `oyno://daily`, `oyno://trails/horse-culture`.

## Localization

All widget text comes pre-localized (KG/RU/EN) inside the snapshot
(`labels`) from the app's own i18n, in the language saved in the snapshot.
Only the no-snapshot fallback and the widget-picker name/description use a
small KG/RU/EN table in Swift, chosen from the device language.

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
