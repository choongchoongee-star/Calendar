require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Constants
target_name = 'CalendarWidget'
bundle_id = 'com.dangmoo.calendar.widget'
app_target = project.targets.find { |t| t.name == 'App' }

# 2. Reset Target
project.targets.select { |t| t.name == target_name }.each(&:remove_from_project)
widget_target = project.new_target(:app_extension, target_name, :ios, '17.0')
widget_target.product_name = target_name

# 3. Add to Products Group (CRITICAL)
products_group = project.main_group['Products'] || project.main_group.new_group('Products')
unless products_group.children.include?(widget_target.product_reference)
  products_group.children << widget_target.product_reference
end

# 4. Apply Build Settings
m_version = app_target.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0.0'

[app_target, widget_target].each do |target|
  target.build_configurations.each do |config|
    config.build_settings['DEVELOPMENT_TEAM'] = 'XLFLVNJU9Q'
    config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
    config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
    config.build_settings['MARKETING_VERSION'] = m_version
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
    
    if target.name == 'App'
      config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Calendar'
      config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
    else
      config.build_settings['PRODUCT_NAME'] = target_name
      config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
      config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Dangmoo Calendar Widget'
      config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/WidgetSource/CalendarWidget.entitlements'
      config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
      config.build_settings['INFOPLIST_FILE'] = 'App/WidgetSource/Info.plist'
      config.build_settings['SKIP_INSTALL'] = 'YES'
    end
  end
end

# 5. Link Files & Frameworks
widget_target.add_system_frameworks(['WidgetKit', 'SwiftUI', 'Foundation'])
app_group = project.main_group['App']
widget_group = app_group['WidgetSource'] || app_group.new_group('WidgetSource', 'WidgetSource')

# Add WidgetBridge.swift to App target
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('WidgetBridge.swift') }.each(&:remove_from_project)
bridge_ref = app_group.new_file('WidgetBridge.swift')
app_target.source_build_phase.add_file_reference(bridge_ref)

# Add CalendarWidget.swift to Widget target
project.objects.select { |obj| obj.isa == 'PBXFileReference' && obj.path && obj.path.include?('CalendarWidget.swift') }.each(&:remove_from_project)
swift_ref = widget_group.new_file('CalendarWidget.swift')
widget_target.source_build_phase.add_file_reference(swift_ref)

# 6. FORCE EMBEDDING (The Real Fix)
app_target.copy_files_build_phases.select { |p| p.name == 'Embed App Extensions' }.each(&:remove_from_project)
embed_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.symbol_dst_subfolder_spec = :plug_ins
embed_phase.dst_path = "" # Empty means "PlugIns" folder root

# Link the product output directly
build_file = embed_phase.add_file_reference(widget_target.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# 7. Add Dependency
app_target.add_dependency(widget_target)

project.save
puts "Successfully force-configured embedding phase for Build #48."
