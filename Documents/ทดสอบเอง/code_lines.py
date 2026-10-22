# -*- coding: utf-8 -*-
"""เลขบรรทัดโค้ดของแต่ละกรณี หาเลขจากไฟล์จริงทุกครั้งที่สร้าง PDF (โค้ดเปลี่ยน เลขเปลี่ยนตาม)"""
import io, os
SOML = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'soml')
FE, BE = 'frontend/src/', 'backend/'


def line(path, pat, nth=1):
    L = io.open(os.path.join(SOML, path), encoding='utf-8').read().split('\n')
    hits = [i + 1 for i, s in enumerate(L) if pat in s]
    if len(hits) < nth:
        raise SystemExit('หาไม่เจอ: %s ใน %s' % (pat, path))
    return hits[nth - 1]


def F(path, pat, what, nth=1):
    return (path, line(path, pat, nth), what)


A = BE + 'app.js'
CODE = {
 'S-01': [F(FE + 'services/session.jsx', "api.post('/auth/login'", 'หน้าจอส่งชื่อผู้ใช้และรหัสผ่าน'),
          F(A, "app.post('/api/auth/login'", 'ประกาศเส้นทาง'),
          F(BE + 'modules/auth/index.js', 'async function login', 'login() ตรวจรหัสด้วย bcrypt'),
          F(BE + 'modules/auth/index.js', 'jwt.sign', 'ออกโทเคน JWT'),
          F(BE + 'modules/auth/index.js', "JWT_EXPIRES_IN =", 'อายุโทเคน 8 ชั่วโมง'),
          F(FE + 'components/Layout.jsx', 'const MENU = [', 'เมนูของแต่ละบทบาท (roles)')],
 'S-02': [F(FE + 'App.jsx', 'path="/products"', 'หน้าสินค้าให้เฉพาะ manager'),
          F(FE + 'components/RequireRole.jsx', 'roles.includes', 'บทบาทไม่ตรง → เด้งกลับ'),
          F(BE + 'middleware/auth.js', 'function verifyToken', 'verifyToken() ไม่มีหรือโทเคนปลอม → 401'),
          F(BE + 'middleware/auth.js', 'function requireRole', 'requireRole() บทบาทไม่ตรง → 403'),
          F(A, "app.put('/api/products/:id'", 'เส้นทางที่ลองยิง')],
 'S-03': [F(FE + 'pages/products/index.jsx', 'api.put(', 'หน้าจอส่งค่าที่แก้'),
          F(A, "app.put('/api/products/:id'", 'ประกาศเส้นทาง (manager)'),
          F(BE + 'modules/product/index.js', 'async function update', 'update() ในธุรกรรม'),
          F(BE + 'modules/audit-log/index.js', 'async function record', 'record() บันทึกประวัติ')],
 'S-04': [F(FE + 'pages/products/index.jsx', 'api.patch(', 'หน้าจอส่งจำนวนและเหตุผล'),
          F(BE + 'modules/product/index.js', 'async function adjustStock', 'adjustStock()'),
          F(BE + 'modules/product/index.js', 'FOR UPDATE', 'ล็อกแถวสินค้า'),
          F(BE + 'modules/product/index.js', 'balanceAfter < 0', 'กันยอดติดลบ'),
          F(BE + 'modules/product/index.js', 'INSERT INTO stock_movements', 'บันทึกการเคลื่อนไหว'),
          F(BE + 'modules/product/index.js', 'alert.checkStock', 'ตรวจแจ้งเตือนหลัง commit')],
 'S-05': [F(FE + 'pages/pos/index.jsx', 'api.get(`/products', 'ค้นสินค้า'),
          F(FE + 'pages/pos/index.jsx', "api.post('/orders/quote'", 'ขอให้หลังบ้านคิดยอด'),
          F(A, "'/api/orders/quote'", 'ประกาศเส้นทาง (sales, manager)'),
          F(BE + 'modules/order/index.js', 'async function quote', 'quote()'),
          F(BE + 'modules/order/index.js', 'async function priceItems', 'priceItems() ราคาจากฐานข้อมูล'),
          F(BE + 'lib/promptpay.js', 'function buildPayload', 'สร้างข้อความ QR พร้อมเพย์')],
 'S-06': [F(FE + 'pages/pos/index.jsx', 'const confirmPayment', 'กดยืนยันรับชำระ'),
          F(FE + 'pages/pos/index.jsx', "api.post('/orders'", 'ส่งคำสั่งซื้อ'),
          F(BE + 'modules/order/index.js', 'async function create', 'create()'),
          F(BE + 'modules/order/index.js', 'async function nextOrderNo', 'nextOrderNo() ล็อกเลขล่าสุดด้วย FOR UPDATE'),
          F(BE + 'modules/order/index.js', 'attempt >= MAX_ORDER_NO_RETRIES', 'ชนกันแล้วลองใหม่ (DF-01)'),
          F(BE + 'modules/order/index.js', 'printClient.printReceipt', 'สั่งพิมพ์หลัง commit'),
          F(BE + 'modules/order/index.js', "broadcast('order.created'", 'ผลักไปจอคลัง'),
          F('print-service/server.js', "app.post('/print/receipt'", 'บริการพิมพ์รับงาน')],
 'S-07': [F(FE + 'pages/queue/index.jsx', 'const load = useCallback', 'load() ดึงคิว'),
          F(FE + 'pages/queue/index.jsx', 'const stop = subscribe', 'ฟังเหตุการณ์ order.*'),
          F(FE + 'services/events.js', 'export function subscribe', 'subscribe()'),
          F(FE + 'services/events.js', 'new WebSocket', 'เปิด WebSocket'),
          F(FE + 'services/events.js', 'new EventSource', 'ทางสำรอง SSE'),
          F(BE + 'modules/queue/index.js', 'function broadcast', 'broadcast() ส่งทุกจอ'),
          F(BE + 'modules/queue/index.js', 'function attach', 'attach() รับ WebSocket ที่ /ws'),
          F(BE + 'modules/queue/index.js', 'async function list', 'list() ส่งรายการคิว')],
 'S-08': [F(FE + 'services/events.js', 'RECONNECT_MS =', 'ต่อใหม่ทุก 2 วินาที'),
          F(FE + 'services/events.js', "ws.onopen", 'ต่อ WebSocket ได้ → ส่ง connected'),
          F(FE + 'services/events.js', 'sse.onopen', 'ต่อ SSE ได้ → ส่ง connected'),
          F(FE + 'pages/queue/index.jsx', "event === 'connected'", 'ได้ connected → load() ใหม่ทั้งหมด')],
 'S-09': [F(FE + 'pages/queue/index.jsx', "status: 'picking'", 'กดเริ่มจัด'),
          F(BE + 'modules/queue/index.js', 'const TRANSITIONS', 'สถานะที่ไปต่อได้'),
          F(BE + 'modules/queue/index.js', 'const WHO_CAN', 'ใครเปลี่ยนเป็นอะไรได้'),
          F(BE + 'modules/queue/index.js', 'async function updateStatus', 'updateStatus()'),
          F(BE + 'modules/queue/index.js', "broadcast('order.status'", 'ผลักสถานะใหม่')],
 'S-10': [F(FE + 'pages/dispatch/index.jsx', 'const confirm = async', 'กดยืนยันจ่าย (หลังยืนยันซ้ำ)'),
          F(A, "'/api/orders/:id/dispatch'", 'ประกาศเส้นทาง (warehouse, manager)'),
          F(BE + 'modules/dispatch/index.js', 'async function confirm', 'confirm() เปิดธุรกรรม'),
          F(BE + 'modules/stock-deduction/index.js', 'async function dispatch', 'dispatch() ตัดสต็อก'),
          F(BE + 'modules/stock-deduction/index.js', 'UPDATE orders', 'เปลี่ยนสถานะแบบมีเงื่อนไข (กันจ่ายซ้ำ)'),
          F(BE + 'modules/stock-deduction/index.js', 'stock_qty >= ?', 'หักสต็อกแบบมีเงื่อนไข (กันติดลบ)'),
          F(BE + 'modules/stock-deduction/index.js', 'INSERT INTO stock_movements', 'บันทึกการเคลื่อนไหว'),
          F(BE + 'config/db.js', 'function withTransaction', 'withTransaction() commit/rollback')],
 'S-11': [F(BE + 'modules/stock-deduction/index.js', "'ALREADY_DISPATCHED'", 'affectedRows = 0 → ปฏิเสธ'),
          F(BE + 'modules/dispatch/index.js', '409', 'แปลงเป็น HTTP 409'),
          F(BE + 'tests/integration/dispatch.test.js', 'Promise.all(', 'เทสยิงพร้อมกันสองคำขอ')],
 'S-12': [F(BE + 'modules/stock-deduction/index.js', "'INSUFFICIENT_STOCK'", 'สต็อกไม่พอ → โยนข้อผิดพลาด'),
          F(BE + 'config/db.js', 'await conn.rollback()', 'ย้อนทั้งใบ')],
 'S-13': [F(BE + 'modules/dispatch/index.js', 'alert.checkStock', 'ตรวจหลังจ่าย'),
          F(BE + 'modules/alert/index.js', 'async function checkStock', 'checkStock()'),
          F(BE + 'modules/alert/index.js', 'async function createOnce', 'createOnce() ไม่สร้างซ้ำ'),
          F(BE + 'modules/alert/index.js', "broadcast('notification.created'", 'ผลักแจ้งเตือน'),
          F(FE + 'pages/notifications/index.jsx', "user.role === 'manager'", 'ปุ่มอ่านแล้วเฉพาะผู้จัดการ'),
          F(FE + 'services/unread.js', "api.get('/notifications?unread=1')", 'ตัวเลขกระดิ่ง')],
 'S-14': [F(BE + 'server.js', 'alert.start()', 'เริ่มตรวจตอนเปิดระบบ'),
          F(BE + 'modules/alert/index.js', 'CHECK_EVERY_MS =', 'ตรวจทุก 60 วินาที'),
          F(BE + 'modules/alert/index.js', 'thresholdMinutes =', 'เกณฑ์จาก .env'),
          F(BE + 'modules/alert/index.js', 'async function checkQueueDelay', 'checkQueueDelay()')],
 'S-15': [F(FE + 'pages/dashboard-ops/index.jsx', "api.get('/dashboard/ops')", 'หน้าจอเรียกข้อมูล'),
          F(BE + 'modules/dashboard/index.js', "SOLD =", 'ไม่นับใบที่ยกเลิก'),
          F(BE + 'modules/dashboard/index.js', 'async function ops', 'ops() ยอดวันนี้ คิว ของใกล้หมด'),
          F(BE + 'modules/dashboard/index.js', 'async function exec', 'exec() ระดับบริหาร')],
 'S-16': [F(FE + 'pages/audit-logs/index.jsx', 'api.get(`/audit-logs', 'หน้าจอส่งตัวกรอง'),
          F(BE + 'modules/audit-log/index.js', 'const ACTIONS', 'ประเภทการกระทำ 10 ชนิด'),
          F(BE + 'modules/audit-log/index.js', 'async function record', 'record() ทุกโมดูลเรียก'),
          F(BE + 'modules/audit-log/index.js', 'async function list', 'list() ค้นตามเงื่อนไข')],
 'S-17': [F(BE + 'modules/print-client/index.js', 'async function printReceipt', 'printReceipt() ไม่โยนข้อผิดพลาด'),
          F(BE + 'modules/print-client/index.js', 'timeoutMs =', 'หมดเวลา 5 วินาที'),
          F('print-service/server.js', "app.post('/print/receipt'", 'แปลงเป็น ESC/POS แล้วส่งเครื่องพิมพ์')],
 'S-18': [F(BE + 'modules/order/index.js', 'MAX_ORDER_NO_RETRIES =', 'ลองใหม่สูงสุด 12 ครั้ง'),
          F(BE + 'modules/order/index.js', 'retryDelayMs =', 'ถอยหลังแบบทวีคูณ'),
          F('evidence/measure-tc13.js', "tc13.json", 'สคริปต์ TC-13 เขียนผล')],
}
