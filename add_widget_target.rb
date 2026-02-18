require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Configuration
app_target = project.targets.find { |t| t.name == 'App' }
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'

# 2. Reset Widget Target
project.targets.select { |t| t.name == target_name }.each(&:remove_from_project)
widget_target = project.new_target(:app_extension, target_name, :ios, '16.0')
widget_target.product_name = target_name

# 3. Settings Lock
m_version = app_target.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0.0'

[app_target, widget_target].each do |target|
  target.build_configurations.each do |config|
    config.build_settings['DEVELOPMENT_TEAM'] = 'XLFLVNJU9Q'
    config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
    config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
    config.build_settings['MARKETING_VERSION'] = m_version
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    config.build_settings['ONLY_ACTIVE_ARCH'] = 'NO'
    
    if target.name == 'App'
      config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Calendar'
      config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
    else
      config.build_settings['PRODUCT_NAME'] = target_name
      config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
      config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Dangmoo Calendar Widget'
      config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/WidgetSource/CalendarWidget.entitlements'
      config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
      config.build_settings['INFOPLIST_KEY_NSExtensionPointIdentifier'] = 'com.apple.widgetkit-extension'
      config.build_settings['INFOPLIST_KEY_CFBundleDisplayName'] = '당무 캘린더'
      config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
      config.build_settings['SKIP_INSTALL'] = 'YES'
      config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
    end
  end
end

# 4. Linkages (Sources & Frameworks)
widget_target.add_system_frameworks(['WidgetKit', 'SwiftUI', 'Foundation'])
app_group = project.main_group['App']
widget_group = app_group['WidgetSource'] || app_group.new_group('WidgetSource', 'WidgetSource')

project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('CalendarWidget') }.each(&:remove_from_project)
swift_ref = widget_group.new_file('CalendarWidget.swift')
widget_target.source_build_phase.add_file_reference(swift_ref)

# Asset Linkage
assets_ref = app_group.find_file_by_path('Assets.xcassets')
widget_target.resources_build_phase.add_file_reference(assets_ref) if assets_ref

# 5. CRITICAL: Manual Embedding (PlugIns)
# Ensure product reference is clean
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path == "#{target_name}.appex" }.each(&:remove_from_project)

# Ensure "Embed App Extensions" phase exists and is tied to PlugIns
embed_phase = app_target.copy_files_build_phases.find { |p| p.name == 'Embed App Extensions' } || app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.symbol_dst_subfolder_spec = :plug_ins
embed_phase.dst_path = "" # Standard for PlugIns
embed_phase.clear # Start fresh

# Add the widget product reference to the embedding phase
build_file = embed_phase.add_file_reference(widget_target.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# 6. Final Linkage
app_target.add_dependency(widget_target)

project.save
puts "Successfully applied Ironclad Embedding Fix."
