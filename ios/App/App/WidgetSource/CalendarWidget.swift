//
//  CalendarWidget.swift
//  Dangmoo Calendar Widget
//

import WidgetKit
import SwiftUI

// MARK: - Data Models
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
}

// MARK: - Provider
struct Provider: TimelineProvider {
    let supabaseUrl = "https://rztrkeejliampmzcqbmx.supabase.co/rest/v1/schedules?select=*"
    let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dHJrZWVqbGlhbXBtemNxYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDE4MTksImV4cCI6MjA4NDY3NzgxOX0.ind5OQoPfWuAd_StssdeIDlrKxotW3XPhGOV63NqUWY"

    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(date: Date(), schedules: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> ()) {
        completion(CalendarEntry(date: Date(), schedules: []))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> ()) {
        Task {
            var schedules: [Schedule] = []
            if let url = URL(string: supabaseUrl) {
                var request = URLRequest(url: url)
                request.timeoutInterval = 15
                request.addValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
                request.addValue(supabaseKey, forHTTPHeaderField: "apikey")
                do {
                    let (data, _) = try await URLSession.shared.data(for: request)
                    schedules = try JSONDecoder().decode([Schedule].self, from: data)
                } catch { print("Fetch error: \(error)") }
            }
            let entry = CalendarEntry(date: Date(), schedules: schedules)
            let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }
}

// MARK: - Main Monthly View
struct CalendarWidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        VStack(spacing: 0) {
            if family == .systemSmall {
                smallView
            } else {
                monthlyGrid
            }
        }
        .padding()
        .applyContainerBackground()
    }

    var smallView: some View {
        VStack(alignment: .leading) {
            Text(entry.date, format: .dateTime.day().month()).font(.headline)
            Spacer()
            let todayStr = formatDate(entry.date)
            let todayEvents = entry.schedules.filter { $0.start_date <= todayStr && $0.end_date >= todayStr }
            Text(todayEvents.isEmpty ? "일정 없음" : "\(todayEvents.count)개의 일정").font(.system(size: 12))
        }
        .widgetURL(URL(string: "vibe://date/\(formatDate(entry.date))"))
    }

    var monthlyGrid: some View {
        VStack(spacing: 0) {
            HStack {
                Text(monthTitle(entry.date)).font(.system(size: 16, weight: .bold))
                Spacer()
            }.padding(.bottom, 8)
            
            let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(generateDays(for: entry.date), id: \.self) { date in
                    if let date = date {
                        dateCell(date)
                    } else { Color.clear.frame(height: 30) }
                }
            }
        }
    }

    func dateCell(_ date: Date) -> some View {
        VStack(spacing: 2) {
            Text("\(Calendar.current.component(.day, from: date))")
                .font(.system(size: 10))
                .foregroundColor(Calendar.current.isDateInToday(date) ? .blue : .primary)
            HStack(spacing: 1) {
                ForEach(eventsFor(date: date).prefix(3)) { ev in
                    Circle().fill(Color(hex: ev.color ?? "#47A9F3")).frame(width: 3, height: 3)
                }
            }
        }
        .frame(maxWidth: .infinity).frame(height: 30)
        .background(Color.gray.opacity(0.05)).cornerRadius(4)
        .widgetURL(URL(string: "vibe://date/\(formatDate(date))"))
    }

    func monthTitle(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy년 M월"; return f.string(from: date)
    }
    
    func formatDate(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }

    func generateDays(for date: Date) -> [Date?] {
        let cal = Calendar.current
        let first = cal.date(from: cal.dateComponents([.year, .month], from: date))!
        let range = cal.range(of: .day, in: .month, for: first)!
        let weekday = cal.component(.weekday, from: first)
        var days: [Date?] = Array(repeating: nil, count: weekday - 1)
        for i in 0..<range.count { days.append(cal.date(byAdding: .day, value: i, to: first)) }
        return days
    }

    func eventsFor(date: Date) -> [Schedule] {
        let ds = formatDate(date)
        return entry.schedules.filter { $0.start_date <= ds && $0.end_date >= ds }
    }
}

// MARK: - Simple Diagnostic Widget
struct StatusWidget: Widget {
    let kind: String = "StatusWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            Text("당무 캘린더 활성화됨")
                .font(.caption)
                .applyContainerBackground()
        }
        .configurationDisplayName("상태 확인")
        .description("위젯이 정상적으로 작동하는지 확인합니다.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Widget Bundle (The Entry Point)
@main
struct CalendarWidgetBundle: WidgetBundle {
    var body: some Widget {
        CalendarWidget()
        StatusWidget() // Added diagnostic widget
    }
}

struct CalendarWidget: Widget {
    let kind: String = "CalendarWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            CalendarWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("당무 캘린더")
        .description("내 일정을 한눈에 확인하세요.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

extension View {
    func applyContainerBackground() -> some View {
        if #available(iOS 17.0, *) { return self.containerBackground(for: .widget) { Color.white } }
        else { return self.background(Color.white) }
    }
}

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
