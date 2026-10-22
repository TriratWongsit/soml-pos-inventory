// ทดสอบระดับระบบบน Firefox เพื่อทวนสอบ NFR-07 (ผลเก็บแยกจากชุดหลักที่รันบน Chromium)
const base = require('./playwright.config');
const { devices } = require('@playwright/test');
module.exports = {
  ...base,
  reporter: [['list'], ['json', { outputFile: 'evidence/system-test-firefox.json' }]],
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } }],
};
