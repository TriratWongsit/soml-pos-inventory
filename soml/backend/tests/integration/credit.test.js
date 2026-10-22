// ขายเชื่อ (บิลเซ็น) รับชำระหนี้ และรายงานขายรายวัน   [คอมเมนต์กรรมการ K-3 K-6 K-9 K-10 · FR-10 FR-11 FR-12]
const { app, request, pool, allTokens, auth } = require('./helpers');

let tokens, P1;
beforeAll(async () => {
  tokens = await allTokens();
  process.env.PRINT_SERVICE_URL = 'http://127.0.0.1:1';
  [[P1]] = await pool.query("SELECT product_id, price FROM products WHERE sku = '101017'");
  await pool.query('UPDATE products SET stock_qty = 100 WHERE product_id = ?', [P1.product_id]);
});
afterAll(() => { delete process.env.PRINT_SERVICE_URL; return pool.end(); });

const newCustomer = async (name = `ผู้รับเหมา ทดสอบ ${Date.now()}`) =>
  (await auth(tokens.sales)(request(app).post('/api/customers').send({ name, phone: '081-234-5678' }))).body.customer;
const sellCredit = (customerId, qty = 2) =>
  auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty }], paymentMethod: 'credit', customerId }));
const pay = (orderId, amount, method = 'cash', token = tokens.manager) =>
  auth(token)(request(app).post(`/api/orders/${orderId}/payments`).send({ amount, method }));

describe('ลูกค้าขายเชื่อ', () => {
  test('พนักงานขายเพิ่มลูกค้าได้ ชื่อสั้นเกินไปถูกปฏิเสธ และมีประวัติ CREATE_CUSTOMER', async () => {
    const bad = await auth(tokens.sales)(request(app).post('/api/customers').send({ name: 'ก' }));
    expect(bad.status).toBe(400);
    const c = await newCustomer('ช่างสมชาย รับเหมา');
    expect(c.customer_id).toBeGreaterThan(0);
    const list = await auth(tokens.sales)(request(app).get('/api/customers?q=สมชาย'));
    expect(list.body.customers.map((x) => x.name)).toContain('ช่างสมชาย รับเหมา');
    const [[log]] = await pool.query("SELECT * FROM audit_logs WHERE action = 'CREATE_CUSTOMER' AND entity_id = ?", [c.customer_id]);
    expect(log).toBeDefined();
  });

  test('พนักงานคลังดูรายชื่อลูกค้าไม่ได้ (403)', async () => {
    expect((await auth(tokens.warehouse)(request(app).get('/api/customers'))).status).toBe(403);
  });
});

describe('สร้างใบขายเชื่อ', () => {
  test('ไม่เลือกลูกค้า → 400 · ลูกค้าไม่มีจริง → 400', async () => {
    const noCustomer = await auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty: 1 }], paymentMethod: 'credit' }));
    expect(noCustomer.status).toBe(400);
    expect((await sellCredit(999999)).status).toBe(400);
  });

  test('ขายเชื่อสำเร็จ: บันทึกวิธีชำระและลูกค้า เข้าคิวพร้อมป้ายขายเชื่อ (K-9)', async () => {
    const c = await newCustomer('ร้านวัสดุ ปลายทาง');
    const res = await sellCredit(c.customer_id, 3);
    expect(res.status).toBe(201);
    expect(res.body.order.paymentMethod).toBe('credit');
    expect(res.body.order.customer.name).toBe('ร้านวัสดุ ปลายทาง');
    const [[row]] = await pool.query('SELECT payment_method, customer_id, settled_at FROM orders WHERE order_id = ?', [res.body.order.orderId]);
    expect(row).toMatchObject({ payment_method: 'credit', customer_id: c.customer_id, settled_at: null });
    const q = await auth(tokens.warehouse)(request(app).get('/api/queue'));
    const inQueue = q.body.queue.find((o) => o.order_id === res.body.order.orderId);
    expect(inQueue).toMatchObject({ payment_method: 'credit', customer_name: 'ร้านวัสดุ ปลายทาง' });
  });

  test('ขาย QR ปกติ คิวขึ้นวิธีชำระ promptpay (ป้ายจ่ายแล้ว)', async () => {
    const res = await auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty: 1 }] }));
    const q = await auth(tokens.warehouse)(request(app).get('/api/queue'));
    expect(q.body.queue.find((o) => o.order_id === res.body.order.orderId).payment_method).toBe('promptpay');
  });
});

