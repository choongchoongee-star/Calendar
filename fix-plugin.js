const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, 'node_modules', '@capacitor-community', 'apple-sign-in', 'ios', 'Sources', 'SignInWithApple', 'Plugin.swift');

if (fs.existsSync(pluginPath)) {
    let content = fs.readFileSync(pluginPath, 'utf8');
    if (!content.includes('import Foundation')) {
        // Use standard newline escape
        content = content.replace('import Capacitor', 'import Capacitor\nimport Foundation');
        fs.writeFileSync(pluginPath, content);
        console.log('✅ Fixed apple-sign-in plugin (added Foundation import)');
    } else {
        console.log('ℹ️ apple-sign-in plugin already fixed');
    }
} else {
    console.log('ℹ️ apple-sign-in plugin not found, skipping fix');
}
