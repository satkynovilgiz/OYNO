# OYNO widgets - native setup still required

The in-app Widget Gallery (`/appearance/widgets`) and the widget data layer
(`src/services/widgets/widgetSnapshot.ts`, fed by
`src/features/appearance/useWidgetSnapshot.ts`) are done. Real Home Screen /
Lock Screen widgets are **not** in the app yet, because iOS widgets are a
separate native WidgetKit extension that cannot ship in JavaScript or via an
EAS OTA update, and do not run in Expo Go.

## What's missing (native, needs a new build)

1. **Widget extension target.** This project uses Continuous Native
   Generation (no committed `ios/` folder), so the target has to be generated
   by a config plugin at prebuild time - e.g. `@bacons/apple-targets`
   (`npx create-target widget`), producing `targets/widget/` with the
   SwiftUI `Widget` + `TimelineProvider` code and an `expo-target.config.js`.
2. **App Group** shared by the app and the extension (e.g.
   `group.<bundle id>.widgets`), added to both entitlements via the same
   plugin / `ios.entitlements` in app.json.
3. **Writing the snapshot** from the app into that App Group so the widget
   can read it: a tiny native module (or the target plugin's
   `ExtensionStorage`) that stores `JSON.stringify(buildWidgetSnapshot(...))`
   under one key in the shared `UserDefaults(suiteName:)`, then calls
   `WidgetCenter.shared.reloadAllTimelines()`. Call it whenever the snapshot
   changes (the hook already produces it).
4. **SwiftUI widgets** that decode `WidgetSnapshot` (version 1) and render
   Daily OYNO, Continue Journey, Passport, Guided Trail and Culture of the
   Day in the `systemSmall`, `systemMedium`, `accessoryInline`,
   `accessoryCircular` and `accessoryRectangular` families, matching the
   gallery previews. Artwork must be bundled into the extension's asset
   catalog (widgets can't load the app's JS assets).
5. **`npx expo prebuild` + a new EAS development/production build.**

Until then the gallery says plainly that widgets arrive with a future full
app update, and nothing claims they are installed.
