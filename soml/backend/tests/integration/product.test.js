// ส่วนควบคุมข้อมูลสินค้า                        [ตารางที่ 3.13 โมดูล 2 · FR-02 · UC-02 · AC-02 · BR-02]
const { app, request, pool, allTokens, auth } = require('./helpers');

let tokens;
beforeAll(async () => { tokens = await allTokens(); });
afterAll(() => pool.end());

const asManager = (req) => auth(tokens.manager)(req);

describe('GET /api/products — ค้นหา', () => {
  test('ทุกบทบาทอ่านได้ และเห็นข้อมูลจริงจากไฟล์สต็อกร้าน', async () => {
    for (const t of Object.values(tokens)) {
      const res = await auth(t)(request(app).get('/api/products').query({ q: 'ปูน' }));
      expect(res.status).toBe(200);
      expect(res.body.products.length).toBeGreaterThan(0);
      expect(res.body.products[0]).toHaveProperty('sku');
      expect(typeof res.body.products[0].price).toBe('number');
    }
  });

  test('หมวดหมู่มาจากชีตในไฟล์สต็อกร้าน และกรองตามหมวดได้', async () => {
    const res = await asManager(request(app).get('/api/products').query({ category: 'เหล็ก' }));
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(34);
    expect(res.body.products.every((p) => p.category === 'เหล็ก')).toBe(true);
    expect(res.body.categories).toEqual(expect.arrayContaining(['สี', 'เหล็ก', 'ประปา', 'หิน+ทราย']));
  });

  test('ค้นด้วยรหัสสินค้าขึ้นต้น', async () => {
    const res = await asManager(request(app).get('/api/products').query({ q: '1010' }));
    expect(res.body.products.every((p) => p.sku.startsWith('1010'))).toBe(true);
  });
});

describe('POST /api/products — เพิ่มสินค้า', () => {
  const body = { sku: 'T-001', name: 'สินค้าทดสอบ', category: 'ทดสอบ', unit: 'ชิ้น', price: 99.5, reorderPoint: 5 };

  test('พนักงานขายและคลังทำไม่ได้ (403)', async () => {
    expect((await auth(tokens.sales)(request(app).post('/api/products').send(body))).status).toBe(403);
    expect((await auth(tokens.warehouse)(request(app).post('/api/products').send(body))).status).toBe(403);
  });

  test('ผู้จัดการเพิ่มได้ ค่าที่บันทึกตรงกับที่กรอก และมีประวัติ', async () => {
    const res = await asManager(request(app).post('/api/products').send(body));
    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ sku: 'T-001', name: 'สินค้าทดสอบ', category: 'ทดสอบ', unit: 'ชิ้น', price: 99.5, reorder_point: 5, stock_qty: 0 });
    const [logs] = await pool.query("SELECT * FROM audit_logs WHERE action = 'CREATE_PRODUCT' AND entity_id = ?", [res.body.product.product_id]);
    expect(logs).toHaveLength(1);
  });

  test('รหัสซ้ำ → 409', async () => {
    expect((await asManager(request(app).post('/api/products').send(body))).status).toBe(409);
  });

  test('ข้อมูลไม่ครบหรือราคาติดลบ → 400', async () => {
    expect((await asManager(request(app).post('/api/products').send({ sku: 'T-002' }))).status).toBe(400);
    expect((await asManager(request(app).post('/api/products').send({ ...body, sku: 'T-003', price: -1 }))).status).toBe(400);
    expect((await asManager(request(app).post('/api/products').send({ ...body, sku: 'T-004', category: '' }))).status).toBe(400);
  });
});

