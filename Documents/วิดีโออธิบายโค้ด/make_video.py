# -*- coding: utf-8 -*-
"""วิดีโอแนวตั้งอธิบายโค้ดอำพร OMS ทั้งระบบ
โค้ดบนจอดึงจากไฟล์จริงตอนสร้าง เลขบรรทัดจึงตรงกับซอร์สโค้ดเสมอ
ขั้นตอน: scenes → frames.html → PNG (puppeteer) → เสียงพากย์ (say -v Kanya) → ffmpeg ต่อเป็น mp4"""
import html, io, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'soml')
ASSET = os.path.join(ROOT, 'Documents', 'assets')
WORK = os.path.join(HERE, '_work')
e = html.escape


def lines_of(rel):
    return io.open(os.path.join(SRC, rel), encoding='utf-8').read().split('\n')


def code(rel, start, n, hl=(), dim_after=None):
    """ตัดโค้ดจากไฟล์จริง เริ่มที่บรรทัดแรกที่มี start ยาว n บรรทัด ไฮไลต์บรรทัดที่มีข้อความใน hl"""
    L = lines_of(rel)
    i = next(k for k, l in enumerate(L) if start in l)
    rows = []
    for k in range(i, min(i + n, len(L))):
        t = L[k]
        on = any(h in t for h in hl)
        rows.append('<div class="ln%s"><span class="no">%d</span><span class="tx">%s</span></div>' % (' on' if on else '', k + 1, e(t) or ' '))
    return ('<div class="code"><div class="fn">%s · บรรทัด %d–%d</div>%s</div>' % (e(rel), i + 1, min(i + n, len(L)), ''.join(rows)))


def flow(items, note=None):
    out = []
    for k, (a, b, c) in enumerate(items):
        if k:
            out.append('<div class="arr">▼</div>')
        out.append('<div class="fb" style="border-color:%s"><b style="color:%s">%s</b><span>%s</span></div>' % (c, c, a, b))
    return '<div class="flow">%s%s</div>' % (''.join(out), '<div class="fnote">%s</div>' % note if note else '')


def shot(name, label):
    return '<div class="shot"><img src="file://%s"><div class="sl">%s</div></div>' % (os.path.join(ASSET, 'screens', name), label)


def qa(q, a):
    return '<div class="qa"><div class="q">กรรมการถาม</div><div class="qq">%s</div><div class="q a">ตอบแบบนี้</div><div class="aa">%s</div></div>' % (q, a)


def big(t, s=''):
    return '<div class="big"><div class="bt">%s</div><div class="bs">%s</div></div>' % (t, s)


Y, G, B, R, O, P = '#FACC15', '#34D399', '#60A5FA', '#F87171', '#FB923C', '#C4B5FD'
SC = []


def s(chap, title, vis, say, sub=None):
    SC.append(dict(chap=chap, title=title, vis=vis, say=say, sub=sub or say))


# ---------------- บทนำ ----------------
C = 'เริ่ม'
s(C, 'อำพร OMS<br>อธิบายโค้ดทั้งระบบ', big('กดปุ่มนี้<br>โค้ดไหนทำงาน?', 'หน้าจอ → API → หลังบ้าน → ฐานข้อมูล'),
  'สวัสดีครับ คลิปนี้พาไล่โค้ดอำพร OMS ทั้งระบบ ตั้งแต่กดปุ่มบนหน้าจอ ไปจนถึงฐานข้อมูล ดูจบแล้ว ต้องตอบกรรมการได้ว่า กดปุ่มนี้ แล้วโค้ดไหนทำงาน')
s(C, 'ภาพเดียวที่ต้องจำ', flow([
    ('หน้าจอ React', 'pages/ ทั้ง 9 หน้า', B), ('services/api.js', 'แนบโทเคน ยิงคำขอ', B),
    ('backend/app.js', 'verifyToken + requireRole', Y), ('modules/…', 'ตรรกะธุรกิจ ใน withTransaction', O),
    ('MySQL InnoDB', 'บันทึกจริง แล้ว commit', G), ('broadcast()', 'ผลักเหตุการณ์ หลัง commit', P),
    ('services/events.js', 'จออื่นได้ยิน แล้วโหลดใหม่', B)]),
  'จำภาพนี้ภาพเดียวพอครับ ทุกปุ่มเดินทางแบบนี้ หน้าจอเรียก api.js ไปที่ app.js ซึ่งตรวจโทเคนกับบทบาทก่อน แล้วส่งให้โมดูล ทำงานในธุรกรรมเดียว บันทึกลง MySQL พอ commit แล้ว ค่อยผลักเหตุการณ์ ให้จออื่นรู้ทันที')
