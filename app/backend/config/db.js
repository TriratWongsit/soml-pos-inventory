// ---------------------------------------------------------------------
// การเชื่อมต่อฐานข้อมูล MySQL 8.0 (InnoDB)
// ชั้นข้อมูลของสถาปัตยกรรม 3-Tier ตามที่ออกแบบไว้ในหัวข้อ 3.2
// ---------------------------------------------------------------------
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// ชุดทดสอบใช้ฐานข้อมูลแยกต่างหาก เพื่อไม่ให้ข้อมูลทดสอบปะปนกับข้อมูลใช้งานจริง
const database =
  process.env.NODE_ENV === 'test'
    ? process.env.DB_NAME_TEST || 'soml_test'
    : process.env.DB_NAME || 'soml';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database,
  waitForConnections: true,
  // NFR-06 กำหนดให้รองรับผู้ใช้งานพร้อมกันอย่างน้อย 10 เซสชัน
  // จึงตั้งขนาดพูลไว้สูงกว่าเกณฑ์เพื่อเผื่อคำขอที่ซ้อนกันในเซสชันเดียว
  connectionLimit: 20,
  queueLimit: 0,
  timezone: 'local',
  decimalNumbers: true,
  charset: 'utf8mb4_unicode_ci',
});

/**
 * ครอบคำสั่งหลายคำสั่งไว้ในธุรกรรมเดียว แล้วคืน connection ให้พูลเสมอ
 *
 * ธุรกรรมตัดสต็อกใน stockDeductionService ต้องอาศัยตัวช่วยนี้ เพราะคำสั่ง
 * ทั้งชุดต้องวิ่งบน connection เดียวกัน จึงจะได้คุณสมบัติ ACID ตาม NFR-04
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, withTransaction, database };
