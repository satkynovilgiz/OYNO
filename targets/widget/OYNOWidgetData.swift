import Foundation
import WidgetKit

/// Where the snapshot lives. The App Group is declared once in app.json
/// (`ios.entitlements`) as `group.<app bundle id>.widgets`; this extension's
/// bundle id is `<app bundle id>.widget`, so the group is derived here rather
/// than repeating the bundle id.
enum OYNOWidgetConfig {
  static let snapshotKey = "oyno.widgetSnapshot.v2"

  static var appGroup: String {
    let parts = (Bundle.main.bundleIdentifier ?? "").split(separator: ".")
    return "group." + parts.dropLast().joined(separator: ".") + ".widgets"
  }
}

/// Mirror of the TypeScript `PublicWidgetSnapshot` (version 2) written by
/// src/services/widgets/widgetBridge.ts. PUBLIC content only (titles, labels,
/// oyno:// content links) - no account, token or personal progress ever
/// reaches the App Group. The widget never calls the network.
struct OYNOSnapshot: Codable {
  struct Labels: Codable {
    let brand: String
    let open: String
    let fallbackTitle: String
    let fallbackSubtitle: String
  }

  struct Card: Codable {
    let kind: String
    let eyebrow: String
    let title: String
    let subtitle: String?
    let url: String
  }

  let version: Int
  let generatedAt: String
  let language: String
  let localDate: String
  let labels: Labels
  let primary: Card?
  let secondary: Card?

  /// Reads and decodes the snapshot; nil when missing, unreadable or from an
  /// unknown version - the widget then shows its bundled fallback, never a crash.
  static func load() -> OYNOSnapshot? {
    guard
      let defaults = UserDefaults(suiteName: OYNOWidgetConfig.appGroup),
      let json = defaults.string(forKey: OYNOWidgetConfig.snapshotKey),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(OYNOSnapshot.self, from: data),
      snapshot.version == 2
    else { return nil }
    return snapshot
  }

  /// Content is chosen per local day: yesterday's card is never shown as
  /// today's (the fallback is shown until the app writes a new snapshot).
  var isCurrent: Bool {
    localDate == OYNOSnapshot.todayKey()
  }

  static func todayKey(_ date: Date = Date()) -> String {
    let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }
}

/// Only `oyno://open/<type>/<id>` content links (validated again by the app
/// on open) or the app root. `via` tells the app which widget size opened it.
func oynoWidgetURL(_ url: String?, size: String) -> URL {
  guard let url, url.hasPrefix("oyno://open/"), !url.contains("?"), let parsed = URL(string: url + "?via=widget_" + size) else {
    return URL(string: "oyno://")!
  }
  return parsed
}

/// Bundled text used when there is no current snapshot (fresh install, the
/// app not opened today). Never invented content.
enum OYNOFallback {
  static let title = "Explore OYNO"
  static let subtitle = "Кыргыз дүйнөсү телефонуңда"
  static let displayName = "Today in OYNO"
  static let description = "Explore OYNO · Кыргыз дүйнөсү телефонуңда"
}

struct OYNOEntry: TimelineEntry {
  let date: Date
  let snapshot: OYNOSnapshot?
}

/// One entry now, refreshed just after the next local midnight (so a past
/// day's card turns into the fallback). The app also reloads the timeline
/// whenever the snapshot really changes.
struct OYNOProvider: TimelineProvider {
  func placeholder(in context: Context) -> OYNOEntry {
    OYNOEntry(date: Date(), snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (OYNOEntry) -> Void) {
    completion(OYNOEntry(date: Date(), snapshot: OYNOSnapshot.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OYNOEntry>) -> Void) {
    let now = Date()
    let nextMidnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime) ?? now.addingTimeInterval(6 * 60 * 60)
    completion(Timeline(entries: [OYNOEntry(date: now, snapshot: OYNOSnapshot.load())], policy: .after(nextMidnight)))
  }
}