s(C, 'โฟลเดอร์ในโปรเจกต์', flow([
    ('frontend/src/pages', 'login · pos · queue · dispatch · dashboard-ops · dashboard-exec · products · notifications · audit-logs', B),
    ('frontend/src/services', 'api.js · events.js · session.jsx', B),
    ('backend/app.js + middleware/auth.js', 'ประกาศเส้นทาง และตรวจสิทธิ์', Y),
    ('backend/modules', 'auth · product · order · queue · dispatch · stock-deduction · dashboard · alert · audit-log', O),
    ('backend/config/db.js', 'pool และ withTransaction', G), ('print-service', 'หน่วยแยก ส่งคำสั่ง ESC/POS ให้เครื่องพิมพ์', R)]),
  'โครงโปรเจกต์มีแค่นี้ครับ ฝั่งหน้าบ้าน หนึ่งหน้าจอ คือหนึ่งโฟลเดอร์ใน pages มีไฟล์กลางสามตัวใน services ฝั่งหลังบ้าน app.js ประกาศเส้นทาง โมดูลแยกตามงาน และมีบริการพิมพ์ แยกเป็นอีกหน่วย')

# ---------------- ไฟล์กลาง ----------------
C = '1 · ไฟล์กลาง'
s(C, 'api.js : ทุกหน้าเรียกผ่านตัวนี้', code('frontend/src/services/api.js', 'async function call', 18, ['authorization', 'fetch(']),
  'ทุกหน้าไม่ได้ยิง fetch เอง แต่เรียก api.get หรือ post ซึ่งมาจบที่ฟังก์ชัน call ตัวนี้ มันต่อคำว่า สแลช api ข้างหน้าให้ แล้วแนบโทเคน ในหัวข้อ authorization ทุกครั้ง')
s(C, 'api.js : จัดการ error ที่เดียว', code('frontend/src/services/api.js', 'async function call', 18, ['if (!res.ok)', 'err.code', '401']),
  'ถ้าหลังบ้านตอบไม่สำเร็จ ตรงนี้แปลงเป็น error ที่มีข้อความภาษาไทยจากหลังบ้าน และเก็บ code ไว้ด้วย เช่น ALREADY_DISPATCHED ถ้าได้ 401 จะลบโทเคนทิ้ง ให้ล็อกอินใหม่')
s(C, 'events.js : ฟังข้อมูลสด', code('frontend/src/services/events.js', 'const openWebSocket', 11, ['new WebSocket', 'fallback', 'onmessage']),
  'events.js คือช่องทางค้าง หน้าไหนอยากรู้ทันที ก็เรียก subscribe มันเปิด WebSocket ที่สแลช ws แนบโทเคนไปในลิงก์ ถ้าเปิดไม่ได้ภายในสามวินาที จะสลับไปทางสำรอง')
s(C, 'events.js : ทางสำรอง SSE', code('frontend/src/services/events.js', 'const openSSE', 9, ['EventSource', "'order.created'", 'RECONNECT_MS']),
  'ทางสำรองคือ SSE ที่สแลช api สแลช events รับเหตุการณ์สี่แบบ order.created, order.status, order.dispatched และ notification.created ถ้าหลุด ต่อใหม่เองในสองวินาที')
s(C, 'app.js : แผนที่ของทุกเส้นทาง', code('backend/app.js', "app.post('/api/auth/login'", 22, ["requireRole('sales'", "'/api/orders/:id/dispatch'", "requireRole('manager'), product.create"]),
  'app.js คือแผนที่ อ่านทีละบรรทัดแบบนี้ เมธอด เส้นทาง ตรวจโทเคน ตรวจบทบาท แล้วฟังก์ชันที่ทำงาน เช่น post สแลช orders ให้เฉพาะ sales กับ manager แล้วไปที่ order.create')
s(C, 'verifyToken กับ requireRole', code('backend/middleware/auth.js', 'function verifyToken', 29, ['jwt.verify', 'status(401)', 'status(403)']),
  'สองฟังก์ชันนี้กันสิทธิ์จริงครับ verifyToken ตรวจลายเซ็นโทเคน ถ้าไม่มีหรือปลอม ตอบ 401 แปลว่าไม่รู้ว่าเป็นใคร ส่วน requireRole รู้ว่าเป็นใคร แต่บทบาทไม่ตรง ตอบ 403 การซ่อนเมนูฝั่งหน้าจอ เป็นแค่ความสะดวก ตัวกันจริงอยู่ตรงนี้')

