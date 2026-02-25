import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridge)
public class WidgetBridge: CAPPlugin {
    @objc func setSelectedCalendar(_ call: CAPPluginCall) {
        let calendarId = call.getString("calendarId") ?? ""
        let calendarsJson = call.getString("calendarsJson") ?? "[]"
        let schedulesJson = call.getString("schedulesJson") ?? "[]"
        let authToken = call.getString("authToken") ?? ""
        let appGroup = "group.com.dangmoo.calendar"
        
        // 1. Save to UserDefaults for simple flags
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(calendarId, forKey: "selectedCalendarId")
            defaults.set(authToken, forKey: "supabaseAuthToken")
            defaults.synchronize()
        }

        // 2. Save large data to Shared File Container (More reliable than UserDefaults)
        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
            let calendarsURL = containerURL.appendingPathComponent("calendars.json")
            let schedulesURL = containerURL.appendingPathComponent("schedules.json")
            
            do {
                try calendarsJson.write(to: calendarsURL, atomically: true, encoding: .utf8)
                try schedulesJson.write(to: schedulesURL, atomically: true, encoding: .utf8)
                print("WIDGET_BRIDGE: Files written successfully to \(containerURL.path)")
            } catch {
                print("WIDGET_BRIDGE: ERROR writing files: \(error)")
            }
        } else {
            print("WIDGET_BRIDGE: ERROR - Could not find container URL for app group \(appGroup)")
        }
        
        // 3. Force Widget Refresh
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
