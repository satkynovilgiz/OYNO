import SwiftUI
import WidgetKit

// MARK: - OYNO style (matches the in-app Widget Gallery)

enum OYNOColor {
  static let forest = Color(red: 0x13 / 255, green: 0x20 / 255, blue: 0x18 / 255)
  static let green = Color(red: 0x2F / 255, green: 0x52 / 255, blue: 0x33 / 255)
  static let cream = Color(red: 0xFB / 255, green: 0xF3 / 255, blue: 0xE3 / 255)
  static let gold = Color(red: 0xE8 / 255, green: 0xB9 / 255, blue: 0x3D / 255)
  static let creamMuted = cream.opacity(0.72)
}

/// The oymo diamond used across OYNO: an outer diamond with an inner one.
struct OymoMark: View {
  var size: CGFloat = 10
  var color: Color = OYNOColor.gold

  var body: some View {
    ZStack {
      Rectangle().stroke(color, lineWidth: 1.2).frame(width: size * 0.7, height: size * 0.7).rotationEffect(.degrees(45))
      Rectangle().fill(color).frame(width: size * 0.25, height: size * 0.25).rotationEffect(.degrees(45))
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

struct Eyebrow: View {
  let text: String

  var body: some View {
    HStack(spacing: 4) {
      OymoMark(size: 9)
      Text(text.uppercased()).font(.system(size: 9, weight: .semibold)).tracking(1).foregroundColor(OYNOColor.gold).lineLimit(1)
    }
  }
}

extension View {
  /// iOS 17 requires containerBackground for widgets; older systems use a
  /// plain background.
  @ViewBuilder
  func oynoBackground(_ color: Color = OYNOColor.forest) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(color, for: .widget)
    } else {
      background(color)
    }
  }
}

/// Shown when there's no snapshot yet (or it's too old) - never invented data.
struct FallbackView: View {
  let text: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      OymoMark(size: 14)
      Spacer(minLength: 0)
      Text("OYNO").font(.system(size: 18, weight: .bold, design: .serif)).foregroundColor(OYNOColor.cream)
      Text(text).font(.system(size: 11)).foregroundColor(OYNOColor.creamMuted).lineLimit(3)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

// MARK: - Daily OYNO

struct DailyView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OYNOEntry

  var body: some View {
    let snapshot = entry.snapshot
    let daily = (snapshot?.isDailyCurrent ?? false) ? snapshot?.daily : nil
    let prompt = snapshot?.labels.openApp ?? OYNOFallback.openApp

    Group {
      switch family {
      case .accessoryInline:
        Text(daily.map { "◆ \($0.title)" } ?? "◆ OYNO")
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 1) {
          Text("◆ " + (snapshot?.labels.daily ?? "OYNO")).font(.system(size: 11, weight: .semibold)).widgetAccentable()
          Text(daily?.title ?? prompt).font(.system(size: 14, weight: .bold)).lineLimit(1)
          if let daily { Text(daily.isCompleted ? "✓ " + (snapshot?.labels.dailyDone ?? "") : (snapshot?.labels.minutes ?? "")).font(.system(size: 11)) }
        }
      default:
        if let daily, let snapshot {
          VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: snapshot.labels.daily)
            Spacer(minLength: 0)
            Text(daily.title).font(.system(size: family == .systemMedium ? 22 : 17, weight: .bold, design: .serif)).foregroundColor(OYNOColor.cream).lineLimit(2).minimumScaleFactor(0.8)
            Text(daily.isCompleted ? "✓ \(snapshot.labels.dailyDone)" : snapshot.labels.minutes).font(.system(size: 11, weight: .medium)).foregroundColor(daily.isCompleted ? OYNOColor.gold : OYNOColor.creamMuted)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
          FallbackView(text: prompt)
        }
      }
    }
    .widgetURL(oynoDeepLink(snapshot?.routes.daily ?? "/daily"))
    .oynoBackground()
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Continue Journey

struct JourneyView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OYNOEntry

