# -*- coding: utf-8 -*-
"""บทของวิดีโอแอนิเมชัน: แต่ละฉากแบ่งเป็นจังหวะ (beat) หนึ่งจังหวะ = หนึ่งช่วงที่พูด
ทุกจังหวะบอกว่าภาพต้องทำอะไรขณะพูด เช่น ไฮไลต์บรรทัดไหน โชว์กล่องที่เท่าไร ส่งจุดข้อมูลจากไหนไปไหน

ชนิดฉาก
  big   ข้อความใหญ่                      beat: {}
  flow  กล่องเรียงลงมา                   beat: show=จำนวนกล่องที่เห็น, hl=[ดัชนีกล่อง], packet=[จาก, ถึง]
  code  โค้ดจริงจากไฟล์                  beat: hl=[ข้อความที่อยู่ในบรรทัดที่จะไฮไลต์]
  shot  ภาพหน้าจอจริง                    beat: {}
  race  สองเครื่องกดจ่ายพร้อมกัน           beat: phase=1..4
  qa    คำถามกรรมการ                     beat แรกคือคำถาม แล้วมีช่วงให้คิด แล้วจึงเฉลย
"""
B, Y, O, G, P, R = '#60A5FA', '#FACC15', '#FB923C', '#34D399', '#C4B5FD', '#F87171'

MAP = [('หน้าจอ React', 'pages/ ทั้ง 9 หน้า', B), ('services/api.js', 'แนบโทเคน แล้วยิงคำขอ', B),
       ('backend/app.js', 'verifyToken + requireRole', Y), ('modules/…', 'ตรรกะธุรกิจใน withTransaction', O),
       ('MySQL InnoDB', 'บันทึกจริง แล้ว commit', G), ('broadcast()', 'ผลักเหตุการณ์หลัง commit', P),
       ('services/events.js', 'จออื่นได้ยิน แล้วโหลดใหม่', B)]


def b(say, **k):
    k['say'] = say
    return k


