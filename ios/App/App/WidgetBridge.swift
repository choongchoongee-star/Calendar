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
        
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(calendarId, forKey: "selectedCalendarId")
            defaults.set(authToken, forKey: "supabaseAuthToken")
            defaults.set(calendarsJson, forKey: "allCalendarsJson")
            defaults.set(schedulesJson, forKey: "cachedSchedulesJson")
            
            // Force synchronization for immediate widget access
            let success = defaults.synchronize()
            print("WIDGET_BRIDGE: Saved data. Calendars length: \(calendarsJson.count), Schedules length: \(schedulesJson.count), Sync Success: \(success)")
            
            // Trigger widget refresh
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve()
        } else {
            call.reject("Could not access App Group")
        }
    }
}
