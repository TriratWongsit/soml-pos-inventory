// ---------------------------------------------------------------------
// ส่วนควบคุมการจ่ายสินค้า (Dispatch Controller)   [ตารางที่ 3.16 โมดูล BE-05 · FR-05 · UC-07 · รูปที่ 3.9]
//
// รับผิดชอบเรื่องเดียว: รับคำขอ POST /api/orders/:id/dispatch แล้วมอบงานให้ stock-deduction
// ในธุรกรรมเดียว จากนั้นแปลงผลเป็นคำตอบ — ไม่มีตรรกะธุรกรรมของตัวเอง (3.6)
//
// หลัง COMMIT เท่านั้น: ผลักเหตุการณ์ให้หน้าจอคิว และตรวจเงื่อนไขแจ้งเตือน (3.4.2.2 ขั้น 7)
// ถ้าสองอย่างนี้ล้ม การจ่ายที่เกิดจริงแล้วต้องไม่ถูกยกเลิก (2.1.2)
// ---------------------------------------------------------------------
const { withTransaction } = require('../../config/db');
const { clientIp } = require('../../middleware/auth');
const stockDeduction = require('../stock-deduction');
const queue = require('../queue');
const alert = require('../alert');

async function confirm(req, res, next) {  // ◀ [D-4] เดโม: confirm() เปิด transaction
  const orderId = Number(req.params.id);
  let result;
  try {
    result = await withTransaction((conn) =>
      stockDeduction.dispatch(conn, { orderId, userId: req.user.userId, ip: clientIp(req) })
    );
  } catch (err) {
    if (err instanceof stockDeduction.DispatchRejected) {
      const status = err.code === 'NOT_FOUND' ? 404 : 409;  // ◀ [D-5] เดโม: แปลงเป็น HTTP 409
      return res.status(status).json({ error: err.message, code: err.code });
    }
    return next(err);
  }

  // ---- หลัง COMMIT ----
  queue.broadcast('order.dispatched', { orderId: result.orderId, orderNo: result.orderNo });
  await alert.checkStock(result.items.map((i) => i.productId)); // 3.4.2.2 ขั้น 7 · BR-05 — นอกธุรกรรม  // ◀ [D-7] เดโม: หลังจ่ายเสร็จ ตรวจของใกล้หมด
  return res.json({ order: { orderId: result.orderId, orderNo: result.orderNo, status: 'delivered' }, items: result.items });
}

module.exports = { confirm };
