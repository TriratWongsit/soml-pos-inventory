// แจ้งเตือนและแดชบอร์ด   [ตารางที่ 3.13 โมดูล 7, 8 · FR-07, FR-08 · UC-08, 09, 11 · AC-09, AC-10 · BR-04, BR-05]
const { app, request, pool, allTokens, auth } = require('./helpers');
const alert = require('../../modules/alert');

let tokens, P1;
beforeAll(async () => {
  tokens = await allTokens();
  process.env.PRINT_SERVICE_URL = 'http://127.0.0.1:1';
  [[P1]] = await pool.query("SELECT product_id FROM products WHERE sku = '100001'");
  await pool.query('DELETE FROM notifications');
});
afterAll(() => { delete process.env.PRINT_SERVICE_URL; alert.stop(); return pool.end(); });

const setStock = (id, qty, rp) => pool.query('UPDATE products SET stock_qty = ?, reorder_point = ? WHERE product_id = ?', [qty, rp, id]);
const unread = (type, col, id) => pool.query(`SELECT * FROM notifications WHERE type = ? AND ${col} = ? AND is_read = FALSE`, [type, id]).then((r) => r[0]);
async function newOrder(items) { return (await auth(tokens.sales)(request(app).post('/api/orders').send({ items }))).body.order; }

describe('low_stock — สร้างเองหลังสต็อกเปลี่ยน [AC-10 · BR-05]', () => {
  test('จ่ายสินค้าจนต่ำกว่าจุดสั่งซื้อเพิ่ม → มีการแจ้งเตือนทันทีโดยไม่ต้องเปิดดู', async () => {
    await setStock(P1.product_id, 6, 5);
    const o = await newOrder([{ productId: P1.product_id, qty: 2 }]);
    await auth(tokens.warehouse)(request(app).post(`/api/orders/${o.orderId}/dispatch`));
    const rows = await unread('low_stock', 'ref_product_id', P1.product_id);
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toMatch(/เหลือ 4 .*ต่ำกว่าจุดสั่งซื้อเพิ่ม \(5\)/);
  });

  test('ไม่สร้างซ้ำขณะที่ใบเดิมยังไม่ถูกอ่าน', async () => {
    const o = await newOrder([{ productId: P1.product_id, qty: 1 }]);
    await auth(tokens.warehouse)(request(app).post(`/api/orders/${o.orderId}/dispatch`));
    expect(await unread('low_stock', 'ref_product_id', P1.product_id)).toHaveLength(1);
  });

  test('ปรับสต็อกด้วยมือจนต่ำกว่าเกณฑ์ก็เตือน (BR-05 ทุกครั้งที่สต็อกเปลี่ยน)', async () => {
    const [[P2]] = await pool.query("SELECT product_id FROM products WHERE sku = '101001'");
    await setStock(P2.product_id, 10, 8);
    await auth(tokens.manager)(request(app).patch(`/api/products/${P2.product_id}/stock`).send({ change: -5, reason: 'manual_adjust', note: 'นับจริง' }));
    expect(await unread('low_stock', 'ref_product_id', P2.product_id)).toHaveLength(1);
  });

  test('reorder_point = 0 (ยังไม่ตั้ง) ไม่เตือน', async () => {
    const [[P3]] = await pool.query("SELECT product_id FROM products WHERE sku = '103001'");
    await setStock(P3.product_id, 0, 0);
    expect(await alert.checkStock([P3.product_id])).toBe(0);
  });
});

describe('queue_delay — ตรวจเป็นรอบ', () => {
  test('คำสั่งซื้อที่รอเกินเกณฑ์ถูกแจ้งเตือน ใบที่ยังไม่เกินไม่ถูกแจ้ง', async () => {
    const [[old]] = await pool.query("INSERT INTO orders (order_no, total_amount, created_by, paid_at) VALUES ('DLY-OLD', 10, 1, NOW() - INTERVAL 45 MINUTE)").then((r) => [[{ id: r[0].insertId }]]);
    const [[fresh]] = await pool.query("INSERT INTO orders (order_no, total_amount, created_by, paid_at) VALUES ('DLY-NEW', 10, 1, NOW())").then((r) => [[{ id: r[0].insertId }]]);
    const created = await alert.checkQueueDelay();
    expect(created).toBeGreaterThanOrEqual(1);
    expect(await unread('queue_delay', 'ref_order_id', old.id)).toHaveLength(1);
    expect(await unread('queue_delay', 'ref_order_id', fresh.id)).toHaveLength(0);
    expect(await alert.checkQueueDelay()).toBe(0); // รอบถัดไปไม่สร้างซ้ำ
  });
});

