//
//  CalendarWidget.swift
//  Dangmoo Calendar Widget
//

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - 1. Shared Constants & State
struct WidgetConstants {
    static let appGroup = "group.com.dangmoo.calendar"
    static let offsetKey = "widgetMonthOffset"
    static let selectedCalendarKey = "selectedCalendarId"
    static let allCalendarsKey = "allCalendars"
    static let authTokenKey = "supabaseAuthToken"
    
    static func getOffset() -> Int {
        UserDefaults(suiteName: appGroup)?.integer(forKey: offsetKey) ?? 0
    }
    
    static func setOffset(_ value: Int) {
        UserDefaults(suiteName: appGroup)?.set(value, forKey: offsetKey)
    }

    static func getRecentCalendarId() -> String? {
        UserDefaults(suiteName: appGroup)?.string(forKey: selectedCalendarKey)
    }
    
    static func getAuthToken() -> String? {
        UserDefaults(suiteName: appGroup)?.string(forKey: authTokenKey)
    }
    
    static func getAllCalendars() -> [CalendarEntity] {
        guard let raw = UserDefaults(suiteName: appGroup)?.array(forKey: allCalendarsKey) else { return [] }
        return raw.compactMap { item in
            // Use [String: Any] and safe casting for better resilience
            guard let dict = item as? [String: Any],
                  let id = dict["id"] as? String,
                  let title = dict["title"] as? String else { return nil }
            return CalendarEntity(id: id, title: title)
        }
    }
}

// MARK: - 2. App Entities for Configuration
struct CalendarEntity: AppEntity, Identifiable {
    var id: String
    var title: String
    
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "캘린더"
    static var defaultQuery = CalendarQuery()
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

struct CalendarQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [CalendarEntity] {
        let all = WidgetConstants.getAllCalendars()
        return all.filter { identifiers.contains($0.id) }
    }
    
    func suggestedEntities() async throws -> [CalendarEntity] {
        return WidgetConstants.getAllCalendars()
    }
    
    func entity(for identifier: String) async throws -> CalendarEntity? {
        return WidgetConstants.getAllCalendars().first { $0.id == identifier }
    }
    
    func defaultResult() async -> CalendarEntity? {
        let all = WidgetConstants.getAllCalendars()
        let recentId = WidgetConstants.getRecentCalendarId()
        return all.first { $0.id == recentId } ?? all.first
    }
}

// MARK: - 3. Data Models
struct Schedule: Decodable, Identifiable {
    let id: String
    let text: String
    let start_date: String
    let end_date: String
    let color: String?
}

struct CalendarEntry: TimelineEntry {
    let date: Date
    let schedules: [Schedule]
    let holidays: [Schedule]
    let displayMonth: Date
    let currentOffset: Int
    let calendarTitle: String?
}

