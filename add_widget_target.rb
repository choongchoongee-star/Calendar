require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Target Definition
app_target = project.targets.find { |t| t.name == 'App' }
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

widget_target = project.targets.find { |t| t.name == target_name } || project.new_target(:app_extension, target_name, :ios, '17.0')

# 2. Universal Settings
[app_target, widget_target].each do |target|
  target.build_configurations.each do |config|
    config.build_settings['DEVELOPMENT_TEAM'] = 'XLFLVNJU9Q'
    config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
    config.build_settings['SWIFT_VERSION'] = '5.0'
  end
end

# 3. Widget Specific Settings
widget_target.product_name = target_name
widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_NAME'] = target_name
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Dangmoo Calendar Widget'
  config.build_settings['INFOPLIST_FILE'] = 'App/WidgetSource/Info.plist'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
end

# 4. App Specific Settings
app_target.build_configurations.each do |config|
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Calendar'
  config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'
end

# 5. File Mapping (Sources)
app_group = project.main_group['App'] || project.main_group.new_group('App', 'App')
widget_group = app_group['WidgetSource'] || app_group.new_group('WidgetSource', 'WidgetSource')

# Force remove old refs to fix path issues
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('CalendarWidget') }.each(&:remove_from_project)

swift_ref = widget_group.new_file('CalendarWidget.swift')
widget_target.source_build_phase.clear
widget_target.add_file_references([swift_ref])

# 6. Embedding
embed_extensions_phase = app_target.copy_files_build_phases.find { |p| p.name == 'Embed App Extensions' } || app_target.new_copy_files_build_phase('Embed App Extensions')
embed_extensions_phase.symbol_dst_subfolder_spec = :plug_ins
embed_extensions_phase.clear
build_file = embed_extensions_phase.add_file_reference(widget_target.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# 7. Dependency
if !app_target.dependencies.find { |d| d.target && d.target.name == target_name }
  app_target.add_dependency(widget_target)
end

project.save
puts "Successfully configured all targets with explicit SWIFT_VERSION and unique product names."
