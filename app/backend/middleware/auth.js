// ---------------------------------------------------------------------
// ตรวจสอบโทเคนและควบคุมสิทธิ์ตามบทบาท (RBAC)   [FR-01 · NFR-01 · UC-01]
//
// SRS §3.1.4 กำหนดว่าทุกคำขอต้องแนบโทเคนและถูกตรวจสอบสิทธิ์ก่อนประมวลผล
// มิดเดิลแวร์ชุดนี้จึงถูกคาดไว้หน้าทุกเส้นทางยกเว้นการเข้าสู่ระบบ
// ---------------------------------------------------------------------
const jwt = require('jsonwebtoken');

const ROLES = ['sales', 'warehouse', 'manager'];

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อนใช้งาน' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: payload.sub,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'โทเคนไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

/**
 * ตรวจโทเคนที่ส่งมาทางสตริงคำค้น ใช้เฉพาะช่องทาง Server-Sent Events
 *
 * ตัว EventSource ของเบราว์เซอร์กำหนดหัวข้อคำขอเองไม่ได้ จึงต้องรับโทเคน
 * ทางสตริงคำค้นเช่นเดียวกับ WebSocket การผ่อนปรนนี้จำกัดไว้เฉพาะเส้นทาง
 * รับเหตุการณ์ซึ่งเป็นการอ่านอย่างเดียว ไม่ใช้กับเส้นทางที่เปลี่ยนแปลงข้อมูล
 */
function verifyTokenFromQuery(req, res, next) {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return verifyToken(req, res, next);
}

/**
 * จำกัดเส้นทางให้เฉพาะบทบาทที่ระบุ
 *
 * ตอบรหัส 403 เมื่อผู้ใช้ยืนยันตัวตนแล้วแต่บทบาทไม่ตรง เพื่อแยกให้ชัดจาก
 * รหัส 401 ที่หมายถึงยังไม่ได้เข้าสู่ระบบ — TC-01 ตรวจพฤติกรรมนี้โดยตรง
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อนใช้งาน' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'บัญชีของท่านไม่มีสิทธิ์เข้าถึงส่วนนี้' });
    }
    return next();
  };
}

/** หมายเลขไอพีของผู้เรียก สำหรับบันทึกลง audit_logs */
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null;
}

module.exports = { verifyToken, verifyTokenFromQuery, requireRole, clientIp, ROLES };
