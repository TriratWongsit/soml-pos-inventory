// ---------------------------------------------------------------------
// ส่วนตรวจเงื่อนไขแจ้งเตือน (Alert Engine)   [ตารางที่ 3.13 โมดูล 8 · FR-08 · UC-11 · BR-05 · 2.1.9]
//
// รับผิดชอบเรื่องเดียว: ตาราง notifications — สร้างเมื่อเงื่อนไขเป็นจริง และให้อ่าน/ทำเครื่องหมาย
//   checkStock(productIds)      หลัง commit ของ dispatch และ product (BR-05: ทุกครั้งที่สต็อกเปลี่ยน)
//   checkQueueDelay()           ทุก 60 วินาทีจาก timer ใน start() — เชิงรุก ไม่รอให้ผู้ใช้เปิดดู
//   GET   /api/notifications            ผู้จัดการ, พนักงานคลัง
//   PATCH /api/notifications/:id/read   ผู้จัดการ (ตาราง 3.13: ทำเครื่องหมายเฉพาะผู้จัดการ)
//
// การแจ้งเตือนเดียวกันไม่ถูกสร้างซ้ำ: ถ้ายังมีใบที่ "ยังไม่อ่าน" ของสินค้า/คำสั่งซื้อนั้นอยู่ ไม่สร้างใหม่
// การสร้างเป็นงานผลพลอยได้ (2.1.2) — ถ้าล้ม ต้องไม่กระทบงานหลักที่เรียกมา จึงดักและบันทึกไว้เฉย ๆ
// ---------------------------------------------------------------------
const { pool } = require('../../config/db');
const { clientIp } = require('../../middleware/auth');
const auditLog = require('../audit-log');
const queue = require('../queue');

const thresholdMinutes = () => Number(process.env.QUEUE_DELAY_THRESHOLD_MINUTES || 30);
const CHECK_EVERY_MS = 60 * 1000;

/** สร้างหนึ่งการแจ้งเตือน ถ้ายังไม่มีใบที่ยังไม่อ่านสำหรับสิ่งเดียวกัน คืน true เมื่อสร้างจริง */
async function createOnce(type, refColumn, refId, message) {
  const [[dup]] = await pool.query(
    `SELECT notification_id FROM notifications WHERE type = ? AND ${refColumn} = ? AND is_read = FALSE LIMIT 1`,
    [type, refId]
  );
  if (dup) return false;
  const [r] = await pool.query(
    `INSERT INTO notifications (type, ${refColumn}, message) VALUES (?, ?, ?)`,
    [type, refId, message]
  );
  // ระบบเป็นผู้กระทำ (user_id NULL) — เขียนนอกธุรกรรมของงานหลักโดยตั้งใจ
  await auditLog.record(pool, { userId: null, action: 'CREATE_NOTIFICATION', entityType: 'notification', entityId: r.insertId });
  queue.broadcast('notification.created', { notificationId: r.insertId, type, message });
  return true;
}

/**
 * ตรวจสินค้าที่ระบุว่าต่ำกว่าจุดสั่งซื้อเพิ่มหรือไม่ (reorder_point = 0 หมายถึงยังไม่ตั้ง จึงไม่เตือน)
 * @returns จำนวนการแจ้งเตือนที่สร้างใหม่
 */
async function checkStock(productIds) {
  if (!productIds?.length) return 0;
  try {
    const [rows] = await pool.query(
      `SELECT product_id, name, unit, stock_qty, reorder_point FROM products
        WHERE product_id IN (?) AND reorder_point > 0 AND stock_qty < reorder_point`,
      [productIds]
    );
    let created = 0;
    for (const p of rows) {
      if (await createOnce('low_stock', 'ref_product_id', p.product_id,
        `${p.name} เหลือ ${p.stock_qty} ${p.unit} ต่ำกว่าจุดสั่งซื้อเพิ่ม (${p.reorder_point})`)) created++;
    }
    return created;
  } catch (err) {
    console.error('ตรวจสต็อกเพื่อแจ้งเตือนไม่สำเร็จ:', err.message);
    return 0;
  }
}

/** ตรวจคำสั่งซื้อที่ชำระแล้วแต่ยังไม่ถูกจ่ายนานเกินเกณฑ์ */
async function checkQueueDelay() {
  try {
    const [rows] = await pool.query(
      `SELECT order_id, order_no, TIMESTAMPDIFF(MINUTE, paid_at, NOW()) AS waited
         FROM orders WHERE status IN ('awaiting_dispatch', 'picking')
          AND paid_at <= NOW() - INTERVAL ? MINUTE`,
      [thresholdMinutes()]
    );
    let created = 0;
    for (const o of rows) {
      if (await createOnce('queue_delay', 'ref_order_id', o.order_id, `${o.order_no} รอจ่ายสินค้ามา ${o.waited} นาที`)) created++;
    }
    return created;
  } catch (err) {
    console.error('ตรวจคิวค้างเพื่อแจ้งเตือนไม่สำเร็จ:', err.message);
    return 0;
  }
}

let timer = null;
/** เริ่มตรวจคิวค้างเป็นรอบ — server.js เรียกครั้งเดียวตอนเปิดระบบ */
function start() {
  if (timer) return;
  timer = setInterval(checkQueueDelay, CHECK_EVERY_MS);
  timer.unref(); // ไม่ยึดกระบวนการไว้ตอนปิดระบบ
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

/** GET /api/notifications?unread=1 */
async function list(req, res, next) {
  try {
    const onlyUnread = req.query.unread === '1';
    const [rows] = await pool.query(
      `SELECT n.notification_id, n.type, n.message, n.is_read, n.created_at, n.ref_product_id, n.ref_order_id
         FROM notifications n ${onlyUnread ? 'WHERE n.is_read = FALSE' : ''}
        ORDER BY n.is_read ASC, n.created_at DESC LIMIT 200`
    );
    return res.json({ notifications: rows });
  } catch (err) { return next(err); }
}

/** PATCH /api/notifications/:id/read — ผู้จัดการ */
async function markRead(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [r] = await pool.query('UPDATE notifications SET is_read = TRUE WHERE notification_id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือน' });
    await auditLog.record(pool, { userId: req.user.userId, action: 'READ_NOTIFICATION', entityType: 'notification', entityId: id, ip: clientIp(req) });
    return res.json({ notificationId: id, isRead: true });
  } catch (err) { return next(err); }
}

module.exports = { checkStock, checkQueueDelay, start, stop, list, markRead };
