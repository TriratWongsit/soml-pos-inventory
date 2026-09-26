// ยืนยันจ่ายสินค้าและตัดสต็อก   [ตารางที่ 3.13 โมดูล 5, 6 · FR-05, FR-06 · UC-07 · AC-07, AC-08 · TC-06 · NFR-04 · BR-02]
const { app, request, pool, allTokens, auth } = require('./helpers');
const { withTransaction } = require('../../config/db');
const stockDeduction = require('../../modules/stock-deduction');

let tokens, P1;
beforeAll(async () => {
  tokens = await allTokens();
  process.env.PRINT_SERVICE_URL = 'http://127.0.0.1:1';
  [[P1]] = await pool.query("SELECT product_id FROM products WHERE sku = '100001'");
});
afterAll(() => { delete process.env.PRINT_SERVICE_URL; return pool.end(); });

const stockOf = async (id) => (await pool.query('SELECT stock_qty FROM products WHERE product_id = ?', [id]))[0][0].stock_qty;
const setStock = (id, qty) => pool.query('UPDATE products SET stock_qty = ? WHERE product_id = ?', [qty, id]);
const orderRow = async (id) => (await pool.query('SELECT * FROM orders WHERE order_id = ?', [id]))[0][0];
async function newOrder(items) {
  const res = await auth(tokens.sales)(request(app).post('/api/orders').send({ items }));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.order;
}
const confirm = (token, id) => auth(token)(request(app).post(`/api/orders/${id}/dispatch`));

describe('POST /api/orders/:id/dispatch — ทางหลัก', () => {
  test('พนักงานขายทำไม่ได้ (403) — เจ้าของงานคือคลัง (BR-02)', async () => {
    const o = await newOrder([{ productId: P1.product_id, qty: 1 }]);
    expect((await confirm(tokens.sales, o.orderId)).status).toBe(403);
  });

  test('จ่ายสำเร็จ: สถานะ delivered ผู้จ่าย เวลา สต็อกลด movement และประวัติ ครบในครั้งเดียว', async () => {
    await setStock(P1.product_id, 10);
    const o = await newOrder([{ productId: P1.product_id, qty: 3 }]);
    const res = await confirm(tokens.warehouse, o.orderId);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('delivered');
    expect(res.body.items[0]).toMatchObject({ qty: 3, balanceAfter: 7 });

    const row = await orderRow(o.orderId);
    expect(row.status).toBe('delivered');
    expect(row.dispatched_by).toBe(3); // santi
    expect(row.dispatched_at).toBeInstanceOf(Date);
    expect(await stockOf(P1.product_id)).toBe(7);

    const [[m]] = await pool.query('SELECT * FROM stock_movements WHERE order_id = ?', [o.orderId]);
    expect(m).toMatchObject({ change_qty: -3, balance_after: 7, reason: 'sale_dispatch', created_by: 3 });
    const [logs] = await pool.query("SELECT * FROM audit_logs WHERE action = 'CONFIRM_DISPATCH' AND entity_id = ?", [o.orderId]);
    expect(logs).toHaveLength(1);
  });

  test('จ่ายได้จากสถานะ picking ด้วย', async () => {
    await setStock(P1.product_id, 10);
    const o = await newOrder([{ productId: P1.product_id, qty: 1 }]);
    await auth(tokens.warehouse)(request(app).patch(`/api/orders/${o.orderId}/status`).send({ status: 'picking' }));
    expect((await confirm(tokens.warehouse, o.orderId)).status).toBe(200);
  });

  test('ไม่พบคำสั่งซื้อ → 404', async () => {
    expect((await confirm(tokens.warehouse, 999999)).status).toBe(404);
  });
});

