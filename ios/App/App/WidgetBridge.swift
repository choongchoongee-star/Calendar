import Foundation
import Capacitor

@objc(WidgetBridge)
public class WidgetBridge: CAPPlugin {
    @objc func setSelectedCalendar(_ call: CAPPluginCall) {
        let calendarId = call.getString("calendarId") ?? ""
        let calendars = call.getArray("calendars", [String: String].self) ?? []
        let appGroup = "group.com.dangmoo.calendar"
        
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(calendarId, forKey: "selectedCalendarId")
            defaults.set(calendars, forKey: "allCalendars")
            defaults.synchronize()
            call.resolve()
        } else {
            call.reject("Could not access App Group")
        }
    }
}
