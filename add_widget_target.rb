require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Target Discovery
app_target = project.targets.find { |t| t.name == 'App' }
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

# Delete old target if it exists to ensure a clean slate
existing_widget = project.targets.find { |t| t.name == target_name }
existing_widget.remove_from_project if existing_widget

# Create new Widget target
widget_target = project.new_target(:app_extension, target_name, :ios, '16.0')
widget_target.product_name = target_name

# 2. Get Versions from App Target
app_config = app_target.build_configurations.first
m_version = app_config.build_settings['MARKETING_VERSION'] || '1.0.0'

# 3. Apply Build Settings
[app_target, widget_target].each do |target|
  target.build_configurations.each do |config|
    config.build_settings['DEVELOPMENT_TEAM'] = 'XLFLVNJU9Q'
    config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    config.build_settings['MARKETING_VERSION'] = m_version
  end
end

widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Dangmoo Calendar Widget'
  config.build_settings['INFOPLIST_FILE'] = 'App/WidgetSource/Info.plist'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/WidgetSource/CalendarWidget.entitlements'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO' # Use our manual file
end

app_target.build_configurations.each do |config|
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Calendar'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end

# 4. Link Frameworks (Explicitly)
widget_target.add_system_frameworks(['WidgetKit', 'SwiftUI', 'AppIntents'])

# 5. File Mapping (Fixed Paths)
# Relative to Project Root (ios/App): App/WidgetSource/
app_group = project.main_group['App'] || project.main_group.new_group('App', 'App')
widget_group = app_group['WidgetSource'] || app_group.new_group('WidgetSource', 'WidgetSource')

# Clear old file references to avoid duplicates
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('CalendarWidget') }.each(&:remove_from_project)

swift_ref = widget_group.new_file('CalendarWidget.swift')
ent_ref = widget_group.new_file('CalendarWidget.entitlements')

widget_target.source_build_phase.add_file_reference(swift_ref)

# 6. Re-configure Embedding Phase
# Remove existing embedding phases to be sure
app_target.copy_files_build_phases.select { |p| p.name == 'Embed App Extensions' }.each(&:remove_from_project)

embed_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.symbol_dst_subfolder_spec = :plug_ins
build_file = embed_phase.add_file_reference(widget_target.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# 7. Add Dependency
app_target.add_dependency(widget_target)

project.save
puts "Successfully applied comprehensive widget fix (Frameworks + Paths + Versioning)."
