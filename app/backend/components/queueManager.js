// ---------------------------------------------------------------------
// Queue Manager — คิวรอจ่ายสินค้าแบบเรียลไทม์   [FR-04 · UC-05, UC-06]
//
// รับผิดชอบสองอย่าง
//   1) ผลักเหตุการณ์จากฝั่งเซิร์ฟเวอร์ไปยังหน้าจอคิว ผ่าน WebSocket
//      โดยมี Server-Sent Events เป็นช่องทางสำรอง (SRS §3.1.4)
//   2) ให้บริการรายการคิวและการปรับสถานะการจัดของ
//
// เกณฑ์เวลาตาม NFR-02 คือคำสั่งซื้อใหม่ต้องปรากฏบนหน้าจอคิวภายใน 3 วินาที
// จึงใช้การผลักข้อมูลแทนการให้หน้าจอวนถามเป็นระยะ
// ---------------------------------------------------------------------
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const auditLog = require('./auditLogService');
const { clientIp } = require('../middleware/auth');

const wsClients = new Set();
const sseClients = new Set();

/** ผลักเหตุการณ์ไปยังผู้ติดตามทุกรายทั้งสองช่องทาง */
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload, at: new Date().toISOString() });

  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(message);
  }
  for (const res of sseClients) {
    res.write(`data: ${message}\n\n`);
  }
  return wsClients.size + sseClients.size;
}

/**
 * ผูกเซิร์ฟเวอร์ WebSocket เข้ากับเซิร์ฟเวอร์ HTTPS ที่กำลังทำงานอยู่
 *
 * เบราว์เซอร์กำหนดหัวข้อคำขอ WebSocket เองไม่ได้ จึงรับโทเคนผ่านสตริงคำค้น
 * แล้วตรวจสอบก่อนรับเข้าเป็นผู้ติดตาม ทุกการเชื่อมต่อยังต้องผ่านการยืนยัน
 * ตัวตนเช่นเดียวกับ REST API ตามที่ NFR-01 กำหนด
 */
function attach(server) {
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url, 'https://localhost');
      const payload = jwt.verify(url.searchParams.get('token'), process.env.JWT_SECRET);
      ws.user = { userId: payload.sub, role: payload.role };
    } catch (err) {
      ws.close(4401, 'unauthorized');
      return;
    }

    wsClients.add(ws);
    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
  });

  return wss;
}

/** ช่องทางสำรองเมื่อเครือข่ายหรือเบราว์เซอร์ไม่รองรับ WebSocket */
function events(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(': connected\n\n');

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

/**
 * รายการคำสั่งซื้อที่รออยู่ในคิว   [UC-05]
 *
 * เรียงตามเวลาที่รับชำระเงินจากเก่าไปใหม่ เพื่อให้พนักงานจัดของตามลำดับ
 * ก่อนหลังได้อย่างเป็นธรรม ตามที่อธิบายไว้ในหัวข้อ 3.8.3
 */
async function listQueue(req, res, next) {
  try {
    const [orders] = await pool.query(
      `SELECT o.order_id, o.order_no, o.total_amount, o.status, o.paid_at,
              TIMESTAMPDIFF(SECOND, o.paid_at, NOW()) AS waited_seconds,
              u.full_name AS created_by_name
         FROM orders o
         JOIN users u ON u.user_id = o.created_by
        WHERE o.status IN ('awaiting_dispatch', 'picking')
        ORDER BY o.paid_at ASC`
    );

    if (orders.length === 0) return res.json({ orders: [] });

    const [items] = await pool.query(
      `SELECT i.order_id, i.qty, i.unit_price, i.line_total,
              p.product_id, p.sku, p.name, p.unit
         FROM order_items i
         JOIN products p ON p.product_id = i.product_id
        WHERE i.order_id IN (?)
        ORDER BY i.order_item_id`,
      [orders.map((o) => o.order_id)]
    );

    const byOrder = new Map(orders.map((o) => [o.order_id, { ...o, items: [] }]));
    for (const item of items) byOrder.get(item.order_id).items.push(item);

    return res.json({ orders: [...byOrder.values()] });
  } catch (err) {
    return next(err);
  }
}

// การเปลี่ยนสถานะที่อนุญาต ตามแผนภาพสถานะในรูปที่ 3.13
// สถานะ delivered ไม่อยู่ในตารางนี้ เพราะต้องผ่านธุรกรรมตัดสต็อกใน
// Dispatch Controller เท่านั้น จะเปลี่ยนตรง ๆ ผ่านเส้นทางนี้ไม่ได้
const ALLOWED_TRANSITIONS = {
  awaiting_dispatch: ['picking', 'cancelled'],
  picking: ['awaiting_dispatch'],
};

/** ปรับสถานะการจัดของในคิวงาน   [UC-06] */
async function updateStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};

    const [rows] = await pool.query('SELECT order_id, order_no, status FROM orders WHERE order_id = ?', [orderId]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อที่ระบุ' });

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({
        error: `เปลี่ยนสถานะจาก ${order.status} เป็น ${status} ไม่ได้`,
        currentStatus: order.status,
      });
    }

    // การยกเลิกคำสั่งซื้อเป็นสิทธิ์ของผู้จัดการเท่านั้น ตามรูปที่ 3.13
    if (status === 'cancelled' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'เฉพาะผู้จัดการเท่านั้นที่ยกเลิกคำสั่งซื้อได้' });
    }

    const [result] = await pool.query(
      'UPDATE orders SET status = ? WHERE order_id = ? AND status = ?',
      [status, orderId, order.status]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ error: 'สถานะคำสั่งซื้อถูกเปลี่ยนโดยผู้ใช้อื่นไปแล้ว' });
    }

    await auditLog.record(null, {
      userId: req.user.userId,
      action: 'UPDATE_ORDER_STATUS',
      entityType: 'order',
      entityId: orderId,
      detail: { from: order.status, to: status },
      ip: clientIp(req),
    });

    broadcast('order.status_changed', { orderId, orderNo: order.order_no, from: order.status, to: status });

    return res.json({ orderId, orderNo: order.order_no, status });
  } catch (err) {
    return next(err);
  }
}

module.exports = { attach, events, broadcast, listQueue, updateStatus, ALLOWED_TRANSITIONS };
