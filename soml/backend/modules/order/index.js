// ---------------------------------------------------------------------
// ส่วนควบคุมคำสั่งซื้อ (Order Controller)   [ตารางที่ 3.13 โมดูล 3 · FR-03 · UC-03, UC-04 · รูปที่ 3.10]
//
// รับผิดชอบเรื่องเดียว: เปลี่ยน "ตะกร้าบนหน้าจอ" ให้เป็น "คำสั่งซื้อที่ชำระแล้ว" อย่างถูกต้องครั้งเดียว
//   POST /api/orders/quote   คำนวณยอดจากราคาในฐาน + สร้าง QR — ไม่เขียนฐานข้อมูล
//   POST /api/orders         ธุรกรรมเดียว: เลขที่ → orders → order_items → audit → COMMIT
//                            แล้วจึงพิมพ์ใบเสร็จและผลักเข้าคิว (นอกธุรกรรม)
//   GET  /api/orders/:id     รายละเอียดหนึ่งใบ ให้หน้าจ่ายสินค้าใช้ (UC-07)
//
// ลำดับตามรูปที่ 3.10 ทุกขั้น — ลำดับนี้คือสาระสำคัญของโมดูล:
//   ราคาอ่านจากฐานเสมอ ไม่รับจากหน้าจอ · คำสั่งซื้อถูกเขียนเมื่อชำระแล้วเท่านั้น (3.7.2 ข้อ 3)
//   พิมพ์และผลักเข้าคิวเกิด "หลัง COMMIT" (2.1.2) · พิมพ์ล้มไม่ทำให้การขายล้ม (UC-03 ทางที่ล้มเหลว)
// ---------------------------------------------------------------------
const { pool, withTransaction } = require('../../config/db');
const { buildPayload } = require('../../lib/promptpay');
const { clientIp } = require('../../middleware/auth');
const auditLog = require('../audit-log');
const printClient = require('../print-client');
const queue = require('../queue');

const MAX_ORDER_NO_RETRIES = 12;
// ถอยหลังแบบทวีคูณก่อนขอเลขใหม่ — การวัด TC-14 พบว่าเมื่อหลายเครื่องสร้างคำสั่งซื้อรัวต่อเนื่อง
// การถอยหลังแบบเพิ่มทีละน้อยทำให้ทุกเครื่องกลับมาชนกันซ้ำจนครบจำนวนครั้งที่ลองใหม่ได้
const retryDelayMs = (attempt) => Math.min(400, 15 * 2 ** (attempt - 1)) + Math.random() * 30;

/**
 * ข้อผิดพลาดที่แปลว่า "เครื่องอื่นเพิ่งบันทึกเลขเดียวกันพร้อมกัน" — ลองใหม่ได้ (UC-03 ทางเลือกที่ยังสำเร็จ)
 *   ER_DUP_ENTRY บน uq_orders_order_no  เลขที่ชนกันจริง
 *   ER_LOCK_DEADLOCK / ER_LOCK_WAIT_TIMEOUT  ตอนยังไม่มีเลขของวันนั้น FOR UPDATE บนช่วงว่างเป็น gap lock
 *     ที่หลายธุรกรรมถือร่วมกันได้ พอ INSERT พร้อมกันจึงรอกันเอง InnoDB จะยกเลิกให้หนึ่งฝ่าย
 */
function isOrderNoCollision(err) {
  return (err.code === 'ER_DUP_ENTRY' && String(err.sqlMessage || '').includes('uq_orders_order_no'))
    || err.code === 'ER_LOCK_DEADLOCK' || err.code === 'ER_LOCK_WAIT_TIMEOUT';
}

/** ตรวจรูปแบบตะกร้า และรวมสินค้าเดียวกันที่ส่งซ้ำให้เหลือแถวเดียว คืน { error } หรือ { items } */
function parseItems(body) {
  const raw = Array.isArray(body?.items) ? body.items : [];
  if (raw.length === 0) return { error: 'ต้องมีสินค้าอย่างน้อยหนึ่งรายการ' };
  const merged = new Map();
  for (const r of raw) {
    const productId = Number(r?.productId);
    const qty = Number(r?.qty);
    if (!Number.isInteger(productId) || productId <= 0) return { error: 'รหัสสินค้าไม่ถูกต้อง' };
    if (!Number.isInteger(qty) || qty <= 0) return { error: 'จำนวนต้องเป็นจำนวนเต็มมากกว่าศูนย์' };
    merged.set(productId, (merged.get(productId) || 0) + qty);
  }
  return { items: [...merged].map(([productId, qty]) => ({ productId, qty })) };
}

/**
 * ตีราคาตะกร้าด้วยราคาปัจจุบันในฐานข้อมูล — หน้าจอส่งมาแค่ (รหัส, จำนวน)
 * คืน { error } หรือ { items: [{productId, sku, name, unit, qty, unitPrice, lineTotal}], totalAmount }
 */
async function priceItems(conn, items) {
  const [rows] = await conn.query(
    'SELECT product_id, sku, name, unit, price, is_active FROM products WHERE product_id IN (?)',
    [items.map((i) => i.productId)]
  );
  const byId = new Map(rows.map((r) => [r.product_id, r]));
  const priced = [];
  let total = 0;
  for (const { productId, qty } of items) {
    const p = byId.get(productId);
    if (!p) return { error: `ไม่พบสินค้ารหัส ${productId}` };
    if (!p.is_active) return { error: `${p.name} เลิกขายแล้ว` };
    const lineTotal = Math.round(p.price * qty * 100) / 100; // ปัดเป็นสตางค์ กันเศษทศนิยมของ double
    priced.push({ productId, sku: p.sku, name: p.name, unit: p.unit, qty, unitPrice: p.price, lineTotal });
    total += lineTotal;
  }
  return { items: priced, totalAmount: Math.round(total * 100) / 100 };
}