describe('PUT /api/products/:id — แก้ไข', () => {
  let productId;
  beforeAll(async () => {
    const [[row]] = await pool.query("SELECT product_id FROM products WHERE sku = 'T-001'");
    productId = row.product_id;
  });

  test('แก้จุดสั่งซื้อเพิ่ม: ค่าที่บันทึกตรงกับที่กรอก และมีบันทึกในประวัติ [AC-02]', async () => {
    const res = await asManager(request(app).put(`/api/products/${productId}`).send({ reorderPoint: 12 }));
    expect(res.status).toBe(200);
    expect(res.body.product.reorder_point).toBe(12);
    const [[row]] = await pool.query('SELECT reorder_point FROM products WHERE product_id = ?', [productId]);
    expect(row.reorder_point).toBe(12);
    const [logs] = await pool.query("SELECT * FROM audit_logs WHERE action = 'UPDATE_PRODUCT' AND entity_id = ?", [productId]);
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  test('แก้ stock_qty ตรง ๆ ผ่าน PUT ไม่ได้ — ต้องผ่านการปรับสต็อกที่มีประวัติ', async () => {
    const res = await asManager(request(app).put(`/api/products/${productId}`).send({ stock_qty: 500, stockQty: 500 }));
    expect(res.status).toBe(400);
    const [[row]] = await pool.query('SELECT stock_qty FROM products WHERE product_id = ?', [productId]);
    expect(row.stock_qty).toBe(0);
  });

  test('ปิดขายแล้วหายจากรายการค้นหาปกติ แต่ผู้จัดการยังเห็นด้วย all=1', async () => {
    await asManager(request(app).put(`/api/products/${productId}`).send({ isActive: false }));
    const normal = await asManager(request(app).get('/api/products').query({ q: 'T-001' }));
    expect(normal.body.products).toHaveLength(0);
    const all = await asManager(request(app).get('/api/products').query({ q: 'T-001', all: '1' }));
    expect(all.body.products).toHaveLength(1);
    await asManager(request(app).put(`/api/products/${productId}`).send({ isActive: true }));
  });

  test('ไม่พบสินค้า → 404', async () => {
    expect((await asManager(request(app).put('/api/products/999999').send({ name: 'x' }))).status).toBe(404);
  });
});

describe('PATCH /api/products/:id/stock — ปรับสต็อกด้วยมือ', () => {
  let productId;
  beforeAll(async () => {
    const [[row]] = await pool.query("SELECT product_id FROM products WHERE sku = 'T-001'");
    productId = row.product_id;
  });

  test('รับสินค้าเข้า: ยอดเพิ่ม และ stock_movements บันทึกยอดหลังเปลี่ยน (3.7.2 ข้อ 2)', async () => {
    const res = await asManager(request(app).patch(`/api/products/${productId}/stock`).send({ change: 40, reason: 'receive' }));
    expect(res.status).toBe(200);
    expect(res.body.stockQty).toBe(40);
    const [[m]] = await pool.query('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY movement_id DESC LIMIT 1', [productId]);
    expect(m).toMatchObject({ change_qty: 40, balance_after: 40, reason: 'receive', order_id: null, created_by: 4 });
  });

  test('ปรับตามการนับจริงต้องมีเหตุผล', async () => {
    const noNote = await asManager(request(app).patch(`/api/products/${productId}/stock`).send({ change: -5, reason: 'manual_adjust' }));
    expect(noNote.status).toBe(400);
    const ok = await asManager(request(app).patch(`/api/products/${productId}/stock`).send({ change: -5, reason: 'manual_adjust', note: 'นับจริงได้ 35' }));
    expect(ok.status).toBe(200);
    expect(ok.body.stockQty).toBe(35);
  });

  test('ปรับจนติดลบถูกปฏิเสธ และยอดไม่เปลี่ยน [BR-02]', async () => {
    const res = await asManager(request(app).patch(`/api/products/${productId}/stock`).send({ change: -100, reason: 'manual_adjust', note: 'ลองให้ติดลบ' }));
    expect(res.status).toBe(409);
    const [[row]] = await pool.query('SELECT stock_qty FROM products WHERE product_id = ?', [productId]);
    expect(row.stock_qty).toBe(35);
  });

  test('ยอดใน products กับ balance_after ล่าสุดตรงกันเสมอ [BR-02]', async () => {
    const [[p]] = await pool.query('SELECT stock_qty FROM products WHERE product_id = ?', [productId]);
    const [[m]] = await pool.query('SELECT balance_after FROM stock_movements WHERE product_id = ? ORDER BY movement_id DESC LIMIT 1', [productId]);
    expect(p.stock_qty).toBe(m.balance_after);
  });

  test('change เป็นศูนย์หรือไม่ใช่จำนวนเต็ม → 400', async () => {
    expect((await asManager(request(app).patch(`/api/products/${productId}/stock`).send({ change: 0, reason: 'receive' }))).status).toBe(400);
    expect((await asManager(request(app).patch(`/api/products/${productId}/stock`).send({ change: 1.5, reason: 'receive' }))).status).toBe(400);
  });
});
