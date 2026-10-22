# -*- coding: utf-8 -*-
"""กรณีทดสอบแบบเหตุการณ์ สำหรับทดสอบด้วยมือก่อนสอบ
ทุกเส้นทางโค้ดอ้างจากไฟล์จริงใน soml/ (frontend → API → middleware → โมดูล → ตาราง → เหตุการณ์)"""
import html, io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from code_lines import CODE
HERE = os.path.dirname(os.path.abspath(__file__))
e = html.escape

# (รหัส, ชื่อเหตุการณ์, อ้างอิง, บทบาท, เรื่องเล่า, เงื่อนไขก่อน, [ขั้นตอน], [ผลที่คาดหวัง], [(ชั้น, รายละเอียด)], ถ้าอาจารย์ถาม)
S = [
('S-01', 'พนักงานขายเข้ากะเช้า', 'UC-01 · FR-01 · TC-01 · AC-12', 'พนักงานขาย',
 'เช้าวันใหม่ พนักงานขายเปิดเครื่องหน้าร้านแล้วเข้าสู่ระบบ ต้องไปหน้าขายทันที และไม่เห็นเมนูของผู้จัดการ',
 'ระบบเปิดอยู่ มีบัญชีพนักงานขาย (ชื่อผู้ใช้ใน db/seed/seed-users.js)',
 ['เปิด http://localhost:5173/login', 'กรอกรหัสผ่านผิดหนึ่งครั้ง แล้วกดเข้าสู่ระบบ', 'กรอกให้ถูก แล้วกดเข้าสู่ระบบ', 'ดูเมนูด้านซ้าย'],
 ['รหัสผิดได้ข้อความแจ้ง ไม่เข้าระบบ', 'รหัสถูกไปหน้าขายหน้าร้าน (/pos) เอง', 'เมนูมีแค่ "ขายหน้าร้าน" ไม่มีสินค้า แดชบอร์ด หรือประวัติ'],
 [('หน้าจอ', 'pages/login/index.jsx → services/session.jsx (login)'), ('API', 'POST /api/auth/login'),
  ('Backend', 'modules/auth/index.js → login() ตรวจรหัสด้วย bcrypt แล้วออก JWT อายุ 8 ชั่วโมง'),
  ('ตาราง', 'อ่าน users · เขียน audit_logs (LOGIN)'), ('หลังเข้า', 'session.jsx เรียก GET /api/auth/me → auth.me · เมนูมาจาก components/Layout.jsx ตาม role')],
 'ทำไมไม่เก็บรหัสผ่านตรง ๆ → เก็บเป็นแฮช bcrypt ใน users.password_hash ถ้าฐานข้อมูลหลุด ก็ไม่ได้รหัสจริง'),

('S-02', 'พนักงานขายพยายามเข้าหน้าผู้จัดการ', 'UC-01 · FR-01 · NFR-01 · TC-01 · AC-01', 'พนักงานขาย',
 'พนักงานขายรู้ว่ามีหน้าจัดการสินค้า เลยลองพิมพ์ที่อยู่เข้าไปเอง และลองยิง API ตรง ๆ',
 'เข้าสู่ระบบด้วยบัญชีพนักงานขายแล้ว',
 ['พิมพ์ http://localhost:5173/products ในช่องที่อยู่', 'เปิด http://localhost:4000/api/products/1 ด้วยเบราว์เซอร์อีกแท็บ (ไม่มีโทเคน)',
  'ใน Terminal รัน curl -i -X PUT http://localhost:4000/api/products/1 (ไม่แนบโทเคน)',
  "ที่หน้าขาย กด F12 แท็บ Console พิมพ์ fetch('/api/products/1',{method:'PUT',headers:{Authorization:'Bearer '+localStorage.getItem('soml.token')}}).then(r=>r.status) (แนบโทเคนพนักงานขาย)"],
 ['หน้าจอเด้งกลับไปหน้าขายของตัวเอง', 'ไม่มีโทเคนได้ 401 "ต้องเข้าสู่ระบบก่อน"', 'มีโทเคนพนักงานขายแต่เรียกเส้นทางผู้จัดการได้ 403 "บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้"'],
 [('หน้าจอ', 'App.jsx → components/RequireRole.jsx (roles ไม่ตรง → Navigate กลับหน้าแรกของบทบาท)'),
  ('API', 'ทุกเส้นทางใน backend/app.js ผ่าน verifyToken แล้วตามด้วย requireRole(...)'),
  ('Backend', 'middleware/auth.js → verifyToken() คืน 401 · requireRole() คืน 403')],
 'กันที่หน้าจออย่างเดียวพอไหม → ไม่พอ เพราะยิง API ตรงได้ จึงต้องกันที่เซิร์ฟเวอร์ทุกเส้นทาง (หน้าจอซ่อนเมนูแค่เพื่อความสะดวก)'),

('S-03', 'ผู้จัดการตั้งจุดสั่งซื้อเพิ่มของปูน', 'UC-02 · FR-02 · TC-02 · AC-02', 'ผู้จัดการ',
 'ผู้จัดการอยากรู้ตัวก่อนของหมด จึงตั้งจุดสั่งซื้อเพิ่มของสินค้าตัวหนึ่ง',
 'เข้าสู่ระบบด้วยบัญชีผู้จัดการ',
 ['เปิดเมนูจัดการข้อมูลสินค้า', 'ค้นสินค้าหนึ่งรายการ กดแก้ไข', 'ใส่จุดสั่งซื้อเพิ่ม เช่น 20 แล้วบันทึก', 'เปิดเมนูประวัติการทำรายการ'],
 ['ค่าในตารางเปลี่ยนเป็น 20', 'ประวัติมีแถว "UPDATE_PRODUCT" พร้อมชื่อผู้จัดการและเวลา'],
 [('หน้าจอ', 'pages/products/index.jsx'), ('API', 'PUT /api/products/:id (requireRole manager)'),
  ('Backend', 'modules/product/index.js → update() ในธุรกรรม withTransaction (config/db.js)'),
  ('ตาราง', 'แก้ products.reorder_point · เขียน audit_logs (UPDATE_PRODUCT)')],
 'ทำไมใช้ธุรกรรมแม้แก้แถวเดียว → เพราะต้องเขียน products กับ audit_logs พร้อมกัน ถ้าอย่างหนึ่งพลาดต้องย้อนทั้งคู่'),

('S-04', 'ของเข้าร้าน ผู้จัดการปรับสต็อก', 'UC-02 · FR-02 · NFR-04', 'ผู้จัดการ',
 'รถส่งของมาส่งสินค้า ผู้จัดการเพิ่มยอดคงเหลือพร้อมเหตุผล',
 'เข้าสู่ระบบด้วยบัญชีผู้จัดการ',
 ['หน้าจัดการสินค้า กดปรับสต็อกของสินค้าหนึ่งรายการ', 'ใส่จำนวน +10 เหตุผล "รับสินค้าเข้า" แล้วบันทึก', 'ลองใส่ -9999 (มากกว่าที่มี)'],
 ['ยอดคงเหลือเพิ่ม 10', 'ใส่ติดลบเกินที่มี ได้ข้อความ "ยอดคงเหลือจะติดลบ" (409) ยอดไม่เปลี่ยน'],
 [('หน้าจอ', 'pages/products/index.jsx'), ('API', 'PATCH /api/products/:id/stock'),
  ('Backend', 'modules/product/index.js → adjustStock() ล็อกแถวด้วย SELECT … FOR UPDATE แล้วหลัง commit เรียก alert.checkStock()'),
  ('ตาราง', 'แก้ products.stock_qty · เขียน stock_movements และ audit_logs (ADJUST_STOCK)')],
 'stock_movements มีไว้ทำไม → เก็บทุกครั้งที่สต็อกเปลี่ยน พร้อมยอดหลังเปลี่ยนและสาเหตุ ทำให้ตรวจย้อนได้ว่าสต็อกหายไปเพราะอะไร'),

('S-05', 'ลูกค้าซื้อสามรายการ พนักงานคิดยอด', 'UC-03 · FR-03 · TC-03 · AC-03', 'พนักงานขาย',
 'ลูกค้ามาซื้อเหล็ก สี และท่อ พนักงานเลือกสินค้าลงรายการ ระบบคิดยอดให้ และแสดง QR ให้ลูกค้าสแกน',
 'เข้าสู่ระบบด้วยบัญชีพนักงานขาย ตั้ง PROMPTPAY_ID ใน .env แล้ว',
 ['ค้นและเพิ่มสินค้า 3 รายการ', 'เปลี่ยนจำนวนของรายการแรกเป็น 2', 'คิดเลขเองบนกระดาษ (ราคา × จำนวน รวมกัน)', 'กด "แสดงรหัส QR เพื่อรับชำระ"', 'ลองสแกน QR ด้วยแอปธนาคาร (ไม่ต้องโอนจริง) ดูยอดที่ขึ้น'],
 ['ยอดบนจอตรงกับที่คิดเอง', 'ยอดบนหน้า QR และยอดที่แอปธนาคารอ่านจาก QR ตรงกัน'],
 [('หน้าจอ', 'pages/pos/index.jsx (ใช้ components/Money.jsx แสดงเงิน · ไลบรารี qrcode วาด QR)'),
  ('API', 'GET /api/products (ค้นสินค้า) · POST /api/orders/quote (คิดยอด)'),
  ('Backend', 'modules/order/index.js → quote() → parseItems() → priceItems() อ่านราคาจากฐานข้อมูล → lib/promptpay.js buildPayload()'),
  ('ตาราง', 'อ่าน products อย่างเดียว ยังไม่บันทึกอะไร')],
 'ทำไมไม่ใช้ราคาที่หน้าจอส่งมา → หน้าจอแก้ได้ จึงคิดราคาจากฐานข้อมูลที่เซิร์ฟเวอร์เท่านั้น (หน้าจอส่งแค่รหัสสินค้ากับจำนวน)'),

('S-06', 'ลูกค้าโอนแล้ว พนักงานยืนยันรับชำระ', 'UC-03 · UC-04 · FR-03 · TC-03 · TC-04 · TC-12', 'พนักงานขาย',
 'ลูกค้าโชว์สลิป พนักงานดูแอปธนาคารว่าเงินเข้า แล้วกดยืนยัน ระบบออกเลขที่ พิมพ์ใบเสร็จ และส่งคำสั่งซื้อไปคลัง',
 'ต่อจาก S-05 บริการพิมพ์เปิดอยู่ (พอร์ต 4100)',
 ['ตรวจแอปธนาคารว่าเงินเข้าจริง', 'กด "ยืนยันรับชำระเงิน"', 'ดูเลขที่คำสั่งซื้อที่ได้ และใบเสร็จที่ออกจากเครื่องพิมพ์', 'ขายต่ออีกใบ ดูว่าเลขที่ต่อเนื่องไม่ซ้ำ'],
 ['ได้เลขที่ใหม่ ไม่ซ้ำกับใบก่อน', 'ใบเสร็จภาษาไทยออกภายใน 5 วินาที คอลัมน์ตรง', 'ถ้าปิดบริการพิมพ์ไว้ การขายยังสำเร็จ (แค่แจ้งว่าพิมพ์ไม่ได้)'],
 [('หน้าจอ', 'pages/pos/index.jsx → confirmPayment()'), ('API', 'POST /api/orders'),
  ('Backend', 'modules/order/index.js → create() ในธุรกรรม: nextOrderNo() ล็อกเลขล่าสุดของวันด้วย FOR UPDATE → priceItems() → บันทึก · ชนกันลองใหม่สูงสุด 12 ครั้ง (DF-01)'),
  ('หลัง commit', 'modules/print-client → printReceipt() → print-service/server.js POST /print/receipt (ESC/POS) · queue.broadcast("order.created")'),
  ('ตาราง', 'เขียน orders, order_items (เก็บราคา ณ เวลาขาย), audit_logs (CREATE_ORDER)')],
 'ทำไมสั่งพิมพ์หลัง commit → ถ้าพิมพ์ล่มการขายต้องยังสำเร็จ และคิวต้องไม่เห็นคำสั่งซื้อที่ยังไม่บันทึกจริง'),

('S-07', 'คลังเห็นออเดอร์เองโดยไม่ต้องรีเฟรช', 'UC-05 · FR-04 · NFR-02 · TC-05 · AC-06', 'พนักงานขาย + พนักงานคลัง',
 'ไฮไลต์ของระบบ: ขายที่หน้าร้าน แล้วรายการขึ้นที่จอคลังเอง คลังเริ่มจัดของได้ก่อนลูกค้าเดินไปถึง',
 'เปิดสองหน้าจอ: คอมเข้าบัญชีพนักงานขาย และมือถือเข้าบัญชีพนักงานคลังที่หน้าคิว (http://<IP เครื่อง>:5173)',
 ['ที่มือถือเปิดหน้าคิวค้างไว้ ห้ามกดรีเฟรช', 'ที่คอมขายสินค้าหนึ่งใบ แล้วกดยืนยันรับชำระ', 'จับเวลาตั้งแต่กดจนรายการขึ้นที่มือถือ'],
 ['รายการขึ้นที่มือถือเองภายใน 3 วินาที (วัดได้สูงสุด 80 ms)', 'หน้าคิวมีป้ายว่ารับข้อมูลสดอยู่'],
 [('หน้าจอ', 'pages/queue/index.jsx → subscribe() ใน services/events.js เปิด WebSocket ที่ /ws (ถ้าเปิดไม่ได้ใน 3 วินาที ถอยไปใช้ SSE ที่ /api/events)'),
  ('API', 'GET /api/queue ทุกครั้งที่ได้เหตุการณ์ order.*'), ('Backend', 'modules/queue/index.js → attach() (WebSocket) · events() (SSE) · broadcast() · list()'),
  ('ตาราง', 'อ่าน orders, order_items, products')],
 'ทำไมไม่ให้จอวนถามทุก 1–2 วินาที → เปลืองและช้ากว่า ใช้ push แทน (ADR-02) และมี SSE สำรองเพราะอุปกรณ์เครือข่ายบางรุ่นไม่ยอมให้ใช้ WebSocket'),

('S-08', 'Wi-Fi ในโกดังหลุดแล้วกลับมา', 'FR-04 · NFR-02 (แก้ 14 ต.ค. 2569)', 'พนักงานขาย + พนักงานคลัง',
 'สัญญาณในโกดังหลุดชั่วครู่ ระหว่างนั้นหน้าร้านขายของไปหนึ่งใบ พอสัญญาณกลับ คิวต้องไม่ตกหล่น',
 'เหมือน S-07',
 ['ที่มือถือปิด Wi-Fi', 'ที่คอมขายหนึ่งใบ', 'เปิด Wi-Fi มือถือกลับ รอ 2–3 วินาที ห้ามกดรีเฟรช'],
 ['ใบที่ขายตอนหลุดขึ้นมาในคิวเอง'],
 [('หน้าจอ', 'services/events.js: เมื่อต่อได้ (ws.onopen / sse.onopen) ส่งเหตุการณ์ "connected" · ต่อใหม่ทุก 2 วินาทีเมื่อหลุด'),
  ('หน้าจอ', 'pages/queue/index.jsx: event === "connected" → load() ดึงคิวใหม่ทั้งหมด'),
  ('API', 'GET /api/queue')],
 'ทำไมต้องโหลดใหม่ทั้งหมด → เหตุการณ์ที่เกิดระหว่างหลุดไม่ถูกส่งซ้ำ การดึงคิวทั้งก้อนจากฐานข้อมูลจึงเป็นวิธีที่ถูกต้องที่สุด'),

('S-09', 'คลังกดเริ่มจัดของ', 'UC-06 · FR-04 · ตารางที่ 3.23', 'พนักงานคลัง',
 'พนักงานคลังรับงานใบหนึ่ง กด "เริ่มจัด" ให้คนอื่นเห็นว่ามีคนทำแล้ว',
 'มีคำสั่งซื้อสถานะรอจ่ายในคิว',
 ['กดเริ่มจัดที่ใบหนึ่ง', 'ดูอีกจอว่าสถานะเปลี่ยนตาม', 'กด "ยกเลิกการจัด" ให้กลับเป็นรอจ่าย', 'ลองให้พนักงานคลังยกเลิกคำสั่งซื้อ (ไม่มีปุ่ม) แล้วให้ผู้จัดการยกเลิก'],
 ['สถานะเปลี่ยนเป็นกำลังจัด ทุกจอเห็นพร้อมกัน', 'ย้อนกลับเป็นรอจ่ายได้', 'ยกเลิกคำสั่งซื้อได้เฉพาะผู้จัดการ'],
 [('หน้าจอ', 'pages/queue/index.jsx'), ('API', 'PATCH /api/orders/:id/status'),
  ('Backend', 'modules/queue/index.js → updateStatus() ตรวจ TRANSITIONS (สถานะที่ไปต่อได้) และ WHO_CAN (ยกเลิกเฉพาะ manager) ล็อกแถวด้วย FOR UPDATE · หลัง commit broadcast("order.status")'),
  ('ตาราง', 'แก้ orders.status · เขียน audit_logs (UPDATE_STATUS / CANCEL_ORDER)')],
 'เปลี่ยนเป็น "ส่งมอบแล้ว" ผ่านเส้นทางนี้ได้ไหม → ไม่ได้ TRANSITIONS ตั้งใจไม่ใส่ delivered ต้องผ่านการยืนยันจ่ายที่ตัดสต็อกเท่านั้น'),

('S-10', 'ลูกค้ามารับของ คลังยืนยันจ่าย', 'UC-07 · FR-05 · FR-06 · TC-06', 'พนักงานคลัง',
 'ลูกค้ายื่นเลขที่คำสั่งซื้อ คลังเปิดใบ จัดของครบ แล้วกดยืนยันจ่าย ระบบตัดสต็อกให้',
 'มีคำสั่งซื้อรอจ่ายหรือกำลังจัด จดยอดคงเหลือของสินค้าในใบไว้ก่อน',
 ['แตะใบในคิวเพื่อเปิดหน้ายืนยันจ่าย', 'กด "ยืนยันจ่ายสินค้า" แล้วกดยืนยันอีกครั้ง', 'ดูคิวว่าใบหายไป', 'ผู้จัดการเปิดหน้าสินค้าดูยอดคงเหลือ'],
 ['ต้องกดสองครั้ง (กันกดพลาด)', 'ใบหายจากคิวทุกจอ', 'สต็อกลดเท่าจำนวนที่จ่ายพอดี'],
 [('หน้าจอ', 'pages/dispatch/index.jsx (arming = ขั้นยืนยันซ้ำ)'), ('API', 'GET /api/orders/:id · POST /api/orders/:id/dispatch'),
  ('Backend', 'modules/dispatch/index.js → confirm() → withTransaction → modules/stock-deduction/index.js → dispatch()'),
  ('ในธุรกรรม', '1) UPDATE orders … WHERE status IN (รอจ่าย, กำลังจัด) 2) UPDATE products SET stock_qty = stock_qty − ? WHERE stock_qty >= ? 3) บันทึก stock_movements 4) audit_logs (CONFIRM_DISPATCH)'),
  ('หลัง commit', 'broadcast("order.dispatched") · alert.checkStock()')],
 'ตัดสต็อกตอนขายหรือตอนจ่าย → ตอนจ่าย เพราะของออกจากคลังจริงตอนนั้น ใบที่ยกเลิกก่อนจ่ายจึงไม่ต้องคืนสต็อก'),

('S-11', 'ลูกค้าเอาบิลเดิมกลับมารับของซ้ำ', 'FR-06 · BR-02 · NFR-04 · TC-06 · AC-07 (ทดสอบหัวใจ)', 'พนักงานคลังสองคน',
 'ปัญหาเดิมของร้าน (EV-06): มีคนเอาบิลเก่ามารับของซ้ำ หรือพนักงานสองคนกดจ่ายใบเดียวกันพร้อมกัน',
 'มีคำสั่งซื้อรอจ่ายหนึ่งใบ เปิดหน้ายืนยันจ่ายของใบนั้นไว้สองเครื่อง',
 ['เครื่องแรกกดยืนยันจ่ายจนสำเร็จ', 'เครื่องที่สองกดยืนยันจ่ายใบเดิม', 'แบบชนกันจริงระดับเสี้ยววินาที ให้รัน: npx jest backend/tests/integration/dispatch.test.js'],
 ['เครื่องที่สองได้ข้อความ "ถูกจ่ายหรือยกเลิกไปแล้ว" (409 ALREADY_DISPATCHED)', 'สต็อกถูกหักครั้งเดียว', 'เทสอัตโนมัติผ่าน: สองคำขอพร้อมกันได้ 200 หนึ่งครั้ง 409 หนึ่งครั้ง'],
 [('Backend', 'modules/stock-deduction/index.js บรรทัด 31–38: UPDATE แบบมีเงื่อนไขสถานะ ถ้า affectedRows = 0 โยน ALREADY_DISPATCHED'),
  ('Backend', 'modules/dispatch/index.js แปลงเป็น HTTP 409'), ('เทส', 'backend/tests/integration/dispatch.test.js บรรทัด 73–81 (Promise.all ยิงพร้อมกัน)')],
 'ทำไมกดด้วยมือทดสอบไม่พอ → สองคนกดให้ชนกันในเสี้ยววินาทีทำไม่ได้จริง ต้องใช้สคริปต์ยิงพร้อมกันเพื่อให้ได้ผลซ้ำทุกครั้ง'),

('S-12', 'ขายเกินของที่มี แล้วคลังจะจ่าย', 'FR-06 · TC-07 · AC-08', 'ผู้จัดการ + พนักงานขาย + พนักงานคลัง',
 'ยอดในระบบเหลือน้อย แต่หน้าร้านขายไปมากกว่านั้น พอคลังกดจ่าย ระบบต้องไม่ยอมให้สต็อกติดลบ',
 'ผู้จัดการปรับสต็อกสินค้าหนึ่งรายการให้เหลือ 1 (S-04)',
 ['พนักงานขายขายสินค้านั้น 2 ชิ้นในใบเดียวกับสินค้าอื่น (ระบบยอมให้ขาย เพราะตัดสต็อกตอนจ่าย)', 'คลังกดยืนยันจ่ายใบนั้น', 'ดูสต็อกของทุกรายการในใบ และสถานะใบ'],
 ['ได้ข้อความ "สต็อก … ไม่พอสำหรับจำนวน 2" (409 INSUFFICIENT_STOCK)', 'สต็อกทุกรายการในใบไม่เปลี่ยนเลย สถานะใบยังรอจ่าย ไม่มี stock_movements ใหม่'],
 [('Backend', 'modules/stock-deduction/index.js บรรทัด 49–56: WHERE stock_qty >= ? ถ้าไม่ผ่านโยน INSUFFICIENT_STOCK'),
  ('ธุรกรรม', 'config/db.js → withTransaction() rollback ทั้งใบ รวมรายการที่หักไปแล้วก่อนหน้า')],
 'TC-06 กับ TC-07 ต่างกันยังไง → TC-06 ล็อกที่ระดับคำสั่งซื้อ (กันจ่ายซ้ำ) TC-07 ล็อกที่ระดับสินค้า (กันติดลบ) ต้องผ่านทั้งคู่'),

('S-13', 'ของใกล้หมด ผู้จัดการได้แจ้งเตือน', 'UC-11 · FR-08 · BR-05 · TC-09 · AC-10', 'พนักงานคลัง + ผู้จัดการ',
 'ปัญหาเดิม (EV-09): สั่งของจากความรู้สึก พอสต็อกต่ำกว่าจุดสั่งซื้อเพิ่ม ระบบต้องเตือนเอง',
 'สินค้าหนึ่งรายการ stock 12 จุดสั่งซื้อเพิ่ม 10 (ตั้งด้วย S-03, S-04)',
 ['ขายสินค้านั้น 5 ชิ้นแล้วคลังจ่าย (เหลือ 7 ต่ำกว่า 10)', 'ดูกระดิ่งแจ้งเตือนและหน้าการแจ้งเตือน', 'ขายและจ่ายอีก 1 ชิ้นโดยยังไม่กดอ่านแล้ว'],
 ['มีแจ้งเตือน "… เหลือ 7 … ต่ำกว่าจุดสั่งซื้อเพิ่ม (10)" ขึ้นทันที ตัวเลขกระดิ่งเพิ่มเอง', 'จ่ายครั้งที่สองไม่เกิดแจ้งเตือนซ้ำ'],
 [('Backend', 'modules/dispatch/index.js หลัง commit → modules/alert/index.js → checkStock() → createOnce() (ไม่สร้างซ้ำถ้ายังมีอันที่ยังไม่อ่าน) → broadcast("notification.created")'),
  ('หน้าจอ', 'pages/notifications/index.jsx · services/unread.js (ตัวเลขกระดิ่ง) · API GET /api/notifications · กดอ่านแล้ว PATCH /api/notifications/:id/read (เฉพาะผู้จัดการ)'),
  ('ตาราง', 'เขียน notifications · audit_logs (CREATE_NOTIFICATION ผู้กระทำคือระบบ user_id = NULL)')],
 'ทำไมตรวจหลัง commit ไม่ใช่ในธุรกรรม → การแจ้งเตือนพลาดต้องไม่ทำให้การจ่ายของล้ม'),

('S-14', 'ออเดอร์ค้างในคิวนานผิดปกติ', 'UC-11 · FR-08 · TC-10 · AC-13', 'ผู้จัดการ',
 'ช่วงคนเยอะ มีใบหนึ่งค้างไม่มีใครจัด ระบบต้องเตือนผู้จัดการเอง',
 'แก้ .env ให้ QUEUE_DELAY_THRESHOLD_MINUTES=1 แล้วเปิดระบบใหม่ (ค่าจริงคือ 30 นาที อย่าลืมแก้คืน)',
 ['ขายหนึ่งใบแล้วปล่อยไว้ในคิว ไม่จัด', 'รอประมาณ 2 นาที', 'ดูหน้าการแจ้งเตือนของผู้จัดการ'],
 ['มีแจ้งเตือน "… รอจ่ายสินค้ามา … นาที" และไม่ซ้ำทุกนาที'],
 [('Backend', 'backend/server.js เรียก alert.start() ตอนเปิดระบบ → setInterval ทุก 60 วินาที → checkQueueDelay() หาใบที่ paid_at เกินเกณฑ์ → createOnce()'),
  ('ตาราง', 'อ่าน orders · เขียน notifications, audit_logs')],
 'ใครเป็นผู้กระทำ → ระบบเอง (ผู้กระทำอัตโนมัติในแผนภาพ use case) ไม่ต้องมีคนกด'),

('S-15', 'ผู้จัดการดูยอดระหว่างวัน', 'UC-08 · UC-09 · FR-07 · TC-08 · AC-09', 'ผู้จัดการ',
 'ปัญหาเดิม (EV-08): ต้องรอสรุปยอดตอนปิดร้าน ตอนนี้ต้องเห็นได้ทันที',
 'มีการขายและจ่ายในวันนี้แล้วหลายใบ',
 ['เปิดแดชบอร์ดปฏิบัติการ จดยอดขายวันนี้และจำนวนคิวค้าง', 'รวมยอดเองจากใบที่ขายวันนี้ (หรือรัน SQL: SELECT SUM(total_amount) FROM orders WHERE DATE(paid_at)=CURDATE() AND status<>\'cancelled\')',
  'ขายเพิ่มอีกหนึ่งใบ ดูว่าแดชบอร์ดเปลี่ยนเอง', 'เปิดแดชบอร์ดระดับบริหาร เปลี่ยนช่วงวัน'],
 ['ตัวเลขบนแดชบอร์ดตรงกับที่รวมเอง', 'ขายเพิ่มแล้วตัวเลขเปลี่ยนเองไม่ต้องรีเฟรช'],
 [('หน้าจอ', 'pages/dashboard-ops/index.jsx (โหลดใหม่ทุกเหตุการณ์) · pages/dashboard-exec/index.jsx'),
  ('API', 'GET /api/dashboard/ops · GET /api/dashboard/exec?days=…'), ('Backend', 'modules/dashboard/index.js → ops() · exec()'),
  ('ตาราง', 'อ่าน orders, order_items, products, notifications')],
 'ตัวเลขแดชบอร์ดเก็บไว้ในตารางไหม → ไม่เก็บ คำนวณจากตารางจริงทุกครั้งที่เรียก ตัวเลขจึงตรงกับข้อมูลเสมอ'),

('S-16', 'ยอดไม่ตรง ผู้จัดการตามหาว่าใครทำ', 'UC-10 · FR-09 · TC-11 · AC-11', 'ผู้จัดการ',
 'ปัญหาเดิม (EV-02): ข้อมูลกระจัดกระจาย ตรวจย้อนหลังยาก ตอนนี้ต้องค้นได้ว่าใครทำอะไรเมื่อไร',
 'ทำ S-03 ถึง S-10 มาแล้ว',
 ['เปิดประวัติการทำรายการ', 'กรองช่วงวันที่วันนี้', 'กรองประเภท "ยืนยันจ่ายสินค้า"', 'ดูแถวที่ได้'],
 ['แสดงเฉพาะแถวที่ตรงเงื่อนไข', 'ทุกแถวมีผู้กระทำ เวลา สิ่งที่ถูกกระทำ และไอพี'],
 [('หน้าจอ', 'pages/audit-logs/index.jsx'), ('API', 'GET /api/audit-logs?…'), ('Backend', 'modules/audit-log/index.js → list() · ทุกโมดูลเรียก record() ภายในธุรกรรมของตัวเอง'),
  ('ตาราง', 'อ่าน audit_logs (ACTIONS 10 ชนิด เช่น LOGIN, CREATE_ORDER, CONFIRM_DISPATCH)')],
 'ทำไมเขียน audit ในธุรกรรมเดียวกับงาน → ถ้างานถูกย้อน ประวัติก็ย้อนด้วย ไม่มีประวัติของสิ่งที่ไม่เกิดขึ้นจริง'),

('S-17', 'พิมพ์ใบเสร็จภาษาไทยที่ร้าน', 'FR-03 · NFR-05 · TC-12 · AC-14 · DF-03', 'พนักงานขาย',
 'ที่ร้าน (Windows) เครื่องพิมพ์ความร้อนต่อ USB และแชร์ชื่อ AmpornOMS-Receipt ขายจากมือถือแล้วใบเสร็จต้องออกเร็ว',
 'ติดตั้งตามภาคผนวก จ เปิดระบบด้วย start.bat',
 ['ขายจากมือถือ', 'กดยืนยันรับชำระพร้อมจับเวลา', 'หยุดเวลาเมื่อเครื่องพิมพ์ตัดกระดาษ', 'ตรวจภาษาไทยและคอลัมน์'],
 ['เสร็จภายใน 5 วินาที (วัดได้ประมาณ 2.3 วินาที)', 'ภาษาไทยไม่เพี้ยน คอลัมน์ตรง 48 ตัวอักษร'],
 [('Backend', 'modules/print-client/index.js → printReceipt() (ไม่โยนข้อผิดพลาด หมดเวลา 5 วินาที)'),
  ('Print Service', 'print-service/server.js POST /print/receipt → lib (ESC/POS ภาษาไทย รหัส มอก. 620) → เครื่องพิมพ์ที่แชร์'),
  ('เทส', 'backend/tests/unit/escpos.test.js · print-client.test.js')],
 'ทำไมพิมพ์ผ่านเครื่องพิมพ์ที่แชร์ → ส่ง USB ตรงบน Windows ไม่ได้ (DF-03) จึงย้อนกลับไปแก้วิธีพิมพ์'),

('S-18', 'ช่วงคนเยอะ ใช้งานพร้อมกันหลายเครื่อง', 'NFR-06 · NFR-04 · TC-13 · AC-15 · DF-01', 'ทุกบทบาท (สคริปต์)',
 'ช่วงเร่งด่วนมีหลายเครื่องขายและจ่ายพร้อมกัน ระบบต้องไม่ล้มและเลขที่ต้องไม่ซ้ำ',
 'ระบบเปิดครบทั้งสี่หน่วย',
 ['รัน npm run evidence (TC-05 วัดความหน่วง และ TC-13 ยิง 10 เซสชัน 20 วินาที)', 'ดูผลใน evidence/tc13.json'],
 ['ไม่มีคำขอล้มเหลว (รอบที่บันทึกในเล่ม 15,383 คำขอ ล้มเหลว 0)', 'เลขที่คำสั่งซื้อไม่ซ้ำ'],
 [('สคริปต์', 'evidence/measure-tc05.js · evidence/measure-tc13.js · evidence/measure-tc04.js'),
  ('Backend', 'modules/order/index.js → nextOrderNo() FOR UPDATE + ลองใหม่แบบถอยหลังทวีคูณ (retryDelayMs) เมื่อชนกัน')],
 'DF-01 คืออะไร → รอบแรกของ TC-13 มีคำขอล้ม 2 ครั้งเพราะธุรกรรมชนกันตอนออกเลขที่ จึงเพิ่มการลองใหม่อัตโนมัติ แล้ววัดซ้ำจนไม่ล้มเลย'),
]

