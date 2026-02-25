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
    static let allCalendarsJsonKey = "allCalendarsJson"
    static let cachedSchedulesJsonKey = "cachedSchedulesJson"
    static let authTokenKey = "supabaseAuthToken"
    
    static var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? UserDefaults.standard
    }
    
    static func getOffset() -> Int {
        sharedDefaults.integer(forKey: offsetKey)
    }
    
    static func setOffset(_ value: Int) {
        sharedDefaults.set(value, forKey: offsetKey)
    }

    static func getRecentCalendarId() -> String? {
        sharedDefaults.string(forKey: selectedCalendarKey)
    }
    
    static func getAuthToken() -> String? {
        sharedDefaults.string(forKey: authTokenKey)
    }
    
    static func getAllCalendars() -> [CalendarEntity] {
        let appGroup = "group.com.dangmoo.calendar"
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return [] }
        let fileURL = containerURL.appendingPathComponent("calendars.json")
        
        guard let data = try? Data(contentsOf: fileURL) else { 
            print("WIDGET_DEBUG: No calendars.json found at \(fileURL)")
            return [] 
        }
        do {
            let decoder = JSONDecoder()
            return try decoder.decode([CalendarEntity].self, from: data)
        } catch { 
            print("WIDGET_DEBUG: Calendars JSON parse failed: \(error)") 
        }
        return []
    }

    static func getCachedSchedules() -> [Schedule] {
        let appGroup = "group.com.dangmoo.calendar"
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return [] }
        let fileURL = containerURL.appendingPathComponent("schedules.json")
        
        guard let data = try? Data(contentsOf: fileURL) else { 
            print("WIDGET_DEBUG: No schedules.json found at \(fileURL)")
            return [] 
        }
        do {
            let decoder = JSONDecoder()
            return try decoder.decode([Schedule].self, from: data)
        } catch { 
            print("WIDGET_DEBUG: Schedules JSON parse failed: \(error)") 
        }
        return []
    }
}

// MARK: - 2. App Entities for Configuration
struct CalendarEntity: AppEntity, Identifiable, Decodable {
    var id: String
    var title: String
    
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "캘린더"
    static var defaultQuery = CalendarQuery()
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
    
    enum CodingKeys: String, CodingKey {
        case id, title
    }

    init(id: String, title: String) {
        self.id = id
        self.title = title
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Handle id as String or Int
        if let stringId = try? container.decode(String.self, forKey: .id) {
            self.id = stringId
        } else if let intId = try? container.decode(Int.self, forKey: .id) {
            self.id = String(intId)
        } else {
            // Default or throw
            self.id = ""
        }
        
        self.title = try container.decode(String.self, forKey: .title)
    }
}

