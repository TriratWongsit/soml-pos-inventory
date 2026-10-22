// ---------------------------------------------------------------------
// Dispatch Controller — ยืนยันจ่ายสินค้า   [FR-05 · UC-07]
//
// ควบคุมลำดับการทำงานของกระบวนการจ่ายสินค้า แต่ไม่ถือตรรกะของธุรกรรม
// ตัดสต็อกไว้เอง ตามการออกแบบในหัวข้อ 3.4 ที่แยก Stock Deduction Service
// ออกมาเป็นส่วนประกอบต่างหาก
// ---------------------------------------------------------------------
const stockDeductionService = require('./stockDeductionService');
const alertEngine = require('./alertEngine');
const queueManager = require('./queueManager');
const { clientIp } = require('../middleware/auth');

async function confirmDispatch(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'รหัสคำสั่งซื้อไม่ถูกต้อง' });
    }

    const result = await stockDeductionService.dispatchOrder(orderId, req.user.userId, clientIp(req));

    // ---- หลังธุรกรรมสำเร็จเท่านั้น ----
    // ลบคำสั่งซื้อออกจากคิวของทุกหน้าจอ เป็นกลไกป้องกันการจ่ายซ้ำ
    // ในระดับส่วนติดต่อผู้ใช้ ทำงานเสริมกับกลไกระดับฐานข้อมูล (§3.6.1)
    queueManager.broadcast('order.dispatched', {
      orderId: result.orderId,
      orderNo: result.orderNo,
    });

    // ตรวจจุดสั่งซื้อเพิ่มของสินค้าที่เพิ่งถูกตัดสต็อก [FR-08 · TC-10]
    const alerts = await alertEngine.checkLowStock(result.movements.map((m) => m.productId));

    return res.json({
      orderId: result.orderId,
      orderNo: result.orderNo,
      status: 'delivered',
      movements: result.movements,
      alerts,
    });
  } catch (err) {
    // ข้อผิดพลาดเชิงธุรกิจมี status กำกับมาแล้ว ส่งต่อให้ตัวจัดการกลางแปลงเป็น HTTP
    return next(err);
  }
}

module.exports = { confirmDispatch };