AUTO = [('ทั้งหมด (unit + integration 134 ข้อ)', 'npm test'), ('ไฟล์เดียว เช่น กันจ่ายซ้ำ', 'npx jest backend/tests/integration/dispatch.test.js'),
        ('เฉพาะ unit', 'npm run test:unit'), ('system test บนเบราว์เซอร์ (ต้องเปิดระบบก่อน)', 'npm run test:system'),
        ('system test ข้อเดียว เช่น AC-07', 'npx playwright test -g "AC-07"'), ('ดูรายงานล่าสุดของ playwright', 'npx playwright show-report')]

PATH = [('หน้าจอ', 'frontend/src/pages/<ชื่อหน้า>/index.jsx'), ('เรียก API', 'frontend/src/services/api.js (แนบโทเคน) · ข้อมูลสดใช้ services/events.js'),
        ('ประตูหลังบ้าน', 'backend/app.js ประกาศทุกเส้นทาง → middleware/auth.js verifyToken → requireRole'),
        ('ตรรกะ', 'backend/modules/<โมดูล>/index.js'), ('ธุรกรรม', 'backend/config/db.js withTransaction() commit หรือ rollback ทั้งก้อน'),
        ('หลัง commit', 'queue.broadcast() ผลักไปทุกจอ · print-client สั่งพิมพ์ · alert ตรวจแจ้งเตือน')]

