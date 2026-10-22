#!/usr/bin/env node
// ---------------------------------------------------------------------
// สร้างบัญชีผู้ใช้ทดสอบครบทั้งสามบทบาท   [FR-01 · UC-01]
//
// บัญชีผู้ใช้ต้องสร้างผ่านสคริปต์นี้ ไม่ใช่ผ่าน seed.sql เพราะรหัสผ่าน
// ต้องผ่านการเข้ารหัสด้วย bcrypt ก่อนบันทึกลงคอลัมน์ password_hash
//
//   node db/seed-users.js
// ---------------------------------------------------------------------
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';
const SALT_ROUNDS = 10;

const ACCOUNTS = [
  { username: 'sales01', full_name: 'สมชาย ใจดี', role: 'sales' },
  { username: 'wh01', full_name: 'ประเสริฐ ขยันงาน', role: 'warehouse' },
  { username: 'mgr01', full_name: 'อำพร เจ้าของร้าน', role: 'manager' },
];

async function main() {
  const database =
    process.env.NODE_ENV === 'test'
      ? process.env.DB_NAME_TEST || 'soml_test'
      : process.env.DB_NAME || 'soml';

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    charset: 'utf8mb4_unicode_ci',
  });

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  for (const acc of ACCOUNTS) {
    // เขียนซ้ำได้โดยไม่เกิดข้อผิดพลาด เพื่อให้ใช้รีเซ็ตรหัสผ่านทดสอบได้ด้วย
    await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
                               full_name     = VALUES(full_name),
                               role          = VALUES(role),
                               is_active     = TRUE`,
      [acc.username, hash, acc.full_name, acc.role]
    );
    console.log(`  ✓ ${acc.username.padEnd(10)} ${acc.role}`);
  }

  await conn.end();

  console.log(`\nสร้างบัญชีทดสอบ ${ACCOUNTS.length} บัญชีในฐานข้อมูล ${database} เรียบร้อย`);
  console.log(`รหัสผ่านของทุกบัญชีคือ  ${DEFAULT_PASSWORD}`);
  console.log('ต้องเปลี่ยนรหัสผ่านทั้งหมดก่อนนำระบบไปใช้งานจริงที่ร้าน');
}

main().catch((err) => {
  console.error('สร้างบัญชีผู้ใช้ไม่สำเร็จ:', err.message);
  process.exit(1);
});
