// ---------------------------------------------------------------------
// ส่วนตั้งค่าการเชื่อมต่อฐานข้อมูล (Database Config)       [ตารางที่ 3.14 แถว 2]
//
// รับผิดชอบเรื่องเดียว: เป็นที่เดียวที่รู้ว่าฐานข้อมูลอยู่ที่ไหนและเปิดการเชื่อมต่ออย่างไร
// ทุกโมดูลที่แตะฐานข้อมูลใช้ pool หรือ withTransaction จากที่นี่ ไม่มีโมดูลไหนเปิดเอง
//
// ฐานข้อมูลถูกเลือกครั้งเดียวตอนไฟล์นี้ถูก require:
//   NODE_ENV=test  → DB_NAME_TEST (soml_new_test)  ชุดทดสอบตั้งค่านี้ใน tests/integration/setup-env.js
//   อื่น ๆ         → DB_NAME      (soml_new)
// ---------------------------------------------------------------------
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

const isTest = process.env.NODE_ENV === 'test';
const database = isTest ? (process.env.DB_NAME_TEST || 'soml_new_test') : (process.env.DB_NAME || 'soml_new');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database,
  // จำนวนการเชื่อมต่อสูงสุดในพูล — NFR-06 ต้องรองรับผู้ใช้พร้อมกันไม่น้อยกว่า 10 เซสชัน
  connectionLimit: 10,
  // MySQL ส่ง DECIMAL มาเป็นสตริงเพื่อรักษาความแม่นยำ แต่ระบบนี้คำนวณยอดเป็นบาทและสตางค์
  // ซึ่ง double ของ JavaScript แทนได้พอ (ยอดไม่เกิน 12 หลัก) จึงแปลงเป็นตัวเลขตั้งแต่ตรงนี้
  decimalNumbers: true,
  // ตั้งเขตเวลาให้ตรงกับเวลาร้าน เพื่อให้ paid_at ที่เก็บด้วย NOW() อ่านตรงกับนาฬิกาหน้าร้าน
  timezone: '+07:00',
  charset: 'utf8mb4',
});

/**
 * รันงานหนึ่งชุดภายในธุรกรรมเดียว                              [2.1.2 · 3.7.3]
 *
 * ถ้า fn ทำงานจนจบ → COMMIT   ถ้า fn โยนข้อผิดพลาด → ROLLBACK แล้วโยนต่อ
 * ผู้เรียกไม่ต้องจำว่าต้อง rollback เอง ซึ่งเป็นจุดที่มักลืมและทำให้มีแถวครึ่ง ๆ กลาง ๆ
 *
 * ใช้: const result = await withTransaction(async (conn) => { ... return x; });
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