# ---------------- เข้าสู่ระบบ ----------------
C = '2 · เข้าสู่ระบบ UC-01'
s(C, 'หน้าเข้าสู่ระบบ', shot('01-login.png', 'pages/login → session.login() → POST /api/auth/login'),
  'เริ่มที่หน้าเข้าสู่ระบบ กรอกชื่อกับรหัสผ่าน แล้วกดปุ่ม หน้าจอเรียก login ใน session.jsx ซึ่งยิง post สแลช api สแลช auth สแลช login')
s(C, 'auth.login : ตรวจรหัสผ่าน', code('backend/modules/auth/index.js', 'async function login', 19, ['bcrypt.compare', 'jwt.sign', "'LOGIN'"]),
  'หลังบ้านหาผู้ใช้ แล้วใช้ bcrypt เทียบรหัสผ่านกับค่าแฮช จุดเด็ดคือ ถ้าไม่เจอชื่อ ก็ยังเทียบกับแฮชปลอม ให้เวลาตอบเท่ากัน คนนอกเดาไม่ได้ว่าชื่อไหนมีจริง ถ้าผ่าน ออกโทเคน JWT อายุแปดชั่วโมง และบันทึก LOGIN ลงประวัติ')
s(C, 'ไปหน้าแรกตามบทบาท', code('frontend/src/services/session.jsx', 'export const HOME_BY_ROLE', 22, ['HOME_BY_ROLE', "'/auth/me'", 'token.set']),
  'ได้โทเคนแล้ว เก็บไว้ แล้วพาไปหน้าแรกของบทบาท พนักงานขายไปหน้าขาย คลังไปหน้าคิว ผู้จัดการไปแดชบอร์ด ถ้ารีเฟรช จะถาม สแลช auth สแลช me ว่าโทเคนยังใช้ได้ไหม')

# ---------------- ขายหน้าร้าน ----------------
C = '3 · ขายหน้าร้าน UC-03'
s(C, 'หน้าขายหน้าร้าน', shot('02-pos.png', 'pages/pos : ตะกร้า → QR → เสร็จ'),
  'หน้าขายมีสามขั้นในหน้าเดียว คือตะกร้า แสดงคิวอาร์ แล้วเสร็จ ค้นสินค้าเรียก get สแลช products โดยรอพิมพ์หยุดสองร้อยมิลลิวินาทีก่อน จะได้ไม่ยิงทุกตัวอักษร')
s(C, 'ตะกร้าเปลี่ยน → ให้หลังบ้านคิดยอด', code('frontend/src/pages/pos/index.jsx', 'ทุกครั้งที่ตะกร้าเปลี่ยน', 7, ["'/orders/quote'"]),
  'ทุกครั้งที่ตะกร้าเปลี่ยน หน้าจอส่งแค่รหัสสินค้ากับจำนวน ไปที่ orders สแลช quote ไม่ส่งราคา เพราะราคาจริงอยู่ในฐานข้อมูล ถ้าเชื่อราคาจากหน้าจอ คนแก้ราคาในเบราว์เซอร์ได้')
s(C, 'priceItems : ราคาจากฐานข้อมูล', code('backend/modules/order/index.js', 'async function priceItems', 18, ['FROM products WHERE product_id IN', 'Math.round', 'is_active']),
  'priceItems ดึงราคาจากตาราง products เช็กว่าสินค้ายังขายอยู่ แล้วคิดยอดรวม ปัดเป็นสตางค์ กันเศษทศนิยม quote ใช้ฟังก์ชันนี้ แล้วสร้างข้อความคิวอาร์พร้อมเพย์ตามยอด ส่งกลับไปให้หน้าจอวาดรูป')
s(C, 'กด "ยืนยันรับชำระเงิน"', code('frontend/src/pages/pos/index.jsx', 'ยืนยันรับชำระเงิน — จุดเดียว', 8, ["api.post('/orders'"]),
  'พนักงานดูแอปธนาคารว่าเงินเข้าแล้ว จึงกดยืนยัน ปุ่มนี้คือจุดเดียวที่คำสั่งซื้อถูกบันทึก ยิง post สแลช orders')