CSS = '''@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
@page{size:A4;margin:14mm 13mm 14mm 13mm}
*{box-sizing:border-box}body{font-family:'Sarabun',sans-serif;font-size:13.5px;color:#1b2430;line-height:1.45;margin:0}
h1{font-size:25px;color:#0F4C81;margin:0 0 4px}h2{font-size:17px;color:#0F4C81;margin:14px 0 6px}
.sub{color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse;margin:4px 0 8px}td,th{border:1px solid #c9ced6;padding:4px 7px;vertical-align:top;text-align:left}
th{background:#0F4C81;color:#fff;font-weight:700}
code,.c{font-family:Menlo,Consolas,monospace;font-size:11.5px;background:#f1f3f6;padding:1px 4px;border-radius:3px}
.card{border:1.5px solid #0F4C81;border-radius:8px;margin:0 0 12px;page-break-inside:avoid;overflow:hidden}
.ch{background:#0F4C81;color:#fff;padding:6px 10px;display:flex;justify-content:space-between;align-items:baseline}
.ch b{font-size:16px}.ch span{font-size:11.5px;opacity:.9}
.cb{padding:7px 10px}
.story{background:#FFF6EC;border-left:4px solid #F28C28;padding:5px 9px;margin-bottom:6px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lbl{font-weight:800;color:#0F4C81;font-size:12.5px;margin-top:4px}
ol,ul{margin:2px 0 2px 18px;padding:0}li{margin:1px 0}
.path td:first-child{width:92px;font-weight:700;background:#f4f6f9;color:#0F4C81}
.path td{font-size:12px}
.ask{background:#EEF6EF;border-left:4px solid #2E9E6B;padding:5px 9px;margin-top:6px;font-size:12.5px}
.res{display:flex;gap:18px;margin-top:6px;font-size:12.5px;border-top:1px dashed #aaa;padding-top:5px}
.box{display:inline-block;width:12px;height:12px;border:1.5px solid #333;margin-right:4px;vertical-align:-2px}
.note{font-size:12px;color:#555}
.cl td{font-size:11.5px;padding:2px 7px}.cl td:first-child{width:48%}.cl code{font-size:10.5px;background:none;padding:0}
.idx td:first-child{white-space:nowrap;width:44px}.idx td:nth-child(3){width:150px}
'''


