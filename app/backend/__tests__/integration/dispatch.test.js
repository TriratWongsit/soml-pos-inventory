// ยืนยันจ่ายสินค้า ตัดสต็อกอะตอมมิก และการแจ้งเตือน
//              [FR-05, FR-06, FR-08 · UC-07, UC-11 · TC-06, TC-08, TC-10]
const { app, request, pool, allTokens, createOrder, stockOf } = require('./helpers');
const stockDeductionService = require('../../components/stockDeductionService');
const alertEngine = require('../../components/alertEngine');

let tokens;
beforeAll(async () => { tokens = await allTokens(); });
afterAll(() => pool.end());

const dispatch = (orderId, token) =>
  request(app).post(`/api/orders/${orderId}/dispatch`).set('Authorization', `Bearer ${token}`);

describe('POST /api/orders/:id/dispatch — เส้นทางปกติ', () => {
  test('ตัดสต็อก เปลี่ยนสถานะ และบันทึกการเคลื่อนไหวครบในธุรกรรมเดียว', async () => {
    const before = await stockOf(1);
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 5 }]);

    const res = await dispatch(order.orderId, tokens.warehouse);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');

    const after = await stockOf(1);
    expect(after.stock_qty).toBe(before.stock_qty - 5);

    const [[row]] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order.orderId]);
    expect(row.status).toBe('delivered');
    expect(row.dispatched_at).toBeInstanceOf(Date);
    expect(row.dispatched_by).toBeGreaterThan(0);

    const [movements] = await pool.query('SELECT * FROM stock_movements WHERE order_id = ?', [order.orderId]);
    expect(movements).toHaveLength(1);
    expect(movements[0].change_qty).toBe(-5);
    expect(movements[0].balance_after).toBe(after.stock_qty);
    expect(movements[0].reason).toBe('sale_dispatch');

    const [logs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'CONFIRM_DISPATCH' AND entity_id = ?", [order.orderId]
    );
    expect(logs).toHaveLength(1);
  });

  test('คำสั่งซื้อที่กำลังจัดของอยู่ก็ยืนยันจ่ายได้ ตามแผนภาพสถานะรูปที่ 3.13', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 1 }]);
    await request(app).patch(`/api/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${tokens.warehouse}`).send({ status: 'picking' });
    expect((await dispatch(order.orderId, tokens.warehouse)).status).toBe(200);
  });

  test('คำสั่งซื้อที่ไม่มีอยู่ได้รับรหัส 404', async () => {
    expect((await dispatch(999999, tokens.warehouse)).status).toBe(404);
  });
});

describe('การป้องกันการจ่ายซ้ำ   [TC-06 · วัตถุประสงค์ข้อ 1.2.3]', () => {
  test('ยืนยันจ่ายซ้ำครั้งที่สองถูกปฏิเสธด้วยข้อความที่ถูกต้อง และสต็อกไม่ถูกหักซ้ำ', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 2 }]);
    const before = await stockOf(1);

    expect((await dispatch(order.orderId, tokens.warehouse)).status).toBe(200);

    const second = await dispatch(order.orderId, tokens.warehouse);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('คำสั่งซื้อนี้ถูกจ่ายสินค้าไปแล้ว');

    const after = await stockOf(1);
    expect(after.stock_qty).toBe(before.stock_qty - 2);
  });

  test('ยิงยืนยันจ่ายพร้อมกันหลายเครื่อง สำเร็จเพียงเครื่องเดียวและสต็อกหักครั้งเดียว', async () => {
    const CONCURRENCY = 10;
    const order = await createOrder(tokens.sales, [{ productId: 1, qty: 3 }]);
    const before = await stockOf(1);

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => dispatch(order.orderId, tokens.warehouse))
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(CONCURRENCY - 1);

    const after = await stockOf(1);
    expect(after.stock_qty).toBe(before.stock_qty - 3);

    const [movements] = await pool.query('SELECT COUNT(*) AS n FROM stock_movements WHERE order_id = ?', [order.orderId]);
    expect(movements[0].n).toBe(1);
  });

  test('เรียกบริการตัดสต็อกตรง ๆ พร้อมกันก็ให้ผลเดียวกัน โดยไม่ต้องผ่าน HTTP', async () => {
    // ทดสอบที่ระดับส่วนประกอบตามเหตุผลการแยก Stock Deduction Service ในหัวข้อ 3.4
    const order = await createOrder(tokens.sales, [{ productId: 2, qty: 4 }]);
    const before = await stockOf(2);

    const settled = await Promise.allSettled(
      Array.from({ length: 8 }, () => stockDeductionService.dispatchOrder(order.orderId, 2))
    );

    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    settled.filter((s) => s.status === 'rejected').forEach((s) => expect(s.reason.status).toBe(409));
    expect((await stockOf(2)).stock_qty).toBe(before.stock_qty - 4);
  });
});

