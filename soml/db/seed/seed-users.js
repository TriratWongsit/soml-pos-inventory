// ---------------------------------------------------------------------
// สร้างบัญชีผู้ใช้ตั้งต้นของร้าน                        [FR-01 · 3.3.1 · 2.1.7]
//
// ทำไมเป็นสคริปต์ Node ไม่ใช่ SQL: users.password_hash ต้องเป็นผลของ bcrypt
// ซึ่งคำนวณใน SQL ล้วนไม่ได้ และห้ามมีรหัสผ่านจริงอยู่ในไฟล์ที่ commit
//
// วิธีใช้ (รันจากโฟลเดอร์ soml/)
//   SEED_PASSWORD='รหัสผ่านเริ่มต้น' npm run seed:users --workspace db
//   ไม่ตั้ง SEED_PASSWORD จะใช้ค่าปริยายสำหรับเครื่องพัฒนาเท่านั้น
//
// รันซ้ำได้: บัญชีที่มีอยู่แล้วจะถูกตั้งรหัสผ่านและบทบาทใหม่ตามรายการนี้
// ---------------------------------------------------------------------
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// ผู้ใช้จริงของร้าน (รายชื่อจากเจ้าของโครงงาน 16 ก.ย. 69)
// ชื่อผู้ใช้ตั้งจากชื่อจริงเพื่อให้ประวัติการทำรายการอ่านออกว่าใครทำ
const USERS = [
  { username: 'siriphan', full_name: 'ศริพรรณ ศิริกันทา', role: 'sales' },
  { username: 'somporn',  full_name: 'สมพร เขียวแก้ว',     role: 'sales' },
  { username: 'santi',    full_name: 'สันติ ศิริกันทา',     role: 'warehouse' },
  { username: 'ning',     full_name: 'นิ้ง',               role: 'manager' },
];

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';
// ค่า cost 10 ตามคำแนะนำของ bcrypt สำหรับเครื่องทั่วไป (ช้าพอกันเดา แต่ล็อกอินไม่หน่วง)
const BCRYPT_COST = 10;

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'soml_new',
  });

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_COST);
  for (const u of USERS) {
    await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
                               full_name = VALUES(full_name),
                               role = VALUES(role),
                               is_active = TRUE`,
      [u.username, hash, u.full_name, u.role]
    );
    console.log(`${u.role.padEnd(9)} ${u.username.padEnd(10)} ${u.full_name}`);
  }
  await conn.end();
  console.log(`\nสร้าง/อัปเดต ${USERS.length} บัญชี — รหัสผ่านเริ่มต้นถูกตั้งแล้ว ควรเปลี่ยนก่อนใช้งานจริง`);
}

main().catch((err) => {
  console.error('seed ผู้ใช้ไม่สำเร็จ:', err.message);
  process.exit(1);
});
