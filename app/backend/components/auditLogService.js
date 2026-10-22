// ---------------------------------------------------------------------
// Audit Log Service — บันทึกประวัติการทำรายการ   [FR-09 · UC-10]
//
// ส่วนประกอบหลักทุกตัวเรียกใช้บริการนี้เมื่อทำรายการสำเร็จ ตามเส้นประ
// ในแผนภาพส่วนประกอบ (รูปที่ 3.4)
// ---------------------------------------------------------------------
const { pool } = require('../config/db');

/**
 * บันทึกหนึ่งเหตุการณ์ลงตาราง audit_logs
 *
 * @param {object} [conn] connection ของธุรกรรมที่กำลังเปิดอยู่
 *        ถ้าไม่ส่งมาจะเขียนผ่านพูลทันทีนอกธุรกรรม
 */
async function record(conn, { userId = null, action, entityType = null, entityId = null, detail = null, ip = null }) {
  const executor = conn || pool;
  await executor.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, detail ? JSON.stringify(detail) : null, ip]
  );
}

/**
 * ค้นหาประวัติย้อนหลัง กรองตามช่วงวันที่และบทบาทของผู้กระทำ [TC-12]
 */
async function search({ from = null, to = null, role = null, action = null, limit = 200 } = {}) {
  const where = [];
  const params = [];

  if (from) { where.push('l.created_at >= ?'); params.push(from); }
  if (to) { where.push('l.created_at <= ?'); params.push(to); }
  if (role) { where.push('u.role = ?'); params.push(role); }
  if (action) { where.push('l.action = ?'); params.push(action); }

  const [rows] = await pool.query(
    `SELECT l.log_id, l.action, l.entity_type, l.entity_id, l.detail,
            l.ip_address, l.created_at,
            u.user_id, u.username, u.full_name, u.role
       FROM audit_logs l
       LEFT JOIN users u ON u.user_id = l.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY l.created_at DESC, l.log_id DESC
      LIMIT ?`,
    [...params, Number(limit)]
  );
  return rows;
}

/** เส้นทาง HTTP สำหรับหน้าจอค้นหาประวัติการทำรายการของผู้จัดการ   [UC-10 · TC-12] */
async function listHandler(req, res, next) {
  try {
    const rows = await search({
      from: req.query.from || null,
      to: req.query.to || null,
      role: req.query.role || null,
      action: req.query.action || null,
      limit: Math.min(Number(req.query.limit || 200), 1000),
    });
    return res.json({ logs: rows });
  } catch (err) {
    return next(err);
  }
}

module.exports = { record, search, listHandler };
