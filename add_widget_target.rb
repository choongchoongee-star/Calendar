require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Targets
app_target = project.targets.find { |t| t.name == 'App' }
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

widget_target = project.targets.find { |t| t.name == target_name } || project.new_target(:app_extension, target_name, :ios, '17.0')

# 2. Settings
[app_target, widget_target].each do |t|
  t.build_configuration_list.set_setting('DEVELOPMENT_TEAM', 'XLFLVNJU9Q')
  t.build_configuration_list.set_setting('CODE_SIGN_STYLE', 'Manual')
end

app_target.build_configuration_list.set_setting('PROVISIONING_PROFILE_SPECIFIER', 'Calendar')
app_target.build_configuration_list.set_setting('ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES', 'YES')

widget_target.product_name = target_name
widget_target.build_configuration_list.set_setting('PRODUCT_BUNDLE_IDENTIFIER', bundle_id)
widget_target.build_configuration_list.set_setting('PROVISIONING_PROFILE_SPECIFIER', 'Dangmoo Calendar Widget')
widget_target.build_configuration_list.set_setting('INFOPLIST_FILE', 'App/WidgetSource/Info.plist')
widget_target.build_configuration_list.set_setting('SKIP_INSTALL', 'YES')

# 3. File Mapping (Sources)
app_group = project.main_group['App'] || project.main_group.new_group('App', 'App')
widget_group = app_group['WidgetSource'] || app_group.new_group('WidgetSource', 'WidgetSource')

project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('CalendarWidget.swift') }.each(&:remove_from_project)
swift_ref = widget_group.new_file('CalendarWidget.swift')

widget_target.source_build_phase.clear
widget_target.add_file_references([swift_ref])

# 4. CRITICAL: Embed Widget in App (Copy Files Phase)
# Find or create "Embed App Extensions" phase
embed_extensions_phase = app_target.copy_files_build_phases.find { |p| p.name == 'Embed App Extensions' }
if !embed_extensions_phase
  embed_extensions_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
  embed_extensions_phase.symbol_dst_subfolder_spec = :plug_ins
end

# Add widget to the embedding phase
if !embed_extensions_phase.files_references.include?(widget_target.product_reference)
  build_file = embed_extensions_phase.add_file_reference(widget_target.product_reference)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end

# 5. Link dependency
if !app_target.dependencies.find { |d| d.target && d.target.name == target_name }
  app_target.add_dependency(widget_target)
end

project.save
puts "Successfully configured widget with explicit embedding phase!"