s(C, 'order.create : บันทึกในธุรกรรมเดียว', code('backend/modules/order/index.js', 'async function create', 25, ['withTransaction', 'nextOrderNo(conn)', 'INSERT INTO orders', 'INSERT INTO order_items', "'CREATE_ORDER'"]),
  'create ทำทุกอย่างใน withTransaction คิดราคาใหม่ ออกเลขที่ บันทึก orders บันทึก order_items พร้อมราคา ณ เวลาขาย และบันทึกประวัติ ถ้าพังตรงไหน ย้อนกลับทั้งหมด')
s(C, 'nextOrderNo : เลขที่ไม่ซ้ำ', code('backend/modules/order/index.js', 'async function nextOrderNo', 10, ['FOR UPDATE', 'padStart']),
  'เลขที่รูปแบบ ORD ขีด วันที่ ขีด ลำดับ เวลาออกเลข ใช้ FOR UPDATE ล็อกเลขล่าสุดของวัน เครื่องที่มาพร้อมกันต้องรอคิว และในฐานยังมี UNIQUE กันอีกชั้น')
s(C, 'ชนกันแล้วลองใหม่ (DF-01)', code('backend/modules/order/index.js', 'for (let attempt = 1', 27, ['for (let attempt', 'isOrderNoCollision', 'retryDelayMs']),
  'ตอนทดสอบภาระงาน เจอชนกันสองครั้ง จากหนึ่งหมื่นสี่พันกว่าครั้ง เลยเพิ่มลูปนี้ ถ้าชน ถอยหลังรอเวลาที่ยาวขึ้นเรื่อยๆ แล้วลองใหม่ วัดซ้ำแล้วไม่ล้มเหลวเลย')
s(C, 'หลัง commit : พิมพ์ + ผลักเข้าคิว', code('backend/modules/order/index.js', '// ---- หลัง COMMIT เท่านั้น ----', 10, ['printReceipt', "broadcast('order.created'"]),
  'พอ commit แล้ว ถึงค่อยสั่งพิมพ์ใบเสร็จ และผลัก order.created ถ้าพิมพ์ไม่ได้ การขายยังสำเร็จ หน้าจอแค่ขึ้นคำเตือน เพราะรับเงินไปแล้ว ที่ต้องรอ commit ก่อน ก็เพื่อไม่ให้คิวเห็นคำสั่งซื้อที่ยังไม่มีจริง')

# ---------------- คิว ----------------
C = '4 · คิวคลัง UC-05/06'
s(C, 'หน้าคิวรอจ่ายสินค้า', shot('04-queue.png', 'pages/queue : GET /api/queue + subscribe()'),
  'ฝั่งคลัง เปิดหน้าคิวบนมือถือ คำสั่งซื้อเรียงตามเวลาชำระ พร้อมเวลารอ ถ้ารอเกินสามสิบนาที การ์ดขึ้นสีเตือน')
s(C, 'โหลดครั้งแรก แล้วรอฟัง', code('frontend/src/pages/queue/index.jsx', 'const load = useCallback', 7, ["api.get('/queue')", 'subscribe(', "startsWith('order.')"]),
  'เปิดหน้า โหลดคิวด้วย get สแลช queue หนึ่งครั้ง จากนั้น subscribe รอฟัง ได้เหตุการณ์ที่ขึ้นต้นด้วย order เมื่อไร ก็โหลดใหม่เอง ไม่ต้องกดรีเฟรช วัดได้ไม่เกินแปดสิบมิลลิวินาที')
s(C, 'broadcast : ผลักไปทุกจอ', code('backend/modules/queue/index.js', 'function broadcast', 10, ['ws.send', 'res.write']),
  'ฝั่งหลังบ้าน broadcast วนส่งข้อความให้ทุกจอที่ต่อค้างอยู่ ทั้ง WebSocket และ SSE คอมเมนต์บอกชัดว่า ต้องเรียกหลัง commit เท่านั้น')
s(C, 'ปุ่ม เริ่มจัด / ยกเลิก', code('frontend/src/pages/queue/index.jsx', 'const startPicking', 12, ["status: 'picking'", "status: 'awaiting_dispatch'", "status: 'cancelled'"]),
  'ปุ่มสามปุ่ม เรียกเส้นทางเดียวกัน คือ patch สแลช orders สแลช ไอดี สแลช status ต่างกันแค่สถานะที่ส่ง เริ่มจัด ยกเลิกการจัด และยกเลิกคำสั่งซื้อ ซึ่งทำได้เฉพาะผู้จัดการ')
