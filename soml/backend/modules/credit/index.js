// ---------------------------------------------------------------------
// ขายเชื่อ (บิลเซ็น) และรับชำระหนี้                            [คอมเมนต์กรรมการ K-6 · FR-10 · FR-11]
//
// ลูกค้าบางรายของร้านเอาของไปก่อนแล้วจ่ายทีหลัง โดยเซ็นบิลไว้กับร้าน
//   GET  /api/customers?q=          รายชื่อลูกค้าขายเชื่อพร้อมยอดค้าง (พนักงานขาย ผู้จัดการ)
//   POST /api/customers             เพิ่มลูกค้า { name, phone?, note? }   (พนักงานขาย ผู้จัดการ)
//   GET  /api/credit                ใบขายเชื่อที่ยังค้างชำระ แยกตามลูกค้า (ผู้จัดการ)
//   POST /api/orders/:id/payments   รับชำระ { amount, method, note? } จ่ายทีละส่วนได้ (ผู้จัดการ)
// การสร้างใบขายเชื่ออยู่ที่ modules/order (paymentMethod = 'credit') เพราะเป็นการขายแบบเดียวกัน
// ---------------------------------------------------------------------
const { pool, withTransaction } = require('../../config/db');
const { clientIp } = require('../../middleware/auth');
const auditLog = require('../audit-log');
const queue = require('../queue');

const PAY_METHODS = ['cash', 'promptpay', 'transfer'];
const round2 = (n) => Math.round(n * 100) / 100;

// ยอดค้างของแต่ละใบ = ยอดขาย - ที่รับชำระแล้ว (ไม่นับใบที่ยกเลิก)
const OPEN_SQL = `
  SELECT o.order_id, o.order_no, o.total_amount, o.paid_at, o.status, o.customer_id,
         COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM orders o LEFT JOIN credit_payments p ON p.order_id = o.order_id
   WHERE o.payment_method = 'credit' AND o.status <> 'cancelled' AND o.settled_at IS NULL
   GROUP BY o.order_id
   ORDER BY o.paid_at`;

async function listCustomers(req, res, next) {
  try {
    const q = `%${String(req.query.q || '').trim()}%`;
    const [rows] = await pool.query(
      `SELECT c.customer_id, c.name, c.phone, c.note, c.is_active,
              COALESCE(SUM(CASE WHEN o.status <> 'cancelled' AND o.settled_at IS NULL THEN o.total_amount END), 0)
              - COALESCE((SELECT SUM(p.amount) FROM credit_payments p JOIN orders o2 ON o2.order_id = p.order_id
                           WHERE o2.customer_id = c.customer_id AND o2.status <> 'cancelled' AND o2.settled_at IS NULL), 0) AS outstanding
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.payment_method = 'credit'
        WHERE c.name LIKE ? OR c.phone LIKE ?
        GROUP BY c.customer_id ORDER BY c.name LIMIT 50`,
      [q, q]
    );
    return res.json({ customers: rows.map((r) => ({ ...r, outstanding: round2(r.outstanding) })) });
  } catch (err) { return next(err); }
}

async function createCustomer(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 150);
    const phone = req.body?.phone ? String(req.body.phone).replace(/[^\d-]/g, '').slice(0, 20) : null;
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 255) : null;
    if (name.length < 2) return res.status(400).json({ error: 'ชื่อลูกค้าต้องมีอย่างน้อย 2 ตัวอักษร' });
    const id = await withTransaction(async (conn) => {
      const [r] = await conn.query('INSERT INTO customers (name, phone, note) VALUES (?, ?, ?)', [name, phone, note]);
      await auditLog.record(conn, { userId: req.user.userId, action: 'CREATE_CUSTOMER', entityType: 'customer', entityId: r.insertId, ip: clientIp(req) });
      return r.insertId;
    });
    return res.status(201).json({ customer: { customer_id: id, name, phone, note, is_active: 1, outstanding: 0 } });
  } catch (err) { return next(err); }
}

async function listOpen(req, res, next) {
  try {
    const [orders] = await pool.query(OPEN_SQL);
    const [customers] = orders.length
      ? await pool.query('SELECT customer_id, name, phone FROM customers WHERE customer_id IN (?)', [[...new Set(orders.map((o) => o.customer_id))]])
      : [[]];
    const byCustomer = new Map(customers.map((c) => [c.customer_id, { ...c, orders: [], outstanding: 0 }]));
    for (const o of orders) {
      const outstanding = round2(o.total_amount - o.paid_amount);
      const c = byCustomer.get(o.customer_id);
      c.orders.push({ ...o, outstanding });
      c.outstanding = round2(c.outstanding + outstanding);
    }
    const list = [...byCustomer.values()].sort((a, b) => b.outstanding - a.outstanding);
    return res.json({ customers: list, totalOutstanding: round2(list.reduce((s, c) => s + c.outstanding, 0)) });
  } catch (err) { return next(err); }
}

async function receivePayment(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const amount = round2(Number(req.body?.amount));
    const method = req.body?.method;
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 255) : null;
    if (!(amount > 0)) return res.status(400).json({ error: 'จำนวนเงินต้องมากกว่า 0' });
    if (!PAY_METHODS.includes(method)) return res.status(400).json({ error: 'วิธีรับเงินต้องเป็น cash, promptpay หรือ transfer' });

    const result = await withTransaction(async (conn) => {
      // ล็อกใบนี้ไว้ กันสองเครื่องรับชำระใบเดียวกันพร้อมกันจนเกินยอด
      const [[o]] = await conn.query(
        'SELECT order_id, order_no, total_amount, status, payment_method, settled_at FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
      if (!o) return { status: 404, error: 'ไม่พบคำสั่งซื้อ' };
      if (o.payment_method !== 'credit') return { status: 409, error: `${o.order_no} ไม่ใช่ใบขายเชื่อ` };
      if (o.status === 'cancelled') return { status: 409, error: `${o.order_no} ถูกยกเลิกแล้ว` };
      if (o.settled_at) return { status: 409, error: `${o.order_no} ชำระครบแล้ว` };
      const [[{ paid }]] = await conn.query('SELECT COALESCE(SUM(amount), 0) AS paid FROM credit_payments WHERE order_id = ?', [orderId]);
      const outstanding = round2(o.total_amount - paid);
      if (amount > outstanding) return { status: 409, error: `รับเกินยอดค้าง (ค้าง ${outstanding} บาท)` };
      await conn.query('INSERT INTO credit_payments (order_id, amount, method, received_by, note) VALUES (?, ?, ?, ?, ?)',
        [orderId, amount, method, req.user.userId, note]);
      const left = round2(outstanding - amount);
      if (left === 0) await conn.query('UPDATE orders SET settled_at = NOW() WHERE order_id = ?', [orderId]);
      await auditLog.record(conn, { userId: req.user.userId, action: 'RECEIVE_PAYMENT', entityType: 'order', entityId: orderId, ip: clientIp(req) });
      return { orderNo: o.order_no, received: amount, outstanding: left, settled: left === 0 };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    queue.broadcast('order.payment', { orderId, ...result });
    return res.status(201).json(result);
  } catch (err) { return next(err); }
}

module.exports = { listCustomers, createCustomer, listOpen, receivePayment, PAY_METHODS };
