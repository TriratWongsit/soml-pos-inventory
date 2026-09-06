// ---------------------------------------------------------------------
// Stock Deduction Service — ธุรกรรมตัดสต็อกแบบอะตอมมิก
//                                          [FR-06 · UC-07 · NFR-04 · §3.5.3]
//
// เป็นจุดที่อ่อนไหวที่สุดของระบบ จึงถูกแยกออกจาก Dispatch Controller ตาม
// เหตุผลในหัวข้อ 3.4 เพื่อให้เขียนชุดทดสอบกรณีการเข้าถึงพร้อมกันได้โดยตรง
// โดยไม่ต้องจำลองคำขอ HTTP ทั้งเส้นทาง
//
// กลไกป้องกันการจ่ายซ้ำมีสองชั้น
//   ชั้นที่ 1  เงื่อนไข status ในคำสั่ง UPDATE ทำหน้าที่เป็นล็อกเชิงบวก
//             ถ้ามีพนักงานคนอื่นยืนยันจ่ายไปก่อนแล้ว จำนวนแถวที่ถูกแก้ไข
//             จะเป็นศูนย์ ระบบจะยกเลิกธุรกรรมทั้งหมดทันที
//   ชั้นที่ 2  SELECT ... FOR UPDATE บนรายการสินค้า ทำให้คำขอที่เข้ามา
//             พร้อมกันต้องรอคิวกันตามลำดับ ไม่เกิดสภาวะแข่งขัน
// ---------------------------------------------------------------------
const { withTransaction } = require('../config/db');
const auditLog = require('./auditLogService');

/** ข้อผิดพลาดเชิงธุรกิจที่ต้องแปลงเป็นรหัสสถานะ HTTP ให้ผู้ใช้เข้าใจ */
class DispatchError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.publicMessage = message;
    Object.assign(this, extra);
  }
}

/**
 * ยืนยันจ่ายสินค้าและตัดสต็อกภายในธุรกรรมเดียว
 *
 * @param {number} orderId  คำสั่งซื้อที่จะจ่าย
 * @param {number} userId   พนักงานคลังผู้ยืนยัน
 * @param {string} [ip]     หมายเลขไอพีสำหรับบันทึกประวัติ
 * @returns {Promise<{orderId, orderNo, movements: Array}>}
 * @throws {DispatchError} 404 ไม่พบคำสั่งซื้อ · 409 จ่ายไปแล้ว · 409 สต็อกไม่พอ
 */
async function dispatchOrder(orderId, userId, ip = null) {
  return withTransaction(async (conn) => {
    // ---- ชั้นที่ 1: ล็อกเชิงบวกด้วยเงื่อนไขสถานะ ----
    // ลงมือ UPDATE ก่อนเป็นอันดับแรก ไม่อ่านสถานะมาตรวจในโปรแกรมแล้วค่อยเขียน
    // เพราะระหว่างสองคำสั่งนั้นพนักงานอีกเครื่องอาจยืนยันจ่ายแทรกเข้ามาได้
    // คำสั่งซื้อที่กำลังจัดของอยู่ (picking) ก็ยืนยันจ่ายได้ ตามรูปที่ 3.13
    const [updated] = await conn.query(
      `UPDATE orders
          SET status = 'delivered', dispatched_by = ?, dispatched_at = NOW()
        WHERE order_id = ? AND status IN ('awaiting_dispatch', 'picking')`,
      [userId, orderId]
    );

    if (updated.affectedRows === 0) {
      // อ่านสถานะล่าสุดแบบล็อกแถว เพื่อให้เห็นค่าที่ธุรกรรมอื่นเพิ่งยืนยันไป
      // การอ่านธรรมดาจะยังเห็นค่าเดิมตามภาพนิ่งของระดับ REPEATABLE READ
      // ทำให้แจ้งสาเหตุผิดว่ายังรอจ่ายอยู่ ทั้งที่ถูกจ่ายไปแล้ว
      const [current] = await conn.query(
        'SELECT order_no, status FROM orders WHERE order_id = ? FOR UPDATE',
        [orderId]
      );
      if (current.length === 0) {
        throw new DispatchError(404, 'ไม่พบคำสั่งซื้อที่ระบุ');
      }

      // ธุรกรรมจะถูก ROLLBACK โดย withTransaction เมื่อโยนข้อผิดพลาดออกไป
      const reason =
        current[0].status === 'delivered'
          ? 'คำสั่งซื้อนี้ถูกจ่ายสินค้าไปแล้ว'
          : `คำสั่งซื้อนี้อยู่ในสถานะ ${current[0].status} จึงยืนยันจ่ายสินค้าไม่ได้`;
      throw new DispatchError(409, reason, {
        orderNo: current[0].order_no,
        currentStatus: current[0].status,
      });
    }

    const [orders] = await conn.query('SELECT order_no FROM orders WHERE order_id = ?', [orderId]);
    const order = orders[0];

    // ---- ชั้นที่ 2: ล็อกแถวสินค้าที่เกี่ยวข้องจนกว่าธุรกรรมจะสิ้นสุด ----
    const [items] = await conn.query(
      `SELECT i.product_id, i.qty, p.name, p.stock_qty
         FROM order_items i
         JOIN products p ON p.product_id = i.product_id
        WHERE i.order_id = ?
        ORDER BY i.product_id
        FOR UPDATE`,
      [orderId]
    );

    if (items.length === 0) {
      throw new DispatchError(409, 'คำสั่งซื้อนี้ไม่มีรายการสินค้า');
    }

    const movements = [];

    for (const item of items) {
      // เงื่อนไข stock_qty >= qty ป้องกันไม่ให้ยอดคงเหลือติดลบ
      // แม้จะมีการปรับสต็อกจากที่อื่นแทรกเข้ามาระหว่างทาง
      const [deducted] = await conn.query(
        'UPDATE products SET stock_qty = stock_qty - ? WHERE product_id = ? AND stock_qty >= ?',
        [item.qty, item.product_id, item.qty]
      );

      if (deducted.affectedRows === 0) {
        // ยกเลิกธุรกรรมทั้งหมด สต็อกทุกรายการและสถานะคำสั่งซื้อกลับสู่ค่าเดิม [TC-08]
        throw new DispatchError(
          409,
          `สต็อกไม่เพียงพอสำหรับ ${item.name} (ต้องการ ${item.qty} คงเหลือ ${item.stock_qty})`,
          { productId: item.product_id }
        );
      }

      const balanceAfter = item.stock_qty - item.qty;
      await conn.query(
        `INSERT INTO stock_movements (product_id, order_id, change_qty, balance_after, reason, created_by)
         VALUES (?, ?, ?, ?, 'sale_dispatch', ?)`,
        [item.product_id, orderId, -item.qty, balanceAfter, userId]
      );

      movements.push({
        productId: item.product_id,
        name: item.name,
        qty: item.qty,
        balanceAfter,
      });
    }

    await auditLog.record(conn, {
      userId,
      action: 'CONFIRM_DISPATCH',
      entityType: 'order',
      entityId: orderId,
      detail: { orderNo: order.order_no, movements },
      ip,
    });

    return { orderId, orderNo: order.order_no, movements };
  });
}

module.exports = { dispatchOrder, DispatchError };