def card(s):
    code_, name, refs, role, story, pre, steps, exp, path, ask = s
    pr = ''.join('<tr><td>%s</td><td>%s</td></tr>' % (e(a), e(b)) for a, b in path)
    return ('<div class="card"><div class="ch"><b>%s %s</b><span>%s</span></div><div class="cb">'
            '<div class="story">%s</div><div class="lbl">ผู้ทดสอบ: <span style="font-weight:400;color:#1b2430">%s</span></div>'
            '<div class="lbl">เงื่อนไขก่อนทดสอบ</div><div>%s</div>'
            '<div class="row"><div><div class="lbl">ขั้นตอน</div><ol>%s</ol></div><div><div class="lbl">ผลที่คาดหวัง</div><ul>%s</ul></div></div>'
            '<div class="lbl">มาจากโมดูลไหน เรียกจากไหน</div><table class="path">%s</table>'
            '<div class="lbl">บรรทัดโค้ด (ใน VS Code กด Cmd+P แล้วพิมพ์ ไฟล์:บรรทัด เช่น stock-deduction/index.js:32 · ไฟล์อยู่ในโฟลเดอร์ soml)</div><table class="cl">%s</table>'
            '<div class="ask"><b>ถ้าอาจารย์ถาม:</b> %s</div>'
            '<div class="res"><span><i class="box"></i>ผ่าน</span><span><i class="box"></i>ไม่ผ่าน</span><span>วันที่ทดสอบ ________</span><span>หมายเหตุ ______________________________</span></div>'
            '</div></div>') % (code_, e(name), e(refs), e(story), e(role), e(pre),
                               ''.join('<li>%s</li>' % e(x) for x in steps), ''.join('<li>%s</li>' % e(x) for x in exp), pr,
                               ''.join('<tr><td><code>%s:%d</code></td><td>%s</td></tr>' % (e(f), n, e(w)) for f, n, w in CODE[code_]), e(ask))


