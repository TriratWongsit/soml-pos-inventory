// ---------------------------------------------------------------------
// บริการตัดสต็อก (Stock Deduction Service)   [ตารางที่ 3.16 โมดูล BE-06 · FR-06 · UC-07 · 3.4.2.2 · NFR-04]
//
// รับผิดชอบเรื่องเดียว: ธุรกรรม 7 ขั้นของหัวข้อ 3.4.2.2 — ตรรกะล้วน ๆ ไม่รู้จัก req/res
// ผู้เรียก (modules/dispatch) เป็นคนเปิดธุรกรรมและส่ง conn เข้ามา
// เหตุผลที่แยกจาก dispatch (3.6): ชุดทดสอบเรียกฟังก์ชันนี้ตรง ๆ พร้อมกันหลายครั้งได้
// โดยไม่ต้องยิง HTTP ทำให้ทดสอบ NFR-04 (ไม่มีสภาวะแข่งขัน) ได้อย่างน่าเชื่อถือ
//
// ขั้น 1 เปิดธุรกรรม และขั้น 6 commit อยู่ที่ withTransaction ของผู้เรียก
// ขั้น 7 (ตรวจแจ้งเตือน) อยู่นอกธุรกรรมโดยตั้งใจ — ผู้เรียกทำหลัง commit
// ---------------------------------------------------------------------
const auditLog = require('../audit-log');

/** ผลลัพธ์ที่ "คาดไว้" ว่าเกิดได้ — ไม่ใช่ข้อผิดพลาดของระบบ ผู้เรียกแปลงเป็นคำตอบ 409 */
class DispatchRejected extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * ตัดสต็อกของคำสั่งซื้อหนึ่งใบภายในธุรกรรมของผู้เรียก
 * สำเร็จ → { orderNo, items: [{productId, name, qty, balanceAfter}] }
 * ล้มเหลว → โยน DispatchRejected (ALREADY_DISPATCHED | INSUFFICIENT_STOCK | NOT_FOUND)
 *           ผู้เรียกที่ใช้ withTransaction จะ rollback ทุกอย่างให้เอง
 */
async function dispatch(conn, { orderId, userId, ip }) {  // ◀ [D-4] เดโม: dispatch() ตัดสต็อกทั้งใบ
  const [[order]] = await conn.query('SELECT order_id, order_no, status FROM orders WHERE order_id = ?', [orderId]);
  if (!order) throw new DispatchRejected('NOT_FOUND', 'ไม่พบคำสั่งซื้อ');

  // ขั้น 2 — เปลี่ยนสถานะแบบมีเงื่อนไข: การล็อกเชิงบวก (2.1.3) กันจ่ายซ้ำระดับคำสั่งซื้อ
  // ถ้าเครื่องอื่นจ่ายไปก่อน แถวจะไม่ตรงเงื่อนไข affectedRows = 0 (UC-07 ทางที่ล้มเหลว E1)
  const [st] = await conn.query(  // ◀ [D-5] เดโม: เปลี่ยนสถานะเฉพาะใบที่ยังไม่จ่าย (กันจ่ายซ้ำ)
    `UPDATE orders SET status = 'delivered', dispatched_by = ?, dispatched_at = NOW()
      WHERE order_id = ? AND status IN ('awaiting_dispatch', 'picking')`,
    [userId, orderId]
  );
  if (st.affectedRows === 0) {  // ◀ [D-5] เดโม: ไม่มีแถวเปลี่ยน = จ่ายไปแล้ว → ปฏิเสธ
    throw new DispatchRejected('ALREADY_DISPATCHED', `คำสั่งซื้อ ${order.order_no} ถูกจ่ายหรือยกเลิกไปแล้ว (สถานะ ${order.status})`);
  }

  const [items] = await conn.query(
    `SELECT i.product_id, i.qty, p.name FROM order_items i JOIN products p ON p.product_id = i.product_id
      WHERE i.order_id = ? ORDER BY i.product_id`, // เรียงตามรหัสสินค้าเสมอ ให้ทุกธุรกรรมล็อกลำดับเดียวกัน ไม่ deadlock กันเอง
    [orderId]
  );

  const result = [];
  for (const it of items) {
    // ขั้น 3 — หักยอดแบบมีเงื่อนไข: กันติดลบระดับสินค้า (UC-07 ทางที่ล้มเหลว E2)
    // เป็นคนละปัญหากับขั้น 2 จึงต้องกันแยก — กันจ่ายซ้ำไม่ได้กันสต็อกไม่พอ และกลับกัน
    const [dq] = await conn.query(
      'UPDATE products SET stock_qty = stock_qty - ? WHERE product_id = ? AND stock_qty >= ?',  // ◀ [D-6] เดโม: หักได้เฉพาะเมื่อของพอ (กันติดลบ)
      [it.qty, it.product_id, it.qty]
    );
    if (dq.affectedRows === 0) {  // ◀ [D-6] เดโม: หักไม่ได้ → สต็อกไม่พอ
      throw new DispatchRejected('INSUFFICIENT_STOCK', `สต็อก ${it.name} ไม่พอสำหรับจำนวน ${it.qty}`);
    }
    const [[p]] = await conn.query('SELECT stock_qty FROM products WHERE product_id = ?', [it.product_id]);

    // ขั้น 4 — บันทึกการเคลื่อนไหวพร้อมยอดหลังเปลี่ยน (3.4.1.3 ข้อ 2)
    await conn.query(
      `INSERT INTO stock_movements (product_id, order_id, change_qty, balance_after, reason, created_by)
       VALUES (?, ?, ?, ?, 'sale_dispatch', ?)`,
      [it.product_id, orderId, -it.qty, p.stock_qty, userId]
    );
    result.push({ productId: it.product_id, name: it.name, qty: it.qty, balanceAfter: p.stock_qty });
  }

  // ขั้น 5 — ประวัติ ในธุรกรรมเดียวกัน
  await auditLog.record(conn, { userId, action: 'CONFIRM_DISPATCH', entityType: 'order', entityId: orderId, ip });

  return { orderId, orderNo: order.order_no, items: result };
}

module.exports = { dispatch, DispatchRejected };
