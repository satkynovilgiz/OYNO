import SwiftUI
import WidgetKit

// MARK: - OYNO style (matches the in-app Widget Gallery)

enum OYNOColor {
  static let forest = Color(red: 0x13 / 255, green: 0x20 / 255, blue: 0x18 / 255)
  static let green = Color(red: 0x2F / 255, green: 0x52 / 255, blue: 0x33 / 255)
  static let cream = Color(red: 0xFB / 255, green: 0xF3 / 255, blue: 0xE3 / 255)
  static let gold = Color(red: 0xE8 / 255, green: 0xB9 / 255, blue: 0x3D / 255)
  static let creamMuted = cream.opacity(0.75)
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

/// One content card: eyebrow, serif title, optional subtitle.
struct CardText: View {
  let card: OYNOSnapshot.Card
  var titleSize: CGFloat = 16
  var titleLines: Int = 3

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Eyebrow(text: card.eyebrow)
      Text(card.title).font(.system(size: titleSize, weight: .bold, design: .serif)).foregroundColor(OYNOColor.cream).lineLimit(titleLines).minimumScaleFactor(0.8)
      if let subtitle = card.subtitle, !subtitle.isEmpty {
        Text(subtitle).font(.system(size: 11)).foregroundColor(OYNOColor.creamMuted).lineLimit(1)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

/// Bundled fallback - no snapshot yet, or it is from a past day.
struct FallbackView: View {
  let title: String
  let subtitle: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      OymoMark(size: 16)
      Spacer(minLength: 0)
      Text(title).font(.system(size: 17, weight: .bold, design: .serif)).foregroundColor(OYNOColor.cream).lineLimit(2)
      Text(subtitle).font(.system(size: 11)).foregroundColor(OYNOColor.creamMuted).lineLimit(2)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Today in OYNO (systemSmall + systemMedium, one responsive layout)

struct TodayView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OYNOEntry

  var body: some View {
    let snapshot = (entry.snapshot?.isCurrent ?? false) ? entry.snapshot : nil
    let primary = snapshot?.primary
    let fallbackTitle = snapshot?.labels.fallbackTitle ?? OYNOFallback.title
    let fallbackSubtitle = snapshot?.labels.fallbackSubtitle ?? OYNOFallback.subtitle

    Group {
      if family == .systemMedium {
        HStack(alignment: .top, spacing: 12) {
          Link(destination: oynoWidgetURL(primary?.url, size: "medium")) {
            if let primary {
              VStack(alignment: .leading) {
                Spacer(minLength: 0)
                CardText(card: primary, titleSize: 17)
              }
              .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            } else {
              FallbackView(title: fallbackTitle, subtitle: fallbackSubtitle)
            }
          }
          if let secondary = snapshot?.secondary {
            Link(destination: oynoWidgetURL(secondary.url, size: "medium")) {
              VStack(alignment: .leading) {
                Spacer(minLength: 0)
                CardText(card: secondary, titleSize: 13, titleLines: 3)
              }
              .padding(10)
              .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
              .background(RoundedRectangle(cornerRadius: 14).fill(OYNOColor.green))
            }
            .frame(width: 120)
          }
        }
      } else {
        if let primary {
          VStack(alignment: .leading) {
            OymoMark(size: 14)
            Spacer(minLength: 0)
            CardText(card: primary)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
          FallbackView(title: fallbackTitle, subtitle: fallbackSubtitle)
        }
      }
    }
    .widgetURL(oynoWidgetURL(primary?.url, size: family == .systemMedium ? "medium" : "small"))
    .oynoBackground()
  }
}

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OYNOToday", provider: OYNOProvider()) { TodayView(entry: $0) }
      .configurationDisplayName(OYNOFallback.displayName)
      .description(OYNOFallback.description)
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct OYNOWidgetBundle: WidgetBundle {
  var body: some Widget {
    TodayWidget()
  }
}
