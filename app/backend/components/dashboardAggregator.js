// ---------------------------------------------------------------------
// Dashboard Aggregator — รวบรวมข้อมูลสำหรับแดชบอร์ด  [FR-07 · UC-08, UC-09]
//
// แยกเป็นสองระดับตามที่ออกแบบไว้ในตารางที่ 3.11
//   UC-08 แดชบอร์ดปฏิบัติการ — ผู้จัดการและพนักงานคลังสินค้าเข้าถึงได้
//         เพราะข้อมูลคิวคงค้างและระดับสต็อกช่วยวางแผนการจัดของประจำวัน
//   UC-09 แดชบอร์ดระดับบริหาร — เฉพาะผู้จัดการ
//
// ตัวเลขทุกตัวคำนวณจากฐานข้อมูลโดยตรงในขณะที่เรียก ไม่มีการเก็บค่าสรุปไว้
// ล่วงหน้า จึงตรงกับข้อมูลจริงเสมอตามที่ TC-09 กำหนดให้ตรวจสอบ
// ---------------------------------------------------------------------
const { pool } = require('../config/db');

/** แดชบอร์ดปฏิบัติการ   [UC-08 · TC-09] */
async function operational(req, res, next) {
  try {
    const [[sales]] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_sales,
              COUNT(*) AS order_count
         FROM orders
        WHERE DATE(paid_at) = CURDATE() AND status <> 'cancelled'`
    );

    const [[queue]] = await pool.query(
      `SELECT COUNT(*) AS waiting,
              COALESCE(MAX(TIMESTAMPDIFF(MINUTE, paid_at, NOW())), 0) AS longest_wait_minutes
         FROM orders
        WHERE status IN ('awaiting_dispatch', 'picking')`
    );

    const [[delivered]] = await pool.query(
      `SELECT COUNT(*) AS delivered
         FROM orders
        WHERE status = 'delivered' AND DATE(dispatched_at) = CURDATE()`
    );

    const [stock] = await pool.query(
      `SELECT product_id, sku, name, unit, stock_qty, reorder_point,
              ROUND(stock_qty / NULLIF(reorder_point, 0) * 100) AS level_percent
         FROM products
        WHERE is_active = TRUE
        ORDER BY (stock_qty <= reorder_point) DESC, stock_qty / NULLIF(reorder_point, 0) ASC
        LIMIT 12`
    );

    const [[lowStock]] = await pool.query(
      'SELECT COUNT(*) AS below_reorder FROM products WHERE is_active = TRUE AND stock_qty <= reorder_point'
    );

    const [alerts] = await pool.query(
      `SELECT notification_id, type, message, is_read, created_at
         FROM notifications
        ORDER BY created_at DESC, notification_id DESC
        LIMIT 8`
    );

    return res.json({
      kpi: {
        salesToday: Number(sales.total_sales),
        orderCountToday: sales.order_count,
        queueWaiting: queue.waiting,
        longestWaitMinutes: queue.longest_wait_minutes,
        deliveredToday: delivered.delivered,
        belowReorderPoint: lowStock.below_reorder,
      },
      stock,
      alerts,
    });
  } catch (err) {
    return next(err);
  }
}

/** แดชบอร์ดระดับบริหาร   [UC-09] */
async function executive(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days || 7), 90);

    const [salesByDay] = await pool.query(
      `SELECT DATE(paid_at) AS day,
              COUNT(*) AS order_count,
              COALESCE(SUM(total_amount), 0) AS total_sales
         FROM orders
        WHERE status <> 'cancelled'
          AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(paid_at)
        ORDER BY day`,
      [days]
    );

    const [topProducts] = await pool.query(
      `SELECT p.product_id, p.sku, p.name, p.unit,
              SUM(i.qty) AS total_qty,
              SUM(i.line_total) AS total_amount
         FROM order_items i
         JOIN orders o ON o.order_id = i.order_id
         JOIN products p ON p.product_id = i.product_id
        WHERE o.status <> 'cancelled'
          AND o.paid_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY p.product_id, p.sku, p.name, p.unit
        ORDER BY total_amount DESC
        LIMIT 10`,
      [days]
    );

    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS order_count,
              COALESCE(SUM(total_amount), 0) AS total_sales,
              COALESCE(AVG(total_amount), 0) AS average_order_value,
              COALESCE(AVG(TIMESTAMPDIFF(MINUTE, paid_at, dispatched_at)), 0) AS average_lead_time_minutes
         FROM orders
        WHERE status = 'delivered'
          AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [days]
    );

    return res.json({
      periodDays: days,
      summary: {
        orderCount: summary.order_count,
        totalSales: Number(summary.total_sales),
        averageOrderValue: Number(summary.average_order_value),
        // ระยะเวลาตั้งแต่รับชำระจนจ่ายสินค้าเสร็จ เป็นตัวชี้วัดการลดเวลารอคอย
        // ตามวัตถุประสงค์ข้อ 1.2.2
        averageLeadTimeMinutes: Number(summary.average_lead_time_minutes),
      },
      salesByDay,
      topProducts,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { operational, executive };
