// ---------------------------------------------------------------------
// ประกอบระบบหลังบ้าน — ที่เดียวที่ประกาศเส้นทางและสิทธิ์        [ตารางที่ 3.18 · 3.14]
//
// กฎของไฟล์นี้
//   1. ทุกเส้นทางประกาศที่นี่ โมดูลใน modules/ ไม่ประกาศเอง
//      → ถามว่า "เส้นทางนี้ใครเข้าได้" เปิดไฟล์เดียวตอบได้ครบ
//   2. ลำดับมิดเดิลแวร์ต่อเส้นทาง: verifyToken → requireRole(...) → ฟังก์ชันของโมดูล
//      เส้นทางที่ไม่มี verifyToken มีได้เฉพาะ /api/health และ POST /api/auth/login
//   3. ตัวจัดการข้อผิดพลาดท้ายสุดแปลง error เป็น JSON เดียวกันทุกที่ ไม่หลุด stack ออกไป
//
// server.js เป็นคนเปิดพอร์ต ไฟล์นี้แค่สร้าง app เพื่อให้ชุดทดสอบเรียกผ่าน supertest ได้
// โดยไม่ต้องเปิดพอร์ตจริง
// ---------------------------------------------------------------------
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const { verifyToken, requireRole } = require('./middleware/auth');
const auditLog = require('./modules/audit-log');
const auth = require('./modules/auth');
const product = require('./modules/product');
const queue = require('./modules/queue');
const order = require('./modules/order');
const dispatch = require('./modules/dispatch');
const alert = require('./modules/alert');
const dashboard = require('./modules/dashboard');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // ---- ไม่ต้องเข้าสู่ระบบ ----
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/api/auth/login', auth.login);                       // UC-01

  // ---- ทุกบทบาทที่เข้าสู่ระบบแล้ว ----
  app.get('/api/auth/me', verifyToken, auth.me);                 // UC-01
  app.get('/api/products', verifyToken, product.list);           // UC-02 (อ่าน)
  app.get('/api/products/:id', verifyToken, product.getById);
  app.get('/api/events', queue.events);                          // UC-05 ช่องทางสำรอง (โทเคนในสตริงคำค้น)
  app.get('/api/orders/:id', verifyToken, order.getById);         // UC-07 ใช้ดูก่อนจ่าย

  // ---- พนักงานขาย และผู้จัดการ ----
  app.post('/api/orders/quote', verifyToken, requireRole('sales', 'manager'), order.quote);   // UC-03
  app.post('/api/orders', verifyToken, requireRole('sales', 'manager'), order.create);        // UC-03, UC-04

  // ---- พนักงานคลังสินค้า และผู้จัดการ ----
  app.get('/api/queue', verifyToken, requireRole('warehouse', 'manager'), queue.list);                   // UC-05
  app.patch('/api/orders/:id/status', verifyToken, requireRole('warehouse', 'manager'), queue.updateStatus); // UC-06
  app.post('/api/orders/:id/dispatch', verifyToken, requireRole('warehouse', 'manager'), dispatch.confirm);   // UC-07
  app.get('/api/dashboard/ops', verifyToken, requireRole('warehouse', 'manager'), dashboard.ops);           // UC-08
  app.get('/api/notifications', verifyToken, requireRole('warehouse', 'manager'), alert.list);             // UC-11 (อ่าน)

  // ---- ผู้จัดการ ----
  app.post('/api/products', verifyToken, requireRole('manager'), product.create);               // UC-02
  app.put('/api/products/:id', verifyToken, requireRole('manager'), product.update);
  app.patch('/api/products/:id/stock', verifyToken, requireRole('manager'), product.adjustStock);

  app.get('/api/dashboard/exec', verifyToken, requireRole('manager'), dashboard.exec);                 // UC-09
  app.patch('/api/notifications/:id/read', verifyToken, requireRole('manager'), alert.markRead);       // UC-11 (ทำเครื่องหมาย)
  app.get('/api/audit-logs', verifyToken, requireRole('manager'), auditLog.list);                      // UC-10

  // ---- เส้นทางที่ไม่รู้จัก ----
  app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบเส้นทางที่ระบุ' }));

  // ---- ตัวจัดการข้อผิดพลาดท้ายสุด ----
  // err.status / err.publicMessage ให้โมดูลตั้งเมื่ออยากบอกผู้ใช้เอง นอกนั้นตอบ 500 กลาง ๆ
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.publicMessage || 'เกิดข้อผิดพลาดภายในระบบ' });
  });

  return app;
}

module.exports = { createApp, verifyToken, requireRole };
