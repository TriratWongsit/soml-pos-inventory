// รีเซ็ตฐานทดสอบ soml_new_test จาก schema + seed ก่อนรันชุดทดสอบการรวมส่วนทั้งชุด
// เพื่อให้ผลทดสอบเหมือนเดิมทุกครั้งและไม่กระทบฐานใช้งาน (ตารางที่ 3.22 ระดับ 2)
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = async () => {
  const root = path.join(__dirname, '..', '..', '..');
  execFileSync('bash', [path.join(root, 'db', 'reset-db.sh'), 'test'], { cwd: root, stdio: 'pipe' });
};
