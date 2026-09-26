// ---------------------------------------------------------------------
// บริการบันทึกประวัติ (Audit Log Service)          [ตารางที่ 3.13 โมดูล 9 · FR-09 · UC-10]
//
// รับผิดชอบเรื่องเดียว: ตาราง audit_logs — เขียนเหตุการณ์ และให้ค้นย้อนหลัง
//
// ฝั่งเขียน  record(conn, event)   ทุกโมดูลเรียก (เส้นประในรูปที่ 3.8)
// ฝั่งอ่าน   list(req, res)        GET /api/audit-logs เฉพาะผู้จัดการ (ตาราง 3.18)
//
// ทำไม record รับ conn จากผู้เรียก ไม่เปิดเอง:
//   ให้ประวัติอยู่ในธุรกรรมเดียวกับงานที่เกิด (3.7.3 ขั้น 5) ถ้างาน rollback
//   ประวัติหายตามไปด้วย จึงไม่มีทางมี "ประวัติของสิ่งที่ไม่ได้เกิดขึ้นจริง"
// ตารางนี้เพิ่มอย่างเดียว (2.1.5) ไม่มีฟังก์ชันแก้หรือลบโดยตั้งใจ
// ---------------------------------------------------------------------
const { pool } = require('../../config/db');

// ชื่อเหตุการณ์ที่ระบบรู้จัก — ประกาศไว้ที่เดียวเพื่อให้หน้าจอกรองได้และสะกดไม่หลุด
const ACTIONS = Object.freeze([
  'LOGIN',            // modules/auth
  'CREATE_PRODUCT',   // modules/product
  'UPDATE_PRODUCT',
  'ADJUST_STOCK',
  'CREATE_ORDER',     // modules/order
  'UPDATE_STATUS',    // modules/queue
  'CONFIRM_DISPATCH', // modules/stock-deduction
  'CANCEL_ORDER',
  'CREATE_NOTIFICATION', // modules/alert (ระบบเป็นผู้กระทำ user_id NULL)
  'READ_NOTIFICATION',
]);

/**
 * บันทึกหนึ่งเหตุการณ์ ภายในธุรกรรมของผู้เรียก
 * @param conn   การเชื่อมต่อจาก withTransaction (หรือ pool ถ้าเหตุการณ์ไม่ได้อยู่ในธุรกรรม)
 * @param event  { userId, action, entityType, entityId, ip }
 *               userId เป็น null ได้เมื่อระบบทำเอง เช่น สร้างการแจ้งเตือน
 */
async function record(conn, { userId = null, action, entityType = null, entityId = null, ip = null }) {
  if (!ACTIONS.includes(action)) throw new Error(`ชื่อเหตุการณ์ไม่รู้จัก: ${action}`);
  await conn.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, ip]
  );
}

/**
 * GET /api/audit-logs?from=&to=&action=&userId=&limit=            [UC-10 · AC-11]
 * แสดงผู้กระทำ เวลา และข้อมูลที่ถูกกระทำ กรองตามช่วงเวลาและประเภทการกระทำ
 * เรียงจากใหม่ไปเก่า จำกัดจำนวนแถวเพื่อไม่ให้ดึงทั้งตาราง
 */
async function list(req, res, next) {
  try {
    const { from, to, action, userId } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

    const where = [];
    const params = [];
    if (from) { where.push('l.created_at >= ?'); params.push(from); }
    if (to) { where.push('l.created_at <= ?'); params.push(to); }
    if (action) {
      if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'ประเภทการกระทำไม่รู้จัก' });
      where.push('l.action = ?'); params.push(action);
    }
    if (userId) { where.push('l.user_id = ?'); params.push(Number(userId)); }

    const [rows] = await pool.query(
      `SELECT l.log_id, l.action, l.entity_type, l.entity_id, l.ip_address, l.created_at,
              l.user_id, u.username, u.full_name
         FROM audit_logs l
         LEFT JOIN users u ON u.user_id = l.user_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY l.created_at DESC, l.log_id DESC
        LIMIT ?`,
      [...params, limit]
    );
    await attachLabels(rows);
    return res.json({ logs: rows, actions: ACTIONS });
  } catch (err) {
    return next(err);
  }
}

/**
 * เติม entity_label ให้แต่ละแถว เพื่อให้ "ข้อมูลที่ถูกกระทำ" (AC-11) อ่านออกโดยไม่ต้องจำรหัส
 *   order        → เลขที่ + รายการสินค้าย่อ + ยอด
 *   product      → รหัส + ชื่อ
 *   notification → ข้อความแจ้งเตือน
 * ถามฐานเพิ่มชนิดละหนึ่งครั้ง (IN …) ไม่ใช่แถวละครั้ง
 */
async function attachLabels(rows) {
  const ids = (type) => [...new Set(rows.filter((r) => r.entity_type === type && r.entity_id).map((r) => r.entity_id))];
  const labels = new Map();

  const orderIds = ids('order');
  if (orderIds.length) {
    const [orders] = await pool.query('SELECT order_id, order_no, total_amount FROM orders WHERE order_id IN (?)', [orderIds]);
    const [items] = await pool.query(
      `SELECT i.order_id, i.qty, p.name FROM order_items i JOIN products p ON p.product_id = i.product_id
        WHERE i.order_id IN (?) ORDER BY i.order_item_id`, [orderIds]
    );
    const byOrder = new Map();
    for (const it of items) (byOrder.get(it.order_id) || byOrder.set(it.order_id, []).get(it.order_id)).push(`${it.name} ×${it.qty}`);
    for (const o of orders) {
      const list = byOrder.get(o.order_id) || [];
      const summary = list.slice(0, 3).join(', ') + (list.length > 3 ? ` และอีก ${list.length - 3} รายการ` : '');
      labels.set(`order:${o.order_id}`, `${o.order_no} — ${summary} (${Number(o.total_amount).toLocaleString('th-TH')} ฿)`);
    }
  }
  const productIds = ids('product');
  if (productIds.length) {
    const [products] = await pool.query('SELECT product_id, sku, name FROM products WHERE product_id IN (?)', [productIds]);
    for (const p of products) labels.set(`product:${p.product_id}`, `${p.sku} ${p.name}`);
  }
  const notifIds = ids('notification');
  if (notifIds.length) {
    const [notifs] = await pool.query('SELECT notification_id, message FROM notifications WHERE notification_id IN (?)', [notifIds]);
    for (const n of notifs) labels.set(`notification:${n.notification_id}`, n.message);
  }
  for (const r of rows) r.entity_label = labels.get(`${r.entity_type}:${r.entity_id}`) || null;
}

module.exports = { record, list, ACTIONS };
