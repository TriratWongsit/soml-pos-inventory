// ---------------------------------------------------------------------
// Express application factory
//
// แยกการประกอบแอปพลิเคชันออกจากการเปิดพอร์ตใน server.js เพื่อให้ชุดทดสอบ
// การทำงานร่วมกัน (Supertest) เรียกใช้แอปได้โดยตรงโดยไม่ต้องเปิดเซิร์ฟเวอร์จริง
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const express = require('express');
const authController = require('./components/authController');
const orderController = require('./components/orderController');
const queueManager = require('./components/queueManager');
const dispatchController = require('./components/dispatchController');
const alertEngine = require('./components/alertEngine');
const productController = require('./components/productController');
const dashboardAggregator = require('./components/dashboardAggregator');
const auditLogService = require('./components/auditLogService');
const { verifyToken, verifyTokenFromQuery, requireRole } = require('./middleware/auth');

function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // ---- FR-01 · UC-01 · เข้าสู่ระบบและควบคุมสิทธิ์ ----
  app.post('/api/auth/login', authController.login);
  app.get('/api/auth/me', verifyToken, authController.me);

  // ---- FR-02 · UC-02 · จัดการข้อมูลสินค้าและจุดสั่งซื้อเพิ่ม ----
  // การอ่านเปิดให้ทุกบทบาทเพราะหน้าจอขายต้องแสดงราคาและจำนวนคงเหลือ
  // ส่วนการแก้ไขจำกัดไว้ที่ผู้จัดการเท่านั้น ตาม TC-01
  app.get('/api/products', verifyToken, productController.list);
  app.post('/api/products', verifyToken, requireRole('manager'), productController.create);
  app.put('/api/products/:id', verifyToken, requireRole('manager'), productController.update);
  app.patch('/api/products/:id/stock', verifyToken, requireRole('manager'), productController.adjustStock);

  // ---- FR-03 · UC-03, UC-04 · สร้างคำสั่งซื้อและออกใบเสร็จ ----
  app.post('/api/orders/quote', verifyToken, requireRole('sales', 'manager'), orderController.quote);
  app.post('/api/orders', verifyToken, requireRole('sales', 'manager'), orderController.create);
  app.get('/api/orders/:id', verifyToken, orderController.getById);

  // ---- FR-04 · UC-05, UC-06 · คิวรอจ่ายสินค้าแบบเรียลไทม์ ----
  app.get('/api/queue', verifyToken, requireRole('warehouse', 'manager'), queueManager.listQueue);
  app.patch('/api/orders/:id/status', verifyToken, requireRole('warehouse', 'manager'), queueManager.updateStatus);
  app.get('/api/events', verifyTokenFromQuery, queueManager.events);

  // ---- FR-05, FR-06 · UC-07 · ยืนยันจ่ายสินค้าและตัดสต็อก ----
  app.post('/api/orders/:id/dispatch', verifyToken, requireRole('warehouse', 'manager'), dispatchController.confirmDispatch);

  // ---- FR-08 · UC-11 · การแจ้งเตือนภายในแอปพลิเคชัน ----
  app.get('/api/notifications', verifyToken, requireRole('manager', 'warehouse'), alertEngine.list);
  app.patch('/api/notifications/:id/read', verifyToken, requireRole('manager'), alertEngine.markRead);

  // ---- FR-07 · UC-08, UC-09 · แดชบอร์ดปฏิบัติการและระดับบริหาร ----
  app.get('/api/dashboard/ops', verifyToken, requireRole('manager', 'warehouse'), dashboardAggregator.operational);
  app.get('/api/dashboard/exec', verifyToken, requireRole('manager'), dashboardAggregator.executive);

  // ---- FR-09 · UC-10 · ค้นหาและดูประวัติการทำรายการ ----
  app.get('/api/audit-logs', verifyToken, requireRole('manager'), auditLogService.listHandler);

  // ---- ให้บริการหน้าเว็บที่สร้างแล้วจากเซิร์ฟเวอร์เดียวกัน ----
  // เมื่อติดตั้งใช้งานจริง ส่วนติดต่อผู้ใช้และ API อยู่ที่ต้นทางเดียวกัน จึงไม่มี
  // ตัวแทนคำขอคั่นกลาง ทำให้ WebSocket เชื่อมต่อตรงและเข้าถึงผ่าน HTTPS
  // ช่องทางเดียวตาม NFR-01  ระหว่างพัฒนายังใช้เซิร์ฟเวอร์ของ Vite ได้ตามปกติ
  const distDir = path.join(__dirname, '..', 'frontend', 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'ไม่พบเส้นทางที่เรียก' });
    }
    // เส้นทางอื่นเป็นของตัวจัดการเส้นทางฝั่งหน้าเว็บ จึงส่งหน้าเดียวกันกลับไป
    const indexFile = path.join(distDir, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    return res.status(404).json({ error: 'ไม่พบเส้นทางที่เรียก' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!err.status || err.status >= 500) console.error('[error]', err);
    res.status(err.status || 500).json({ error: err.publicMessage || 'เกิดข้อผิดพลาดภายในระบบ' });
  });

  return app;
}

module.exports = { createApp };
