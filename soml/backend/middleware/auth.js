// ---------------------------------------------------------------------
// ส่วนตรวจสิทธิ์คั่นหน้าเส้นทาง (Auth Middleware)         [ตารางที่ 3.14 แถว 1 · 2.1.7]
//
// รับผิดชอบเรื่องเดียว: ตัดสินว่าคำขอนี้ "เป็นใคร" และ "มีสิทธิ์ไหม" ก่อนถึงโมดูลใด ๆ
// ถูกใช้จาก app.js เท่านั้น — โมดูลใน modules/ ไม่ต้องตรวจสิทธิ์เองอีก
// เหตุผล: ถ้าตรวจในแต่ละโมดูล เพิ่มเส้นทางใหม่แล้วลืมได้ แต่ถ้าคั่นที่ app.js ลืมไม่ได้
//
// การออกโทเคนอยู่ที่ modules/auth (ตอนล็อกอิน) ไฟล์นี้มีแต่ฝั่ง "ตรวจ"
// ---------------------------------------------------------------------
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'change-me') {
  // หยุดตั้งแต่เริ่ม ดีกว่าเปิดระบบที่ใครก็ปลอมโทเคนได้
  throw new Error('ต้องตั้ง JWT_SECRET ใน .env ให้เป็นค่าสุ่มก่อนเปิดระบบ');
}

/**
 * ตรวจโทเคนจากหัวข้อ Authorization: Bearer <token>
 * สำเร็จ → req.user = { userId, username, role, fullName } แล้วไปต่อ
 * ล้มเหลว → 401 (ไม่รู้ว่าเป็นใคร)
 */
function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อน' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : 'โทเคนไม่ถูกต้อง';
    return res.status(401).json({ error: message });
  }
}

/**
 * จำกัดเส้นทางให้เฉพาะบทบาทที่ระบุ ใช้ต่อจาก verifyToken เสมอ
 *   requireRole('manager')            เฉพาะผู้จัดการ
 *   requireRole('warehouse','manager') พนักงานคลังหรือผู้จัดการ (ตาราง 3.18)
 * รู้ว่าเป็นใครแต่ไม่มีสิทธิ์ → 403 (ต่างจาก 401 ที่ไม่รู้ว่าเป็นใคร)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อน' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้' });
    }
    return next();
  };
}

/** หมายเลขไอพีของผู้ใช้ สำหรับ audit_logs.ip_address (FR-09) */
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, ''); // IPv4 ที่ถูกห่อเป็น IPv6 ให้แสดงแบบ IPv4 ปกติ
}

module.exports = { verifyToken, requireRole, clientIp, JWT_SECRET };
