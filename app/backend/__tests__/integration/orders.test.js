// สร้างคำสั่งซื้อ ออกใบเสร็จ และคิวรอจ่ายสินค้า
//                              [FR-03, FR-04 · UC-03 ถึง UC-06 · TC-03, TC-04]
const { app, request, pool, allTokens, createOrder } = require('./helpers');

let tokens;
beforeAll(async () => { tokens = await allTokens(); });
afterAll(() => pool.end());

describe('POST /api/orders/quote   [TC-03]', () => {
  test('คำนวณยอดรวมตรงกับการคำนวณด้วยมือ และ QR ระบุยอดตรงกัน', async () => {
    const res = await request(app).post('/api/orders/quote')
      .set('Authorization', `Bearer ${tokens.sales}`)
      .send({ items: [{ productId: 1, qty: 10 }, { productId: 2, qty: 5 }, { productId: 3, qty: 2 }] });

    expect(res.status).toBe(200);
    // 185×10 + 152×5 + 135×2 = 1850 + 760 + 270 = 2880
    expect(res.body.totalAmount).toBe(2880);
    expect(res.body.items.map((i) => i.lineTotal)).toEqual([1850, 760, 270]);

    // ช่อง 54 ของ payload คือยอดเงิน ต้องตรงกับยอดรวม
    expect(res.body.qrPayload).toContain('54072880.00');
  });

  test('ไม่เขียนข้อมูลลงฐานข้อมูล เพราะยังไม่ได้รับชำระเงิน', async () => {
    const [[before]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    await request(app).post('/api/orders/quote')
      .set('Authorization', `Bearer ${tokens.sales}`).send({ items: [{ productId: 1, qty: 1 }] });
    const [[after]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    expect(after.n).toBe(before.n);
  });

  test('ใช้ราคาจากฐานข้อมูลเสมอ ไม่รับราคาที่ส่งมาจากหน้าจอ', async () => {
    const res = await request(app).post('/api/orders/quote')
      .set('Authorization', `Bearer ${tokens.sales}`)
      .send({ items: [{ productId: 1, qty: 1, unitPrice: 1, price: 1 }] });
    expect(res.body.items[0].unitPrice).toBe(185);
  });

  test('รวมรายการสินค้าเดียวกันที่ส่งซ้ำให้เหลือแถวเดียว', async () => {
    const res = await request(app).post('/api/orders/quote')
      .set('Authorization', `Bearer ${tokens.sales}`)
      .send({ items: [{ productId: 1, qty: 2 }, { productId: 1, qty: 3 }] });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qty).toBe(5);
  });

  test('ปฏิเสธรายการที่ไม่ถูกต้อง', async () => {
    const auth = (r) => r.set('Authorization', `Bearer ${tokens.sales}`);
    expect((await auth(request(app).post('/api/orders/quote')).send({ items: [] })).status).toBe(400);
    expect((await auth(request(app).post('/api/orders/quote')).send({ items: [{ productId: 1, qty: 0 }] })).status).toBe(400);
    expect((await auth(request(app).post('/api/orders/quote')).send({ items: [{ productId: 1, qty: 1.5 }] })).status).toBe(400);
    expect((await auth(request(app).post('/api/orders/quote')).send({ items: [{ productId: 99999, qty: 1 }] })).status).toBe(400);
  });
});

describe('POST /api/orders', () => {
  test('บันทึกคำสั่งซื้อพร้อมสถานะรอจ่ายสินค้าและเวลารับชำระ', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 3 }]);
    const [[row]] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order.orderId]);

    expect(row.status).toBe('awaiting_dispatch');
    expect(row.paid_at).toBeInstanceOf(Date);
    expect(Number(row.total_amount)).toBe(555);

    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.orderId]);
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(3);
  });

  test('ไม่ตัดสต็อกตอนสร้างคำสั่งซื้อ เพราะสต็อกตัดตอนจ่ายสินค้าเท่านั้น', async () => {
    const [[before]] = await pool.query('SELECT stock_qty FROM products WHERE product_id = 2');
    await createOrder(tokens.sales, [{ productId: 2, qty: 4 }]);
    const [[after]] = await pool.query('SELECT stock_qty FROM products WHERE product_id = 2');
    expect(after.stock_qty).toBe(before.stock_qty);
  });

  test('บันทึกเหตุการณ์สร้างคำสั่งซื้อลงประวัติการทำรายการ', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 1 }]);
    const [logs] = await pool.query(
      "SELECT detail FROM audit_logs WHERE action = 'CREATE_ORDER' AND entity_id = ?", [order.orderId]
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].detail.orderNo).toBe(order.orderNo);
  });

  test('คำสั่งซื้อยังสำเร็จแม้พิมพ์ใบเสร็จไม่ได้   [SRS §3.1.2 · UC-03/A2]', async () => {
    // ชี้ไปยังพอร์ตที่ไม่มีบริการใดฟังอยู่ เพื่อจำลองเครื่องพิมพ์ขัดข้องอย่าง
    // แน่นอน ไม่ขึ้นกับว่าบริการพิมพ์จริงกำลังทำงานอยู่หรือไม่ขณะรันทดสอบ
    const original = process.env.PRINT_SERVICE_URL;
    process.env.PRINT_SERVICE_URL = 'http://127.0.0.1:1';

    try {
      const res = await request(app).post('/api/orders')
        .set('Authorization', `Bearer ${tokens.sales}`).send({ items: [{ productId: 1, qty: 1 }] });

      expect(res.body.print.ok).toBe(false);
      expect(res.body.print.error).toBeTruthy();

      // สิ่งที่ต้องรับประกันคือคำสั่งซื้อยังถูกบันทึกและเข้าคิวได้ตามปกติ
      expect(res.status).toBe(201);
      expect(res.body.order.orderId).toBeGreaterThan(0);

      const [[row]] = await pool.query('SELECT status FROM orders WHERE order_id = ?', [res.body.order.orderId]);
      expect(row.status).toBe('awaiting_dispatch');
    } finally {
      if (original === undefined) delete process.env.PRINT_SERVICE_URL;
      else process.env.PRINT_SERVICE_URL = original;
    }
  });

  test('เลขที่คำสั่งซื้อไม่ซ้ำกันเมื่อสร้างพร้อมกัน   [TC-04 · UC-04]', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app).post('/api/orders').set('Authorization', `Bearer ${tokens.sales}`)
          .send({ items: [{ productId: 1, qty: 1 }] })
      )
    );
    const orderNos = results.map((r) => r.body.order?.orderNo);
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(orderNos).size).toBe(20);
    orderNos.forEach((no) => expect(no).toMatch(/^ORD-\d{8}-\d{4}$/));
  });
});

