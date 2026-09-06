// ---------------------------------------------------------------------
// Order Controller — สร้างคำสั่งซื้อและออกใบเสร็จ   [FR-03 · UC-03, UC-04]
//
// จังหวะการเขียนฐานข้อมูล
//   POST /api/orders/quote  คำนวณยอดรวมและสร้างรหัส QR โดยไม่เขียนฐานข้อมูล
//   POST /api/orders        เขียนคำสั่งซื้อลงฐานข้อมูลเมื่อยืนยันรับชำระแล้ว
//
// ออกแบบให้เขียนแถวครั้งเดียวตอนรับชำระเงิน เพราะแผนภาพสถานะในรูปที่ 3.13
// กำหนดให้สถานะแรกของคำสั่งซื้อคือ awaiting_dispatch ซึ่งเกิดขึ้นเมื่อยืนยัน
// รับชำระเงินแล้ว และคอลัมน์ paid_at ในตารางที่ 3.6 เป็น NOT NULL
// ผลคือคำสั่งซื้อในฐานข้อมูลมีสถานะเดียวคือชำระเงินแล้ว ไม่มีแถวค้างจาก
// ตะกร้าที่ลูกค้าเดินหนี
// ---------------------------------------------------------------------
const { pool, withTransaction } = require('../config/db');
const { buildPayload } = require('../lib/promptpay');
const auditLog = require('./auditLogService');
const printServiceClient = require('./printServiceClient');
const queueManager = require('./queueManager');
const { clientIp } = require('../middleware/auth');

const MAX_ORDER_NO_RETRIES = 10;

/** ตรวจรูปแบบรายการสินค้าที่ส่งเข้ามา */
function parseItems(body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return { error: 'ต้องมีรายการสินค้าอย่างน้อยหนึ่งรายการ' };
  }

  const parsed = [];
  for (const raw of items) {
    const productId = Number(raw?.productId);
    const qty = Number(raw?.qty);
    if (!Number.isInteger(productId) || productId <= 0) {
      return { error: 'รหัสสินค้าไม่ถูกต้อง' };
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return { error: 'จำนวนสินค้าต้องเป็นจำนวนเต็มมากกว่าศูนย์' };
    }
    parsed.push({ productId, qty });
  }

  // รวมรายการสินค้าเดียวกันที่ส่งซ้ำมาให้เหลือแถวเดียว
  const merged = new Map();
  for (const item of parsed) {
    merged.set(item.productId, (merged.get(item.productId) || 0) + item.qty);
  }
  return { items: [...merged].map(([productId, qty]) => ({ productId, qty })) };
}

/**
 * ดึงราคาปัจจุบันจากฐานข้อมูลแล้วคำนวณยอดรวม
 *
 * ราคาต้องอ่านจากฐานข้อมูลเสมอ ไม่รับราคาที่ส่งมาจากหน้าจอ มิฉะนั้นผู้ใช้
 * ที่แก้คำขอระหว่างทางจะกำหนดราคาขายเองได้
 */
async function priceItems(executor, items) {
  const [rows] = await executor.query(
    'SELECT product_id, sku, name, unit, price, stock_qty, is_active FROM products WHERE product_id IN (?)',
    [items.map((i) => i.productId)]
  );
  const byId = new Map(rows.map((r) => [r.product_id, r]));

  const priced = [];
  let totalAmount = 0;

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) {
      return { error: `ไม่พบสินค้ารหัส ${item.productId}` };
    }
    if (!product.is_active) {
      return { error: `สินค้า ${product.name} ปิดการขายอยู่` };
    }

    const unitPrice = Number(product.price);
    const lineTotal = Number((unitPrice * item.qty).toFixed(2));
    totalAmount += lineTotal;

    priced.push({
      productId: product.product_id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      qty: item.qty,
      unitPrice,
      lineTotal,
      stockQty: product.stock_qty,
    });
  }

  return { items: priced, totalAmount: Number(totalAmount.toFixed(2)) };
}