SCENES = [
    # ------------------------------------------------------------ เริ่ม
    dict(chap='เริ่ม', title='อำพร OMS<br>อธิบายโค้ดทั้งระบบ', kind='big', text='กดปุ่มนี้<br>โค้ดไหนทำงาน?',
         sub2='หน้าจอ → API → หลังบ้าน → ฐานข้อมูล', beats=[
        b('สวัสดีครับ คลิปนี้จะพาไล่โค้ดของอำพร OMS ทั้งระบบนะครับ'),
        b('ตั้งแต่เรากดปุ่มบนหน้าจอ ไปจนถึงข้อมูลที่ลงฐานข้อมูล'),
        b('ดูจบแล้ว เป้าหมายคือ ตอบกรรมการได้ว่า กดปุ่มนี้แล้ว โค้ดไหนทำงาน')]),
    dict(chap='เริ่ม', title='ภาพเดียวที่ต้องจำ', kind='flow', boxes=MAP, beats=[
        b('จำภาพนี้ภาพเดียวพอครับ ทุกปุ่มในระบบเดินทางแบบนี้หมด', show=1, hl=[0]),
        b('หน้าจอไม่ได้คุยกับหลังบ้านเอง แต่เรียกผ่าน api.js ซึ่งแนบโทเคนไปให้ทุกครั้ง', show=2, hl=[1], packet=[0, 1]),
        b('คำขอวิ่งไปที่ app.js ตรงนี้ตรวจก่อนเลยว่า เป็นใคร และมีสิทธิ์ไหม', show=3, hl=[2], packet=[1, 2]),
        b('ผ่านแล้ว ถึงส่งให้โมดูลทำงาน โดยทำทุกอย่างในธุรกรรมเดียว', show=4, hl=[3], packet=[2, 3]),
        b('ข้อมูลลง MySQL แล้ว commit คือยืนยันว่าบันทึกจริง', show=5, hl=[4], packet=[3, 4]),
        b('พอ commit แล้วเท่านั้น หลังบ้านถึงผลักเหตุการณ์ออกไป', show=6, hl=[5], packet=[4, 5]),
        b('จออื่นที่รอฟังอยู่ ได้ยินแล้วก็โหลดข้อมูลใหม่เอง ไม่ต้องกดรีเฟรช', show=7, hl=[6], packet=[5, 6])]),
    dict(chap='เริ่ม', title='โฟลเดอร์ในโปรเจกต์', kind='flow', boxes=[
        ('frontend/src/pages', 'login · pos · queue · dispatch · dashboard-ops · dashboard-exec · products · notifications · audit-logs', B),
        ('frontend/src/services', 'api.js · events.js · session.jsx', B),
        ('backend/app.js + middleware/auth.js', 'ประกาศเส้นทาง และตรวจสิทธิ์', Y),
        ('backend/modules', 'auth · product · order · queue · dispatch · stock-deduction · dashboard · alert · audit-log', O),
        ('backend/config/db.js', 'pool และ withTransaction', G),
        ('print-service', 'หน่วยแยก ส่งคำสั่ง ESC/POS ให้เครื่องพิมพ์', R)], beats=[
        b('มาดูโครงโปรเจกต์กันก่อนครับ ฝั่งหน้าบ้าน หนึ่งหน้าจอคือหนึ่งโฟลเดอร์ใน pages', show=1, hl=[0]),
        b('ไฟล์กลางที่ทุกหน้าใช้ มีสามตัว อยู่ใน services', show=2, hl=[1]),
        b('ฝั่งหลังบ้าน app.js ประกาศเส้นทางทั้งหมด และ middleware ตรวจสิทธิ์', show=3, hl=[2]),
        b('งานแต่ละเรื่องแยกเป็นโมดูล เช่น order, queue, dispatch', show=4, hl=[3]),
        b('db.js มีฟังก์ชัน withTransaction ที่ทุกโมดูลใช้', show=5, hl=[4]),
        b('และบริการพิมพ์ใบเสร็จ แยกออกมาเป็นอีกหน่วยหนึ่งครับ', show=6, hl=[5])]),

    # ------------------------------------------------------------ ไฟล์กลาง
    dict(chap='1 · ไฟล์กลาง', title='api.js : ทุกหน้าเรียกผ่านตัวนี้', kind='code', file='frontend/src/services/api.js',
         start='async function call', n=24, beats=[
        b('เริ่มที่ api.js ครับ ทุกหน้าเรียก api.get หรือ api.post แล้วมาจบที่ฟังก์ชัน call ตัวนี้', hl=['async function call', 'export const api']),
        b('มันอ่านโทเคนที่เก็บไว้ แล้วแนบไปในหัวข้อ authorization ทุกครั้ง', hl=['const t = token.get()', 'authorization']),
        b('แล้วยิงไปที่ สแลช api ต่อด้วยเส้นทางที่หน้าจอส่งมา', hl=['fetch(`/api']),
        b('ถ้าหลังบ้านตอบไม่สำเร็จ ตรงนี้แปลงเป็น error ที่มีข้อความจากหลังบ้าน และเก็บรหัสไว้ด้วย', hl=['if (!res.ok)', 'err.code']),
        b('ถ้าได้ 401 แปลว่าโทเคนใช้ไม่ได้แล้ว ก็ลบทิ้ง ให้ผู้ใช้ล็อกอินใหม่', hl=['res.status === 401'])]),
    dict(chap='1 · ไฟล์กลาง', title='events.js : ฟังข้อมูลสด', kind='code', file='frontend/src/services/events.js',
         start='export function subscribe', n=32, beats=[
        b('ไฟล์กลางตัวที่สอง events.js หน้าไหนอยากรู้ข้อมูลทันที ก็เรียก subscribe', hl=['export function subscribe']),
        b('ทางหลักคือ WebSocket ที่ สแลช ws โดยแนบโทเคนไปในลิงก์', hl=['new WebSocket']),
        b('ถ้าเปิดไม่ได้ภายในสามวินาที จะปิดแล้วสลับไปทางสำรอง', hl=['const fallback', 'WS_OPEN_TIMEOUT_MS']),
        b('ทางสำรองคือ SSE รับเหตุการณ์สี่แบบ เกี่ยวกับคำสั่งซื้อสามแบบ และแจ้งเตือนอีกหนึ่ง', hl=['new EventSource', "'order.created'"]),
        b('ถ้าสายหลุด ก็ต่อใหม่เองในสองวินาที หน้าคิวจึงไม่กลายเป็นหน้าจอนิ่ง', hl=['RECONNECT_MS);'])]),
    dict(chap='1 · ไฟล์กลาง', title='app.js : แผนที่ของทุกเส้นทาง', kind='code', file='backend/app.js',
         start="app.post('/api/auth/login'", n=24, beats=[
        b('ฝั่งหลังบ้าน app.js คือแผนที่ครับ อ่านทีละบรรทัดแบบนี้', hl=["app.post('/api/orders', verifyToken"]),
        b('เมธอด เส้นทาง ตรวจโทเคน ตรวจบทบาท แล้วก็ฟังก์ชันที่ทำงาน', hl=["app.post('/api/orders', verifyToken"]),
        b('เช่นเส้นทางจ่ายสินค้า ให้เฉพาะพนักงานคลังกับผู้จัดการ แล้วไปที่ dispatch.confirm', hl=["'/api/orders/:id/dispatch'"]),
        b('ส่วนงานของผู้จัดการ อย่างเพิ่มสินค้า ก็ล็อกด้วย requireRole manager', hl=["requireRole('manager'), product.create", "'/api/audit-logs'"])]),
    dict(chap='1 · ไฟล์กลาง', title='verifyToken กับ requireRole', kind='code', file='backend/middleware/auth.js',
         start='function verifyToken', n=29, beats=[
        b('สองฟังก์ชันนี้คือตัวกันสิทธิ์จริงครับ', hl=['function verifyToken', 'function requireRole']),
        b('verifyToken ดึงโทเคนจากหัวข้อ แล้วตรวจลายเซ็น ถ้าไม่มี หรือปลอม ตอบ 401 แปลว่า ไม่รู้ว่าเป็นใคร', hl=["if (!token) return res.status(401)", 'jwt.verify', 'return res.status(401).json({ error: message'] ),
        b('requireRole รู้แล้วว่าเป็นใคร แต่ถ้าบทบาทไม่ตรง ตอบ 403 แปลว่า ไม่มีสิทธิ์', hl=['status(403)']),
        b('การซ่อนเมนูบนหน้าจอ เป็นแค่ความสะดวก ตัวกันจริงอยู่ที่สองฟังก์ชันนี้ ที่ฝั่งเซิร์ฟเวอร์ครับ', hl=['function requireRole'])]),

    # ------------------------------------------------------------ เข้าสู่ระบบ
    dict(chap='2 · เข้าสู่ระบบ UC-01', title='หน้าเข้าสู่ระบบ', kind='shot', img='01-login.png',
         label='pages/login → session.login() → POST /api/auth/login', beats=[
        b('มาเริ่มเส้นทางแรก หน้าเข้าสู่ระบบครับ'),
        b('กรอกชื่อกับรหัสผ่าน แล้วกดปุ่ม หน้าจอเรียก login ใน session.jsx'),
        b('ซึ่งยิง post ไปที่ สแลช api สแลช auth สแลช login')]),
    dict(chap='2 · เข้าสู่ระบบ UC-01', title='auth.login : ตรวจรหัสผ่าน', kind='code', file='backend/modules/auth/index.js',
         start='async function login', n=19, beats=[
        b('หลังบ้านหาผู้ใช้จากชื่อที่กรอกมา', hl=['SELECT user_id, username, password_hash']),
        b('แล้วใช้ bcrypt เทียบรหัสผ่าน กับค่าแฮชที่เก็บไว้ ฐานข้อมูลไม่เคยเก็บรหัสผ่านจริง', hl=['bcrypt.compare']),
        b('จุดที่น่าสนใจคือ ถ้าไม่เจอชื่อ ก็ยังเทียบกับแฮชปลอม ให้เวลาตอบเท่ากัน คนนอกจึงเดาไม่ได้ว่าชื่อไหนมีจริง', hl=['เทียบรหัสผ่านแม้ไม่พบผู้ใช้', 'bcrypt.compare']),
        b('ถ้าผ่าน ออกโทเคน JWT อายุแปดชั่วโมง และบันทึกการเข้าสู่ระบบลงประวัติ', hl=['jwt.sign', "'LOGIN'"])]),
    dict(chap='2 · เข้าสู่ระบบ UC-01', title='ไปหน้าแรกตามบทบาท', kind='code', file='frontend/src/services/session.jsx',
         start='export const HOME_BY_ROLE', n=22, beats=[
        b('ได้โทเคนแล้ว หน้าจอเก็บไว้', hl=['token.set']),
        b('แล้วพาไปหน้าแรกของบทบาท พนักงานขายไปหน้าขาย คลังไปหน้าคิว ผู้จัดการไปแดชบอร์ด', hl=['export const HOME_BY_ROLE']),
        b('ถ้ารีเฟรชหน้า จะถาม สแลช auth สแลช me ก่อน ว่าโทเคนที่เก็บไว้ยังใช้ได้ไหม', hl=["api.get('/auth/me')"])]),

    # ------------------------------------------------------------ ขายหน้าร้าน
    dict(chap='3 · ขายหน้าร้าน UC-03', title='หน้าขายหน้าร้าน', kind='shot', img='02-pos.png', label='pages/pos : ตะกร้า → QR → เสร็จ', beats=[
        b('เส้นทางที่สอง ขายหน้าร้านครับ หน้านี้มีสามขั้นในหน้าเดียว'),
        b('คือเลือกของลงตะกร้า แสดงคิวอาร์ แล้วก็เสร็จ'),
        b('ช่องค้นหาจะรอให้พิมพ์หยุดก่อนสองร้อยมิลลิวินาที แล้วค่อยถาม จะได้ไม่ยิงคำขอทุกตัวอักษร')]),
    dict(chap='3 · ขายหน้าร้าน UC-03', title='ตะกร้าเปลี่ยน → ให้หลังบ้านคิดยอด', kind='code', file='frontend/src/pages/pos/index.jsx',
         start='ทุกครั้งที่ตะกร้าเปลี่ยน', n=7, beats=[
        b('ทุกครั้งที่ตะกร้าเปลี่ยน หน้าจอขอยอดใหม่จากหลังบ้าน', hl=['useEffect', "'/orders/quote'"]),
        b('สังเกตว่าส่งไปแค่รหัสสินค้ากับจำนวน ไม่ส่งราคาเลย', hl=['productId: i.productId, qty: i.qty']),
        b('เพราะราคาจริงอยู่ในฐานข้อมูลครับ ถ้าเชื่อราคาจากหน้าจอ คนแก้ราคาในเบราว์เซอร์ได้', hl=["'/orders/quote'"])]),
    dict(chap='3 · ขายหน้าร้าน UC-03', title='priceItems : ราคาจากฐานข้อมูล', kind='code', file='backend/modules/order/index.js',
         start='async function priceItems', n=18, beats=[
        b('ฝั่งหลังบ้าน priceItems ดึงราคาจากตาราง products', hl=['FROM products WHERE product_id IN']),
        b('เช็กว่าสินค้ามีอยู่จริง และยังเปิดขายอยู่', hl=['if (!p) return', 'is_active) return']),
        b('แล้วคิดยอดทีละรายการ ปัดเป็นสตางค์ กันเศษทศนิยม', hl=['const lineTotal', 'totalAmount: Math.round']),
        b('ฟังก์ชัน quote ใช้ตัวนี้ แล้วสร้างข้อความคิวอาร์พร้อมเพย์ตามยอด ส่งกลับให้หน้าจอวาดเป็นรูป', hl=['return { items: priced'])]),
    dict(chap='3 · ขายหน้าร้าน UC-03', title='กด "ยืนยันรับชำระเงิน"', kind='code', file='frontend/src/pages/pos/index.jsx',
         start='ยืนยันรับชำระเงิน — จุดเดียว', n=8, beats=[
        b('พนักงานดูแอปธนาคารว่าเงินเข้าแล้ว จึงกดยืนยันรับชำระเงิน', hl=['const confirmPayment']),
        b('ปุ่มนี้คือจุดเดียวในระบบ ที่คำสั่งซื้อถูกบันทึก โดยยิง post สแลช orders', hl=["api.post('/orders'"])]),
    dict(chap='3 · ขายหน้าร้าน UC-03', title='order.create : บันทึกในธุรกรรมเดียว', kind='code', file='backend/modules/order/index.js',
         start='async function create', n=25, beats=[
        b('create ทำงานทั้งหมดใน withTransaction', hl=['order = await withTransaction']),
        b('คิดราคาใหม่จากฐานข้อมูลอีกรอบ แล้วออกเลขที่คำสั่งซื้อ', hl=['const priced = await priceItems(conn', 'nextOrderNo(conn)']),
        b('บันทึกลงตาราง orders ด้วยสถานะรอจ่ายสินค้า', hl=['INSERT INTO orders']),
        b('บันทึกรายการสินค้า พร้อมราคา ณ เวลาที่ขาย เผื่อวันหลังราคาเปลี่ยน ใบเก่าก็ยังถูก', hl=['INSERT INTO order_items', 'คัดลอกราคา']),
        b('และบันทึกประวัติ ถ้าพังตรงไหน ย้อนกลับทั้งหมด ไม่มีข้อมูลค้างครึ่งๆ', hl=["'CREATE_ORDER'"])]),
    dict(chap='3 · ขายหน้าร้าน UC-03', title='nextOrderNo : เลขที่ไม่ซ้ำ', kind='code', file='backend/modules/order/index.js',
         start='async function nextOrderNo', n=10, beats=[
        b('เลขที่คำสั่งซื้อ หน้าตาแบบนี้ ORD ขีด วันที่ ขีด ลำดับสี่หลัก', hl=['const prefix', 'padStart']),
        b('ตอนอ่านเลขล่าสุดของวัน ใช้ FOR UPDATE ล็อกไว้ เครื่องที่มาพร้อมกันต้องรอคิว', hl=['FOR UPDATE']),
        b('และในฐานข้อมูล ยังตั้ง UNIQUE ไว้กันอีกชั้นหนึ่งครับ', hl=['const seq'])]),
    dict(chap='3 · ขายหน้าร้าน UC-03', title='ชนกันแล้วลองใหม่ (DF-01)', kind='code', file='backend/modules/order/index.js',
         start='for (let attempt = 1', n=27, beats=[
        b('ตอนทดสอบภาระงาน เราเจอธุรกรรมชนกัน สองครั้ง จากหนึ่งหมื่นสี่พันกว่าครั้ง', hl=['for (let attempt']),
        b('เลยห่อด้วยลูปนี้ ถ้าชนกันที่เลขที่ ก็รอแล้วลองใหม่', hl=['isOrderNoCollision']),
        b('โดยรอนานขึ้นเรื่อยๆ ในแต่ละรอบ ไม่ให้ทุกเครื่องกลับมาชนกันซ้ำ วัดซ้ำแล้ว ไม่ล้มเหลวเลยครับ', hl=['retryDelayMs'])]),
    dict(chap='3 · ขายหน้าร้าน UC-03', title='หลัง commit : พิมพ์ + ผลักเข้าคิว', kind='code', file='backend/modules/order/index.js',
         start='// ---- หลัง COMMIT เท่านั้น ----', n=10, beats=[
        b('พอ commit แล้ว ถึงค่อยสั่งพิมพ์ใบเสร็จ', hl=['printReceipt']),
        b('ถ้าพิมพ์ไม่ได้ การขายยังสำเร็จนะครับ หน้าจอแค่ขึ้นคำเตือน เพราะรับเงินไปแล้ว', hl=['printReceipt']),
        b('แล้วผลัก order.created ไปทุกจอ ที่ต้องรอ commit ก่อน ก็เพื่อไม่ให้คิวเห็นคำสั่งซื้อที่ยังไม่มีจริง', hl=["broadcast('order.created'"])]),

    # ------------------------------------------------------------ คิว
    dict(chap='4 · คิวคลัง UC-05/06', title='หน้าคิวรอจ่ายสินค้า', kind='shot', img='04-queue.png', label='pages/queue : GET /api/queue + subscribe()', beats=[
        b('ฝั่งคลังสินค้า เปิดหน้าคิวบนมือถือครับ'),
        b('คำสั่งซื้อเรียงตามเวลาที่ชำระ พร้อมเวลารอ ถ้ารอเกินสามสิบนาที การ์ดจะขึ้นสีเตือน')]),
    dict(chap='4 · คิวคลัง UC-05/06', title='โหลดครั้งแรก แล้วรอฟัง', kind='code', file='frontend/src/pages/queue/index.jsx',
         start='const load = useCallback', n=8, beats=[
        b('เปิดหน้า โหลดคิวด้วย get สแลช queue หนึ่งครั้ง', hl=["api.get('/queue')"]),
        b('จากนั้น subscribe รอฟัง ได้เหตุการณ์ที่ขึ้นต้นด้วย order เมื่อไร ก็โหลดคิวใหม่เอง', hl=['subscribe(', "startsWith('order.')"]),
        b('ไม่ต้องกดรีเฟรชเลย วัดได้ไม่เกินแปดสิบมิลลิวินาที ส่วนเวลารอ นับใหม่ทุกสามสิบวินาที', hl=['setInterval'])]),
    dict(chap='4 · คิวคลัง UC-05/06', title='broadcast : ผลักไปทุกจอ', kind='code', file='backend/modules/queue/index.js',
         start='function broadcast', n=10, beats=[
        b('ฝั่งหลังบ้าน broadcast วนส่งข้อความให้ทุกจอที่ต่อค้างอยู่', hl=['for (const ws of wsClients)', 'ws.send']),
        b('ทั้งทาง WebSocket และทาง SSE', hl=['res.write']),
        b('คอมเมนต์บนหัวฟังก์ชันบอกชัดว่า ต้องเรียกหลัง commit เท่านั้น', hl=['function broadcast'])]),
    dict(chap='4 · คิวคลัง UC-05/06', title='ปุ่ม เริ่มจัด / ยกเลิก', kind='code', file='frontend/src/pages/queue/index.jsx',
         start='const startPicking', n=13, beats=[
        b('บนการ์ดมีปุ่มสามปุ่ม แต่เรียกเส้นทางเดียวกันหมด', hl=['api.patch']),
        b('เริ่มจัดของ ส่งสถานะ picking', hl=["status: 'picking'"]),
        b('ยกเลิกการจัด ส่งกลับเป็นรอจ่าย', hl=["status: 'awaiting_dispatch'"]),
        b('ยกเลิกคำสั่งซื้อ ส่ง cancelled ปุ่มนี้ผู้จัดการเท่านั้นที่ใช้ได้', hl=["status: 'cancelled'"])]),
    dict(chap='4 · คิวคลัง UC-05/06', title='TRANSITIONS : แผนภาพสถานะในโค้ด', kind='code', file='backend/modules/queue/index.js',
         start='const TRANSITIONS', n=9, beats=[
        b('แผนภาพสถานะในเล่ม อยู่ในโค้ดตรงนี้เลยครับ', hl=['const TRANSITIONS']),
        b('TRANSITIONS บอกว่า จากสถานะไหน ไปสถานะไหนได้บ้าง', hl=['awaiting_dispatch:', 'picking:']),
        b('WHO_CAN บอกว่า บทบาทไหน ตั้งสถานะไหนได้', hl=['const WHO_CAN']),
        b('สังเกตว่า delivered ไม่อยู่ในนี้ เพราะต้องไปทางยืนยันจ่ายเท่านั้น', hl=['delivered: []'])]),
    dict(chap='4 · คิวคลัง UC-05/06', title='updateStatus : ตรวจแล้วค่อยเปลี่ยน', kind='code', file='backend/modules/queue/index.js',
         start='async function updateStatus', n=26, beats=[
        b('updateStatus ตรวจบทบาทก่อน ถ้าไม่มีสิทธิ์ ตอบ 403', hl=['WHO_CAN[target].includes']),
        b('แล้วล็อกแถวคำสั่งซื้อด้วย FOR UPDATE', hl=['FOR UPDATE']),
        b('เช็กว่ามีลูกศรในแผนภาพสถานะไหม ถ้าไม่มี ตอบ 409', hl=['TRANSITIONS[order.status]', 'status(409)']),
        b('ถ้ามี เปลี่ยนสถานะ บันทึกประวัติ commit แล้วผลัก order.status ทุกจอเห็นพร้อมกัน', hl=["UPDATE orders SET status = ?", "broadcast('order.status'"])]),

    # ------------------------------------------------------------ ยืนยันจ่าย
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='หัวใจของระบบ', kind='shot', img='05-dispatch.png',
         label='pages/dispatch : GET /api/orders/:id → POST /api/orders/:id/dispatch', beats=[
        b('มาถึงส่วนที่สำคัญที่สุดของระบบแล้วครับ ตั้งใจดูช่วงนี้นะครับ'),
        b('หน้ายืนยันจ่าย โหลดรายการที่ต้องจัด ด้วย get สแลช orders สแลช ไอดี'),
        b('ต้องกดยืนยันสองครั้ง เพราะส่งมอบแล้ว ย้อนกลับไม่ได้')]),
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='กดยืนยัน', kind='code', file='frontend/src/pages/dispatch/index.jsx',
         start='const confirm = async', n=10, beats=[
        b('กดยืนยัน ยิง post ไปที่ dispatch ของคำสั่งซื้อใบนั้น', hl=['/dispatch`']),
        b('ถ้าได้ ALREADY_DISPATCHED กลับมา แปลว่ามีคนจ่ายไปก่อนแล้ว หน้าจอจะโหลดใบใหม่ ให้เห็นว่าจ่ายไปแล้ว', hl=['ALREADY_DISPATCHED'])]),
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='dispatch.confirm', kind='code', file='backend/modules/dispatch/index.js',
         start='async function confirm', n=21, beats=[
        b('หลังบ้าน confirm ห่อทุกอย่างไว้ใน withTransaction แล้วเรียก stock-deduction', hl=['withTransaction', 'stockDeduction.dispatch']),
        b('ถ้าถูกปฏิเสธ ตอบ 409 พร้อมรหัสบอกเหตุผล', hl=['409', 'code: err.code']),
        b('ถ้าผ่าน หลัง commit ผลัก order.dispatched ใบนี้ก็หายจากคิวทุกจอ', hl=["broadcast('order.dispatched'"]),
        b('แล้วค่อยเช็กสต็อกเพื่อแจ้งเตือน ซึ่งทำนอกธุรกรรม ถ้าแจ้งเตือนพัง การจ่ายของก็ไม่ถูกยกเลิก', hl=['checkStock'])]),
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='withTransaction', kind='code', file='backend/config/db.js',
         start='async function withTransaction', n=15, beats=[
        b('withTransaction สั้นมากครับ เปิดธุรกรรม', hl=['beginTransaction']),
        b('รันงานที่ส่งเข้ามา ถ้าสำเร็จ commit', hl=['await fn(conn)', 'conn.commit']),
        b('ถ้ามี error ตรงไหนก็ตาม rollback ทั้งหมด ข้อมูลจึงไม่ค้างครึ่งๆ กลางๆ', hl=['rollback'])]),
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='ขั้น 2 : กันจ่ายซ้ำ', kind='code', file='backend/modules/stock-deduction/index.js',
         start='async function dispatch', n=15, beats=[
        b('ขั้นที่สอง กันจ่ายซ้ำ เราอัปเดตสถานะเป็น delivered', hl=["UPDATE orders SET status = 'delivered'"]),
        b('แต่มีเงื่อนไขว่า สถานะตอนนี้ ต้องยังรอจ่าย หรือกำลังจัดอยู่', hl=["AND status IN ('awaiting_dispatch', 'picking')"]),
        b('ถ้าเครื่องอื่นจ่ายไปก่อนแล้ว แถวจะไม่ตรงเงื่อนไข affectedRows ก็เป็นศูนย์', hl=['affectedRows === 0']),
        b('เราก็โยน ALREADY_DISPATCHED ออกไป ธุรกรรมย้อนกลับ', hl=['ALREADY_DISPATCHED'])]),
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='ขั้น 3 : กันสต็อกติดลบ', kind='code', file='backend/modules/stock-deduction/index.js',
         start='for (const it of items)', n=10, beats=[
        b('ขั้นที่สาม หักสต็อกทีละสินค้า', hl=['UPDATE products SET stock_qty = stock_qty - ?']),
        b('โดยมีเงื่อนไขว่า ยอดคงเหลือ ต้องมากกว่าหรือเท่ากับจำนวนที่จะหัก', hl=['stock_qty >= ?']),
        b('ถ้าของไม่พอ โยน INSUFFICIENT_STOCK แล้วทั้งใบย้อนกลับ สินค้าที่หักไปแล้วก็คืนครบ', hl=['INSUFFICIENT_STOCK']),
        b('สองขั้นนี้กันคนละปัญหานะครับ ขั้นสองกันจ่ายซ้ำ ขั้นสามกันติดลบ จึงต้องมีทั้งคู่', hl=['กันติดลบระดับสินค้า', 'เป็นคนละปัญหา'])]),
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='ขั้น 4–5 : บันทึกทุกการเคลื่อนไหว', kind='code', file='backend/modules/stock-deduction/index.js',
         start='ขั้น 4', n=12, beats=[
        b('ขั้นที่สี่ บันทึกการเคลื่อนไหวของสต็อก พร้อมยอดหลังเปลี่ยน', hl=['INSERT INTO stock_movements']),
        b('ขั้นที่ห้า บันทึกการยืนยันจ่ายลงประวัติ ทั้งหมดนี้อยู่ในธุรกรรมเดียวกันครับ', hl=["'CONFIRM_DISPATCH'"])]),
    dict(chap='5 · ยืนยันจ่าย UC-07 ⭐', title='ถ้าสองคนกดพร้อมกัน?', kind='race', beats=[
        b('ทีนี้มาดูของจริงครับ สมมติพนักงานสองคน กดยืนยันจ่ายใบเดียวกัน ในเวลาเดียวกัน', phase=1),
        b('ฐานข้อมูลล็อกแถว ให้เครื่อง A ทำก่อน A ผ่านเงื่อนไข ตัดสต็อก แล้ว commit', phase=2),
        b('เครื่อง B ได้คิวต่อ เช็กเงื่อนไขใหม่ เจอว่าสถานะเป็น delivered แล้ว affectedRows จึงเป็นศูนย์', phase=3),
        b('B ได้ 409 กลับไป สต็อกถูกหักแค่ครั้งเดียว ตรงกับผลทดสอบ TC-06 ครับ', phase=4)]),

    # ------------------------------------------------------------ ส่วนอื่น
    dict(chap='6 · ส่วนอื่นที่ต้องรู้', title='checkStock : แจ้งเตือนของใกล้หมด', kind='code', file='backend/modules/alert/index.js',
         start='async function checkStock', n=14, beats=[
        b('หลังจ่ายของ checkStock หาสินค้าที่ยอดคงเหลือ ต่ำกว่าจุดสั่งซื้อเพิ่ม', hl=['stock_qty < reorder_point']),
        b('แล้วสร้างการแจ้งเตือน โดย createOnce กันไม่ให้แจ้งเรื่องเดิมซ้ำ', hl=['createOnce']),
        b('หน้าแจ้งเตือน กับตัวเลขบนเมนู ฟัง notification.created แล้วอัปเดตเอง', hl=['createOnce'])]),
    dict(chap='6 · ส่วนอื่นที่ต้องรู้', title='dashboard.ops : คำนวณสดทุกครั้ง', kind='code', file='backend/modules/dashboard/index.js',
         start='async function ops', n=26, beats=[
        b('แดชบอร์ด ไม่ได้เก็บค่าสรุปไว้ล่วงหน้า แต่คำนวณจากฐานข้อมูลทุกครั้งที่เปิด', hl=['SUM(o.total_amount)']),
        b('ยอดขายวันนี้ คิวที่รออยู่', hl=["status IN ('awaiting_dispatch', 'picking')"]),
        b('และสินค้าที่ใกล้หมด ตัวเลขจึงตรงกับฐานข้อมูลเสมอ หน้าจอโหลดใหม่เมื่อมีเหตุการณ์ และทุกหกสิบวินาที', hl=['stock_qty < reorder_point'])]),
    dict(chap='6 · ส่วนอื่นที่ต้องรู้', title='adjustStock : ปรับสต็อกต้องมีประวัติ', kind='code', file='backend/modules/product/index.js',
         start='async function adjustStock', n=26, beats=[
        b('หน้าสินค้า แก้ยอดคงเหลือตรงๆ ไม่ได้ ต้องผ่านปุ่มปรับสต็อกเท่านั้น', hl=['async function adjustStock']),
        b('หลังบ้านล็อกแถวสินค้า และไม่ยอมให้ติดลบ', hl=['FOR UPDATE', 'balanceAfter < 0']),
        b('บันทึกการเคลื่อนไหวพร้อมเหตุผล และลงประวัติ ทุกการเปลี่ยนสต็อก จึงย้อนดูได้ว่าใครทำ ทำไม', hl=['INSERT INTO stock_movements', "'ADJUST_STOCK'"])]),
    dict(chap='6 · ส่วนอื่นที่ต้องรู้', title='auditLog.record : ประวัติทุกเหตุการณ์', kind='code', file='backend/modules/audit-log/index.js',
         start='async function record', n=8, beats=[
        b('ทุกโมดูลบันทึกประวัติผ่านฟังก์ชันเดียวนี้', hl=['async function record']),
        b('มันรับการเชื่อมต่อจากธุรกรรมของผู้เรียก ประวัติจึงสำเร็จ หรือย้อนกลับ พร้อมงานจริงเสมอ', hl=['INSERT INTO audit_logs']),
        b('ชื่อเหตุการณ์ต้องอยู่ในรายการที่รู้จัก พิมพ์ผิดจะไม่ผ่าน', hl=['ACTIONS.includes'])]),

    # ------------------------------------------------------------ ซ้อมตอบ
    dict(chap='7 · ซ้อมตอบกรรมการ', title='คำถามที่ 1', kind='qa', q='ถ้าสองคนกดจ่ายใบเดียวกันพร้อมกัน ระบบกันยังไง?',
         a='UPDATE แบบมีเงื่อนไขสถานะ ใน stock-deduction คนที่สองได้ affectedRows = 0 → 409 อยู่ในธุรกรรมเดียว ทดสอบแล้ว TC-06', beats=[
        b('มาซ้อมตอบกันครับ คำถามแรก ถ้าสองคนกดจ่ายใบเดียวกันพร้อมกัน ระบบกันยังไง ลองคิดก่อนนะครับ'),
        b('ตอบว่า ใช้อัปเดตแบบมีเงื่อนไขสถานะ ในไฟล์ stock-deduction คนที่สองได้ affectedRows เป็นศูนย์ ได้ 409 อยู่ในธุรกรรมเดียว และทดสอบแล้วใน TC-06', answer=True)]),
    dict(chap='7 · ซ้อมตอบกรรมการ', title='คำถามที่ 2', kind='qa', q='ทำไมไม่คิดยอดเงินที่หน้าจอ?',
         a='หน้าจอแก้ได้ ราคาจริงอยู่ในฐานข้อมูล หลังบ้านคิดใหม่ด้วย priceItems ทุกครั้ง หน้าจอส่งแค่รหัสสินค้ากับจำนวน', beats=[
        b('คำถามที่สอง ทำไมไม่คิดยอดเงินที่หน้าจอ'),
        b('ตอบว่า หน้าจอแก้ได้ครับ ราคาจริงอยู่ในฐานข้อมูล หลังบ้านคิดใหม่ด้วย priceItems ทุกครั้ง หน้าจอส่งแค่รหัสกับจำนวน', answer=True)]),
    dict(chap='7 · ซ้อมตอบกรรมการ', title='คำถามที่ 3', kind='qa', q='คิวขึ้นเองได้ยังไง ไม่ต้องรีเฟรช?',
         a='หลัง commit หลังบ้านเรียก broadcast ผ่าน WebSocket (สำรองด้วย SSE) หน้าคิว subscribe ไว้ ได้ order.* ก็ดึงคิวใหม่ วัดได้สูงสุด 80 ms', beats=[
        b('คำถามที่สาม คิวขึ้นเองได้ยังไง ไม่ต้องรีเฟรช'),
        b('ตอบว่า หลัง commit หลังบ้านเรียก broadcast ผ่าน WebSocket มี SSE เป็นทางสำรอง หน้าคิว subscribe ไว้ ได้เหตุการณ์ก็ดึงคิวใหม่ วัดได้แปดสิบมิลลิวินาที', answer=True)]),
    dict(chap='7 · ซ้อมตอบกรรมการ', title='คำถามที่ 4', kind='qa', q='ซ่อนเมนูอย่างเดียว คนยิง API ตรงๆ ได้ไหม?',
         a='ไม่ได้ ทุกเส้นทางใน app.js ผ่าน verifyToken (ไม่มีโทเคน → 401) และ requireRole (บทบาทไม่ตรง → 403) ที่ฝั่งเซิร์ฟเวอร์', beats=[
        b('คำถามที่สี่ ถ้าซ่อนเมนูอย่างเดียว คนยิง API ตรงๆ ได้ไหม'),
        b('ตอบว่า ไม่ได้ครับ ทุกเส้นทางใน app.js ผ่าน verifyToken กับ requireRole ที่ฝั่งเซิร์ฟเวอร์ ไม่มีโทเคนได้ 401 บทบาทไม่ตรงได้ 403', answer=True)]),
    dict(chap='7 · ซ้อมตอบกรรมการ', title='คำถามที่ 5', kind='qa', q='เครื่องพิมพ์เสีย ขายต่อได้ไหม?',
         a='ได้ สั่งพิมพ์หลัง commit และบริการพิมพ์เป็นหน่วยแยก (ADR-01) พิมพ์ไม่ได้ คำสั่งซื้อยังบันทึกและเข้าคิว หน้าจอขึ้นคำเตือน', beats=[
        b('คำถามสุดท้าย เครื่องพิมพ์เสีย ขายต่อได้ไหม'),
        b('ตอบว่า ได้ครับ สั่งพิมพ์หลัง commit และบริการพิมพ์แยกเป็นอีกหน่วย ถ้าพิมพ์ไม่ได้ คำสั่งซื้อยังบันทึกและเข้าคิว หน้าจอแค่ขึ้นคำเตือน', answer=True)]),
    dict(chap='จบ', title='สรุปประโยคเดียว', kind='big', text='api.js → app.js ตรวจสิทธิ์<br>→ ธุรกรรมเดียว → commit<br>→ broadcast',
         sub2='จำประโยคนี้ไว้ตอบทุกคำถาม', beats=[
        b('สรุปประโยคเดียวนะครับ หน้าจอเรียกผ่าน api.js ทุกคำขอโดนตรวจสิทธิ์ที่ app.js'),
        b('อะไรที่เปลี่ยนข้อมูล ทำในธุรกรรมเดียว commit แล้วค่อย broadcast ให้จออื่นรู้'),
        b('จำประโยคนี้ไว้ แล้วไล่ดูโค้ดตามคลิปอีกสักรอบ สู้ๆ ครับ')]),
]