// MARK: - 4. AppIntents for Interaction
struct ChangeMonthIntent: AppIntent {
    static var title: LocalizedStringResource = "달 이동"
    @Parameter(title: "Delta") var delta: Int
    init() {}
    init(delta: Int) { self.delta = delta }
    func perform() async throws -> some IntentResult {
        WidgetConstants.setOffset(WidgetConstants.getOffset() + delta)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct RefreshWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "위젯 새로고침"
    func perform() async throws -> some IntentResult {
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - 5. Configuration Intent
struct ConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "달력 설정"
    @Parameter(title: "표시할 캘린더") var calendar: CalendarEntity?
}

// MARK: - 6. Provider
struct Provider: AppIntentTimelineProvider {
    let supabaseBaseUrl = "https://rztrkeejliampmzcqbmx.supabase.co/rest/v1/schedules"
    let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dHJrZWVqbGlhbXBtemNxYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDE4MTksImV4cCI6MjA4NDY3NzgxOX0.ind5OQoPfWuAd_StssdeIDlrKxotW3XPhGOV63NqUWY"

    let holidayData = [
        ("2026-01-01", "2026-01-01", "신정"), ("2026-02-16", "2026-02-18", "설날"),
        ("2026-03-01", "2026-03-01", "삼일절"), ("2026-05-05", "2026-05-05", "어린이날"),
        ("2026-05-24", "2026-05-24", "부처님 오신 날"), ("2026-06-06", "2026-06-06", "현충일"),
        ("2026-08-15", "2026-08-15", "광복절"), ("2026-09-24", "2026-09-26", "추석"),
        ("2026-10-03", "2026-10-03", "개천절"), ("2026-10-09", "2026-10-09", "한글날"),
        ("2026-12-25", "2026-12-25", "성탄절")
    ]

    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(date: Date(), schedules: [], holidays: [], displayMonth: Date(), currentOffset: 0, calendarTitle: "캘린더")
    }

    func snapshot(for configuration: ConfigurationIntent, in context: Context) async -> CalendarEntry {
        CalendarEntry(date: Date(), schedules: [], holidays: [], displayMonth: Date(), currentOffset: 0, calendarTitle: "캘린더")
    }

    func timeline(for configuration: ConfigurationIntent, in context: Context) async -> Timeline<CalendarEntry> {
        let currentDate = Date()
        let offset = WidgetConstants.getOffset()
        let displayMonth = Calendar.current.date(byAdding: .month, value: offset, to: currentDate) ?? currentDate
        
        let targetCalendar = configuration.calendar ?? {
            let recentId = WidgetConstants.getRecentCalendarId()
            return WidgetConstants.getAllCalendars().first { $0.id == recentId }
        }()

        var fetchedSchedules: [Schedule] = []
        if let cal = targetCalendar {
            let urlStr = "\(supabaseBaseUrl)?calendar_id=eq.\(cal.id)&select=*"
            if let url = URL(string: urlStr) {
                var request = URLRequest(url: url)
                request.timeoutInterval = 10
                request.addValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
                request.addValue(supabaseKey, forHTTPHeaderField: "apikey")
                
                // Add Auth Token if available to bypass RLS
                if let token = WidgetConstants.getAuthToken(), !token.isEmpty {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                
                do {
                    let (data, _) = try await URLSession.shared.data(for: request)
                    fetchedSchedules = try JSONDecoder().decode([Schedule].self, from: data)
                } catch { print("Fetch error: \(error)") }
            }
        }

        let holidays = holidayData.map { h in
            Schedule(id: "h-\(h.0)", text: h.2, start_date: h.0, end_date: h.1, color: "#E74C3C")
        }
        
        let entry = CalendarEntry(
            date: currentDate, 
            schedules: fetchedSchedules, 
            holidays: holidays,
            displayMonth: displayMonth, 
            currentOffset: offset,
            calendarTitle: targetCalendar?.title
        )
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: currentDate)!
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
}

// MARK: - 7. Main View
struct CalendarWidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.widgetFamily) var family

