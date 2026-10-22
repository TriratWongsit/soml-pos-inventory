// ---------------------------------------------------------------------
// การตั้งค่าชุดทดสอบ แบ่งเป็นสองโครงการตามระดับการทดสอบในตารางที่ 3.23
//   unit        — ทดสอบฟังก์ชันย่อย ไม่ต้องพึ่งฐานข้อมูล
//   integration — ทดสอบการทำงานร่วมกันผ่าน HTTP และฐานข้อมูล soml_test
// ---------------------------------------------------------------------
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/backend/__tests__/unit/**/*.test.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/backend/__tests__/integration/**/*.test.js'],
      // ต้องตั้ง NODE_ENV ก่อนโมดูลถูกโหลด เพราะ config/db.js เลือกฐานข้อมูล
      // ตามค่านี้ตั้งแต่ตอน require ครั้งแรก
      setupFiles: ['<rootDir>/backend/__tests__/integration/setup-env.js'],
      globalSetup: '<rootDir>/backend/__tests__/integration/global-setup.js',
    },
  ],
  collectCoverageFrom: [
    'backend/**/*.js',
    'print-service/**/*.js',
    // ไฟล์เปิดเซิร์ฟเวอร์ไม่นับ เพราะทดสอบผ่านการเรียกจริงในสคริปต์ทดสอบระบบแทน
    '!backend/server.js',
    '!print-service/server.js',
    '!backend/__tests__/**',
  ],
  coverageDirectory: 'evidence/coverage',
  // เกณฑ์ตามตารางที่ 3.23 — ความครอบคลุมโค้ดต้องไม่น้อยกว่าร้อยละ 70
  coverageThreshold: { global: { statements: 70, branches: 70, functions: 70, lines: 70 } },
};