describe('รับชำระหนี้', () => {
  test('จ่ายทีละส่วนได้ ยอดค้างลดลง ครบแล้วปิดใบ (settled_at) และหายจากรายการลูกหนี้', async () => {
    const c = await newCustomer('คุณป้า จ่ายทีละนิด');
    const o = (await sellCredit(c.customer_id, 2)).body.order;       // ยอด = ราคา × 2
    const half = Math.round(o.totalAmount * 50) / 100;
    const r1 = await pay(o.orderId, half, 'cash');
    expect(r1.status).toBe(201);
    expect(r1.body.outstanding).toBeCloseTo(o.totalAmount - half, 2);
    expect(r1.body.settled).toBe(false);
    const open1 = await auth(tokens.manager)(request(app).get('/api/credit'));
    const mine = open1.body.customers.find((x) => x.customer_id === c.customer_id);
    expect(mine.outstanding).toBeCloseTo(o.totalAmount - half, 2);
    const r2 = await pay(o.orderId, Math.round((o.totalAmount - half) * 100) / 100, 'transfer');
    expect(r2.body.settled).toBe(true);
    const [[row]] = await pool.query('SELECT settled_at FROM orders WHERE order_id = ?', [o.orderId]);
    expect(row.settled_at).not.toBeNull();
    const open2 = await auth(tokens.manager)(request(app).get('/api/credit'));
    expect(open2.body.customers.find((x) => x.customer_id === c.customer_id)).toBeUndefined();
    expect((await pay(o.orderId, 1)).status).toBe(409);               // ชำระครบแล้ว รับเพิ่มไม่ได้
  });

  test('รับเกินยอดค้าง → 409 · ใบ QR รับชำระหนี้ไม่ได้ → 409 · พนักงานขายรับเงินไม่ได้ → 403', async () => {
    const c = await newCustomer();
    const o = (await sellCredit(c.customer_id, 1)).body.order;
    expect((await pay(o.orderId, o.totalAmount + 1)).status).toBe(409);
    const qr = (await auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty: 1 }] }))).body.order;
    expect((await pay(qr.orderId, 1)).status).toBe(409);
    expect((await pay(o.orderId, 1, 'cash', tokens.sales)).status).toBe(403);
    expect((await pay(o.orderId, 1, 'bitcoin')).status).toBe(400);
  });

  test('สองเครื่องรับชำระใบเดียวกันพร้อมกัน ยอดรวมไม่เกินยอดขาย', async () => {
    const c = await newCustomer();
    const o = (await sellCredit(c.customer_id, 1)).body.order;
    const [a, b] = await Promise.all([pay(o.orderId, o.totalAmount), pay(o.orderId, o.totalAmount)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const [[{ paid }]] = await pool.query('SELECT SUM(amount) AS paid FROM credit_payments WHERE order_id = ?', [o.orderId]);
    expect(paid).toBeCloseTo(o.totalAmount, 2);
  });
});

describe('K-3 กัน QR ผิด', () => {
  test('ยอดที่ลูกค้าเห็น (quotedTotal) ไม่ตรงกับยอดจริง → 409 TOTAL_CHANGED ไม่บันทึกคำสั่งซื้อ', async () => {
    const [[{ n: before }]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    const res = await auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty: 1 }], quotedTotal: 1 }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TOTAL_CHANGED');
    const [[{ n: after }]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    expect(after).toBe(before);
  });

  test('ยอดตรง → บันทึกได้ · หน้า QR ได้เลขพร้อมเพย์ปลายทางแบบปิดบางหลัก', async () => {
    const quote = await auth(tokens.sales)(request(app).post('/api/orders/quote').send({ items: [{ productId: P1.product_id, qty: 2 }] }));
    expect(quote.body.promptpayTo).toMatch(/^x/);
    const res = await auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty: 2 }], quotedTotal: quote.body.totalAmount }));
    expect(res.status).toBe(201);
  });

  test('เลขพร้อมเพย์ใน .env ผิดรูปแบบ → ไม่สร้าง QR (503)', async () => {
    const saved = process.env.PROMPTPAY_ID;
    process.env.PROMPTPAY_ID = '12345';
    try {
      const res = await auth(tokens.sales)(request(app).post('/api/orders/quote').send({ items: [{ productId: P1.product_id, qty: 1 }] }));
      expect(res.status).toBe(503);
    } finally { process.env.PROMPTPAY_ID = saved; }
  });
});

