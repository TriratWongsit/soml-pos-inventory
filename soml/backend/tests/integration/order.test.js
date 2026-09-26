// ส่วนควบคุมคำสั่งซื้อ           [ตารางที่ 3.13 โมดูล 3 · FR-03 · UC-03, UC-04 · AC-03, AC-04 · TC-03, TC-04]
const { app, request, pool, allTokens, auth } = require('./helpers');
const { crc16 } = require('../../lib/promptpay');

let tokens;
let P1, P2; // สินค้าจริงจากไฟล์สต็อกร้าน
beforeAll(async () => {
  tokens = await allTokens();
  process.env.PRINT_SERVICE_URL = 'http://127.0.0.1:1'; // ไม่มีบริการพิมพ์ระหว่างทดสอบ — ต้องไม่ทำให้การขายล้ม
  [[P1]] = await pool.query("SELECT product_id, price FROM products WHERE sku = '100001'"); // 130.00
  [[P2]] = await pool.query("SELECT product_id, price FROM products WHERE sku = '101001'"); // 150.00
});
afterAll(() => { delete process.env.PRINT_SERVICE_URL; return pool.end(); });

const quote = (token, items) => auth(token)(request(app).post('/api/orders/quote').send({ items }));
const create = (token, items) => auth(token)(request(app).post('/api/orders').send({ items }));
const countOrders = async () => (await pool.query('SELECT COUNT(*) AS n FROM orders'))[0][0].n;

describe('POST /api/orders/quote [TC-03]', () => {
  test('ยอดรวมตรงกับการคำนวณด้วยมือ และ QR ระบุยอดเดียวกัน', async () => {
    const res = await quote(tokens.sales, [{ productId: P1.product_id, qty: 3 }, { productId: P2.product_id, qty: 2 }]);
    expect(res.status).toBe(200);
    const expected = 130 * 3 + 150 * 2; // 690
    expect(res.body.totalAmount).toBe(expected);
    expect(res.body.items.map((i) => i.lineTotal)).toEqual([390, 300]);
    expect(res.body.qrPayload).toContain('5406690.00');                           // ช่อง 54 ยอด
    expect(res.body.qrPayload.slice(-4)).toBe(crc16(res.body.qrPayload.slice(0, -4)));
  });

  test('ไม่เขียนฐานข้อมูล เพราะยังไม่ได้รับชำระเงิน (3.7.2 ข้อ 3)', async () => {
    const before = await countOrders();
    await quote(tokens.sales, [{ productId: P1.product_id, qty: 1 }]);
    expect(await countOrders()).toBe(before);
  });

  test('ใช้ราคาจากฐานข้อมูลเสมอ ราคาที่หน้าจอส่งมาถูกเพิกเฉย', async () => {
    const res = await auth(tokens.sales)(request(app).post('/api/orders/quote').send({ items: [{ productId: P1.product_id, qty: 1, price: 1, unitPrice: 1 }] }));
    expect(res.body.totalAmount).toBe(130);
  });

  test('สินค้าเดียวกันส่งซ้ำถูกรวมเป็นแถวเดียว', async () => {
    const res = await quote(tokens.sales, [{ productId: P1.product_id, qty: 1 }, { productId: P1.product_id, qty: 2 }]);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qty).toBe(3);
  });

  test('ยังไม่ตั้งหมายเลขพร้อมเพย์ → 503 พร้อมบอกว่าต้องตั้งที่ไหน (UC-03 E3)', async () => {
    const saved = process.env.PROMPTPAY_ID;
    delete process.env.PROMPTPAY_ID;
    try {
      const res = await quote(tokens.sales, [{ productId: P1.product_id, qty: 1 }]);
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/PROMPTPAY_ID/);
    } finally { process.env.PROMPTPAY_ID = saved; }
  });

  test('ตะกร้าว่าง จำนวนศูนย์ หรือสินค้าไม่มี → 400 · พนักงานคลังใช้ไม่ได้ → 403', async () => {
    expect((await quote(tokens.sales, [])).status).toBe(400);
    expect((await quote(tokens.sales, [{ productId: P1.product_id, qty: 0 }])).status).toBe(400);
    expect((await quote(tokens.sales, [{ productId: 999999, qty: 1 }])).status).toBe(400);
    expect((await quote(tokens.warehouse, [{ productId: P1.product_id, qty: 1 }])).status).toBe(403);
  });
});

