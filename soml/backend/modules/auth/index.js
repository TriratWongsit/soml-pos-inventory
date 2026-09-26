// ---------------------------------------------------------------------
// ส่วนควบคุมการเข้าสู่ระบบ (Auth Controller)      [ตารางที่ 3.13 โมดูล 1 · FR-01 · UC-01]
//
// รับผิดชอบเรื่องเดียว: พิสูจน์ว่าผู้ใช้เป็นใคร แล้วออกโทเคนให้ถือไปใช้กับเส้นทางอื่น
//   POST /api/auth/login   ตรวจชื่อผู้ใช้/รหัสผ่าน → ออกโทเคน → บันทึก LOGIN
//   GET  /api/auth/me      คืนข้อมูลผู้ใช้จากโทเคน (หน้าจอใช้ตอนรีเฟรช)
//
// ฝั่ง "ตรวจโทเคน" อยู่ที่ middleware/auth.js ไม่ใช่ที่นี่ — โมดูลนี้เป็นฝั่ง "ออกโทเคน"
// ---------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');
const { JWT_SECRET, clientIp } = require('../../middleware/auth');
const auditLog = require('../audit-log');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'; // หนึ่งกะทำงาน แล้วต้องเข้าใหม่

// ข้อความเดียวสำหรับทุกกรณีที่ล้มเหลว (ไม่มีชื่อนี้ / รหัสผิด / บัญชีถูกปิด)
// เพื่อไม่ให้คนนอกใช้หน้าล็อกอินเดาได้ว่าชื่อผู้ใช้ไหนมีอยู่จริง (2.1.7)
const LOGIN_FAILED = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

/** สิ่งที่ฝังในโทเคนและส่งกลับหน้าจอ — ไม่มี password_hash เด็ดขาด */
function publicUser(row) {
  return { userId: row.user_id, username: row.username, role: row.role, fullName: row.full_name };
}

/** POST /api/auth/login  { username, password } */
async function login(req, res, next) {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) return res.status(400).json({ error: 'ต้องระบุชื่อผู้ใช้และรหัสผ่าน' });

    const [[row]] = await pool.query(
      'SELECT user_id, username, password_hash, full_name, role, is_active FROM users WHERE username = ?',
      [username]
    );
    // เทียบรหัสผ่านแม้ไม่พบผู้ใช้ (กับ hash หลอก) เพื่อให้เวลาตอบใกล้เคียงกันทุกกรณี
    const matched = await bcrypt.compare(password, row?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!row || !matched || !row.is_active) return res.status(401).json({ error: LOGIN_FAILED });

    const user = publicUser(row);
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    await auditLog.record(pool, { userId: user.userId, action: 'LOGIN', ip: clientIp(req) });
    return res.json({ token, user });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/auth/me — ใช้ต่อจาก verifyToken จึงมี req.user แล้ว */
function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, me };