describe('E1 จ่ายซ้ำ [AC-07 · TC-06 · NFR-04]', () => {
  test('กดยืนยันใบเดียวกันสองครั้งต่อเนื่อง: ครั้งที่สองถูกปฏิเสธ', async () => {
    await setStock(P1.product_id, 10);
    const o = await newOrder([{ productId: P1.product_id, qty: 2 }]);
    expect((await confirm(tokens.warehouse, o.orderId)).status).toBe(200);
    const again = await confirm(tokens.warehouse, o.orderId);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_DISPATCHED');
    expect(await stockOf(P1.product_id)).toBe(8);
  });

  test('ผ่าน HTTP: สองเครื่องกดพร้อมกัน สำเร็จหนึ่ง ปฏิเสธหนึ่ง สต็อกหักครั้งเดียว', async () => {
    await setStock(P1.product_id, 10);
    const o = await newOrder([{ productId: P1.product_id, qty: 4 }]);
    const [a, b] = await Promise.all([confirm(tokens.warehouse, o.orderId), confirm(tokens.manager, o.orderId)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await stockOf(P1.product_id)).toBe(6);
    const [moves] = await pool.query('SELECT * FROM stock_movements WHERE order_id = ?', [o.orderId]);
    expect(moves).toHaveLength(1);
  });

  test('เรียกบริการตัดสต็อกตรง ๆ 10 ธุรกรรมพร้อมกัน: สำเร็จหนึ่งเดียว (เหตุผลที่แยกโมดูล — 3.6)', async () => {
    await setStock(P1.product_id, 10);
    const o = await newOrder([{ productId: P1.product_id, qty: 1 }]);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        withTransaction((conn) => stockDeduction.dispatch(conn, { orderId: o.orderId, userId: 3, ip: 'test' }))
      )
    );
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(9);
    expect(rejected.every((r) => r.reason instanceof stockDeduction.DispatchRejected && r.reason.code === 'ALREADY_DISPATCHED')).toBe(true);
    expect(await stockOf(P1.product_id)).toBe(9);
  });
});

describe('E2 สต็อกไม่พอ [AC-08]', () => {
  test('ธุรกรรมถูกยกเลิกทั้งหมด: สถานะ สต็อก และประวัติไม่เปลี่ยน', async () => {
    await setStock(P1.product_id, 2);
    const o = await newOrder([{ productId: P1.product_id, qty: 5 }]);
    const [[{ n: logsBefore }]] = await pool.query('SELECT COUNT(*) AS n FROM audit_logs');
    const res = await confirm(tokens.warehouse, o.orderId);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    // ขั้น 2 เปลี่ยนสถานะไปแล้วก่อนขั้น 3 ล้ม — rollback ต้องดึงกลับมาเป็นรอจ่าย
    expect((await orderRow(o.orderId)).status).toBe('awaiting_dispatch');
    expect((await orderRow(o.orderId)).dispatched_by).toBeNull();
    expect(await stockOf(P1.product_id)).toBe(2);
    const [[{ n: logsAfter }]] = await pool.query('SELECT COUNT(*) AS n FROM audit_logs');
    expect(logsAfter).toBe(logsBefore);
    const [moves] = await pool.query('SELECT * FROM stock_movements WHERE order_id = ?', [o.orderId]);
    expect(moves).toHaveLength(0);
  });

  test('ค่าขอบเขต: สต็อกพอดีกับจำนวนที่สั่ง ต้องจ่ายได้และเหลือศูนย์ (Boundary Value — 3.10.1)', async () => {
    await setStock(P1.product_id, 5);
    const o = await newOrder([{ productId: P1.product_id, qty: 5 }]);
    expect((await confirm(tokens.warehouse, o.orderId)).status).toBe(200);
    expect(await stockOf(P1.product_id)).toBe(0);
  });

  test('หลายรายการ: รายการที่สองไม่พอ → รายการแรกที่หักไปแล้วต้องถูกคืน', async () => {
    const [[P2]] = await pool.query("SELECT product_id FROM products WHERE sku = '101001'");
    await setStock(P1.product_id, 10);
    await setStock(P2.product_id, 0);
    const o = await newOrder([{ productId: P1.product_id, qty: 1 }, { productId: P2.product_id, qty: 1 }]);
    expect((await confirm(tokens.warehouse, o.orderId)).status).toBe(409);
    expect(await stockOf(P1.product_id)).toBe(10);
  });
});

describe('BR-02 ตัวเลขในระบบตรงกับของจริง', () => {
  test('ยอดใน products = balance_after ล่าสุดเสมอ หลังจ่ายหลายใบ', async () => {
    await setStock(P1.product_id, 20);
    for (let i = 0; i < 3; i++) {
      const o = await newOrder([{ productId: P1.product_id, qty: 2 }]);
      await confirm(tokens.warehouse, o.orderId);
    }
    const [[m]] = await pool.query('SELECT balance_after FROM stock_movements WHERE product_id = ? ORDER BY movement_id DESC LIMIT 1', [P1.product_id]);
    expect(await stockOf(P1.product_id)).toBe(14);
    expect(m.balance_after).toBe(14);
  });
});