/**
 * คำนวณยอดรวมและสร้างรหัส QR พร้อมเพย์ โดยยังไม่บันทึกลงฐานข้อมูล
 * หน้าจอ POS เรียกใช้ทุกครั้งที่รายการในตะกร้าเปลี่ยน
 */
async function quote(req, res, next) {
  try {
    const parsed = parseItems(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const priced = await priceItems(pool, parsed.items);
    if (priced.error) return res.status(400).json({ error: priced.error });

    if (!process.env.PROMPTPAY_ID) {
      return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าหมายเลขพร้อมเพย์ของร้านในไฟล์ .env' });
    }

    return res.json({
      items: priced.items,
      totalAmount: priced.totalAmount,
      qrPayload: buildPayload(process.env.PROMPTPAY_ID, priced.totalAmount),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * สร้างเลขที่คำสั่งซื้อถัดไปของวัน รูปแบบ ORD-YYYYMMDD-NNNN   [UC-04]
 *
 * ค่าลำดับอ่านจากเลขที่ล่าสุดของวันนั้นในฐานข้อมูล ไม่ได้นับในหน่วยความจำ
 * ระบบจึงให้เลขที่ต่อเนื่องถูกต้องแม้เริ่มเซิร์ฟเวอร์ใหม่ และมีดัชนี
 * uq_orders_order_no เป็นหลักประกันชั้นสุดท้ายว่าเลขที่จะไม่ซ้ำกัน
 *
 * คำสั่ง SELECT ใช้ FOR UPDATE เพื่อล็อกช่วงเลขที่ของวันนั้นไว้จนกว่าธุรกรรม
 * จะสิ้นสุด ทำให้พนักงานขายหลายเครื่องที่กดบันทึกพร้อมกันได้เลขที่เรียงต่อกัน
 * ทีละราย แทนที่จะอ่านค่าสูงสุดเดียวกันแล้วแย่งกันเขียนจนล้มเหลว
 * เป็นหลักการล็อกระดับแถวแบบเดียวกับธุรกรรมตัดสต็อกในหัวข้อ 3.5.3
 */
async function nextOrderNo(conn, now = new Date()) {
  const yyyymmdd =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const prefix = `ORD-${yyyymmdd}-`;

  const [rows] = await conn.query(
    'SELECT order_no FROM orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1 FOR UPDATE',
    [`${prefix}%`]
  );

  const lastSeq = rows.length ? Number(rows[0].order_no.slice(prefix.length)) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

/**
 * บันทึกคำสั่งซื้อที่รับชำระเงินแล้ว   [UC-03 · UC-04]
 *
 * ทั้งการเขียน orders, order_items และ audit_logs อยู่ในธุรกรรมเดียว
 * ถ้าขั้นตอนใดล้มเหลวจะไม่มีคำสั่งซื้อครึ่ง ๆ กลาง ๆ ค้างในฐานข้อมูล
 */
async function create(req, res, next) {
  try {
    const parsed = parseItems(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    let order;
    let attempt = 0;

    // วนใหม่เมื่อเลขที่คำสั่งซื้อชนกับที่พนักงานขายอีกเครื่องเพิ่งบันทึกไป
    for (;;) {
      try {
        order = await withTransaction(async (conn) => {
          const priced = await priceItems(conn, parsed.items);
          if (priced.error) {
            const err = new Error(priced.error);
            err.status = 400;
            err.publicMessage = priced.error;
            throw err;
          }

          const orderNo = await nextOrderNo(conn);
          const [result] = await conn.query(
            `INSERT INTO orders (order_no, total_amount, status, created_by, paid_at)
             VALUES (?, ?, 'awaiting_dispatch', ?, NOW())`,
            [orderNo, priced.totalAmount, req.user.userId]
          );
          const orderId = result.insertId;

          await conn.query(
            `INSERT INTO order_items (order_id, product_id, qty, unit_price, line_total) VALUES ?`,
            [priced.items.map((i) => [orderId, i.productId, i.qty, i.unitPrice, i.lineTotal])]
          );

          await auditLog.record(conn, {
            userId: req.user.userId,
            action: 'CREATE_ORDER',
            entityType: 'order',
            entityId: orderId,
            detail: { orderNo, totalAmount: priced.totalAmount, itemCount: priced.items.length },
            ip: clientIp(req),
          });

          return { orderId, orderNo, totalAmount: priced.totalAmount, items: priced.items };
        });
        break;
      } catch (err) {
        // ER_DUP_ENTRY  เลขที่ชนกัน (เหลือเป็นตาข่ายรองรับหลังใช้ FOR UPDATE แล้ว)
        // ER_LOCK_DEADLOCK / ER_LOCK_WAIT_TIMEOUT  เกิดได้เมื่อหลายเครื่องรอล็อกช่วงเลขที่เดียวกัน
        const retryable =
          (err.code === 'ER_DUP_ENTRY' && String(err.sqlMessage || '').includes('uq_orders_order_no')) ||
          err.code === 'ER_LOCK_DEADLOCK' ||
          err.code === 'ER_LOCK_WAIT_TIMEOUT';
        if (!retryable || ++attempt >= MAX_ORDER_NO_RETRIES) throw err;

        // ถอยหลังแบบสุ่มก่อนลองใหม่ เพื่อไม่ให้ทุกคำขอกลับมาชนกันซ้ำพร้อมกันอีก
        await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.random() * 20));
      }
    }

    // ---- หลัง COMMIT เท่านั้น จึงสั่งพิมพ์และผลักเข้าคิว ----
    // เรียงลำดับเช่นนี้เพื่อไม่ให้หน้าจอคิวเห็นคำสั่งซื้อที่ธุรกรรมยังไม่สำเร็จ
    const printResult = await printServiceClient.printReceipt({
      orderNo: order.orderNo,
      totalAmount: order.totalAmount,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      cashierName: req.user.fullName,
      paidAt: new Date().toISOString(),
    });

    queueManager.broadcast('order.created', {
      orderId: order.orderId,
      orderNo: order.orderNo,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
    });

    return res.status(201).json({
      order: {
        orderId: order.orderId,
        orderNo: order.orderNo,
        totalAmount: order.totalAmount,
        status: 'awaiting_dispatch',
        items: order.items,
      },
      // ผลการพิมพ์แยกจากผลการบันทึก เพื่อให้หน้าจอเตือนได้โดยคำสั่งซื้อยังสมบูรณ์
      print: printResult,
    });
  } catch (err) {
    return next(err);
  }
}

/** รายละเอียดคำสั่งซื้อหนึ่งรายการ ใช้บนหน้าจอยืนยันจ่ายสินค้า   [UC-07] */
async function getById(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const [orders] = await pool.query(
      `SELECT o.order_id, o.order_no, o.total_amount, o.status, o.paid_at,
              o.dispatched_at, u.full_name AS created_by_name
         FROM orders o
         JOIN users u ON u.user_id = o.created_by
        WHERE o.order_id = ?`,
      [orderId]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อที่ระบุ' });

    const [items] = await pool.query(
      `SELECT i.qty, i.unit_price, i.line_total,
              p.product_id, p.sku, p.name, p.unit, p.stock_qty
         FROM order_items i
         JOIN products p ON p.product_id = i.product_id
        WHERE i.order_id = ?
        ORDER BY i.order_item_id`,
      [orderId]
    );

    return res.json({
      order: {
        ...orders[0],
        items: items.map((i) => ({
          ...i,
          // คอลัมน์ "คงเหลือหลังจ่าย" บนหน้าจอยืนยันจ่าย ตามรูปที่ 3.17
          stockAfterDispatch: i.stock_qty - i.qty,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { quote, create, getById, nextOrderNo, parseItems, priceItems };
