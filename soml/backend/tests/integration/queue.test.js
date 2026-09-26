// ส่วนจัดการคิวงาน                     [ตารางที่ 3.13 โมดูล 4 · FR-04 · UC-05, UC-06 · AC-06 · ตาราง 3.20]
const http = require('http');
const WebSocket = require('ws');
const { app, request, pool, allTokens, auth } = require('./helpers');
const queue = require('../../modules/queue');

let tokens;
beforeAll(async () => { tokens = await allTokens(); });
afterAll(() => pool.end());

/** ยังไม่มี modules/order (ขั้น 12) จึงใส่คำสั่งซื้อลงฐานตรง ๆ ตามรูปที่ schema กำหนด */
async function insertOrder(orderNo, status = 'awaiting_dispatch', paidAt = 'NOW()') {
  const [r] = await pool.query(
    `INSERT INTO orders (order_no, total_amount, status, created_by, paid_at) VALUES (?, 100, ?, 1, ${paidAt})`,
    [orderNo, status]
  );
  await pool.query('INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, 1, 2, 50)', [r.insertId]);
  return r.insertId;
}

describe('GET /api/queue', () => {
  let older, newer, done;
  beforeAll(async () => {
    older = await insertOrder('Q-OLD', 'awaiting_dispatch', "NOW() - INTERVAL 10 MINUTE");
    newer = await insertOrder('Q-NEW', 'picking');
    done = await insertOrder('Q-DONE', 'delivered');
  });

  test('พนักงานขายดูคิวไม่ได้ (403) — คลังและผู้จัดการดูได้', async () => {
    expect((await auth(tokens.sales)(request(app).get('/api/queue'))).status).toBe(403);
    expect((await auth(tokens.warehouse)(request(app).get('/api/queue'))).status).toBe(200);
    expect((await auth(tokens.manager)(request(app).get('/api/queue'))).status).toBe(200);
  });

  test('แสดงเฉพาะที่รอจ่ายและกำลังจัด เรียงเก่าไปใหม่ พร้อมเวลาที่รอและรายการสินค้า', async () => {
    const { body } = await auth(tokens.warehouse)(request(app).get('/api/queue'));
    const ids = body.queue.map((o) => o.order_id);
    expect(ids).toContain(older);
    expect(ids).toContain(newer);
    expect(ids).not.toContain(done);
    expect(ids.indexOf(older)).toBeLessThan(ids.indexOf(newer));
    const first = body.queue.find((o) => o.order_id === older);
    expect(first.waited_seconds).toBeGreaterThanOrEqual(590);
    expect(first.items[0]).toMatchObject({ qty: 2, unit_price: 50, sku: '100001' });
    expect(first.created_by_name).toBe('ศริพรรณ ศิริกันทา');
  });
});

describe('PATCH /api/orders/:id/status — ตาราง 3.20', () => {
  let id;
  beforeEach(async () => { id = await insertOrder(`S-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`); });
  const patch = (token, status) => auth(token)(request(app).patch(`/api/orders/${id}/status`).send({ status }));
  const statusOf = async () => (await pool.query('SELECT status FROM orders WHERE order_id = ?', [id]))[0][0].status;

  test('คลังเริ่มจัดของ: awaiting_dispatch → picking และมีประวัติ', async () => {
    const res = await patch(tokens.warehouse, 'picking');
    expect(res.status).toBe(200);
    expect(await statusOf()).toBe('picking');
    const [logs] = await pool.query("SELECT * FROM audit_logs WHERE action = 'UPDATE_STATUS' AND entity_id = ?", [id]);
    expect(logs).toHaveLength(1);
  });

  test('หยิบผิด ถอยกลับได้: picking → awaiting_dispatch', async () => {
    await patch(tokens.warehouse, 'picking');
    expect((await patch(tokens.warehouse, 'awaiting_dispatch')).status).toBe(200);
    expect(await statusOf()).toBe('awaiting_dispatch');
  });

  test('ยกเลิกได้ทั้งจาก awaiting_dispatch และ picking แต่เฉพาะผู้จัดการ', async () => {
    expect((await patch(tokens.warehouse, 'cancelled')).status).toBe(403);
    await patch(tokens.warehouse, 'picking');
    expect((await patch(tokens.manager, 'cancelled')).status).toBe(200);
    expect(await statusOf()).toBe('cancelled');
    const [logs] = await pool.query("SELECT * FROM audit_logs WHERE action = 'CANCEL_ORDER' AND entity_id = ?", [id]);
    expect(logs).toHaveLength(1);
  });

  test('delivered ตั้งผ่านเส้นทางนี้ไม่ได้ — เกิดได้ทางเดียวคือธุรกรรมตัดสต็อก', async () => {
    expect((await patch(tokens.manager, 'delivered')).status).toBe(400);
    expect(await statusOf()).toBe('awaiting_dispatch');
  });

  test('สถานะปลายทางเปลี่ยนต่อไม่ได้: cancelled → picking ถูกปฏิเสธ', async () => {
    await patch(tokens.manager, 'cancelled');
    expect((await patch(tokens.warehouse, 'picking')).status).toBe(409);
    expect(await statusOf()).toBe('cancelled');
  });

  test('ไม่พบคำสั่งซื้อ → 404', async () => {
    expect((await auth(tokens.warehouse)(request(app).patch('/api/orders/999999/status').send({ status: 'picking' }))).status).toBe(404);
  });
});

describe('ช่องทางค้าง — broadcast ถึงหน้าจอที่เปิดอยู่ [AC-06 · 3.5.2]', () => {
  let server, port;
  beforeAll((done) => {
    server = http.createServer(app);
    queue.attach(server);
    server.listen(0, () => { port = server.address().port; done(); });
  });
  afterAll((done) => { server.close(done); });

  test('WebSocket: ต้องมีโทเคน ไม่มีถูกปิดด้วยรหัส 4401', (done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('close', (code) => { expect(code).toBe(4401); done(); });
  });

  test('WebSocket: มีโทเคนแล้วได้รับเหตุการณ์ที่ broadcast ภายใน 3 วินาที', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${tokens.warehouse}`);
    await new Promise((r) => ws.on('open', r));
    const received = new Promise((r) => ws.on('message', (m) => r(JSON.parse(m))));
    const started = Date.now();
    queue.broadcast('order.created', { orderNo: 'WS-1' });
    const msg = await received;
    expect(Date.now() - started).toBeLessThan(3000);
    expect(msg).toMatchObject({ event: 'order.created', data: { orderNo: 'WS-1' } });
    ws.close();
  });

  test('SSE ทางสำรอง: /api/events ต้องมีโทเคน และได้รับเหตุการณ์เดียวกัน', async () => {
    expect((await request(app).get('/api/events')).status).toBe(401);

    const chunks = await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/api/events?token=${tokens.warehouse}`, (res) => {
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
        let buf = '';
        res.on('data', (c) => {
          buf += c;
          if (buf.includes('event: order.created')) { req.destroy(); resolve(buf); }
        });
        // พอช่องทางเปิดแล้ว (ได้ ready) ค่อยยิงเหตุการณ์
        res.once('data', () => setTimeout(() => queue.broadcast('order.created', { orderNo: 'SSE-1' }), 20));
      });
      req.on('error', (e) => (e.code === 'ECONNRESET' ? null : reject(e)));
    });
    expect(chunks).toContain('event: ready');
    expect(chunks).toContain('data: {"orderNo":"SSE-1"}');
  });
});