  var body: some View {
    let snapshot = (entry.snapshot?.isFresh ?? false) ? entry.snapshot : nil
    let journey = snapshot?.journey

    Group {
      if family == .accessoryRectangular {
        VStack(alignment: .leading, spacing: 1) {
          Text("◆ " + (journey?.eyebrow ?? "OYNO")).font(.system(size: 11, weight: .semibold)).widgetAccentable()
          Text(journey?.title ?? OYNOFallback.openApp).font(.system(size: 14, weight: .bold)).lineLimit(2)
          if let progress = journey?.progress { Text("\(progress.completed) / \(progress.total)").font(.system(size: 11)) }
        }
      } else if let journey {
        HStack(spacing: 12) {
          if family == .systemMedium { ProgressBadge(progress: journey.progress, size: 56) }
          VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: journey.eyebrow)
            Spacer(minLength: 0)
            Text(journey.title).font(.system(size: family == .systemMedium ? 20 : 16, weight: .bold, design: .serif)).foregroundColor(OYNOColor.cream).lineLimit(2).minimumScaleFactor(0.8)
            if family == .systemSmall, let progress = journey.progress {
              Text("\(progress.completed) / \(progress.total)").font(.system(size: 11, weight: .semibold)).foregroundColor(OYNOColor.gold)
            }
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
      } else {
        FallbackView(text: OYNOFallback.openApp)
      }
    }
    .widgetURL(oynoDeepLink(journey?.route ?? "/home"))
    .oynoBackground()
    .accessibilityElement(children: .combine)
  }
}

/// Gold ring with "3/5" when there's real progress, otherwise the oymo mark.
struct ProgressBadge: View {
  let progress: OYNOSnapshot.Progress?
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().stroke(OYNOColor.cream.opacity(0.16), lineWidth: 4)
      if let progress, progress.total > 0 {
        Circle()
          .trim(from: 0, to: CGFloat(progress.completed) / CGFloat(progress.total))
          .stroke(OYNOColor.gold, style: StrokeStyle(lineWidth: 4, lineCap: .round))
          .rotationEffect(.degrees(-90))
        Text("\(progress.completed)/\(progress.total)").font(.system(size: 12, weight: .bold)).foregroundColor(OYNOColor.cream)
      } else {
        OymoMark(size: size * 0.35)
      }
    }
    .frame(width: size, height: size)
  }
}

// MARK: - Discovery Passport

struct PassportView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OYNOEntry

  var body: some View {
    let snapshot = (entry.snapshot?.isFresh ?? false) ? entry.snapshot : nil

    Group {
      if let snapshot {
        let passport = snapshot.passport
        switch family {
        case .accessoryInline:
          Text("◆ \(snapshot.labels.passport) \(passport.unlocked)/\(passport.total)")
        case .accessoryCircular:
          Gauge(value: Double(passport.unlocked), in: 0...Double(max(passport.total, 1))) {
            Text("◆")
          } currentValueLabel: {
            Text("\(passport.unlocked)/\(passport.total)")
          }
          .gaugeStyle(.accessoryCircularCapacity)
        case .accessoryRectangular:
          VStack(alignment: .leading, spacing: 1) {
            Text("◆ " + snapshot.labels.passport).font(.system(size: 11, weight: .semibold)).widgetAccentable()
            Text("\(passport.unlocked) / \(passport.total)").font(.system(size: 18, weight: .bold))
            Text(snapshot.labels.passportProgress).font(.system(size: 10)).lineLimit(1)
          }
        default:
          VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: snapshot.labels.passport)
            Spacer(minLength: 0)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
              Text("\(passport.unlocked)").font(.system(size: 40, weight: .bold, design: .serif)).foregroundColor(OYNOColor.gold)
              Text("/ \(passport.total)").font(.system(size: 18, weight: .semibold)).foregroundColor(OYNOColor.creamMuted)
            }
            HStack(spacing: 5) {
              ForEach(0..<max(passport.total, 0), id: \.self) { index in
                Circle()
                  .fill(index < passport.unlocked ? OYNOColor.gold : Color.clear)
                  .overlay(Circle().stroke(OYNOColor.gold.opacity(0.6), lineWidth: 1))
                  .frame(width: 8, height: 8)
              }
            }
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
      } else if family == .accessoryInline || family == .accessoryCircular {
        Text("◆ OYNO")
      } else {
        FallbackView(text: OYNOFallback.openApp)
      }
    }
    .widgetURL(oynoDeepLink(snapshot?.routes.passport ?? "/journey"))
    .oynoBackground()
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Active Guided Trail