import json
PG = json.load(open(os.path.join(HERE, 'pages.json'))) if os.path.exists(os.path.join(HERE, 'pages.json')) else {}
idx = ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (s[0], e(s[1]), e(s[3]), e(s[2]), PG.get(s[0], '')) for s in S)
body = ('<h1>กรณีทดสอบแบบเหตุการณ์ · อำพร OMS</h1>'
        '<div class="sub">ใช้ทดสอบด้วยตัวเองก่อนสอบ แต่ละกรณีบอกเหตุการณ์ ขั้นตอน ผลที่คาดหวัง และเส้นทางในโค้ดว่ามาจากโมดูลไหน เรียกจากไหน · อ้างอิงกรณีทดสอบ TC-01 ถึง TC-13 ตารางที่ 3.29 และเกณฑ์ AC ตารางที่ 3.11</div>'
        '<h2>ก่อนเริ่ม</h2><ol><li>เปิดระบบ: <code>cd soml</code> แล้ว <code>npm run dev</code> หน้าจออยู่ที่ <code>http://localhost:5173</code> หลังบ้าน <code>:4000</code> บริการพิมพ์ <code>:4100</code></li>'
        '<li>อยากเริ่มจากข้อมูลสะอาด: <code>npm run db:reset</code> (ล้างฐานใช้งานกลับเป็นสินค้า 783 รายการและผู้ใช้ตั้งต้น)</li>'
        '<li>ชื่อผู้ใช้ทั้งสามบทบาทอยู่ใน <code>db/seed/seed-users.js</code></li>'
        '<li>มือถือใช้ <code>http://&lt;IP เครื่อง&gt;:5173</code> ใน Wi-Fi เดียวกัน</li></ol>'
        '<h2>เส้นทางที่ทุกกรณีเดินผ่าน</h2><table class="path">%s</table>'
        '<h2>รายการกรณีทดสอบ</h2><table class="idx"><tr><th>รหัส</th><th>เหตุการณ์</th><th>ผู้ทดสอบ</th><th>อ้างอิง</th><th>หน้า</th></tr>%s</table>'
        '<h2>คำสั่งรันเทสอัตโนมัติ (อาจารย์อาจขอให้รันให้ดู)</h2><table><tr><th>ต้องการ</th><th>คำสั่ง (รันในโฟลเดอร์ soml)</th></tr>%s</table>'
        '<div class="note">ตัวเลขที่อ้าง (134 ข้อ, 13 กรณี, 80 ms, 2.3 วินาที, 15,383 คำขอ) มาจากผลที่บันทึกในเล่มบทที่ 4 ถ้าทดสอบเองได้ค่าต่างไป ให้จดค่าจริงไว้ในช่องหมายเหตุ</div>'
        '<div style="page-break-after:always"></div>%s') % (
    ''.join('<tr><td>%s</td><td>%s</td></tr>' % (e(a), e(b)) for a, b in PATH), idx,
    ''.join('<tr><td>%s</td><td><code>%s</code></td></tr>' % (e(a), e(b)) for a, b in AUTO), ''.join(card(s) for s in S))
io.open(os.path.join(HERE, 'scenarios.html'), 'w', encoding='utf-8').write(
    '<!doctype html><html><head><meta charset="utf-8"><title>กรณีทดสอบแบบเหตุการณ์</title><style>%s</style></head><body>%s</body></html>' % (CSS, body))
print(len(S), 'กรณี')