describe('สต็อกไม่เพียงพอ   [TC-08]', () => {
  test('ยกเลิกทั้งธุรกรรม สต็อกทุกรายการและสถานะคำสั่งซื้อไม่เปลี่ยน', async () => {
    await pool.query('UPDATE products SET stock_qty = 100 WHERE product_id = 4');
    await pool.query('UPDATE products SET stock_qty = 3 WHERE product_id = 5');

    const order = await createOrder(tokens.sales, [{ productId: 4, qty: 10 }, { productId: 5, qty: 50 }]);
    const before4 = await stockOf(4);
    const before5 = await stockOf(5);

    const res = await dispatch(order.orderId, tokens.warehouse);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/สต็อกไม่เพียงพอ/);

    // รายการแรกมีของพอและถูกหักไปแล้วในธุรกรรม ต้องถูกย้อนกลับทั้งหมด
    expect((await stockOf(4)).stock_qty).toBe(before4.stock_qty);
    expect((await stockOf(5)).stock_qty).toBe(before5.stock_qty);

    const [[row]] = await pool.query('SELECT status FROM orders WHERE order_id = ?', [order.orderId]);
    expect(row.status).toBe('awaiting_dispatch');

    const [movements] = await pool.query('SELECT COUNT(*) AS n FROM stock_movements WHERE order_id = ?', [order.orderId]);
    expect(movements[0].n).toBe(0);
  });
});

describe('การแจ้งเตือนสต็อกต่ำ   [FR-08 · TC-10]', () => {
  test('สร้างการแจ้งเตือนเมื่อจ่ายสินค้าจนต่ำกว่าจุดสั่งซื้อเพิ่ม และไม่แจ้งซ้ำ', async () => {
    await pool.query('DELETE FROM notifications');
    await pool.query('UPDATE products SET stock_qty = 52, reorder_point = 50 WHERE product_id = 6');

    const order = await createOrder(tokens.sales, [{ productId: 6, qty: 5 }]);
    const res = await dispatch(order.orderId, tokens.warehouse);

    expect(res.body.alerts).toHaveLength(1);
    expect(res.body.alerts[0].type).toBe('low_stock');
    expect(res.body.alerts[0].message).toMatch(/ต่ำกว่าจุดสั่งซื้อเพิ่ม/);

    // จ่ายสินค้ารายการเดิมอีกครั้งต้องไม่แจ้งซ้ำ ตราบใดที่ผู้จัดการยังไม่ได้อ่าน
    const again = await createOrder(tokens.sales, [{ productId: 6, qty: 1 }]);
    expect((await dispatch(again.orderId, tokens.warehouse)).body.alerts).toHaveLength(0);
  });

  test('ผู้จัดการเห็นการแจ้งเตือนและทำเครื่องหมายว่าอ่านแล้วได้   [UC-11]', async () => {
    const list = await request(app).get('/api/notifications?unread=true')
      .set('Authorization', `Bearer ${tokens.manager}`);
    expect(list.body.notifications.length).toBeGreaterThan(0);

    const id = list.body.notifications[0].notification_id;
    expect((await request(app).patch(`/api/notifications/${id}/read`)
      .set('Authorization', `Bearer ${tokens.manager}`)).status).toBe(200);

    const [[row]] = await pool.query('SELECT is_read FROM notifications WHERE notification_id = ?', [id]);
    expect(Boolean(row.is_read)).toBe(true);
  });
});

