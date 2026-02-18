import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridge)
public class WidgetBridge: CAPPlugin {
    @objc func setSelectedCalendar(_ call: CAPPluginCall) {
        let calendarId = call.getString("calendarId") ?? ""
        let calendars = call.getArray("calendars") ?? []
        let authToken = call.getString("authToken") ?? ""
        let appGroup = "group.com.dangmoo.calendar"
        
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(calendarId, forKey: "selectedCalendarId")
            defaults.set(authToken, forKey: "supabaseAuthToken")
            
            let sanitizedCalendars = calendars.compactMap { item -> [String: String]? in
                guard let dict = item as? [String: Any],
                      let id = dict["id"] as? String,
                      let title = dict["title"] as? String else { return nil }
                return ["id": id, "title": title]
            }
            
            defaults.set(sanitizedCalendars, forKey: "allCalendars")
            defaults.synchronize()
            
            // Critical: Inform the widget system to refresh immediately
            WidgetCenter.shared.reloadAllTimelines()
            
            call.resolve()
        } else {
            call.reject("Could not access App Group")
        }
    }
}