s(C, 'TRANSITIONS : แผนภาพสถานะในโค้ด', code('backend/modules/queue/index.js', 'const TRANSITIONS', 9, ['awaiting_dispatch:', 'picking:', 'WHO_CAN']),
  'แผนภาพสถานะในเล่ม อยู่ในโค้ดตรงนี้ TRANSITIONS บอกว่าจากสถานะไหนไปไหนได้ WHO_CAN บอกว่าบทบาทไหนตั้งสถานะไหนได้ สังเกตว่า delivered ไม่มีในนี้ เพราะต้องไปทางยืนยันจ่ายเท่านั้น')
s(C, 'updateStatus : ตรวจแล้วค่อยเปลี่ยน', code('backend/modules/queue/index.js', 'async function updateStatus', 26, ['WHO_CAN[target].includes', 'FOR UPDATE', 'TRANSITIONS[order.status]', "broadcast('order.status'"]),
  'updateStatus ตรวจบทบาท แล้วล็อกแถวคำสั่งซื้อ เช็กว่ามีลูกศรในแผนภาพสถานะไหม ถ้าไม่มี ตอบ 409 ถ้ามี เปลี่ยนสถานะ บันทึกประวัติ แล้ว commit จากนั้นผลัก order.status ทุกจอเห็นพร้อมกัน')

# ---------------- ยืนยันจ่าย ----------------
C = '5 · ยืนยันจ่าย UC-07 ⭐'
s(C, 'หัวใจของระบบ', shot('05-dispatch.png', 'pages/dispatch : GET /api/orders/:id → POST /api/orders/:id/dispatch'),
  'มาถึงส่วนที่สำคัญที่สุด ตั้งใจฟังนะครับ หน้ายืนยันจ่าย โหลดรายการที่ต้องจัดด้วย get สแลช orders สแลช ไอดี และต้องกดยืนยันสองครั้ง เพราะส่งมอบแล้ว ย้อนกลับไม่ได้')
s(C, 'กดยืนยัน', code('frontend/src/pages/dispatch/index.jsx', 'const confirm = async', 10, ['/dispatch`', 'ALREADY_DISPATCHED']),
  'กดยืนยัน ยิง post สแลช orders สแลช ไอดี สแลช dispatch ถ้าได้ ALREADY_DISPATCHED กลับมา แปลว่ามีคนจ่ายไปก่อน หน้าจอโหลดใบใหม่ ให้เห็นว่าจ่ายไปแล้ว')
s(C, 'dispatch.confirm', code('backend/modules/dispatch/index.js', 'async function confirm', 21, ['withTransaction', '409', "broadcast('order.dispatched'", 'checkStock']),
  'หลังบ้าน confirm ห่อทุกอย่างใน withTransaction แล้วเรียก stock-deduction ถ้าถูกปฏิเสธ ตอบ 409 ถ้าผ่าน หลัง commit ผลัก order.dispatched ใบนี้หายจากคิวทุกจอ แล้วค่อยเช็กสต็อกเพื่อแจ้งเตือน นอกธุรกรรม')
s(C, 'withTransaction', code('backend/config/db.js', 'async function withTransaction', 15, ['beginTransaction', 'commit', 'rollback']),
  'withTransaction สั้นมาก เปิดธุรกรรม รันงาน ถ้าสำเร็จ commit ถ้ามี error ตรงไหน rollback ทั้งหมด ข้อมูลจึงไม่ค้างครึ่งๆ กลางๆ')
s(C, 'ขั้น 2 : กันจ่ายซ้ำ', code('backend/modules/stock-deduction/index.js', 'async function dispatch', 15, ["AND status IN ('awaiting_dispatch', 'picking')", 'affectedRows === 0', 'ALREADY_DISPATCHED']),
  'ขั้นที่สอง กันจ่ายซ้ำ อัปเดตสถานะเป็น delivered แต่มีเงื่อนไขว่า สถานะตอนนี้ต้องยังรอจ่าย หรือกำลังจัด ถ้าเครื่องอื่นจ่ายไปก่อน แถวจะไม่ตรงเงื่อนไข affectedRows เป็นศูนย์ เราก็โยน ALREADY_DISPATCHED')
s(C, 'ขั้น 3 : กันสต็อกติดลบ', code('backend/modules/stock-deduction/index.js', 'for (const it of items)', 10, ['stock_qty >= ?', 'INSUFFICIENT_STOCK']),
  'ขั้นที่สาม หักสต็อกทีละสินค้า โดยมีเงื่อนไขว่า ยอดคงเหลือต้องมากกว่าหรือเท่ากับจำนวนที่หัก ถ้าไม่พอ โยน INSUFFICIENT_STOCK แล้วทั้งใบ rollback สินค้าที่หักไปแล้วก็คืนครบ')
