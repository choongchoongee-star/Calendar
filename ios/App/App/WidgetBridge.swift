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
        
        // 1. Primary Sync: UserDefaults
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(calendarId, forKey: "selectedCalendarId")
            defaults.set(authToken, forKey: "supabaseAuthToken")
            defaults.set(calendarsJson, forKey: "allCalendarsJson")
            defaults.set(schedulesJson, forKey: "cachedSchedulesJson")
            defaults.synchronize()
            print("WIDGET_BRIDGE: Saved to UserDefaults")
        }

        // 2. Secondary Sync: Shared File Container (Backup)
        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
            let calURL = containerURL.appendingPathComponent("cals_backup.json")
            let schURL = containerURL.appendingPathComponent("schs_backup.json")
            try? calendarsJson.write(to: calURL, atomically: true, encoding: .utf8)
            try? schedulesJson.write(to: schURL, atomically: true, encoding: .utf8)
            print("WIDGET_BRIDGE: Saved to Shared Files")
        }

        // 3. Force Widget Refresh on Main Thread
        DispatchQueue.main.async {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
