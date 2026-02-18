require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Target Discovery
app_target = project.targets.find { |t| t.name == 'App' }
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

# Ensure widget target exists
widget_target = project.targets.find { |t| t.name == target_name } || project.new_target(:app_extension, target_name, :ios, '16.0')
widget_target.product_name = target_name

# 2. Force Signing & Versioning for ALL configurations
m_version = app_target.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0.0'

widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_NAME'] = target_name
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Dangmoo Calendar Widget'
  config.build_settings['DEVELOPMENT_TEAM'] = 'XLFLVNJU9Q'
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  config.build_settings['INFOPLIST_FILE'] = 'App/WidgetSource/Info.plist'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/WidgetSource/CalendarWidget.entitlements'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['MARKETING_VERSION'] = m_version
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
end

app_target.build_configurations.each do |config|
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Calendar'
  config.build_settings['DEVELOPMENT_TEAM'] = 'XLFLVNJU9Q'
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
  config.build_settings['MARKETING_VERSION'] = m_version
end

# 3. Frameworks
widget_target.add_system_frameworks(['WidgetKit', 'SwiftUI', 'AppIntents'])

# 4. File Mapping (Ensure fresh references)
app_group = project.main_group['App'] || project.main_group.new_group('App', 'App')
widget_group = app_group['WidgetSource'] || app_group.new_group('WidgetSource', 'WidgetSource')

# Cleanup & Add
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('CalendarWidget') }.each(&:remove_from_project)
swift_ref = widget_group.new_file('CalendarWidget.swift')
ent_ref = widget_group.new_file('CalendarWidget.entitlements')

widget_target.source_build_phase.clear
widget_target.add_file_references([swift_ref])

# 5. Embedding (App Target)
app_target.copy_files_build_phases.select { |p| p.name == 'Embed App Extensions' }.each(&:remove_from_project)
embed_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.symbol_dst_subfolder_spec = :plug_ins
embed_phase.add_file_reference(widget_target.product_reference).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# 6. Dependency
app_target.add_dependency(widget_target) unless app_target.dependencies.find { |d| d.target && d.target.name == target_name }

project.save
puts "Project signing and embedding successfully locked for all configurations."