s(C, 'ขั้น 4–5 : บันทึกทุกการเคลื่อนไหว', code('backend/modules/stock-deduction/index.js', 'ขั้น 4', 12, ['INSERT INTO stock_movements', "'CONFIRM_DISPATCH'"]),
  'ขั้นที่สี่ บันทึก stock_movements พร้อมยอดหลังเปลี่ยน ขั้นที่ห้า บันทึก CONFIRM_DISPATCH ลงประวัติ ทั้งหมดอยู่ในธุรกรรมเดียวกัน')
s(C, 'ถ้าสองคนกดพร้อมกัน?', flow([
    ('เครื่อง A กดยืนยัน', 'UPDATE … WHERE status IN (รอจ่าย, กำลังจัด)', B),
    ('ฐานข้อมูลล็อกแถว', 'A ได้ก่อน → affectedRows = 1 → ตัดสต็อก → commit', G),
    ('เครื่อง B กดพร้อมกัน', 'รอ A จบ แล้วเช็กเงื่อนไขใหม่ สถานะเป็น delivered แล้ว', O),
    ('B ได้ affectedRows = 0', 'โยน ALREADY_DISPATCHED → ตอบ 409 สต็อกไม่ถูกหักซ้ำ', R)],
    'ผลทดสอบ TC-06 : ยิงพร้อมกัน 2 คำขอ สำเร็จครั้งเดียว สต็อกถูกหักครั้งเดียว'),
  'สมมติสองคนกดพร้อมกัน ฐานข้อมูลล็อกแถวให้คนแรกก่อน คนแรกผ่าน ตัดสต็อก แล้ว commit คนที่สองเช็กเงื่อนไขใหม่ เจอว่าสถานะเป็น delivered แล้ว affectedRows เป็นศูนย์ ได้ 409 สต็อกจึงไม่ถูกหักซ้ำ ผลทดสอบ TC-06 ยืนยันแล้ว')

# ---------------- ส่วนอื่น ----------------
C = '6 · แจ้งเตือน แดชบอร์ด สินค้า ประวัติ'
s(C, 'checkStock : แจ้งเตือนของใกล้หมด', code('backend/modules/alert/index.js', 'async function checkStock', 14, ['stock_qty < reorder_point', 'createOnce']),
  'หลังจ่ายของ checkStock หาสินค้าที่ยอดต่ำกว่าจุดสั่งซื้อเพิ่ม แล้วสร้างแจ้งเตือน createOnce กันแจ้งซ้ำเรื่องเดิม หน้าแจ้งเตือนกับตัวเลขบนเมนู ฟัง notification.created แล้วอัปเดตเอง')
s(C, 'dashboard.ops : คำนวณสดทุกครั้ง', code('backend/modules/dashboard/index.js', 'async function ops', 26, ['SUM(o.total_amount)', "status IN ('awaiting_dispatch', 'picking')", 'stock_qty < reorder_point']),
  'แดชบอร์ด ไม่ได้เก็บค่าสรุปไว้ล่วงหน้า แต่คำนวณจากฐานข้อมูลทุกครั้งที่อ่าน ยอดขายวันนี้ คิวที่รอ และสินค้าใกล้หมด ตัวเลขจึงตรงกับฐานเสมอ หน้าจอโหลดใหม่เมื่อมีเหตุการณ์ และทุกหกสิบวินาที')
s(C, 'adjustStock : ปรับสต็อกต้องมีประวัติ', code('backend/modules/product/index.js', 'async function adjustStock', 26, ['FOR UPDATE', 'balanceAfter < 0', 'INSERT INTO stock_movements', "'ADJUST_STOCK'"]),
  'หน้าสินค้า แก้ยอดคงเหลือตรงๆ ไม่ได้ ต้องผ่านปรับสต็อก หลังบ้านล็อกแถวสินค้า ไม่ให้ติดลบ บันทึก stock_movements พร้อมเหตุผล และ ADJUST_STOCK ลงประวัติ ทุกการเปลี่ยนสต็อก จึงย้อนดูได้ว่าใครทำ')
s(C, 'auditLog.record : ประวัติทุกเหตุการณ์', code('backend/modules/audit-log/index.js', 'async function record', 8, ['ACTIONS.includes', 'INSERT INTO audit_logs']),
  'ทุกโมดูลบันทึกประวัติผ่านฟังก์ชันเดียว รับ conn จากธุรกรรมของผู้เรียก ประวัติจึงสำเร็จหรือย้อนกลับไปพร้อมงานจริง ชื่อเหตุการณ์ต้องอยู่ในรายการที่รู้จัก หน้าประวัติของผู้จัดการ กรองตามช่วงเวลาและประเภทได้')

