// ---------------------------------------------------------------------
// ส่วนจัดการคิวงาน (Queue Manager)          [ตารางที่ 3.13 โมดูล 4 · FR-04 · UC-05, UC-06]
//
// รับผิดชอบเรื่องเดียว: "คลังเห็นอะไรอยู่ในคิว และรู้ทันทีเมื่อมีของใหม่"
//   GET   /api/queue                 รายการที่รอจ่าย เรียงตามเวลาชำระ (UC-05)
//   PATCH /api/orders/:id/status     เปลี่ยนสถานะตามแผนภาพ 3.13 / ตาราง 3.20 เท่านั้น (UC-06)
//   broadcast(event, data)           ผลักเหตุการณ์ไปทุกหน้าจอที่เปิดค้าง — order, dispatch เรียก
//   attach(server)                   ผูกช่องทางค้างเข้ากับ http server (server.js เรียก)
//   GET   /api/events                ช่องทางค้างทางเดียว (SSE) เป็นทางสำรอง
//
// ทำไมต้อง "ผลัก" ไม่ให้หน้าจอถามเอง: BR-03 คลังต้องรู้ก่อนลูกค้าเดินไปถึง (NFR-02 ≤ 3 วินาที)
// ทำไมมีสองช่องทาง: 3.5.2 — อุปกรณ์เครือข่ายบางรุ่นยกระดับเป็น WebSocket ไม่ได้ จึงมี SSE สำรอง
//
// สถานะ delivered ตั้งผ่านเส้นทางนี้ไม่ได้ — เกิดได้ทางเดียวคือธุรกรรมตัดสต็อก (ขั้น 13)
// มิฉะนั้นสถานะจะไม่ใช่หลักฐานว่าสต็อกถูกหักแล้วจริง (ย่อหน้าท้ายตาราง 3.20)
// ---------------------------------------------------------------------
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { pool, withTransaction } = require('../../config/db');
const { clientIp, JWT_SECRET } = require('../../middleware/auth');
const auditLog = require('../audit-log');

// ตาราง 3.20 — สถานะที่เปลี่ยนผ่านเส้นทางนี้ได้ (delivered ไม่อยู่ในนี้โดยตั้งใจ)
const TRANSITIONS = Object.freeze({
  awaiting_dispatch: ['picking', 'cancelled'],
  picking: ['awaiting_dispatch', 'cancelled'],
  delivered: [],
  cancelled: [],
});
// ใครเปลี่ยนไปสถานะใดได้ (ตาราง 3.13 โมดูล 4: พนักงานคลังกับผู้จัดการ · ยกเลิกเฉพาะผู้จัดการ)
const WHO_CAN = Object.freeze({ picking: ['warehouse', 'manager'], awaiting_dispatch: ['warehouse', 'manager'], cancelled: ['manager'] });

// ---------- ช่องทางค้าง ----------
const wsClients = new Set();   // WebSocket ที่ยืนยันตัวตนแล้ว
const sseClients = new Set();  // response ของ /api/events ที่เปิดค้าง

/** ส่งเหตุการณ์ไปทุกช่องทาง ผู้เรียกต้องเรียกหลัง commit เท่านั้น เพื่อไม่ให้คิวเห็นของที่ยังไม่มีจริง */
function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, at: new Date().toISOString() });
  for (const ws of wsClients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
  for (const res of sseClients) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

/** ผูก WebSocket ที่เส้นทาง /ws?token=… เข้ากับ http server */
function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    // ช่องทางค้างยืนยันตัวตนด้วยโทเคนในสตริงคำค้น เพราะเบราว์เซอร์กำหนดหัวข้อคำขอของ WebSocket ไม่ได้ (ท้าย 3.6)
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    try {
      jwt.verify(token || '', JWT_SECRET);
    } catch {
      ws.close(4401, 'ต้องเข้าสู่ระบบก่อน');
      return;
    }
    wsClients.add(ws);
    ws.on('close', () => wsClients.delete(ws));
  });
  return wss;
}

/** GET /api/events?token=… — SSE ทางสำรอง อ่านอย่างเดียว */
function events(req, res) {
  try {
    jwt.verify(String(req.query.token || ''), JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อน' });
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.write('event: ready\ndata: {}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

// ---------- คิว ----------
const QUEUE_SQL = `
  SELECT o.order_id, o.order_no, o.total_amount, o.status, o.paid_at,
         TIMESTAMPDIFF(SECOND, o.paid_at, NOW()) AS waited_seconds,
         u.full_name AS created_by_name
    FROM orders o
    JOIN users u ON u.user_id = o.created_by
   WHERE o.status IN ('awaiting_dispatch', 'picking')
   ORDER BY o.paid_at ASC, o.order_id ASC`;

/** GET /api/queue — คิวพร้อมรายการสินค้าของแต่ละใบ เก่าสุดอยู่บน */
async function list(req, res, next) {
  try {
    const [orders] = await pool.query(QUEUE_SQL);
    if (orders.length === 0) return res.json({ queue: [] });
    const [items] = await pool.query(
      `SELECT i.order_id, i.qty, i.unit_price, p.sku, p.name, p.unit
         FROM order_items i JOIN products p ON p.product_id = i.product_id
        WHERE i.order_id IN (?) ORDER BY i.order_item_id`,
      [orders.map((o) => o.order_id)]
    );
    const byOrder = new Map(orders.map((o) => [o.order_id, { ...o, items: [] }]));
    for (const it of items) byOrder.get(it.order_id).items.push(it);
    return res.json({ queue: [...byOrder.values()] });
  } catch (err) { return next(err); }
}

/** PATCH /api/orders/:id/status  { status } */
async function updateStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const target = req.body?.status;
    if (!WHO_CAN[target]) return res.status(400).json({ error: 'สถานะที่ระบุตั้งผ่านเส้นทางนี้ไม่ได้' });
    if (!WHO_CAN[target].includes(req.user.role)) return res.status(403).json({ error: 'บทบาทของคุณเปลี่ยนไปสถานะนี้ไม่ได้' });

    const result = await withTransaction(async (conn) => {
      const [[order]] = await conn.query('SELECT order_id, order_no, status FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
      if (!order) return { notFound: true };
      if (!TRANSITIONS[order.status].includes(target)) {
        return { error: `เปลี่ยนจาก ${order.status} เป็น ${target} ไม่ได้ตามแผนภาพสถานะ` };
      }
      await conn.query('UPDATE orders SET status = ? WHERE order_id = ?', [target, orderId]);
      await auditLog.record(conn, {
        userId: req.user.userId, action: target === 'cancelled' ? 'CANCEL_ORDER' : 'UPDATE_STATUS',
        entityType: 'order', entityId: orderId, ip: clientIp(req),
      });
      return { order: { orderId, orderNo: order.order_no, from: order.status, status: target } };
    });
    if (result.notFound) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    if (result.error) return res.status(409).json({ error: result.error });

    broadcast('order.status', result.order); // หลัง commit — หน้าจอคิวทุกจอเห็นพร้อมกัน
    return res.json(result.order);
  } catch (err) { return next(err); }
}

module.exports = { list, updateStatus, events, broadcast, attach, TRANSITIONS };
