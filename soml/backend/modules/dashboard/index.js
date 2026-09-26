// ---------------------------------------------------------------------
// ส่วนรวบรวมข้อมูลแดชบอร์ด (Dashboard Aggregator)   [ตารางที่ 3.13 โมดูล 7 · FR-07 · UC-08, UC-09 · BR-04]
//
// รับผิดชอบเรื่องเดียว: คำนวณตัวชี้วัด "สด" จากฐานข้อมูลทุกครั้งที่ถูกเรียก
// ไม่มีตารางสรุป ไม่มีแคช — BR-04 ยอมแลกความเร็วกับความถูกต้อง (2.1.8)
// เนื้อหาตามตารางที่ 3.15:
//   GET /api/dashboard/ops    ผู้จัดการ, คลัง   ยอดขายวันนี้ จำนวนคิวค้าง สินค้าที่ต่ำกว่าจุดสั่งซื้อเพิ่ม
//                                              และคำสั่งซื้อที่รอเกินเกณฑ์ สำหรับกล่องต้องดูแลวันนี้ (UC-08 ข้อ 3)
//   GET /api/dashboard/exec   ผู้จัดการ         แนวโน้มยอดขายย้อนหลัง และสินค้าขายดี
//
// "ยอดขาย" นับจากคำสั่งซื้อที่ชำระแล้วและไม่ถูกยกเลิก (ทุกแถวใน orders ชำระแล้วอยู่แล้ว — 3.7.2 ข้อ 3)
// ---------------------------------------------------------------------
const { pool } = require('../../config/db');

const SOLD = "o.status <> 'cancelled'";
// เกณฑ์เดียวกับที่ Alert Engine ใช้สร้างการแจ้งเตือนคิวค้าง (TBD-03)
const thresholdMinutes = () => Number(process.env.QUEUE_DELAY_THRESHOLD_MINUTES || 30);

/** GET /api/dashboard/ops */
async function ops(req, res, next) {
  try {
    const [[today]] = await pool.query(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o WHERE ${SOLD} AND DATE(o.paid_at) = CURDATE()`
    );
    const [[queueStat]] = await pool.query(
      `SELECT COUNT(*) AS waiting,
              COALESCE(MAX(TIMESTAMPDIFF(MINUTE, paid_at, NOW())), 0) AS longest_wait_minutes
         FROM orders WHERE status IN ('awaiting_dispatch', 'picking')`
    );
    const [delayed] = await pool.query(
      `SELECT order_no, TIMESTAMPDIFF(MINUTE, paid_at, NOW()) AS wait_minutes
         FROM orders WHERE status IN ('awaiting_dispatch', 'picking')
          AND paid_at <= NOW() - INTERVAL ? MINUTE
        ORDER BY paid_at ASC`,
      [thresholdMinutes()]
    );
    queueStat.threshold_minutes = thresholdMinutes();
    queueStat.delayed = delayed;
    const [lowStock] = await pool.query(
      `SELECT product_id, sku, name, unit, stock_qty, reorder_point FROM products
        WHERE is_active = TRUE AND reorder_point > 0 AND stock_qty < reorder_point
        ORDER BY (reorder_point - stock_qty) DESC LIMIT 50`
    );
    return res.json({ today, queue: queueStat, lowStock, generatedAt: new Date().toISOString() });
  } catch (err) { return next(err); }
}

/** GET /api/dashboard/exec?days=30 */
async function exec(req, res, next) {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const [trend] = await pool.query(
      `SELECT DATE(o.paid_at) AS day, COUNT(*) AS orders, SUM(o.total_amount) AS revenue
         FROM orders o WHERE ${SOLD} AND o.paid_at >= CURDATE() - INTERVAL ? DAY
        GROUP BY DATE(o.paid_at) ORDER BY day`,
      [days - 1]
    );
    const [topProducts] = await pool.query(
      `SELECT p.product_id, p.sku, p.name, p.unit,
              SUM(i.qty) AS qty_sold, SUM(i.qty * i.unit_price) AS revenue
         FROM order_items i
         JOIN orders o ON o.order_id = i.order_id
         JOIN products p ON p.product_id = i.product_id
        WHERE ${SOLD} AND o.paid_at >= CURDATE() - INTERVAL ? DAY
        GROUP BY p.product_id ORDER BY revenue DESC LIMIT 10`,
      [days - 1]
    );
    const [[total]] = await pool.query(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o WHERE ${SOLD} AND o.paid_at >= CURDATE() - INTERVAL ? DAY`,
      [days - 1]
    );
    return res.json({ days, total, trend, topProducts, generatedAt: new Date().toISOString() });
  } catch (err) { return next(err); }
}

module.exports = { ops, exec };
