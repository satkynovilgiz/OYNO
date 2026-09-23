/**
 * OYNO widget extension (WidgetKit + SwiftUI), generated at `expo prebuild`
 * by @bacons/apple-targets - no committed ios/ folder needed.
 *
 * The App Group is NOT repeated here: it's declared once in app.json
 * (ios.entitlements['com.apple.security.application-groups']) and mirrored
 * into this target from the Expo config.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'OYNOWidgets',
  // => <app bundle id>.widget; OYNOWidgetData.swift derives the App Group
  // from this by dropping the last segment.
  bundleIdentifier: '.widget',
  displayName: 'OYNO',
  // Lock Screen families (accessoryInline/Circular/Rectangular) need iOS 16.
  deploymentTarget: '16.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#E8B93D',
    $widgetBackground: '#132018',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
