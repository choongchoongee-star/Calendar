//
//  CalendarWidget.swift
//  Dangmoo Calendar Widget
//

import WidgetKit
import SwiftUI

// MARK: - 1. Data Models
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

// MARK: - 2. Provider (iOS 16 Compatible)
struct Provider: TimelineProvider {
    let supabaseUrl = "https://rztrkeejliampmzcqbmx.supabase.co/rest/v1/schedules?select=*"
    let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dHJrZWVqbGlhbXBtemNxYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDE4MTksImV4cCI6MjA4NDY3NzgxOX0.ind5OQoPfWuAd_StssdeIDlrKxotW3XPhGOV63NqUWY"

    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(date: Date(), schedules: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> ()) {
        let entry = CalendarEntry(date: Date(), schedules: [])
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> ()) {
        Task {
            var schedules: [Schedule] = []
            if let url = URL(string: supabaseUrl) {
                var request = URLRequest(url: url)
                request.addValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
                request.addValue(supabaseKey, forHTTPHeaderField: "apikey")
                
                do {
                    let (data, _) = try await URLSession.shared.data(for: request)
                    schedules = try JSONDecoder().decode([Schedule].self, from: data)
                } catch {
                    print("Fetch failed: \(error)")
                }
            }

            let entry = CalendarEntry(date: Date(), schedules: schedules)
            let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

// MARK: - 3. Widget View
struct CalendarWidgetEntryView : View {
    var entry: Provider.Entry
    let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
    let days = ["일", "월", "화", "수", "목", "금", "토"]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(monthTitle(entry.date))
                    .font(.system(size: 16, weight: .bold))
                Spacer()
            }
            .padding(.bottom, 8)
            
            // Weekdays
            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(days, id: \.self) { day in
                    Text(day).font(.caption2).foregroundColor(.gray)
                }
            }
            
            // Grid
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(generateDays(for: entry.date), id: \.self) { date in
                    if let date = date {
                        VStack(spacing: 2) {
                            Text("\(Calendar.current.component(.day, from: date))")
                                .font(.caption)
                                .foregroundColor(Calendar.current.isDateInToday(date) ? .blue : .primary)
                                .fontWeight(Calendar.current.isDateInToday(date) ? .bold : .regular)
                            HStack(spacing: 2) {
                                ForEach(eventsFor(date: date).prefix(3)) { event in
                                    Circle().fill(Color(hex: event.color ?? "#47A9F3")).frame(width: 4, height: 4)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity).frame(height: 35)
                        .background(Color.gray.opacity(0.05)).cornerRadius(4)
                    } else {
                        Color.clear.frame(height: 35)
                    }
                }
            }
        }
        .padding()
        .applyContainerBackground() // Use helper for iOS 16/17 compatibility
    }
    
    func monthTitle(_ date: Date) -> String {
        let formatter = DateFormatter(); formatter.dateFormat = "yyyy년 M월"
        return formatter.string(from: date)
    }
    
    func generateDays(for date: Date) -> [Date?] {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: date)
        let firstDay = calendar.date(from: components)!
        let range = calendar.range(of: .day, in: .month, for: firstDay)!
        let firstWeekday = calendar.component(.weekday, from: firstDay)
        var days: [Date?] = Array(repeating: nil, count: firstWeekday - 1)
        for i in 0..<range.count {
            if let date = calendar.date(byAdding: .day, value: i, to: firstDay) { days.append(date) }
        }
        return days
    }
    
    func eventsFor(date: Date) -> [Schedule] {
        let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"
        let ds = formatter.string(from: date)
        return entry.schedules.filter { $0.start_date <= ds && $0.end_date >= ds }
    }
}

// Helper for iOS 17 vs older background
extension View {
    func applyContainerBackground() -> some View {
        if #available(iOS 17.0, *) {
            return self.containerBackground(for: .widget) { Color.white }
        } else {
            return self.background(Color.white)
        }
    }
}

@main
struct CalendarWidget: Widget {
    let kind: String = "CalendarWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            CalendarWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Dangmoo Calendar")
        .description("View your monthly schedules.")
        .supportedFamilies([.systemLarge])
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
