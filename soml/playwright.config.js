// ---------------------------------------------------------------------
// การทดสอบระดับระบบ (System Testing) — ระดับที่สามของตารางที่ 3.22
//
//   npm run dev            เปิดระบบไว้ก่อน (หน้าจอ + หลังบ้าน + บริการพิมพ์)
//   npm run test:system    รันการทดสอบผ่านหน้าจอจริงด้วยเบราว์เซอร์
//
// ทดสอบผ่านสิ่งที่ผู้ใช้เห็นจริง ไม่ได้เรียกฟังก์ชันภายใน จึงตอบคำถามว่า
// "ผู้ใช้ทำงานจนจบกระบวนการได้หรือไม่" ตามที่ตารางที่ 3.22 กำหนด
//
// หน้าจอเปิดที่พอร์ตอื่นได้ด้วยตัวแปร SYSTEM_BASE_URL
// ---------------------------------------------------------------------
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/system',
  // เรียงทีละไฟล์ทีละข้อ เพราะการทดสอบสร้างคำสั่งซื้อจริงและตัดสต็อกจริง ลำดับจึงสำคัญ
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'evidence/system-test-result.json' }]],
  use: {
    baseURL: process.env.SYSTEM_BASE_URL || 'http://localhost:5173',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