/**
 * ออกเลขที่คำสั่งซื้อไม่ซ้ำ รูปแบบ ORD-YYYYMMDD-NNNN รันต่อวัน           [UC-04 · AC-04]
 * ล็อกเลขล่าสุดของวันด้วย FOR UPDATE ให้เครื่องที่มาพร้อมกันต้องรอคิว (2.1.3)
 * UNIQUE(order_no) ในฐานเป็นตาข่ายรองรับอีกชั้น ถ้าชนจริงผู้เรียกจะลองใหม่
 */
async function nextOrderNo(conn) {
  const [[{ today }]] = await conn.query("SELECT DATE_FORMAT(NOW(), '%Y%m%d') AS today");
  const prefix = `ORD-${today}-`;
  const [[last]] = await conn.query(
    'SELECT order_no FROM orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1 FOR UPDATE',
    [`${prefix}%`]
  );
  const seq = last ? Number(last.order_no.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** POST /api/orders/quote { items } — ไม่เขียนฐานข้อมูล */
async function quote(req, res, next) {
  try {
    const parsed = parseItems(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const priced = await priceItems(pool, parsed.items);
    if (priced.error) return res.status(400).json({ error: priced.error });
    // ยังไม่ตั้งหมายเลขพร้อมเพย์ของร้าน = ระบบยังไม่พร้อมรับชำระ ไม่ใช่ความผิดของคำขอ (503)
    if (!process.env.PROMPTPAY_ID) return res.status(503).json({ error: 'ยังไม่ได้ตั้งหมายเลขพร้อมเพย์ของร้าน (PROMPTPAY_ID ใน .env)' });
    const qrPayload = buildPayload(process.env.PROMPTPAY_ID, priced.totalAmount);
    return res.json({ items: priced.items, totalAmount: priced.totalAmount, qrPayload });
  } catch (err) { return next(err); }
}

/** POST /api/orders { items } — เรียกเมื่อพนักงานยืนยันรับชำระแล้วเท่านั้น */
async function create(req, res, next) {
  try {
    const parsed = parseItems(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    let order;
    for (let attempt = 1; ; attempt++) {
      try {
        order = await withTransaction(async (conn) => {
          const priced = await priceItems(conn, parsed.items);
          if (priced.error) { const e = new Error(priced.error); e.status = 400; e.publicMessage = priced.error; throw e; }

          const orderNo = await nextOrderNo(conn);
          const [r] = await conn.query(
            "INSERT INTO orders (order_no, total_amount, status, created_by, paid_at) VALUES (?, ?, 'awaiting_dispatch', ?, NOW())",
            [orderNo, priced.totalAmount, req.user.userId]
          );
          const orderId = r.insertId;
          // 3.7.2 ข้อ 1: คัดลอกราคา ณ เวลาขายลง order_items
          await conn.query(
            'INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES ?',
            [priced.items.map((i) => [orderId, i.productId, i.qty, i.unitPrice])]
          );
          await auditLog.record(conn, { userId: req.user.userId, action: 'CREATE_ORDER', entityType: 'order', entityId: orderId, ip: clientIp(req) });
          return { orderId, orderNo, totalAmount: priced.totalAmount, items: priced.items };
        });
        break;
      } catch (err) {
        if (!isOrderNoCollision(err) || attempt >= MAX_ORDER_NO_RETRIES) throw err;
        // ถอยหลังก่อนขอเลขใหม่ เพื่อไม่ให้ทุกเครื่องกลับมาชนกันซ้ำพร้อมกันอีก
        await new Promise((r) => setTimeout(r, retryDelayMs(attempt)));
      }
    }

    // ---- หลัง COMMIT เท่านั้น ----
    const print = await printClient.printReceipt({
      orderNo: order.orderNo,
      paidAt: new Date().toISOString(),
      cashierName: req.user.fullName,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      totalAmount: order.totalAmount,
    });
    queue.broadcast('order.created', { orderId: order.orderId, orderNo: order.orderNo, totalAmount: order.totalAmount, itemCount: order.items.length });

    return res.status(201).json({
      order: { orderId: order.orderId, orderNo: order.orderNo, totalAmount: order.totalAmount, status: 'awaiting_dispatch', items: order.items },
      print, // แยกจากผลการบันทึก — หน้าจอเตือนได้โดยคำสั่งซื้อยังสมบูรณ์
    });
  } catch (err) { return next(err); }
}

/** GET /api/orders/:id */
async function getById(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const [[order]] = await pool.query(
      `SELECT o.order_id, o.order_no, o.total_amount, o.status, o.paid_at, o.dispatched_at,
              u.full_name AS created_by_name
         FROM orders o JOIN users u ON u.user_id = o.created_by WHERE o.order_id = ?`,
      [orderId]
    );
    if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    const [items] = await pool.query(
      `SELECT i.product_id, i.qty, i.unit_price, p.sku, p.name, p.unit, p.stock_qty
         FROM order_items i JOIN products p ON p.product_id = i.product_id
        WHERE i.order_id = ? ORDER BY i.order_item_id`,
      [orderId]
    );
    return res.json({ order: { ...order, items } });
  } catch (err) { return next(err); }
}

module.exports = { quote, create, getById, parseItems, nextOrderNo };
