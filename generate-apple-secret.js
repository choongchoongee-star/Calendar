const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

/**
 * --- APPLE CLIENT SECRET GENERATOR ---
 * 
 * 1. Your .p8 file is already in this folder: AuthKey_S8YXPF6KZ3.p8
 * 2. Run: node generate-apple-secret.js
 * 3. Copy the output into Supabase "Client Secret" field.
 */

// --- CONFIGURATION ---
const TEAM_ID = 'XLFLVNJU9Q';
const KEY_ID = 'S8YXPF6KZ3';
const SERVICES_ID = 'com.dangmoo.calendar.web';
const PRIVATE_KEY_FILENAME = 'AuthKey_S8YXPF6KZ3.p8';

// --- SCRIPT LOGIC ---
try {
    const privateKeyPath = path.join(__dirname, PRIVATE_KEY_FILENAME);
    
    if (!fs.existsSync(privateKeyPath)) {
        console.error(`\n❌ Error: File not found: ${PRIVATE_KEY_FILENAME}`);
        console.log(`Please ensure your .p8 file is in: ${__dirname}\n`);
        process.exit(1);
    }

    const privateKey = fs.readFileSync(privateKeyPath);

    const token = jwt.sign({}, privateKey, {
        algorithm: 'ES256',
        expiresIn: '180d', // 6 months (Maximum allowed by Apple)
        audience: 'https://appleid.apple.com',
        issuer: TEAM_ID,
        subject: SERVICES_ID,
        keyid: KEY_ID,
    });

    console.log("\n✅ SUCCESS! Copy the token below into the Supabase 'Client Secret' field:");
    console.log("\n-------------------------------------------------------------------------");
    console.log(token);
    console.log("-------------------------------------------------------------------------\n");
    console.log("⚠️ Remember: This token will expire in 6 months. You will need to regenerate it then.\n");

} catch (err) {
    console.error("\n❌ An error occurred during generation:");
    console.error(err.message);
    process.exit(1);
}