describe('GET /api/queue   [UC-05]', () => {
  test('แสดงเฉพาะคำสั่งซื้อที่รอจ่าย เรียงตามเวลารับชำระจากเก่าไปใหม่', async () => {
    const res = await request(app).get('/api/queue').set('Authorization', `Bearer ${tokens.warehouse}`);
    expect(res.status).toBe(200);

    const paidTimes = res.body.orders.map((o) => new Date(o.paid_at).getTime());
    expect([...paidTimes].sort((a, b) => a - b)).toEqual(paidTimes);
    res.body.orders.forEach((o) => {
      expect(['awaiting_dispatch', 'picking']).toContain(o.status);
      expect(o.items.length).toBeGreaterThan(0);
      expect(o).toHaveProperty('waited_seconds');
    });
  });
});

describe('PATCH /api/orders/:id/status   [UC-06]', () => {
  test('เปลี่ยนสถานะได้เฉพาะเส้นทางที่แผนภาพสถานะอนุญาต', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 1 }]);
    const patch = (status, token = tokens.warehouse) =>
      request(app).patch(`/api/orders/${order.orderId}/status`)
        .set('Authorization', `Bearer ${token}`).send({ status });

    expect((await patch('picking')).status).toBe(200);
    // จะข้ามไปสถานะส่งมอบสำเร็จตรง ๆ ไม่ได้ ต้องผ่านธุรกรรมตัดสต็อกเท่านั้น
    expect((await patch('delivered')).status).toBe(409);
    expect((await patch('awaiting_dispatch')).status).toBe(200);
  });

  test('การยกเลิกคำสั่งซื้อเป็นสิทธิ์ของผู้จัดการเท่านั้น', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 1 }]);
    const patch = (token) => request(app).patch(`/api/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'cancelled' });

    expect((await patch(tokens.warehouse)).status).toBe(403);
    expect((await patch(tokens.manager)).status).toBe(200);
  });
});