struct TrailView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OYNOEntry

  var body: some View {
    let snapshot = (entry.snapshot?.isFresh ?? false) ? entry.snapshot : nil
    let trail = snapshot?.trail

    Group {
      if family == .accessoryRectangular {
        VStack(alignment: .leading, spacing: 1) {
          Text("◆ " + (snapshot?.labels.trail ?? "OYNO")).font(.system(size: 11, weight: .semibold)).widgetAccentable()
          Text(trail?.title ?? snapshot?.labels.noTrail ?? OYNOFallback.openApp).font(.system(size: 14, weight: .bold)).lineLimit(1)
          if let trail { Text("\(trail.completed) / \(trail.total)").font(.system(size: 11)) }
        }
      } else if let snapshot {
        VStack(alignment: .leading, spacing: 6) {
          Eyebrow(text: snapshot.labels.trail)
          Spacer(minLength: 0)
          if let trail {
            Text(trail.title).font(.system(size: 17, weight: .bold, design: .serif)).foregroundColor(OYNOColor.cream).lineLimit(2).minimumScaleFactor(0.8)
            GeometryReader { proxy in
              ZStack(alignment: .leading) {
                Capsule().fill(OYNOColor.cream.opacity(0.16))
                Capsule().fill(OYNOColor.gold).frame(width: proxy.size.width * CGFloat(trail.completed) / CGFloat(max(trail.total, 1)))
              }
            }
            .frame(height: 4)
            Text("\(trail.completed) / \(trail.total)").font(.system(size: 11, weight: .semibold)).foregroundColor(OYNOColor.creamMuted)
          } else {
            Text(snapshot.labels.noTrail).font(.system(size: 13, weight: .medium)).foregroundColor(OYNOColor.creamMuted).lineLimit(3)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else {
        FallbackView(text: OYNOFallback.openApp)
      }
    }
    .widgetURL(oynoDeepLink(snapshot?.routes.trail ?? "/explore"))
    .oynoBackground()
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Culture of the Day

struct CultureView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OYNOEntry

  var body: some View {
    let snapshot = (entry.snapshot?.isFresh ?? false) ? entry.snapshot : nil
    let culture = snapshot?.cultureOfDay

    Group {
      if let snapshot, let culture {
        VStack(alignment: .leading, spacing: 4) {
          Eyebrow(text: snapshot.labels.cultureOfDay)
          Spacer(minLength: 0)
          Text(culture.title).font(.system(size: family == .systemMedium ? 22 : 17, weight: .bold, design: .serif)).foregroundColor(OYNOColor.cream).lineLimit(2)
          if family == .systemMedium, let description = culture.description {
            Text(description).font(.system(size: 12)).foregroundColor(OYNOColor.creamMuted).lineLimit(2)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else {
        FallbackView(text: snapshot?.labels.openApp ?? OYNOFallback.openApp)
      }
    }
    .widgetURL(oynoDeepLink(snapshot?.routes.cultureOfDay ?? "/culture"))
    .oynoBackground()
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Widgets

struct DailyWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OYNODaily", provider: OYNOProvider()) { DailyView(entry: $0) }
      .configurationDisplayName(OYNOFallback.displayName("daily"))
      .description(OYNOFallback.description("daily"))
      .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
  }
}

struct JourneyWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OYNOJourney", provider: OYNOProvider()) { JourneyView(entry: $0) }
      .configurationDisplayName(OYNOFallback.displayName("journey"))
      .description(OYNOFallback.description("journey"))
      .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}

struct PassportWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OYNOPassport", provider: OYNOProvider()) { PassportView(entry: $0) }
      .configurationDisplayName(OYNOFallback.displayName("passport"))
      .description(OYNOFallback.description("passport"))
      .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct TrailWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OYNOTrail", provider: OYNOProvider()) { TrailView(entry: $0) }
      .configurationDisplayName(OYNOFallback.displayName("trail"))
      .description(OYNOFallback.description("trail"))
      .supportedFamilies([.systemSmall, .accessoryRectangular])
  }
}

struct CultureWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OYNOCulture", provider: OYNOProvider()) { CultureView(entry: $0) }
      .configurationDisplayName(OYNOFallback.displayName("culture"))
      .description(OYNOFallback.description("culture"))
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct OYNOWidgetBundle: WidgetBundle {
  var body: some Widget {
    DailyWidget()
    JourneyWidget()
    PassportWidget()
    TrailWidget()
    CultureWidget()
  }
}
