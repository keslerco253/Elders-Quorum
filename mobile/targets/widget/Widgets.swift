import SwiftUI
import WidgetKit

// My Ward Link's home-screen (and lock-screen) widget: this Sunday's lesson,
// this week's Come, Follow Me reading, the next event and unread messages.
// The app saves a key for it in the shared App Group; the widget asks the
// website for the latest (/api/widget) about every half hour.

let appGroup = "group.com.MyWardLink.app"

struct WardData: Codable {
  struct Lesson: Codable {
    let org: String
    let when: String
    let title: String
    let subtitle: String
    let path: String
  }
  struct Study: Codable {
    let reading: String
    let theme: String
    let path: String
  }
  struct Event: Codable {
    let title: String
    let when: String
    let path: String
  }
  let ward: String
  let lesson: Lesson?
  let study: Study?
  let event: Event?
  /// The next few events (missing from data saved by older versions).
  let events: [Event]?
  let unread: Int

  var upcoming: [Event] {
    if let events, !events.isEmpty { return events }
    return event.map { [$0] } ?? []
  }

  static let sample = WardData(
    ward: "Maple Grove Ward",
    lesson: Lesson(org: "Elders Quorum", when: "This Sunday", title: "Faith in Jesus Christ", subtitle: "", path: "/lessons"),
    study: Study(reading: "Genesis 1–2; Moses 2–3", theme: "“In the Beginning God Created the Heaven and the Earth”", path: "/"),
    event: Event(title: "Ward chili cook-off", when: "Fri · 6:00 PM", path: "/calendar"),
    events: [
      Event(title: "Ward chili cook-off", when: "Fri · 6:00 PM", path: "/calendar"),
      Event(title: "Yard cleanup service project", when: "Sat, Oct 24 · 9:00 AM", path: "/calendar"),
    ],
    unread: 2
  )
}

enum WardState {
  case ready(WardData)
  case signedOut
  case unavailable
}

struct WardEntry: TimelineEntry {
  let date: Date
  let state: WardState
  let base: String
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> WardEntry {
    WardEntry(date: Date(), state: .ready(.sample), base: "https://mywardlink.net")
  }

  func getSnapshot(in context: Context, completion: @escaping (WardEntry) -> Void) {
    if context.isPreview {
      completion(placeholder(in: context))
      return
    }
    load(completion)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<WardEntry>) -> Void) {
    load { entry in
      completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60))))
    }
  }

  private func load(_ done: @escaping (WardEntry) -> Void) {
    let defaults = UserDefaults(suiteName: appGroup)
    let base = defaults?.string(forKey: "appUrl") ?? "https://mywardlink.net"
    let cached: () -> WardData? = {
      guard let data = defaults?.data(forKey: "lastData") else { return nil }
      return try? JSONDecoder().decode(WardData.self, from: data)
    }
    guard let key = defaults?.string(forKey: "widgetKey"), !key.isEmpty, let url = URL(string: base + "/api/widget") else {
      done(WardEntry(date: Date(), state: .signedOut, base: base))
      return
    }
    var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
    request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
    URLSession.shared.dataTask(with: request) { data, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      if status == 401 {
        defaults?.removeObject(forKey: "lastData")
        done(WardEntry(date: Date(), state: .signedOut, base: base))
        return
      }
      if status == 200, let data, let ward = try? JSONDecoder().decode(WardData.self, from: data) {
        defaults?.set(data, forKey: "lastData")
        done(WardEntry(date: Date(), state: .ready(ward), base: base))
        return
      }
      // Offline or the site is busy: show the last we had.
      if let ward = cached() {
        done(WardEntry(date: Date(), state: .ready(ward), base: base))
      } else {
        done(WardEntry(date: Date(), state: .unavailable, base: base))
      }
    }.resume()
  }
}

// MARK: - Views

private let text = Color("WardText")
private let muted = Color("WardMuted")
private let accent = Color("WardAccent")

func link(_ base: String, _ path: String) -> URL? {
  URL(string: base + path)
}

struct Header: View {
  let data: WardData
  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "house.fill").font(.caption2).foregroundStyle(accent)
      Text(data.ward).font(.caption2.weight(.semibold)).foregroundStyle(muted).lineLimit(1)
      Spacer(minLength: 2)
      if data.unread > 0 {
        Text("\(min(data.unread, 99))")
          .font(.caption2.weight(.bold))
          .foregroundStyle(.white)
          .padding(.horizontal, 6)
          .padding(.vertical, 1)
          .background(Capsule().fill(Color("WardBadge")))
          .accessibilityLabel("\(data.unread) unread")
      }
    }
  }
}

struct Row: View {
  let icon: String
  let label: String
  let title: String
  let detail: String
  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: icon).font(.footnote).foregroundStyle(accent).frame(width: 18)
      VStack(alignment: .leading, spacing: 1) {
        Text(label).font(.caption2).foregroundStyle(muted).lineLimit(1)
        Text(title).font(.footnote.weight(.semibold)).foregroundStyle(text).lineLimit(1)
        if !detail.isEmpty {
          Text(detail).font(.caption2).foregroundStyle(muted).lineLimit(1)
        }
      }
      Spacer(minLength: 0)
    }
  }
}