describe('รับชำระด้วยเงินสด (เพิ่มหลังสอบ)', () => {
  const sellCash = (cashReceived, qty = 1) =>
    auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty }], paymentMethod: 'cash', cashReceived }));

  test('รับเงินไม่พอ → 400 CASH_SHORT ไม่บันทึก · ไม่ระบุเงินที่รับ → 400', async () => {
    const [[{ n: before }]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    const short = await sellCash(1);
    expect(short.status).toBe(400);
    expect(short.body.code).toBe('CASH_SHORT');
    expect((await auth(tokens.sales)(request(app).post('/api/orders').send({ items: [{ productId: P1.product_id, qty: 1 }], paymentMethod: 'cash' }))).status).toBe(400);
    const [[{ n: after }]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    expect(after).toBe(before);
  });

  test('รับเงินพอ → บันทึก payment_method cash เงินที่รับ และคิดเงินทอนถูก · คิวขึ้นวิธีชำระ cash', async () => {
    const res = await sellCash(1000, 2);
    expect(res.status).toBe(201);
    expect(res.body.order.paymentMethod).toBe('cash');
    expect(res.body.order.change).toBeCloseTo(1000 - res.body.order.totalAmount, 2);
    const [[row]] = await pool.query('SELECT payment_method, cash_received FROM orders WHERE order_id = ?', [res.body.order.orderId]);
    expect(row).toMatchObject({ payment_method: 'cash', cash_received: 1000 });
    const q = await auth(tokens.warehouse)(request(app).get('/api/queue'));
    expect(q.body.queue.find((o) => o.order_id === res.body.order.orderId).payment_method).toBe('cash');
  });

  test('รายงานรายวันแยกยอดเงินสด และเงินสดในลิ้นชักรวมรับชำระหนี้เป็นเงินสด', async () => {
    const r = (await auth(tokens.manager)(request(app).get('/api/reports/daily'))).body;
    const [[db]] = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS cash FROM orders WHERE DATE(paid_at) = CURDATE() AND status <> 'cancelled' AND payment_method = 'cash'");
    const [[pc]] = await pool.query("SELECT COALESCE(SUM(amount),0) AS paid FROM credit_payments WHERE DATE(received_at) = CURDATE() AND method = 'cash'");
    expect(r.summary.cash.amount).toBeCloseTo(db.cash, 2);
    expect(r.summary.cashInDrawer).toBeCloseTo(db.cash + pc.paid, 2);
  });
});

describe('K-10 รายงานการขายรายวัน', () => {
  test('ยอดในรายงานตรงกับผลรวมจากฐานข้อมูล แยก QR กับขายเชื่อ และรวมเงินรับชำระหนี้ของวัน', async () => {
    const res = await auth(tokens.manager)(request(app).get('/api/reports/daily'));
    expect(res.status).toBe(200);
    const [[db]] = await pool.query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS revenue,
              COALESCE(SUM(CASE WHEN payment_method='credit' THEN total_amount END),0) AS credit
         FROM orders WHERE DATE(paid_at) = CURDATE() AND status <> 'cancelled'`);
    const [[pm]] = await pool.query('SELECT COALESCE(SUM(amount),0) AS paid FROM credit_payments WHERE DATE(received_at) = CURDATE()');
    expect(res.body.summary.orders).toBe(db.n);
    expect(res.body.summary.revenue).toBeCloseTo(db.revenue, 2);
    expect(res.body.summary.credit.amount).toBeCloseTo(db.credit, 2);
    expect(res.body.summary.creditPaymentsReceived).toBeCloseTo(pm.paid, 2);
    expect(res.body.summary.moneyIn).toBeCloseTo(res.body.summary.promptpay.amount + res.body.summary.cash.amount + pm.paid, 2);
    expect(res.body.orders.every((o) => /\.$/.test(o.cashier) || !/\s/.test(o.cashier))).toBe(true);   // ชื่อพนักงานเป็นชื่อย่อ เช่น "ศริพรรณ ศ."
  });

  test('วันที่ผิดรูปแบบ → 400 · พนักงานคลังดูไม่ได้ → 403', async () => {
    expect((await auth(tokens.manager)(request(app).get('/api/reports/daily?date=15-10-2026'))).status).toBe(400);
    expect((await auth(tokens.warehouse)(request(app).get('/api/reports/daily'))).status).toBe(403);
  });
});
