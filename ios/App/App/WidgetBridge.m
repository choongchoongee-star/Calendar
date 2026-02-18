#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WidgetBridge, "WidgetBridge",
  CAP_PLUGIN_METHOD(setSelectedCalendar, CAPPluginReturnPromise);
)
