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
        
        // Save everything to UserDefaults (Highest reliability for widgets)
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(calendarId, forKey: "selectedCalendarId")
            defaults.set(authToken, forKey: "supabaseAuthToken")
            defaults.set(calendarsJson, forKey: "allCalendarsJson")
            defaults.set(schedulesJson, forKey: "cachedSchedulesJson")
            defaults.synchronize()
            print("WIDGET_BRIDGE: Data saved to UserDefaults suite.")
        } else {
            print("WIDGET_BRIDGE: ERROR - Failed to access UserDefaults suite.")
        }

        // Force Widget Refresh
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
