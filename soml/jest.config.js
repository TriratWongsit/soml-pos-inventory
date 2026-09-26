// ---------------------------------------------------------------------
// ชุดทดสอบแบ่งเป็นสองโครงการตามระดับในตารางที่ 3.22
//   unit        — ตรรกะภายในโมดูล ไม่แตะฐานข้อมูล            (backend/tests/unit)
//   integration — โมดูลทำงานร่วมกับฐานข้อมูลจริง soml_new_test (backend/tests/integration)
// ระดับที่สาม (ทดสอบระบบ) อยู่ที่ tests/system และรันแยกต่างหาก
// ---------------------------------------------------------------------
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/backend/tests/unit/**/*.test.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/backend/tests/integration/**/*.test.js'],
      // ตั้ง NODE_ENV=test ก่อนโหลดโมดูลใด เพราะ config/db.js เลือกฐานข้อมูลตอน require
      setupFiles: ['<rootDir>/backend/tests/integration/setup-env.js'],
      // รีเซ็ตฐาน soml_new_test จาก schema + seed ก่อนรันทั้งชุด
      globalSetup: '<rootDir>/backend/tests/integration/global-setup.js',
    },
  ],
  collectCoverageFrom: ['backend/**/*.js', 'print-service/**/*.js', '!backend/server.js', '!print-service/server.js', '!backend/tests/**'],
  coverageDirectory: 'coverage',
};
