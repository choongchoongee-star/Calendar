require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Targets
app_target = project.targets.find { |t| t.name == 'App' }
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

widget_target = project.targets.find { |t| t.name == target_name } || project.new_target(:app_extension, target_name, :ios, '17.0')

# 2. Target Settings
widget_target.product_name = target_name
[app_target, widget_target].each do |t|
  t.build_configuration_list.set_setting('DEVELOPMENT_TEAM', 'XLFLVNJU9Q')
  t.build_configuration_list.set_setting('CODE_SIGN_STYLE', 'Manual')
end

app_target.build_configuration_list.set_setting('PROVISIONING_PROFILE_SPECIFIER', 'Calendar')
widget_target.build_configuration_list.set_setting('PROVISIONING_PROFILE_SPECIFIER', 'Dangmoo Calendar Widget')
widget_target.build_configuration_list.set_setting('PRODUCT_BUNDLE_IDENTIFIER', bundle_id)
widget_target.build_configuration_list.set_setting('INFOPLIST_FILE', 'App/WidgetSource/Info.plist')
widget_target.build_configuration_list.set_setting('SWIFT_VERSION', '5.0')
widget_target.build_configuration_list.set_setting('GENERATE_INFOPLIST_FILE', 'YES')

# 3. Flat File Mapping
# We want: Main Group -> App -> WidgetSource
app_group = project.main_group['App'] || project.main_group.new_group('App', 'App')
widget_group = app_group['WidgetSource'] || app_group.new_group('WidgetSource', 'WidgetSource')

# Clear existing file refs to avoid duplicates or bad paths
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('CalendarWidget') }.each(&:remove_from_project)

# Add files relative to the WidgetSource group
# Physical path: ios/App/App/WidgetSource/CalendarWidget.swift
# Group hierarchy: (Project Root) / App / WidgetSource /
# So file path relative to widget_group is just the filename
swift_ref = widget_group.new_file('CalendarWidget.swift')
plist_ref = widget_group.new_file('Info.plist')

# 4. Build Phases
widget_target.source_build_phase.clear
widget_target.add_file_references([swift_ref])

# 5. Link
if !app_target.dependencies.find { |d| d.target && d.target.name == target_name }
  app_target.add_dependency(widget_target)
end

project.save
puts "Successfully mapped widget with flat group paths."
