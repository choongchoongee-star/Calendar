require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Define the Widget Target
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

# Check if target already exists to avoid duplicates
if project.targets.find { |t| t.name == target_name }
  puts "Widget target already exists. Skipping creation."
  exit 0
end

# 2. Add the Widget Target
widget_target = project.new_target(:app_extension, target_name, :ios, '17.0')
widget_target.product_name = target_name
widget_target.build_configuration_list.set_setting('PRODUCT_NAME', target_name)
widget_target.build_configuration_list.set_setting('PRODUCT_BUNDLE_IDENTIFIER', bundle_id)
widget_target.build_configuration_list.set_setting('INFOPLIST_FILE', 'App/WidgetSource/Info.plist')
widget_target.build_configuration_list.set_setting('SWIFT_VERSION', '5.0')
widget_target.build_configuration_list.set_setting('CODE_SIGN_STYLE', 'Manual')
widget_target.build_configuration_list.set_setting('DEVELOPMENT_TEAM', 'XLFLVNJU9Q')
widget_target.build_configuration_list.set_setting('GENERATE_INFOPLIST_FILE', 'YES')

# 3. Add Files to the Target
widget_group = project.main_group.find_subpath('App/WidgetSource', true)
file_ref = widget_group.new_file('CalendarWidget.swift')
widget_target.add_file_references([file_ref]) # Add to Sources build phase

# 4. Link with Main App
project.targets.find { |t| t.name == 'App' }.add_dependency(widget_target)

# 5. Save
project.save
puts "Successfully added Widget target to Xcode project!"
