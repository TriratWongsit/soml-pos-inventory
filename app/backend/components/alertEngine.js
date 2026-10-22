// ---------------------------------------------------------------------
// Alert Engine — แจ้งเตือนภายในแอปพลิเคชัน   [FR-08 · UC-11]
//
// ตรวจสองเงื่อนไขตามที่กำหนดไว้ในหัวข้อ 3.4
//   1) ระดับสต็อกต่ำกว่าหรือเท่ากับจุดสั่งซื้อเพิ่ม  -> low_stock
//   2) คำสั่งซื้อค้างในคิวนานเกินเกณฑ์             -> queue_delay
//
// การตรวจสต็อกทำ "หลัง" ธุรกรรมตัดสต็อก COMMIT แล้วเท่านั้น เพื่อไม่ให้
// การสร้างการแจ้งเตือนไปหน่วงหรือทำให้ธุรกรรมหลักล้มเหลว
// ---------------------------------------------------------------------
const { pool } = require('../config/db');
const queueManager = require('./queueManager');

const QUEUE_DELAY_MINUTES = () => Number(process.env.QUEUE_DELAY_THRESHOLD_MINUTES || 30);

/** สร้างการแจ้งเตือนแล้วผลักไปยังหน้าจอผู้จัดการทันที */
async function raise({ type, message, productId = null, orderId = null }) {
  const [result] = await pool.query(
    `INSERT INTO notifications (type, ref_product_id, ref_order_id, message)
     VALUES (?, ?, ?, ?)`,
    [type, productId, orderId, message]
  );

  const notification = {
    notificationId: result.insertId,
    type,
    message,
    productId,
    orderId,
    createdAt: new Date().toISOString(),
  };
  queueManager.broadcast('notification.created', notification);
  return notification;
}

/**
 * ตรวจสินค้าที่ระบุว่าต่ำกว่าจุดสั่งซื้อเพิ่มหรือไม่   [TC-10]
 *
 * แจ้งเตือนซ้ำไม่เกินหนึ่งครั้งต่อสินค้าหนึ่งรายการที่ยังไม่ถูกอ่าน เพื่อไม่ให้
 * ผู้จัดการได้รับข้อความเดิมทุกครั้งที่จ่ายสินค้ารายการนั้น
 */
async function checkLowStock(productIds = []) {
  if (productIds.length === 0) return [];

  const [rows] = await pool.query(
    `SELECT p.product_id, p.name, p.unit, p.stock_qty, p.reorder_point
       FROM products p
      WHERE p.product_id IN (?)
        AND p.stock_qty <= p.reorder_point
        AND NOT EXISTS (
              SELECT 1 FROM notifications n
               WHERE n.type = 'low_stock'
                 AND n.ref_product_id = p.product_id
                 AND n.is_read = FALSE
            )`,
    [productIds]
  );

  const raised = [];
  for (const p of rows) {
    raised.push(
      await raise({
        type: 'low_stock',
        productId: p.product_id,
        message: `${p.name} เหลือ ${p.stock_qty} ${p.unit} ต่ำกว่าจุดสั่งซื้อเพิ่มที่ตั้งไว้ ${p.reorder_point} ${p.unit}`,
      })
    );
  }
  return raised;
}

/**
 * ตรวจคำสั่งซื้อที่ค้างในคิวนานผิดปกติ   [TC-11]
 * เรียกเป็นระยะจากตัวจับเวลาใน server.js
 */
async function checkQueueDelay() {
  const [rows] = await pool.query(
    `SELECT o.order_id, o.order_no,
            TIMESTAMPDIFF(MINUTE, o.paid_at, NOW()) AS waited_minutes
       FROM orders o
      WHERE o.status IN ('awaiting_dispatch', 'picking')
        AND TIMESTAMPDIFF(MINUTE, o.paid_at, NOW()) >= ?
        AND NOT EXISTS (
              SELECT 1 FROM notifications n
               WHERE n.type = 'queue_delay'
                 AND n.ref_order_id = o.order_id
            )`,
    [QUEUE_DELAY_MINUTES()]
  );

  const raised = [];
  for (const o of rows) {
    raised.push(
      await raise({
        type: 'queue_delay',
        orderId: o.order_id,
        message: `คำสั่งซื้อ ${o.order_no} ค้างอยู่ในคิวมาแล้ว ${o.waited_minutes} นาที`,
      })
    );
  }
  return raised;
}

/** รายการแจ้งเตือนสำหรับหน้าจอผู้จัดการ */
async function list(req, res, next) {
  try {
    const onlyUnread = String(req.query.unread || '') === 'true';
    const [rows] = await pool.query(
      `SELECT notification_id, type, ref_product_id, ref_order_id, message, is_read, created_at
         FROM notifications
        ${onlyUnread ? 'WHERE is_read = FALSE' : ''}
        ORDER BY created_at DESC, notification_id DESC
        LIMIT 200`
    );
    return res.json({ notifications: rows });
  } catch (err) {
    return next(err);
  }
}

/** ทำเครื่องหมายว่าอ่านแล้ว */
async function markRead(req, res, next) {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE notification_id = ?',
      [Number(req.params.id)]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือนที่ระบุ' });
    return res.json({ notificationId: Number(req.params.id), isRead: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { raise, checkLowStock, checkQueueDelay, list, markRead };