describe('GET/PATCH /api/notifications [UC-11]', () => {
  test('คลังอ่านได้แต่ทำเครื่องหมายไม่ได้ — ผู้จัดการทำได้ และมีประวัติ', async () => {
    const list = await auth(tokens.warehouse)(request(app).get('/api/notifications').query({ unread: '1' }));
    expect(list.status).toBe(200);
    expect(list.body.notifications.length).toBeGreaterThan(0);
    const id = list.body.notifications[0].notification_id;
    expect((await auth(tokens.warehouse)(request(app).patch(`/api/notifications/${id}/read`))).status).toBe(403);
    expect((await auth(tokens.sales)(request(app).get('/api/notifications'))).status).toBe(403);
    const res = await auth(tokens.manager)(request(app).patch(`/api/notifications/${id}/read`));
    expect(res.status).toBe(200);
    const [[n]] = await pool.query('SELECT is_read FROM notifications WHERE notification_id = ?', [id]);
    expect(n.is_read).toBe(1);
    const [logs] = await pool.query("SELECT * FROM audit_logs WHERE action = 'READ_NOTIFICATION' AND entity_id = ?", [id]);
    expect(logs).toHaveLength(1);
  });
});

describe('แดชบอร์ด — คำนวณสดจากฐาน [AC-09 · BR-04]', () => {
  test('ops: ตัวเลขตรงกับผลรวมที่คำนวณจากฐานข้อมูลโดยตรง', async () => {
    await setStock(P1.product_id, 100, 0);
    await newOrder([{ productId: P1.product_id, qty: 1 }]);
    const res = await auth(tokens.warehouse)(request(app).get('/api/dashboard/ops'));
    expect(res.status).toBe(200);
    const [[direct]] = await pool.query("SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue FROM orders WHERE status <> 'cancelled' AND DATE(paid_at) = CURDATE()");
    expect(res.body.today.orders).toBe(direct.orders);
    expect(res.body.today.revenue).toBe(direct.revenue);
    const [[q]] = await pool.query("SELECT COUNT(*) AS waiting FROM orders WHERE status IN ('awaiting_dispatch','picking')");
    expect(res.body.queue.waiting).toBe(q.waiting);
    expect(Array.isArray(res.body.lowStock)).toBe(true);
  });

  test('ops: เปลี่ยนข้อมูลแล้วเรียกใหม่ ตัวเลขเปลี่ยนทันที (ไม่มีค่าสรุปค้าง)', async () => {
    const before = (await auth(tokens.manager)(request(app).get('/api/dashboard/ops'))).body.today.revenue;
    await newOrder([{ productId: P1.product_id, qty: 1 }]); // 130 บาท
    const after = (await auth(tokens.manager)(request(app).get('/api/dashboard/ops'))).body.today.revenue;
    expect(after).toBe(before + 130);
  });

  test('ops: คำสั่งซื้อที่รอเกินเกณฑ์อยู่ในรายการ delayed ของกล่องต้องดูแลวันนี้ ใบที่ยังไม่เกินไม่อยู่', async () => {
    await pool.query("INSERT INTO orders (order_no, total_amount, created_by, paid_at) VALUES ('OPS-OLD', 10, 1, NOW() - INTERVAL 45 MINUTE)");
    await pool.query("INSERT INTO orders (order_no, total_amount, created_by, paid_at) VALUES ('OPS-NEW', 10, 1, NOW())");
    const res = await auth(tokens.manager)(request(app).get('/api/dashboard/ops'));
    const nos = res.body.queue.delayed.map((d) => d.order_no);
    expect(res.body.queue.threshold_minutes).toBe(30);
    expect(nos).toContain('OPS-OLD');
    expect(nos).not.toContain('OPS-NEW');
    expect(res.body.queue.delayed.find((d) => d.order_no === 'OPS-OLD').wait_minutes).toBeGreaterThanOrEqual(45);
  });

  test('exec: ผู้จัดการเท่านั้น มีแนวโน้มรายวันและสินค้าขายดี', async () => {
    expect((await auth(tokens.warehouse)(request(app).get('/api/dashboard/exec'))).status).toBe(403);
    const res = await auth(tokens.manager)(request(app).get('/api/dashboard/exec').query({ days: 7 }));
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(res.body.trend.length).toBeGreaterThan(0);
    expect(res.body.topProducts[0]).toHaveProperty('qty_sold');
    expect(res.body.total.revenue).toBe(res.body.trend.reduce((s, d) => s + d.revenue, 0));
  });
});
