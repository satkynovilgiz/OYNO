import Foundation
import WidgetKit

/// Where the snapshot lives. The App Group is declared once in app.json
/// (`ios.entitlements`) as `group.<app bundle id>.widgets`; this extension's
/// bundle id is `<app bundle id>.widget`, so the group is derived here rather
/// than repeating the bundle id.
enum OYNOWidgetConfig {
  static let snapshotKey = "oyno.widgetSnapshot.v1"

  static var appGroup: String {
    let parts = (Bundle.main.bundleIdentifier ?? "").split(separator: ".")
    return "group." + parts.dropLast().joined(separator: ".") + ".widgets"
  }
}

/// Mirror of the TypeScript `WidgetSnapshot` (version 1) written by
/// src/services/widgets/widgetBridge.ts. The app computes every value -
/// nothing here recalculates progress.
struct OYNOSnapshot: Codable {
  struct Labels: Codable {
    let daily: String
    let dailyDone: String
    let minutes: String
    let journey: String
    let passport: String
    let passportProgress: String
    let trail: String
    let noTrail: String
    let cultureOfDay: String
    let openApp: String
  }

  struct Routes: Codable {
    let daily: String
    let journey: String
    let passport: String
    let trail: String?
    let cultureOfDay: String?
  }

  struct Daily: Codable {
    let itemId: String
    let title: String
    let minutes: Int
    let isCompleted: Bool
  }

  struct Progress: Codable {
    let completed: Int
    let total: Int
  }

  struct Journey: Codable {
    let eyebrow: String
    let title: String
    let progress: Progress?
    let route: String
  }

  struct Passport: Codable {
    let unlocked: Int
    let total: Int
  }

  struct Trail: Codable {
    let id: String
    let title: String
    let completed: Int
    let total: Int
  }

  struct Culture: Codable {
    let id: String
    let title: String
    let description: String?
  }

  let version: Int
  let language: String
  let generatedAt: String
  let localDate: String
  let labels: Labels
  let routes: Routes
  let daily: Daily?
  let journey: Journey
  let passport: Passport
  let trail: Trail?
  let cultureOfDay: Culture?

  /// Reads and decodes the snapshot; nil when missing, unreadable or from an
  /// unknown version - widgets then show the OYNO fallback, never a crash.
  static func load() -> OYNOSnapshot? {
    guard
      let defaults = UserDefaults(suiteName: OYNOWidgetConfig.appGroup),
      let json = defaults.string(forKey: OYNOWidgetConfig.snapshotKey),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(OYNOSnapshot.self, from: data),
      snapshot.version == 1
    else { return nil }
    return snapshot
  }

  /// Daily OYNO changes every local day: yesterday's item is never shown as
  /// today's.
  var isDailyCurrent: Bool {
    localDate == OYNOSnapshot.todayKey()
  }

  /// Journey/Passport/Trail are only shown while reasonably fresh (3 days).
  var isFresh: Bool {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = formatter.date(from: generatedAt) else { return false }
    return Date().timeIntervalSince(date) < 3 * 24 * 60 * 60
  }

  static func todayKey(_ date: Date = Date()) -> String {
    let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }
}

/// `oyno://daily` etc. - expo-router maps it to the same in-app route.
func oynoDeepLink(_ route: String?) -> URL {
  guard let route, let url = URL(string: "oyno:/" + route) else { return URL(string: "oyno://")! }
  return url
}

/// Text used only when there is no snapshot yet (fresh install, never opened)
/// - picked from the device language, KG/RU/EN like the app.
enum OYNOFallback {
  private static var language: String {
    let preferred = Locale.preferredLanguages.first?.lowercased() ?? "en"
    if preferred.hasPrefix("ky") { return "kg" }
    if preferred.hasPrefix("ru") { return "ru" }
    return "en"
  }

  static var openApp: String {
    switch language {
    case "kg": return "OYNOну ачып, саякатыңды башта"
    case "ru": return "Открой OYNO, чтобы начать путешествие"
    default: return "Open OYNO to start your journey"
    }
  }

  static func displayName(_ kind: String) -> String {
    let names: [String: [String: String]] = [
      "daily": ["kg": "Күндүн ачылышы", "ru": "Открытие дня", "en": "Daily OYNO"],
      "journey": ["kg": "Саякатыңды улант", "ru": "Продолжи путешествие", "en": "Continue Journey"],
      "passport": ["kg": "Ачылыштар паспорту", "ru": "Паспорт открытий", "en": "Discovery Passport"],
      "trail": ["kg": "Саякат", "ru": "Маршрут", "en": "Guided Trail"],
      "culture": ["kg": "Күндүн маданияты", "ru": "Культура дня", "en": "Culture of the Day"],
    ]
    return names[kind]?[language] ?? "OYNO"
  }

  static func description(_ kind: String) -> String {
    let descriptions: [String: [String: String]] = [
      "daily": ["kg": "Бүгүнкү маданий ачылыш", "ru": "Сегодняшнее культурное открытие", "en": "Today's cultural discovery"],
      "journey": ["kg": "Кийинки кадамың", "ru": "Твой следующий шаг", "en": "Your next step in OYNO"],
      "passport": ["kg": "Ачылган табигый жерлер", "ru": "Открытые природные места", "en": "Nature sites you've discovered"],
      "trail": ["kg": "Башталган саякатыңдын прогресси", "ru": "Прогресс начатого маршрута", "en": "Progress on your active trail"],
      "culture": ["kg": "Бүгүнкү маданият материалы", "ru": "Материал о культуре на сегодня", "en": "Today's culture material"],
    ]
    return descriptions[kind]?[language] ?? ""
  }
}

struct OYNOEntry: TimelineEntry {
  let date: Date
  let snapshot: OYNOSnapshot?
}

/// One entry now, refreshed at the next local midnight (so Daily switches to
/// its "open OYNO" state instead of showing yesterday). The app also calls
/// WidgetCenter.reloadAllTimelines() whenever the snapshot really changes.
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