# ---------------- ซ้อมตอบ ----------------
C = '7 · ซ้อมตอบกรรมการ'
s(C, 'คำถามที่ 1', qa('ถ้าสองคนกดจ่ายใบเดียวกันพร้อมกัน ระบบกันยังไง?',
   'UPDATE แบบมีเงื่อนไขสถานะ ใน stock-deduction บรรทัด 31 คนที่สองได้ affectedRows = 0 ได้ 409 อยู่ในธุรกรรมเดียว ทดสอบแล้วใน TC-06'),
  'คำถามแรก ถ้าสองคนกดจ่ายพร้อมกัน กันยังไง ตอบว่า ใช้อัปเดตแบบมีเงื่อนไขสถานะ ในไฟล์ stock-deduction คนที่สองได้ affectedRows เป็นศูนย์ ได้ 409 และทดสอบแล้วใน TC-06')
s(C, 'คำถามที่ 2', qa('ทำไมไม่คิดยอดเงินที่หน้าจอ?',
   'ราคาจริงอยู่ในฐานข้อมูล หลังบ้านคิดใหม่ด้วย priceItems ทุกครั้ง หน้าจอส่งแค่รหัสสินค้ากับจำนวน (ADR-07)'),
  'คำถามที่สอง ทำไมไม่คิดยอดที่หน้าจอ ตอบว่า หน้าจอแก้ได้ ราคาจริงอยู่ในฐาน หลังบ้านคิดใหม่ด้วย priceItems ทุกครั้ง หน้าจอส่งแค่รหัสกับจำนวน')
s(C, 'คำถามที่ 3', qa('คิวขึ้นเองได้ยังไง ไม่ต้องรีเฟรช?',
   'หลัง commit หลังบ้านเรียก broadcast ผ่าน WebSocket (สำรองด้วย SSE) หน้าคิว subscribe ไว้ ได้ order.* ก็ดึงคิวใหม่ วัดได้สูงสุด 80 ms'),
  'คำถามที่สาม คิวขึ้นเองได้ยังไง ตอบว่า หลัง commit หลังบ้านเรียก broadcast ผ่าน WebSocket มี SSE เป็นทางสำรอง หน้าคิว subscribe ไว้ ได้เหตุการณ์ก็ดึงคิวใหม่ วัดได้แปดสิบมิลลิวินาที')
s(C, 'คำถามที่ 4', qa('ซ่อนเมนูอย่างเดียว คนยิง API ตรงๆ ได้ไหม?',
   'ไม่ได้ ทุกเส้นทางใน app.js ผ่าน verifyToken (ไม่มีโทเคน 401) และ requireRole (บทบาทไม่ตรง 403) ที่ฝั่งเซิร์ฟเวอร์'),
  'คำถามที่สี่ ถ้ายิงAPIตรงๆ ได้ไหม ตอบว่า ไม่ได้ครับ ทุกเส้นทางใน app.js ผ่าน verifyToken กับ requireRole ที่ฝั่งเซิร์ฟเวอร์ ไม่มีโทเคนได้ 401 บทบาทไม่ตรงได้ 403')
s(C, 'คำถามที่ 5', qa('เครื่องพิมพ์เสีย ขายต่อได้ไหม?',
   'ได้ สั่งพิมพ์หลัง commit และบริการพิมพ์เป็นหน่วยแยก (ADR-01) ถ้าพิมพ์ไม่ได้ คำสั่งซื้อยังบันทึกและเข้าคิว หน้าจอขึ้นคำเตือน'),
  'คำถามสุดท้าย เครื่องพิมพ์เสีย ขายต่อได้ไหม ตอบว่า ได้ครับ สั่งพิมพ์หลัง commit และบริการพิมพ์แยกเป็นอีกหน่วย ถ้าพิมพ์ไม่ได้ คำสั่งซื้อยังบันทึกและเข้าคิว หน้าจอแค่ขึ้นคำเตือน')
s('จบ', 'สรุปประโยคเดียว', big('api.js → app.js ตรวจสิทธิ์<br>→ ธุรกรรมเดียว → commit<br>→ broadcast', 'จำประโยคนี้ไว้ตอบทุกคำถาม'),
  'สรุปประโยคเดียว หน้าจอเรียกผ่าน api.js ทุกคำขอโดนตรวจสิทธิ์ที่ app.js อะไรที่เปลี่ยนข้อมูล ทำในธุรกรรมเดียว commit แล้วค่อย broadcast ให้จออื่นรู้ จำประโยคนี้ไว้ สู้ๆ ครับ')