    let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
    let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        VStack(spacing: 0) {
            if entry.calendarTitle == nil && family != .systemSmall {
                noCalendarView
            } else if family == .systemSmall {
                smallView
            } else {
                fullGridView
            }
        }
        .containerBackground(for: .widget) {
            colorScheme == .dark ? Color.black : Color.white
        }
    }

    var noCalendarView: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar.badge.exclamationmark").font(.largeTitle).foregroundColor(.gray)
            Text("캘린더를 선택해주세요").font(.headline)
            Text("위젯을 길게 눌러 편집하거나\n앱에서 캘린더를 열람하세요").font(.caption).multilineTextAlignment(.center).foregroundColor(.gray)
        }
    }

    var smallView: some View {
        VStack(alignment: .leading) {
            Text(monthAbbr(entry.date)).font(.system(size: 20, weight: .bold))
            Text("\(Calendar.current.component(.day, from: entry.date))").font(.system(size: 36, weight: .heavy))
            Spacer()
            if let title = entry.calendarTitle {
                Text(title).font(.system(size: 10, weight: .bold)).foregroundColor(.blue).lineLimit(1)
            }
            let todayEvents = eventsFor(date: entry.date)
            if let first = todayEvents.first {
                Text(first.text).font(.caption2).lineLimit(1).foregroundColor(Color(hex: first.color ?? "#5DA2D5"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(URL(string: "vibe://date/\(formatDate(entry.date))"))
    }

    var fullGridView: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    Text(monthAbbr(entry.displayMonth))
                        .font(.system(size: 18, weight: .bold))
                    if let title = entry.calendarTitle {
                        Text(title).font(.system(size: 9, weight: .bold)).foregroundColor(.blue).lineLimit(1)
                    }
                }
                .foregroundColor(colorScheme == .dark ? .white : .black)
                
                Spacer()
                
                HStack(spacing: 15) {
                    Button(intent: ChangeMonthIntent(delta: -1)) { Image(systemName: "chevron.left") }
                    Button(intent: ChangeMonthIntent(delta: 1)) { Image(systemName: "chevron.right") }
                }
                .font(.system(size: 14, weight: .bold))
                .tint(colorScheme == .dark ? .white : .black)

                Spacer()
                
                HStack(spacing: 12) {
                    Link(destination: URL(string: "vibe://add")!) {
                        Image(systemName: "plus").font(.system(size: 16, weight: .bold))
                    }
                    Button(intent: RefreshWidgetIntent()) {
                        Image(systemName: "arrow.clockwise").font(.system(size: 14, weight: .bold))
                    }
                }
                .foregroundColor(colorScheme == .dark ? .white : .black)
                .tint(colorScheme == .dark ? .white : .black)
            }
            .padding(.bottom, 12)

            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(0..<7) { i in
                    Text(weekdays[i])
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(i == 0 ? Color(hex: "#FF4D4D") : Color(hex: "#888888"))
                }
            }
            .padding(.bottom, 6)

            let days = generateDays(for: entry.displayMonth)
            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(0..<days.count, id: \.self) { index in
                    let date = days[index]
                    dateCell(date)
                        .border(Color(hex: "#333333").opacity(0.3), width: 0.5)
                }
            }
            .cornerRadius(8)
            .clipped()
        }
    }

    func dateCell(_ date: Date?) -> some View {
        VStack(spacing: 1) {
            if let date = date {
                let isCurrentMonth = Calendar.current.isDate(date, equalTo: entry.displayMonth, toGranularity: .month)
                let isToday = Calendar.current.isDateInToday(date)
                let isSunday = Calendar.current.component(.weekday, from: date) == 1
                let isHoliday = entry.holidays.contains(where: { isWithin(date: date, event: $0) })
                
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.system(size: 11, weight: isToday ? .bold : .regular))
                    .foregroundColor(textColor(date: date, isCurrentMonth: isCurrentMonth, isSunday: isSunday, isHoliday: isHoliday))
                    .frame(width: 20, height: 20)
                    .background(isToday ? Circle().fill(Color(hex: "#FF6B54")) : nil)
                
                VStack(spacing: 1) {
                    let dayHolidays = entry.holidays.filter { isWithin(date: date, event: $0) }
                    let daySchedules = entry.schedules.filter { isWithin(date: date, event: $0) }
                    
                    ForEach(dayHolidays.prefix(1)) { ev in
                         Text(ev.text)
                            .font(.system(size: 7, weight: .bold))
                            .padding(.horizontal, 2)
                            .background(RoundedRectangle(cornerRadius: 2).fill(Color(hex: "#E74C3C")))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                    ForEach(daySchedules.prefix(2 - dayHolidays.count)) { ev in
                        Text(ev.text)
                            .font(.system(size: 7))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 2)
                            .background(Color(hex: ev.color ?? "#5DA2D5"))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                    if dayHolidays.count + daySchedules.count > 2 {
                        Text("...")
                            .font(.system(size: 7))
                            .foregroundColor(.gray)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 40)
        .widgetURL(date != nil ? URL(string: "vibe://date/\(formatDate(date!))") : nil)
    }

    func isWithin(date: Date, event: Schedule) -> Bool {
        let ds = formatDate(date)
        return event.start_date <= ds && event.end_date >= ds
    }

    func monthAbbr(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "MMM"; return f.string(from: date).uppercased()
    }
    
    func formatDate(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }

    func textColor(date: Date, isCurrentMonth: Bool, isSunday: Bool, isHoliday: Bool) -> Color {
        if !isCurrentMonth { return Color(hex: "#444444") }
        if isSunday || isHoliday { return Color(hex: "#FF4D4D") }
        return colorScheme == .dark ? .white : .black
    }

    func generateDays(for month: Date) -> [Date?] {
        let cal = Calendar.current
        let first = cal.date(from: cal.dateComponents([.year, .month], from: month))!
        let weekday = cal.component(.weekday, from: first)
        let prevMonthDays = weekday - 1
        let startOfGrid = cal.date(byAdding: .day, value: -prevMonthDays, to: first)!
        var days: [Date?] = []
        for i in 0..<42 { days.append(cal.date(byAdding: .day, value: i, to: startOfGrid)) }
        return days
    }

    func eventsFor(date: Date) -> [Schedule] {
        let ds = formatDate(date)
        return (entry.holidays + entry.schedules).filter { $0.start_date <= ds && $0.end_date >= ds }
    }
}

// MARK: - 8. Entry Point
@main
struct CalendarWidgetBundle: WidgetBundle {
    var body: some Widget {
        CalendarWidget()
    }
}

struct CalendarWidget: Widget {
    let kind: String = "CalendarWidget"
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationIntent.self, provider: Provider()) { entry in
            CalendarWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("당무 캘린더")
        .description("Glassmorphism 스타일의 세련된 달력 위젯")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Extensions
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue:  Double(b) / 255, opacity: Double(a) / 255)
    }
}