struct Message: View {
  let title: String
  let detail: String
  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Image(systemName: "house.fill").foregroundStyle(accent)
      Text(title).font(.footnote.weight(.semibold)).foregroundStyle(text)
      Text(detail).font(.caption2).foregroundStyle(muted)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct SmallView: View {
  let data: WardData
  let base: String
  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Header(data: data)
      Spacer(minLength: 2)
      if let l = data.lesson {
        Text(l.when.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(accent)
        Text(l.title).font(.subheadline.weight(.semibold)).foregroundStyle(text).lineLimit(3).minimumScaleFactor(0.85)
        Text(l.subtitle.isEmpty ? l.org : l.subtitle).font(.caption2).foregroundStyle(muted).lineLimit(1)
      } else if let s = data.study {
        Text("COME, FOLLOW ME").font(.caption2.weight(.semibold)).foregroundStyle(accent)
        Text(s.reading).font(.subheadline.weight(.semibold)).foregroundStyle(text).lineLimit(3).minimumScaleFactor(0.85)
      } else if let e = data.event {
        Text("NEXT UP").font(.caption2.weight(.semibold)).foregroundStyle(accent)
        Text(e.title).font(.subheadline.weight(.semibold)).foregroundStyle(text).lineLimit(3)
        Text(e.when).font(.caption2).foregroundStyle(muted)
      } else {
        Text("Nothing coming up").font(.footnote).foregroundStyle(muted)
      }
    }
    .widgetURL(link(base, data.lesson?.path ?? data.study?.path ?? data.event?.path ?? "/"))
  }
}

struct MediumView: View {
  let data: WardData
  let base: String
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Header(data: data)
      if let l = data.lesson, let url = link(base, l.path) {
        Link(destination: url) {
          Row(icon: "book.fill", label: "\(l.when) · \(l.org)", title: l.title, detail: l.subtitle)
        }
      }
      if let s = data.study, let url = link(base, s.path) {
        Link(destination: url) {
          Row(icon: "books.vertical.fill", label: "Come, Follow Me this week", title: s.reading, detail: "")
        }
      }
      if let e = data.event, let url = link(base, e.path) {
        Link(destination: url) {
          Row(icon: "calendar", label: e.when, title: e.title, detail: "")
        }
      }
      if data.lesson == nil && data.study == nil && data.event == nil {
        Text("Nothing coming up").font(.footnote).foregroundStyle(muted)
      }
      Spacer(minLength: 0)
    }
    .widgetURL(link(base, "/"))
  }
}

struct SectionLabel: View {
  let text: String
  var body: some View {
    Text(text.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(accent)
  }
}

struct LargeView: View {
  let data: WardData
  let base: String
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Header(data: data)
      if let l = data.lesson, let url = link(base, l.path) {
        Link(destination: url) {
          VStack(alignment: .leading, spacing: 2) {
            SectionLabel(text: "\(l.when) · \(l.org)")
            Text(l.title).font(.headline).foregroundStyle(text).lineLimit(2)
            if !l.subtitle.isEmpty {
              Text(l.subtitle).font(.caption).foregroundStyle(muted).lineLimit(1)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
      if let s = data.study, let url = link(base, s.path) {
        Link(destination: url) {
          VStack(alignment: .leading, spacing: 2) {
            SectionLabel(text: "Come, Follow Me this week")
            Text(s.reading).font(.subheadline.weight(.semibold)).foregroundStyle(text).lineLimit(2)
            if !s.theme.isEmpty {
              Text(s.theme).font(.caption).foregroundStyle(muted).lineLimit(2)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
      if !data.upcoming.isEmpty {
        VStack(alignment: .leading, spacing: 6) {
          SectionLabel(text: "Coming up")
          ForEach(Array(data.upcoming.prefix(3).enumerated()), id: \.offset) { _, e in
            if let url = link(base, e.path) {
              Link(destination: url) {
                Row(icon: "calendar", label: e.when, title: e.title, detail: "")
              }
            }
          }
        }
      }
      if data.lesson == nil && data.study == nil && data.upcoming.isEmpty {
        Text("Nothing coming up").font(.footnote).foregroundStyle(muted)
      }
      Spacer(minLength: 0)
      if data.unread > 0, let url = link(base, "/messages") {
        Link(destination: url) {
          HStack(spacing: 6) {
            Image(systemName: "bubble.left.fill").font(.footnote).foregroundStyle(accent)
            Text(data.unread == 1 ? "1 new message or notification" : "\(data.unread) new messages and notifications")
              .font(.caption.weight(.semibold)).foregroundStyle(text)
          }
        }
      }
    }
    .widgetURL(link(base, "/"))
  }
}

struct LockScreenView: View {
  let data: WardData
  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      if let l = data.lesson {
        Text(l.when).font(.caption2.weight(.semibold))
        Text(l.title).font(.caption).lineLimit(2)
      } else if let s = data.study {
        Text("Come, Follow Me").font(.caption2.weight(.semibold))
        Text(s.reading).font(.caption).lineLimit(2)
      } else if let e = data.event {
        Text(e.when).font(.caption2.weight(.semibold))
        Text(e.title).font(.caption).lineLimit(2)
      } else {
        Text("My Ward Link").font(.caption2.weight(.semibold))
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct WardWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: WardEntry

  var body: some View {
    Group {
      switch entry.state {
      case .ready(let data):
        switch family {
        case .systemMedium: MediumView(data: data, base: entry.base)
        case .systemLarge: LargeView(data: data, base: entry.base)
        case .accessoryRectangular: LockScreenView(data: data)
        default: SmallView(data: data, base: entry.base)
        }
      case .signedOut:
        Message(title: "My Ward Link", detail: "Open the app and sign in to see your ward here.")
      case .unavailable:
        Message(title: "My Ward Link", detail: "Couldn't load your ward. It will try again soon.")
      }
    }
    .containerBackground(for: .widget) { Color("WardBackground") }
  }
}

struct WardWidget: Widget {
  let kind = "WardWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      WardWidgetView(entry: entry)
    }
    .configurationDisplayName("My Ward Link")
    .description("This Sunday's lesson, this week's Come, Follow Me, and what's coming up.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
  }
}

@main
struct WardWidgets: WidgetBundle {
  var body: some Widget {
    WardWidget()
  }
}
