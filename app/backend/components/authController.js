// ---------------------------------------------------------------------
// Auth Controller — เข้าสู่ระบบและควบคุมสิทธิ์ตามบทบาท   [FR-01 · UC-01]
// ---------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const auditLog = require('./auditLogService');
const { clientIp } = require('../middleware/auth');

// แฮชหลอกสำหรับกรณีไม่พบชื่อผู้ใช้ เพื่อให้เวลาที่ใช้ตอบกลับใกล้เคียงกับกรณี
// ที่พบบัญชีจริง ผู้ไม่ประสงค์ดีจึงไม่สามารถเดาได้จากเวลาตอบสนองว่าบัญชีใดมีอยู่
// (แนวปฏิบัติตาม OWASP ASVS ที่อ้างไว้ในหัวข้อ 2.1.6)
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const [rows] = await pool.query(
      'SELECT user_id, username, password_hash, full_name, role, is_active FROM users WHERE username = ?',
      [username]
    );
    const user = rows[0];

    const matched = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    // UC-01/A1 — ไม่ระบุว่าผิดที่ชื่อผู้ใช้หรือรหัสผ่าน เพื่อไม่ให้ใช้ข้อความ
    // แจ้งเตือนคาดเดาว่าบัญชีใดมีอยู่จริง
    if (!user || !matched) {
      await auditLog.record(null, {
        action: 'LOGIN_FAILED',
        detail: { username },
        ip: clientIp(req),
      });
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    // UC-01/A2 — ตรวจสถานะบัญชี "หลัง" ยืนยันรหัสผ่านผ่านแล้วเท่านั้น
    // เพราะถ้าตอบว่าบัญชีถูกปิดใช้งานตั้งแต่ก่อนตรวจรหัสผ่าน เท่ากับยืนยัน
    // ให้ผู้เดาทราบว่าบัญชีนั้นมีอยู่จริง
    if (!user.is_active) {
      return res.status(403).json({ error: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้จัดการ' });
    }

    const token = jwt.sign(
      {
        sub: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await auditLog.record(null, {
      userId: user.user_id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.user_id,
      ip: clientIp(req),
    });

    return res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/** คืนข้อมูลผู้ใช้ของโทเคนปัจจุบัน ใช้ให้หน้าจอรู้ว่าต้องแสดงเมนูใด */
async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, me };