CSS = '''
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans Thai',sans-serif;background:#000}
.f{width:1080px;height:1920px;position:relative;overflow:hidden;background:linear-gradient(180deg,#1a1430 0%,#120e22 100%);color:#f3f0ff;display:flex;flex-direction:column;padding:70px 50px 60px}
.top{display:flex;justify-content:space-between;align-items:center}
.chip{background:#6D3FC6;color:#fff;font-size:30px;font-weight:700;padding:10px 26px;border-radius:40px}
.brand{font-size:28px;color:#c4b5fd;font-weight:700}
.pb{height:10px;background:#2b2347;border-radius:6px;margin-top:22px;overflow:hidden}.pb i{display:block;height:100%;background:#FACC15}
h1{font-size:58px;line-height:1.25;font-weight:800;margin:30px 0 26px;color:#fff}
.vis{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
.sub{background:rgba(255,255,255,.08);border-left:10px solid #FACC15;border-radius:14px;padding:26px 30px;font-size:37px;line-height:1.5;margin-top:26px;font-weight:500}
.code{background:#0b0916;border:2px solid #3b2f63;border-radius:18px;padding:20px 0;font:24px/1.55 'Menlo','Noto Sans Thai',monospace}
.fn{color:#a78bfa;font-size:24px;padding:0 24px 12px;border-bottom:1px solid #2b2347;margin-bottom:10px;font-family:'Noto Sans Thai',sans-serif;font-weight:700}
.ln{display:flex;padding:1px 18px 1px 0;opacity:.55}.ln.on{opacity:1;background:rgba(250,204,21,.16);box-shadow:inset 8px 0 0 #FACC15}
.no{flex:0 0 74px;text-align:right;padding-right:18px;color:#6b6290}
.tx{white-space:pre-wrap;word-break:break-all;flex:1}
.flow{display:flex;flex-direction:column;align-items:stretch}
.fb{border:3px solid;border-radius:18px;padding:18px 26px;background:rgba(255,255,255,.05);display:flex;flex-direction:column;gap:4px}
.fb b{font-size:36px}.fb span{font-size:29px;color:#ddd6fe}
.arr{text-align:center;color:#a78bfa;font-size:30px;line-height:1.3}
.fnote{margin-top:24px;font-size:30px;color:#34D399;font-weight:700;text-align:center}
.shot{display:flex;flex-direction:column;align-items:center;gap:20px}
.shot img{max-width:100%;max-height:900px;border-radius:16px;border:3px solid #3b2f63;background:#fff}
.sl{font:28px/1.4 'Menlo','Noto Sans Thai',monospace;color:#FACC15;text-align:center}
.qa{display:flex;flex-direction:column;gap:18px}
.q{display:inline-block;align-self:flex-start;background:#F87171;color:#fff;font-weight:800;font-size:30px;padding:8px 24px;border-radius:30px}
.q.a{background:#34D399;color:#062}
.qq{font-size:50px;font-weight:800;line-height:1.35}
.aa{font-size:38px;line-height:1.5;background:rgba(52,211,153,.1);border:3px solid #34D399;border-radius:18px;padding:24px}
.big{text-align:center}.bt{font-size:76px;font-weight:800;line-height:1.3;color:#FACC15}.bs{font-size:38px;color:#ddd6fe;margin-top:30px}
'''


def build_html():
    out = []
    n = len(SC)
    for k, c in enumerate(SC):
        out.append('<section class="f" id="f%d"><div class="top"><span class="chip">%s</span><span class="brand">อำพร OMS · %d/%d</span></div>'
                   '<div class="pb"><i style="width:%.1f%%"></i></div><h1>%s</h1><div class="vis">%s</div><div class="sub">%s</div></section>'
                   % (k, c['chap'], k + 1, n, (k + 1) * 100.0 / n, c['title'], c['vis'], c['sub']))
    doc = ('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;700;800&display=swap">'
           '<style>%s</style></head><body>%s</body></html>' % (CSS, ''.join(out)))
    io.open(os.path.join(WORK, 'frames.html'), 'w', encoding='utf-8').write(doc)


if __name__ == '__main__':
    os.makedirs(WORK, exist_ok=True)
    build_html()
    json.dump([c['say'] for c in SC], io.open(os.path.join(WORK, 'say.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(len(SC), 'scenes')
