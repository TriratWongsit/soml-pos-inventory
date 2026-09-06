// จัดการข้อมูลสินค้าและจุดสั่งซื้อเพิ่ม   [FR-02 · UC-02 · TC-02]
const { app, request, pool, allTokens } = require('./helpers');

let tokens;
beforeAll(async () => { tokens = await allTokens(); });
afterAll(() => pool.end());

describe('GET /api/products', () => {
  test('พนักงานขายอ่านรายการสินค้าได้ เพราะหน้าจอขายต้องแสดงราคาและจำนวนคงเหลือ', async () => {
    const res = await request(app).get('/api/products').set('Authorization', `Bearer ${tokens.sales}`);
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(25);
    expect(res.body.products[0]).toHaveProperty('stock_qty');
    expect(res.body.products[0]).toHaveProperty('reorder_point');
  });

  test('ค้นหาด้วยชื่อหรือรหัสสินค้าได้', async () => {
    const res = await request(app).get('/api/products?q=CEM').set('Authorization', `Bearer ${tokens.manager}`);
    expect(res.body.products.length).toBeGreaterThan(0);
    res.body.products.forEach((p) => expect(`${p.sku}${p.name}`).toMatch(/CEM/i));
  });
});

describe('PUT /api/products/:id   [TC-02]', () => {
  test('ผู้จัดการแก้จุดสั่งซื้อเพิ่มแล้วค่าที่บันทึกตรงกับที่กรอก และมีบันทึกในประวัติ', async () => {
    const res = await request(app)
      .put('/api/products/3')
      .set('Authorization', `Bearer ${tokens.manager}`)
      .send({ reorder_point: 45 });

    expect(res.status).toBe(200);
    expect(res.body.changes.reorder_point).toEqual({ from: 30, to: 45 });

    // ค่าที่บันทึกในฐานข้อมูลต้องตรงกับที่กรอก
    const [[row]] = await pool.query('SELECT reorder_point FROM products WHERE product_id = 3');
    expect(row.reorder_point).toBe(45);

    // ต้องมีบันทึกในประวัติการทำรายการพร้อมค่าเดิมและค่าใหม่
    const [logs] = await pool.query(
      "SELECT detail FROM audit_logs WHERE action = 'UPDATE_PRODUCT' AND entity_id = 3 ORDER BY log_id DESC LIMIT 1"
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].detail.changes.reorder_point).toEqual({ from: 30, to: 45 });
  });

  test('ปฏิเสธค่าที่ไม่ถูกต้อง', async () => {
    const res = await request(app).put('/api/products/3')
      .set('Authorization', `Bearer ${tokens.manager}`).send({ price: -5 });
    expect(res.status).toBe(400);
  });

  test('รหัสสินค้าที่ไม่มีอยู่ได้รับรหัส 404', async () => {
    const res = await request(app).put('/api/products/99999')
      .set('Authorization', `Bearer ${tokens.manager}`).send({ reorder_point: 1 });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/products', () => {
  test('เพิ่มสินค้าใหม่ได้และรหัสสินค้าซ้ำถูกปฏิเสธ', async () => {
    const body = { sku: 'TEST-001', name: 'สินค้าทดสอบ', unit: 'ชิ้น', price: 99.5, stock_qty: 10, reorder_point: 3 };
    const created = await request(app).post('/api/products').set('Authorization', `Bearer ${tokens.manager}`).send(body);
    expect(created.status).toBe(201);

    const duplicate = await request(app).post('/api/products').set('Authorization', `Bearer ${tokens.manager}`).send(body);
    expect(duplicate.status).toBe(409);
  });
});

describe('PATCH /api/products/:id/stock', () => {
  test('ปรับสต็อกด้วยมือแล้วมีบันทึกการเคลื่อนไหวเสมอ', async () => {
    const before = (await pool.query('SELECT stock_qty FROM products WHERE product_id = 1'))[0][0].stock_qty;
    const res = await request(app).patch('/api/products/1/stock')
      .set('Authorization', `Bearer ${tokens.manager}`)
      .send({ changeQty: 50, reason: 'receive', note: 'รับสินค้าเข้าคลัง' });

    expect(res.status).toBe(200);
    expect(res.body.stockAfter).toBe(before + 50);

    const [movements] = await pool.query(
      "SELECT * FROM stock_movements WHERE product_id = 1 AND reason = 'receive' ORDER BY movement_id DESC LIMIT 1"
    );
    expect(movements[0].change_qty).toBe(50);
    expect(movements[0].balance_after).toBe(before + 50);
  });

  test('ปรับแล้วยอดคงเหลือติดลบถูกปฏิเสธและสต็อกไม่เปลี่ยน', async () => {
    const before = (await pool.query('SELECT stock_qty FROM products WHERE product_id = 1'))[0][0].stock_qty;
    const res = await request(app).patch('/api/products/1/stock')
      .set('Authorization', `Bearer ${tokens.manager}`).send({ changeQty: -999999 });

    expect(res.status).toBe(409);
    const after = (await pool.query('SELECT stock_qty FROM products WHERE product_id = 1'))[0][0].stock_qty;
    expect(after).toBe(before);
  });
});