describe('การแจ้งเตือนคิวงานค้างนานผิดปกติ   [FR-08 · TC-11]', () => {
  const THRESHOLD = Number(process.env.QUEUE_DELAY_THRESHOLD_MINUTES || 30);

  /** ย้อนเวลารับชำระของคำสั่งซื้อให้ดูเหมือนค้างอยู่ในคิวมานานแล้ว */
  const ageOrder = (orderId, minutes) =>
    pool.query('UPDATE orders SET paid_at = DATE_SUB(NOW(), INTERVAL ? MINUTE) WHERE order_id = ?', [minutes, orderId]);

  beforeEach(() => pool.query("DELETE FROM notifications WHERE type = 'queue_delay'"));

  test('สร้างการแจ้งเตือนเมื่อคำสั่งซื้อค้างในคิวเกินเกณฑ์ที่กำหนด', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 10, qty: 1 }]);
    await ageOrder(order.orderId, THRESHOLD + 5);

    const raised = await alertEngine.checkQueueDelay();

    const mine = raised.filter((n) => n.orderId === order.orderId);
    expect(mine).toHaveLength(1);
    expect(mine[0].type).toBe('queue_delay');
    // ข้อความต้องระบุเลขที่คำสั่งซื้อและระยะเวลาที่รอ เพื่อให้ผู้จัดการรู้ว่าต้องไปตามรายการใด
    expect(mine[0].message).toContain(order.orderNo);
    expect(mine[0].message).toMatch(/\d+ นาที/);

    const [rows] = await pool.query(
      "SELECT type, ref_order_id FROM notifications WHERE type = 'queue_delay' AND ref_order_id = ?",
      [order.orderId]
    );
    expect(rows).toHaveLength(1);
  });

  test('คำสั่งซื้อที่รอยังไม่ถึงเกณฑ์ต้องไม่ถูกแจ้งเตือน', async () => {
    // ค่าขอบเขต ตั้งเวลารอให้น้อยกว่าเกณฑ์อยู่หนึ่งนาที
    const order = await createOrder(tokens.sales, [{ productId: 11, qty: 1 }]);
    await ageOrder(order.orderId, THRESHOLD - 1);

    const raised = await alertEngine.checkQueueDelay();
    expect(raised.filter((n) => n.orderId === order.orderId)).toHaveLength(0);
  });

  test('เรียกตรวจซ้ำแล้วไม่สร้างการแจ้งเตือนซ้ำสำหรับคำสั่งซื้อเดิม', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 12, qty: 1 }]);
    await ageOrder(order.orderId, THRESHOLD + 5);

    await alertEngine.checkQueueDelay();
    const second = await alertEngine.checkQueueDelay();

    expect(second.filter((n) => n.orderId === order.orderId)).toHaveLength(0);
    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS n FROM notifications WHERE type = 'queue_delay' AND ref_order_id = ?",
      [order.orderId]
    );
    expect(count.n).toBe(1);
  });

  test('คำสั่งซื้อที่จ่ายสินค้าไปแล้วต้องไม่ถูกนับว่าค้างในคิว', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 13, qty: 1 }]);
    await ageOrder(order.orderId, THRESHOLD + 60);
    await dispatch(order.orderId, tokens.warehouse);

    const raised = await alertEngine.checkQueueDelay();
    expect(raised.filter((n) => n.orderId === order.orderId)).toHaveLength(0);
  });

  test('ผู้จัดการเห็นการแจ้งเตือนคิวค้างในรายการแจ้งเตือน   [UC-11]', async () => {
    const order = await createOrder(tokens.sales, [{ productId: 14, qty: 1 }]);
    await ageOrder(order.orderId, THRESHOLD + 5);
    await alertEngine.checkQueueDelay();

    const list = await request(app).get('/api/notifications')
      .set('Authorization', `Bearer ${tokens.manager}`);
    expect(list.body.notifications.some((n) => n.type === 'queue_delay' && n.ref_order_id === order.orderId)).toBe(true);
  });
});
