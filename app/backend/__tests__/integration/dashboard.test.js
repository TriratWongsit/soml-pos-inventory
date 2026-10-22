// แดชบอร์ดและประวัติการทำรายการ   [FR-07, FR-09 · UC-08 ถึง UC-10 · TC-09, TC-12]
const { app, request, pool, allTokens, createOrder } = require('./helpers');

let tokens;
beforeAll(async () => { tokens = await allTokens(); });
afterAll(() => pool.end());

describe('GET /api/dashboard/ops   [UC-08 · TC-09]', () => {
  test('ตัวเลขบนแดชบอร์ดตรงกับผลรวมที่คำนวณจากฐานข้อมูลโดยตรง', async () => {
    await createOrder(tokens.sales, [{ productId: 1, qty: 2 }]);

    const res = await request(app).get('/api/dashboard/ops').set('Authorization', `Bearer ${tokens.manager}`);
    expect(res.status).toBe(200);

    const [[sales]] = await pool.query(
      "SELECT COALESCE(SUM(total_amount),0) AS s, COUNT(*) AS c FROM orders WHERE DATE(paid_at)=CURDATE() AND status<>'cancelled'"
    );
    const [[queue]] = await pool.query(
      "SELECT COUNT(*) AS n FROM orders WHERE status IN ('awaiting_dispatch','picking')"
    );
    const [[low]] = await pool.query(
      'SELECT COUNT(*) AS n FROM products WHERE is_active = TRUE AND stock_qty <= reorder_point'
    );

    expect(res.body.kpi.salesToday).toBe(Number(sales.s));
    expect(res.body.kpi.orderCountToday).toBe(sales.c);
    expect(res.body.kpi.queueWaiting).toBe(queue.n);
    expect(res.body.kpi.belowReorderPoint).toBe(low.n);
  });

  test('พนักงานคลังสินค้าเข้าถึงแดชบอร์ดปฏิบัติการได้ ตามตารางที่ 3.11', async () => {
    expect((await request(app).get('/api/dashboard/ops')
      .set('Authorization', `Bearer ${tokens.warehouse}`)).status).toBe(200);
  });
});

describe('GET /api/dashboard/exec   [UC-09]', () => {
  test('สรุปยอดขายและเวลาเฉลี่ยจากรับชำระถึงจ่ายของ', async () => {
    const res = await request(app).get('/api/dashboard/exec?days=7')
      .set('Authorization', `Bearer ${tokens.manager}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toHaveProperty('averageLeadTimeMinutes');
    expect(Array.isArray(res.body.salesByDay)).toBe(true);
    expect(Array.isArray(res.body.topProducts)).toBe(true);

    const [[check]] = await pool.query(
      "SELECT COALESCE(SUM(total_amount),0) AS s FROM orders WHERE status='delivered' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
    );
    expect(res.body.summary.totalSales).toBe(Number(check.s));
  });

  test('พนักงานคลังสินค้าเข้าถึงแดชบอร์ดบริหารไม่ได้', async () => {
    expect((await request(app).get('/api/dashboard/exec')
      .set('Authorization', `Bearer ${tokens.warehouse}`)).status).toBe(403);
  });
});

describe('GET /api/audit-logs   [UC-10 · TC-12]', () => {
  test('กรองตามบทบาทผู้กระทำได้ถูกต้อง', async () => {
    const res = await request(app).get('/api/audit-logs?role=manager')
      .set('Authorization', `Bearer ${tokens.manager}`);
    expect(res.status).toBe(200);
    res.body.logs.forEach((l) => expect(l.role).toBe('manager'));
  });

  test('กรองตามประเภทเหตุการณ์และช่วงวันที่ได้', async () => {
    // ก่อเหตุการณ์ยืนยันจ่ายสินค้าขึ้นเองก่อน เพื่อไม่ต้องพึ่งไฟล์ทดสอบอื่น
    const order = await createOrder(tokens.sales, [{ productId: 8, qty: 1 }]);
    await request(app).post(`/api/orders/${order.orderId}/dispatch`)
      .set('Authorization', `Bearer ${tokens.warehouse}`);

    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/audit-logs?action=CONFIRM_DISPATCH&from=${today} 00:00:00&to=${today} 23:59:59`)
      .set('Authorization', `Bearer ${tokens.manager}`);

    expect(res.body.logs.length).toBeGreaterThan(0);
    res.body.logs.forEach((l) => expect(l.action).toBe('CONFIRM_DISPATCH'));
  });

  test('บันทึกครบทุกประเภทเหตุการณ์สำคัญของระบบ', async () => {
    // ก่อเหตุการณ์แต่ละประเภทขึ้นเองในเทสต์นี้ ไม่พึ่งพาว่าไฟล์ทดสอบอื่นรันมาก่อน
    // เพราะ jest ไม่รับประกันลำดับการรันของไฟล์
    const asManager = (r) => r.set('Authorization', `Bearer ${tokens.manager}`);

    await request(app).post('/api/auth/login').send({ username: 'sales01', password: 'ผิด' });
    await asManager(request(app).put('/api/products/7')).send({ reorder_point: 12 });
    await asManager(request(app).patch('/api/products/7/stock')).send({ changeQty: 5, reason: 'receive' });

    const order = await createOrder(tokens.sales, [{ productId: 7, qty: 1 }]);
    await request(app).post(`/api/orders/${order.orderId}/dispatch`)
      .set('Authorization', `Bearer ${tokens.warehouse}`);

    const res = await request(app).get('/api/audit-logs?limit=1000')
      .set('Authorization', `Bearer ${tokens.manager}`);
    const actions = new Set(res.body.logs.map((l) => l.action));

    for (const action of ['LOGIN', 'LOGIN_FAILED', 'CREATE_ORDER', 'CONFIRM_DISPATCH', 'UPDATE_PRODUCT', 'ADJUST_STOCK']) {
      expect(actions).toContain(action);
    }
  });
});