struct CalendarQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [CalendarEntity] {
        let all = WidgetConstants.getAllCalendars()
        return all.filter { identifiers.contains($0.id) }
    }
    
    func suggestedEntities() async throws -> [CalendarEntity] {
        let all = WidgetConstants.getAllCalendars()
        if all.isEmpty {
            return [CalendarEntity(id: "default", title: "앱을 먼저 실행해주세요")]
        }
        return all
    }
    
    func entity(for identifier: String) async throws -> CalendarEntity? {
        if identifier == "default" { return nil }
        return WidgetConstants.getAllCalendars().first { $0.id == identifier }
    }
    
    func defaultResult() async -> CalendarEntity? {
        let all = WidgetConstants.getAllCalendars()
        if all.isEmpty { return nil }
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

    enum CodingKeys: String, CodingKey {
        case id, text, start_date, end_date, color
    }

    init(id: String, text: String, start_date: String, end_date: String, color: String?) {
        self.id = id
        self.text = text
        self.start_date = start_date
        self.end_date = end_date
        self.color = color
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Handle id as String or Int
        if let stringId = try? container.decode(String.self, forKey: .id) {
            self.id = stringId
        } else if let intId = try? container.decode(Int.self, forKey: .id) {
            self.id = String(intId)
        } else {
            self.id = ""
        }
        
        self.text = try container.decode(String.self, forKey: .text)
        self.start_date = try container.decode(String.self, forKey: .start_date)
        self.end_date = try container.decode(String.self, forKey: .end_date)
        self.color = try? container.decode(String.self, forKey: .color)
    }
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
    let supabaseBaseUrl = "https://SUPABASE_PROJECT_ID_REMOVED.supabase.co/rest/v1/schedules"
    let supabaseKey = "SUPABASE_ANON_KEY_REMOVED"

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
        
        let allCalendars = WidgetConstants.getAllCalendars()
        let recentId = WidgetConstants.getRecentCalendarId()

        let targetCalendar: CalendarEntity? = {
            if let configCal = configuration.calendar, configCal.id != "default" { return configCal }
            if let recentId = recentId, let found = allCalendars.first(where: { $0.id == recentId }) { return found }
            return allCalendars.first
        }()

        // Use cached schedules provided by the app (reliable method)
        let fetchedSchedules = WidgetConstants.getCachedSchedules()

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
        // Refresh every 30 minutes
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
            if family == .systemSmall {
                smallView
            } else {
                fullGridView
            }
        }
        .containerBackground(for: .widget) {
            colorScheme == .dark ? Color.black : Color.white
        }
    }

    var smallView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(monthAbbr(entry.date)).font(.system(size: 16, weight: .bold)).foregroundColor(.red)
                Spacer()
                if let title = entry.calendarTitle {
                    Text(title).font(.system(size: 9)).foregroundColor(.blue).lineLimit(1)
                }
            }
            Text("\(Calendar.current.component(.day, from: entry.date))").font(.system(size: 34, weight: .heavy))
            Spacer()
            let todayEvents = eventsFor(date: entry.date)
            if todayEvents.isEmpty {
                Text("일정 없음").font(.system(size: 11)).foregroundColor(.gray)
            } else {
                ForEach(todayEvents.prefix(2)) { ev in
                    Text(ev.text)
                        .font(.system(size: 10, weight: .medium))
                        .lineLimit(1)
                        .padding(.horizontal, 4)
                        .background(RoundedRectangle(cornerRadius: 2).fill(Color(hex: ev.color ?? "#5DA2D5").opacity(0.2)))
                        .foregroundColor(Color(hex: ev.color ?? "#5DA2D5"))
                }
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
                
                HStack(spacing: 14) {
                    // Deep link with date context
                    Link(destination: URL(string: "vibe://add?date=\(formatDate(entry.displayMonth))")!) {
                        Image(systemName: "plus").font(.system(size: 16, weight: .bold))
                    }
                    Button(intent: RefreshWidgetIntent()) {
                        Image(systemName: "arrow.clockwise").font(.system(size: 14, weight: .bold))
                    }
                }
                .foregroundColor(colorScheme == .dark ? .white : .black)
            }
            .padding(.bottom, 8)

            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(0..<7) { i in
                    Text(weekdays[i].prefix(1))
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(i == 0 ? .red : (i == 6 ? .blue : .gray))
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.bottom, 6)

            let days = generateDays(for: entry.displayMonth)
            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(0..<42, id: \.self) { index in
                    if index < days.count {
                        dateCell(days[index])
                            .border(Color.gray.opacity(0.1), width: 0.5)
                    } else {
                        Color.clear.frame(height: 38)
                    }
                }
            }
            .cornerRadius(4)
            .clipped()
        }
    }

    func monthAbbr(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR") // Month names can be localized
        f.dateFormat = "MMMM"
        return f.string(from: date)
    }
    
    func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX") // CRITICAL: Fixed format for comparison
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    func textColor(date: Date, isCurrentMonth: Bool, isSunday: Bool, isHoliday: Bool) -> Color {
        if !isCurrentMonth { return Color.gray.opacity(0.3) }
        if isToday(date) { return .white } // Contrast on red circle
        if isSunday || isHoliday { return .red }
        return colorScheme == .dark ? .white : .black
    }

    func isToday(_ date: Date) -> Bool {
        Calendar.current.isDateInToday(date)
    }

    func generateDays(for month: Date) -> [Date?] {
        let cal = Calendar.current
        guard let first = cal.date(from: cal.dateComponents([.year, .month], from: month)) else { return [] }
        let weekday = cal.component(.weekday, from: first)
        let prevMonthDays = weekday - 1
        guard let startOfGrid = cal.date(byAdding: .day, value: -prevMonthDays, to: first) else { return [] }
        var days: [Date?] = []
        for i in 0..<42 { days.append(cal.date(byAdding: .day, value: i, to: startOfGrid)) }
        return days
    }

    func eventsFor(date: Date) -> [Schedule] {
        let ds = formatDate(date)
        return (entry.holidays + entry.schedules).filter { 
            let start = String($0.start_date.prefix(10))
            let end = String($0.end_date.prefix(10))
            return start <= ds && end >= ds 
        }
    }

    func dateCell(_ date: Date?) -> some View {
        Group {
            if let date = date {
                Link(destination: URL(string: "vibe://date/\(formatDate(date))")!) {
                    VStack(spacing: 1) {
                        let isCurrentMonth = Calendar.current.isDate(date, equalTo: entry.displayMonth, toGranularity: .month)
                        let isTodayDate = isToday(date)
                        let isSunday = Calendar.current.component(.weekday, from: date) == 1
                        let holiday = entry.holidays.first(where: { isWithin(date: date, event: $0) })
                        
                        Text("\(Calendar.current.component(.day, from: date))")
                            .font(.system(size: 10, weight: isTodayDate ? .bold : .regular))
                            .foregroundColor(textColor(date: date, isCurrentMonth: isCurrentMonth, isSunday: isSunday, isHoliday: holiday != nil))
                            .frame(width: 20, height: 20)
                            .background(isTodayDate ? Circle().fill(Color.red) : nil)
                            .background(isTodayDate ? nil : (holiday != nil && isCurrentMonth ? Circle().fill(Color.red.opacity(0.1)) : nil))
                        
                        VStack(spacing: 1) {
                            let daySchedules = entry.schedules.filter { isWithin(date: date, event: $0) }
                            if isCurrentMonth {
                                ForEach(daySchedules.prefix(2)) { ev in
                                    RoundedRectangle(cornerRadius: 1)
                                        .fill(Color(hex: ev.color ?? "#5DA2D5"))
                                        .frame(height: 2)
                                        .padding(.horizontal, 2)
                                }
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .contentShape(Rectangle())
                }
            } else {
                Color.clear.frame(height: 38)
            }
        }
    }

    func isWithin(date: Date, event: Schedule) -> Bool {
        let ds = formatDate(date)
        let eventStart = String(event.start_date.prefix(10))
        let eventEnd = String(event.end_date.prefix(10))
        return eventStart <= ds && eventEnd >= ds
    }
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
