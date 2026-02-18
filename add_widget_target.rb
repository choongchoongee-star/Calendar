require 'xcodeproj'
require 'fileutils'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Update Main App Target
app_target = project.targets.find { |t| t.name == 'App' }
app_target.build_configuration_list.set_setting('PROVISIONING_PROFILE_SPECIFIER', 'Calendar')
app_target.build_configuration_list.set_setting('DEVELOPMENT_TEAM', 'XLFLVNJU9Q')
app_target.build_configuration_list.set_setting('CODE_SIGN_STYLE', 'Manual')

# 2. Add/Update Widget Target
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

widget_target = project.targets.find { |t| t.name == target_name }
if !widget_target
  widget_target = project.new_target(:app_extension, target_name, :ios, '17.0')
end

widget_target.product_name = target_name
widget_target.build_configuration_list.set_setting('PRODUCT_NAME', target_name)
widget_target.build_configuration_list.set_setting('PRODUCT_BUNDLE_IDENTIFIER', bundle_id)
widget_target.build_configuration_list.set_setting('INFOPLIST_FILE', 'App/WidgetSource/Info.plist')
widget_target.build_configuration_list.set_setting('SWIFT_VERSION', '5.0')
widget_target.build_configuration_list.set_setting('CODE_SIGN_STYLE', 'Manual')
widget_target.build_configuration_list.set_setting('DEVELOPMENT_TEAM', 'XLFLVNJU9Q')
widget_target.build_configuration_list.set_setting('PROVISIONING_PROFILE_SPECIFIER', 'Dangmoo Calendar Widget')
widget_target.build_configuration_list.set_setting('GENERATE_INFOPLIST_FILE', 'YES')

# 3. Critical Fix: Ensure File Reference is Absolute and in the correct Group
# Target path: ios/App/App/WidgetSource/
# Relative to Project Root (ios/App): App/WidgetSource/
file_name = 'CalendarWidget.swift'
file_rel_path = "App/WidgetSource/#{file_name}"

# Find the group
app_group = project.main_group.find_subpath('App', false) || project.main_group.new_group('App')
widget_group = app_group.find_subpath('WidgetSource', true)

# Remove any existing references to this file to avoid conflicts
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?(file_name) }.each(&:remove_from_project)

# Add new reference
file_ref = widget_group.new_reference(file_rel_path)
file_ref.last_known_file_type = 'sourcecode.swift'

# Add to compile sources
widget_target.source_build_phase.clear
widget_target.add_file_references([file_ref])

# 4. Link with Main App
if !app_target.dependencies.find { |d| d.target && d.target.name == target_name }
  app_target.add_dependency(widget_target)
end

# 5. Save
project.save
puts "Project updated successfully with absolute file mapping."