describe('POST /api/orders [AC-03]', () => {
  test('บันทึกคำสั่งซื้อสถานะรอจ่าย พร้อมเลขที่ เวลาชำระ และราคา ณ เวลาขาย', async () => {
    const res = await create(tokens.sales, [{ productId: P1.product_id, qty: 3 }]);
    expect(res.status).toBe(201);
    const { order } = res.body;
    expect(order.orderNo).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(order.status).toBe('awaiting_dispatch');
    expect(order.totalAmount).toBe(390);

    const [[row]] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order.orderId]);
    expect(row.paid_at).toBeInstanceOf(Date);
    expect(row.created_by).toBe(1);
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.orderId]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ qty: 3, unit_price: 130 });
  });

  test('ราคาในใบเสร็จเก่าไม่เปลี่ยนเมื่อราคาสินค้าเปลี่ยน (3.7.2 ข้อ 1)', async () => {
    const { order } = (await create(tokens.sales, [{ productId: P2.product_id, qty: 1 }])).body;
    await pool.query('UPDATE products SET price = 999 WHERE product_id = ?', [P2.product_id]);
    try {
      const [[item]] = await pool.query('SELECT unit_price FROM order_items WHERE order_id = ?', [order.orderId]);
      expect(item.unit_price).toBe(150);
    } finally {
      await pool.query('UPDATE products SET price = 150 WHERE product_id = ?', [P2.product_id]);
    }
  });

  test('ไม่ตัดสต็อกตอนขาย — สต็อกตัดตอนจ่ายสินค้าเท่านั้น (FR-06)', async () => {
    const [[before]] = await pool.query('SELECT stock_qty FROM products WHERE product_id = ?', [P1.product_id]);
    await create(tokens.sales, [{ productId: P1.product_id, qty: 2 }]);
    const [[after]] = await pool.query('SELECT stock_qty FROM products WHERE product_id = ?', [P1.product_id]);
    expect(after.stock_qty).toBe(before.stock_qty);
  });

  test('มีประวัติ CREATE_ORDER ในธุรกรรมเดียวกัน', async () => {
    const { order } = (await create(tokens.sales, [{ productId: P1.product_id, qty: 1 }])).body;
    const [logs] = await pool.query("SELECT * FROM audit_logs WHERE action = 'CREATE_ORDER' AND entity_id = ?", [order.orderId]);
    expect(logs).toHaveLength(1);
    expect(logs[0].user_id).toBe(1);
  });

  test('พิมพ์ใบเสร็จไม่ได้ คำสั่งซื้อยังสำเร็จ และแจ้งผลการพิมพ์แยก (UC-03 ทางที่ล้มเหลว)', async () => {
    const res = await create(tokens.sales, [{ productId: P1.product_id, qty: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.print.ok).toBe(false);
    expect(res.body.print.error).toBeTruthy();
    const [[row]] = await pool.query('SELECT status FROM orders WHERE order_id = ?', [res.body.order.orderId]);
    expect(row.status).toBe('awaiting_dispatch');
  });

  test('สินค้าที่เลิกขายแล้วสั่งไม่ได้ และไม่มีแถวค้าง', async () => {
    await pool.query('UPDATE products SET is_active = FALSE WHERE product_id = ?', [P2.product_id]);
    const before = await countOrders();
    try {
      const res = await create(tokens.sales, [{ productId: P2.product_id, qty: 1 }]);
      expect(res.status).toBe(400);
      expect(await countOrders()).toBe(before);
    } finally {
      await pool.query('UPDATE products SET is_active = TRUE WHERE product_id = ?', [P2.product_id]);
    }
  });
});

describe('เลขที่คำสั่งซื้อไม่ซ้ำ [UC-04 · AC-04 · TC-04]', () => {
  test('รันต่อเนื่อง: เลขเพิ่มทีละหนึ่งในวันเดียวกัน', async () => {
    const a = (await create(tokens.sales, [{ productId: P1.product_id, qty: 1 }])).body.order.orderNo;
    const b = (await create(tokens.sales, [{ productId: P1.product_id, qty: 1 }])).body.order.orderNo;
    expect(Number(b.slice(-4))).toBe(Number(a.slice(-4)) + 1);
  });

  test('สร้างพร้อมกัน 20 รายการจากพนักงานขาย 2 คน ไม่มีเลขซ้ำแม้แต่รายการเดียว', async () => {
    const somporn = await require('./helpers').tokenFor('somporn');
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => create(i % 2 ? tokens.sales : somporn, [{ productId: P1.product_id, qty: 1 }]))
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const nos = results.map((r) => r.body.order.orderNo);
    expect(new Set(nos).size).toBe(20);
  });
});

describe('GET /api/orders/:id', () => {
  test('คืนคำสั่งซื้อพร้อมรายการและสต็อกปัจจุบันของสินค้า สำหรับหน้าจ่ายของ', async () => {
    const { order } = (await create(tokens.sales, [{ productId: P1.product_id, qty: 2 }])).body;
    const res = await auth(tokens.warehouse)(request(app).get(`/api/orders/${order.orderId}`));
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ order_no: order.orderNo, status: 'awaiting_dispatch', created_by_name: 'ศริพรรณ ศิริกันทา' });
    expect(res.body.order.items[0]).toMatchObject({ qty: 2, unit_price: 130, sku: '100001' });
    expect(typeof res.body.order.items[0].stock_qty).toBe('number');
  });

  test('ไม่พบ → 404', async () => {
    expect((await auth(tokens.warehouse)(request(app).get('/api/orders/999999'))).status).toBe(404);
  });
});
