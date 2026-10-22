// ---------------------------------------------------------------------
// รายงานการขายรายวัน                                          [คอมเมนต์กรรมการ K-10 · FR-12]
//
// GET /api/reports/daily?date=YYYY-MM-DD  (ผู้จัดการ · ไม่ระบุ = วันนี้)
// ทุกใบของวันนั้น พร้อมยอดแยกตามวิธีชำระ ใบที่ยกเลิก และเงินรับชำระหนี้ขายเชื่อของวัน
// หน้าจอพิมพ์ออกเป็นกระดาษ A4 และดาวน์โหลด CSV ให้นักบัญชีใช้ทำภาษี
// ตัวเลขคำนวณจากตารางจริงทุกครั้ง ไม่เก็บซ้ำ จึงตรงกับฐานข้อมูลเสมอ
// ---------------------------------------------------------------------
const { pool } = require('../../config/db');
const { shortName } = require('../../lib/names');

const round2 = (n) => Math.round(n * 100) / 100;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

async function daily(req, res, next) {
  try {
    let date = req.query.date;
    if (!date) [[{ date }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS date");
    if (!isDate(date)) return res.status(400).json({ error: 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD' });

    const [orders] = await pool.query(
      `SELECT o.order_id, o.order_no, o.paid_at, o.total_amount, o.status, o.payment_method, o.settled_at,
              c.name AS customer_name, u.full_name AS cashier
         FROM orders o JOIN users u ON u.user_id = o.created_by
         LEFT JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.paid_at >= ? AND o.paid_at < ? + INTERVAL 1 DAY
        ORDER BY o.paid_at, o.order_id`,
      [date, date]
    );
    const [payments] = await pool.query(
      `SELECT p.payment_id, p.received_at, p.amount, p.method, o.order_no, c.name AS customer_name
         FROM credit_payments p JOIN orders o ON o.order_id = p.order_id
         LEFT JOIN customers c ON c.customer_id = o.customer_id
        WHERE p.received_at >= ? AND p.received_at < ? + INTERVAL 1 DAY
        ORDER BY p.received_at`,
      [date, date]
    );

    const sold = orders.filter((o) => o.status !== 'cancelled');
    const sum = (rows) => round2(rows.reduce((s, r) => s + Number(r.total_amount ?? r.amount), 0));
    const summary = {
      orders: sold.length,
      revenue: sum(sold),
      promptpay: { orders: sold.filter((o) => o.payment_method === 'promptpay').length, amount: sum(sold.filter((o) => o.payment_method === 'promptpay')) },
      cash: { orders: sold.filter((o) => o.payment_method === 'cash').length, amount: sum(sold.filter((o) => o.payment_method === 'cash')) },
      credit: { orders: sold.filter((o) => o.payment_method === 'credit').length, amount: sum(sold.filter((o) => o.payment_method === 'credit')) },
      cancelled: { orders: orders.length - sold.length, amount: sum(orders.filter((o) => o.status === 'cancelled')) },
      creditPaymentsReceived: sum(payments),
    };
    // เงินที่เข้าจริงวันนั้น = ขายด้วย QR + เงินสด + รับชำระหนี้ขายเชื่อ (ขายเชื่อวันนี้ยังไม่ได้เงิน)
    summary.moneyIn = round2(summary.promptpay.amount + summary.cash.amount + summary.creditPaymentsReceived);
    // เงินสดที่ควรอยู่ในลิ้นชักจากการขายและรับชำระหนี้เป็นเงินสด ใช้นับเงินตอนปิดร้าน
    summary.cashInDrawer = round2(summary.cash.amount + payments.filter((p) => p.method === 'cash').reduce((s, p) => s + Number(p.amount), 0));

    return res.json({
      date,
      summary,
      orders: orders.map((o) => ({ ...o, cashier: shortName(o.cashier) })),
      payments,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { return next(err); }
}

module.exports = { daily };
