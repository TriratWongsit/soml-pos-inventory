# -*- coding: utf-8 -*-
"""ใบลำดับเดโม System Test แบบ e2e (D-1 ถึง D-8)
1) หาเลขบรรทัดจากโค้ดจริงด้วยข้อความในบรรทัด
2) ใส่คอมเมนต์ "◀ [D-x] ..." ต่อท้ายบรรทัดนั้น (ไม่แทรกบรรทัดใหม่ เลขบรรทัดจึงไม่เลื่อน) ใส่ซ้ำไม่ได้
3) สร้าง demo.html แล้วใช้ render.js แปลงเป็น PDF
ใช้: python3 make_demo.py [--comment]"""
import html, io, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SOML = os.path.join(HERE, '..', '..', 'soml')
e = html.escape
FE, BE = 'frontend/src/', 'backend/'


def read(path):
    return io.open(os.path.join(SOML, path), encoding='utf-8').read().split('\n')


def find(path, pat):
    hits = [i + 1 for i, s in enumerate(read(path)) if pat in s]
    if not hits:
        raise SystemExit('หาไม่เจอ: %s ใน %s' % (pat, path))
    return hits[0]


# (ไฟล์, ข้อความในบรรทัด, คำอธิบาย)
D = [
 dict(code='D-1', name='เข้าระบบตามบทบาท และกันคนไม่มีสิทธิ์', uc='UC-01 · FR-01 · NFR-01', tc='TC-01', ac=['AC-12 เข้าสู่ระบบสำเร็จ', 'AC-01 พนักงานขายเรียก'],
      story='เช้าวันใหม่ พนักงานขายเข้าระบบ แล้วลองเข้าหน้าของผู้จัดการ', device='คอม (บัญชีพนักงานขาย)',
      steps=['เข้าสู่ระบบด้วยรหัสผิดหนึ่งครั้ง แล้วด้วยรหัสถูก', 'ชี้ให้ดูเมนูซ้ายที่มีแค่ "ขายหน้าร้าน"', 'พิมพ์ /products ในช่องที่อยู่'],
      expect=['รหัสผิดเข้าไม่ได้ รหัสถูกไปหน้าขายเอง', 'พิมพ์ /products แล้วเด้งกลับหน้าขาย', 'ถ้ายิง API ตรง ไม่มีโทเคนได้ 401 บทบาทผิดได้ 403'],
      pts=[(BE + 'modules/auth/index.js', 'async function login', 'login() ตรวจรหัสผ่านด้วย bcrypt'),
            (BE + 'modules/auth/index.js', 'jwt.sign', 'ออกโทเคน JWT อายุ 8 ชั่วโมง'),
            (BE + 'middleware/auth.js', 'function verifyToken', 'ไม่มีโทเคนหรือโทเคนปลอม → 401'),
            (BE + 'middleware/auth.js', 'function requireRole', 'บทบาทไม่ตรง → 403'),
            (FE + 'components/RequireRole.jsx', 'roles.includes', 'หน้าจอ: บทบาทไม่ตรง เด้งกลับหน้าของตัวเอง'),
            (FE + 'components/Layout.jsx', 'const MENU = [', 'เมนูของแต่ละบทบาท')]),
 dict(code='D-2', name='ลูกค้าซื้อของ คิดยอด QR ยืนยันรับเงิน พิมพ์ใบเสร็จ', uc='UC-03 · UC-04 · FR-03', tc='TC-03 · TC-04 · TC-12', ac=['AC-03 ยอดรวมและรหัส QR', 'AC-04 ขายต่อเนื่อง', 'AC-05 บริการพิมพ์ใช้ไม่ได้'],
      story='ลูกค้าซื้อสามรายการ (ปัญหาเดิม EV-01 เขียนบิลคิดยอดเอง)', device='คอม (บัญชีพนักงานขาย)',
      steps=['ค้นและเพิ่มสินค้า 3 รายการ เปลี่ยนจำนวนหนึ่งรายการ', 'กดแสดง QR แล้วให้อาจารย์ดูยอดในหน้า QR', 'กดยืนยันรับชำระเงิน'],
      expect=['ยอดถูกต้อง ตรงกับยอดใน QR', 'ได้เลขที่คำสั่งซื้อใหม่ ใบเสร็จออก (ถ้าต่อเครื่องพิมพ์)'],
      pts=[(FE + 'pages/pos/index.jsx', "api.post('/orders/quote'", 'หน้าจอขอให้หลังบ้านคิดยอด'),
            (BE + 'modules/order/index.js', 'async function quote', 'quote() คิดยอดและสร้างข้อความ QR'),
            (BE + 'modules/order/index.js', 'async function priceItems', 'ราคาจากฐานข้อมูล ไม่เชื่อราคาจากหน้าจอ'),
            (FE + 'pages/pos/index.jsx', 'const confirmPayment', 'กดยืนยันรับชำระ'),
            (BE + 'modules/order/index.js', 'async function create', 'create() บันทึกคำสั่งซื้อใน transaction'),
            (BE + 'modules/order/index.js', 'async function nextOrderNo', 'ออกเลขที่ไม่ซ้ำ ล็อกด้วย FOR UPDATE'),
            (BE + 'modules/order/index.js', 'printClient.printReceipt', 'สั่งพิมพ์หลัง commit พิมพ์ล่มการขายยังสำเร็จ'),
            (BE + 'modules/order/index.js', "queue.broadcast('order.created'", 'ผลักคำสั่งซื้อไปจอคลัง')]),
 dict(code='D-3', name='จอคลังเห็นคำสั่งซื้อเอง ไม่ต้องรีเฟรช (จุดเด่น)', uc='UC-05 · FR-04 · NFR-02', tc='TC-05', ac=['คำสั่งซื้อใหม่ปรากฏบนหน้าจอคิว'],
      story='ลูกค้าจ่ายเงินแล้ว คลังในโกดังเห็นงานทันที (ปัญหาเดิม EV-03, EV-04 ลูกค้าถือบิลเดินไปโกดัง)', device='มือถือ (บัญชีพนักงานคลัง) เปิดหน้าคิวค้างไว้ก่อนทำ D-2',
      steps=['เปิดหน้าคิวบนมือถือค้างไว้ ห้ามรีเฟรช', 'ทำ D-2 ที่คอม แล้วให้อาจารย์ดูมือถือ', '(เสริม) ปิด Wi-Fi มือถือ ขายอีกใบ แล้วเปิด Wi-Fi กลับ'],
      expect=['คำสั่งซื้อขึ้นที่มือถือเองภายใน 3 วินาที', 'ต่อ Wi-Fi กลับแล้ว ใบที่ขายตอนหลุดขึ้นมาเอง'],
      pts=[(BE + 'modules/queue/index.js', 'function broadcast', 'broadcast() ส่งเหตุการณ์ไปทุกจอ'),
            (FE + 'services/events.js', 'new WebSocket', 'เปิด WebSocket (ต่อไม่ได้ใน 3 วินาทีใช้ SSE แทน)'),
            (FE + 'services/events.js', 'ws.onopen', 'ต่อได้ → ส่ง connected ให้หน้าจอโหลดใหม่'),
            (FE + 'pages/queue/index.jsx', 'const stop = subscribe', 'ได้เหตุการณ์ → load() เอง ไม่ต้องรีเฟรช'),
            (BE + 'modules/queue/index.js', 'async function list', 'list() ส่งรายการคิว')]),
 dict(code='D-4', name='คลังเริ่มจัด แล้วยืนยันจ่ายและตัดสต็อก', uc='UC-06 · UC-07 · FR-05 · FR-06', tc='TC-06', ac=['AC-07 จ่ายสำเร็จหนึ่งครั้ง'],
      story='ลูกค้ามาถึงคลัง พนักงานจัดของตามรายการบนจอ (ปัญหาเดิม EV-05 อ่านบิลด้วยตา)', device='มือถือ (พนักงานคลัง) + คอม (ผู้จัดการ ดูสต็อก)',
      steps=['จดยอดคงเหลือของสินค้าในใบก่อน', 'กดเริ่มจัด', 'แตะใบ กดยืนยันจ่าย แล้วกดยืนยันอีกครั้ง', 'ผู้จัดการเปิดหน้าสินค้าดูยอด'],
      expect=['สถานะเปลี่ยนทุกจอพร้อมกัน', 'ต้องกดสองครั้งกันกดพลาด', 'ใบหายจากคิว สต็อกลดเท่าที่จ่ายพอดี'],
      pts=[(FE + 'pages/queue/index.jsx', "status: 'picking'", 'กดเริ่มจัด'),
            (BE + 'modules/queue/index.js', 'const TRANSITIONS', 'สถานะที่เปลี่ยนต่อได้ (ไม่มี delivered)'),
            (BE + 'modules/queue/index.js', 'async function updateStatus', 'updateStatus() เปลี่ยนสถานะการจัดของ'),
            (FE + 'pages/dispatch/index.jsx', 'const confirm = async', 'กดยืนยันจ่าย (หลังกดยืนยันซ้ำ)'),
            (BE + 'modules/dispatch/index.js', 'async function confirm', 'confirm() เปิด transaction'),
            (BE + 'modules/stock-deduction/index.js', 'async function dispatch', 'dispatch() ตัดสต็อกทั้งใบ')]),
 dict(code='D-5', name='เอาใบเดิมมาขอรับของซ้ำ', uc='UC-07 · FR-06 · BR-02 · NFR-04', tc='TC-06', ac=['AC-07 จ่ายสำเร็จหนึ่งครั้ง'],
      story='ปัญหาเดิม EV-06 มีคนเอาบิลเก่ามารับของซ้ำ', device='มือถือหรือคอม (พนักงานคลัง)',
      steps=['เปิดหน้ายืนยันจ่ายของใบที่จ่ายไปแล้วใน D-4 (หรือเปิดใบเดียวกันไว้สองเครื่องก่อนกด)', 'กดยืนยันจ่ายอีกครั้ง',
             'ถ้าอาจารย์ถามเรื่องกดพร้อมกันจริง: รัน npx jest backend/tests/integration/dispatch.test.js'],
      expect=['ขึ้นข้อความ "ถูกจ่ายหรือยกเลิกไปแล้ว" (409) สต็อกไม่ลดซ้ำ', 'เทสอัตโนมัติ: สองคำขอพร้อมกันได้ 200 หนึ่งครั้ง 409 หนึ่งครั้ง'],
      pts=[(BE + 'modules/stock-deduction/index.js', 'const [st] = await conn.query(', 'เปลี่ยนสถานะเฉพาะใบที่ยังไม่จ่าย (กันจ่ายซ้ำ)'),
            (BE + 'modules/stock-deduction/index.js', 'if (st.affectedRows === 0)', 'ไม่มีแถวเปลี่ยน = จ่ายไปแล้ว → ปฏิเสธ'),
            (BE + 'modules/dispatch/index.js', "err.code === 'NOT_FOUND' ? 404 : 409", 'แปลงเป็น HTTP 409'),
            (BE + 'tests/integration/dispatch.test.js', 'Promise.all(', 'เทสยิงยืนยันจ่ายพร้อมกันสองคำขอ')]),
 dict(code='D-6', name='ขายเกินของที่มี คลังจ่ายไม่ได้', uc='UC-07 · FR-06', tc='TC-07', ac=['AC-08 สต็อกไม่พอ'],
      story='ยอดในระบบเหลือน้อย แต่หน้าร้านขายไปมากกว่านั้น', device='คอม (พนักงานขาย) + มือถือ (พนักงานคลัง)',
      steps=['ใช้สินค้าที่เตรียมไว้ให้เหลือ 1 ชิ้น', 'ขายสินค้านั้น 2 ชิ้นรวมกับสินค้าอื่นในใบเดียว', 'คลังกดยืนยันจ่ายใบนั้น'],
      expect=['ขึ้นข้อความ "สต็อก ... ไม่พอ" (409)', 'สต็อกทุกรายการในใบไม่เปลี่ยน สถานะใบยังรอจ่าย'],
      pts=[(BE + 'modules/stock-deduction/index.js', 'stock_qty >= ?', 'หักได้เฉพาะเมื่อของพอ (กันติดลบ)'),
            (BE + 'modules/stock-deduction/index.js', 'if (dq.affectedRows === 0)', 'หักไม่ได้ → สต็อกไม่พอ'),
            (BE + 'config/db.js', 'await conn.rollback()', 'ผิดตรงไหนย้อนทั้งใบ')]),
 dict(code='D-7', name='ของใกล้หมด ผู้จัดการได้แจ้งเตือน', uc='UC-11 · FR-08 · BR-05', tc='TC-09', ac=['AC-10 จ่ายสินค้าจนต่ำกว่า'],
      story='ปัญหาเดิม EV-09 สั่งของจากความรู้สึก', device='มือถือ (พนักงานคลัง) + คอม (ผู้จัดการ)',
      steps=['ใช้สินค้าที่เตรียมไว้ สต็อก 12 จุดสั่งซื้อเพิ่ม 10', 'ขาย 5 ชิ้น แล้วคลังยืนยันจ่าย (เหลือ 7)', 'ผู้จัดการดูกระดิ่งและหน้าการแจ้งเตือน'],
      expect=['แจ้งเตือน "เหลือ 7 ต่ำกว่าจุดสั่งซื้อเพิ่ม (10)" ขึ้นทันที', 'จ่ายเพิ่มอีกไม่เตือนซ้ำจนกว่าจะกดอ่าน'],
      pts=[(BE + 'modules/dispatch/index.js', 'await alert.checkStock', 'หลังจ่ายเสร็จ ตรวจของใกล้หมด'),
            (BE + 'modules/alert/index.js', 'async function checkStock', 'checkStock() เทียบยอดกับจุดสั่งซื้อเพิ่ม'),
            (BE + 'modules/alert/index.js', 'async function createOnce', 'createOnce() ไม่สร้างแจ้งเตือนซ้ำ'),
            (BE + 'modules/alert/index.js', "queue.broadcast('notification.created'", 'ผลักแจ้งเตือนไปกระดิ่ง')]),
 dict(code='D-8', name='ผู้จัดการดูยอดระหว่างวัน และค้นว่าใครจ่ายใบนี้', uc='UC-08 · UC-10 · FR-07 · FR-09', tc='TC-08 · TC-11', ac=['AC-09 ตัวเลขบนแดชบอร์ด', 'AC-11 ค้นประวัติ'],
      story='ปัญหาเดิม EV-08 รอสรุปยอดตอนปิดร้าน และ EV-02 ตรวจย้อนหลังยาก', device='คอม (ผู้จัดการ)',
      steps=['เปิดแดชบอร์ดปฏิบัติการ ดูยอดขายวันนี้ คิวค้าง ของใกล้หมด', 'เปิดประวัติการทำรายการ กรองวันนี้ และประเภทยืนยันจ่าย'],
      expect=['ตัวเลขรวมการขายใน D-2 ถึง D-7', 'เห็นแถวยืนยันจ่ายของ D-4 พร้อมชื่อผู้ทำและเวลา'],
      pts=[(FE + 'pages/dashboard-ops/index.jsx', "api.get('/dashboard/ops')", 'แดชบอร์ดดึงข้อมูล และโหลดใหม่ทุกเหตุการณ์'),
            (BE + 'modules/dashboard/index.js', 'async function ops', 'ops() คำนวณจากตารางจริงทุกครั้ง'),
            (BE + 'modules/audit-log/index.js', 'async function record', 'record() ทุกโมดูลบันทึกประวัติใน transaction เดียวกัน'),
            (BE + 'modules/audit-log/index.js', 'async function list', 'list() ค้นประวัติตามตัวกรอง'),
            (FE + 'pages/audit-logs/index.jsx', 'api.get(`/audit-logs', 'หน้าจอส่งตัวกรองไปค้น')]),
]

MARK = '◀ ['


def resolve():
    for d in D:
        d['lines'] = [(f, find(f, p), w) for f, p, w in d['pts']]


def add_comments():
    by_file = {}
    for d in D:
        for f, n, w in d['lines']:
            by_file.setdefault(f, []).append((n, d['code'], w))
    changed = 0
    for f, items in by_file.items():
        L = read(f)
        for n, c, w in items:
            if MARK in L[n - 1]:
                continue
            L[n - 1] = L[n - 1].rstrip() + '  // ◀ [%s] เดโม: %s' % (c, w)
            changed += 1
        io.open(os.path.join(SOML, f), 'w', encoding='utf-8').write('\n'.join(L))
    print('ใส่คอมเมนต์', changed, 'บรรทัด')


def owner(f):
    return 'พนาวุฒน์ (หน้าบ้าน)' if f.startswith(FE) else 'ตรัยรัตน์ (หลังบ้าน)'


def acline(prefix):
    return find('tests/system/acceptance.spec.js', "test('" + prefix)


CSS = '''@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
@page{size:A4;margin:13mm 12mm}*{box-sizing:border-box}
body{font-family:Sarabun,sans-serif;font-size:13.5px;line-height:1.45;color:#1b2430;margin:0}
h1{font-size:24px;color:#0F4C81;margin:0 0 4px}h2{font-size:17px;color:#0F4C81;margin:12px 0 6px}
table{width:100%;border-collapse:collapse;margin:4px 0 8px}td,th{border:1px solid #c9ced6;padding:4px 7px;vertical-align:top;text-align:left}
th{background:#0F4C81;color:#fff}code{font-family:Menlo,monospace;font-size:11.5px;background:#f1f3f6;padding:0 3px;border-radius:3px}
.card{border:1.5px solid #0F4C81;border-radius:8px;margin:0 0 12px;page-break-inside:avoid;overflow:hidden}
.ch{background:#0F4C81;color:#fff;padding:6px 10px;display:flex;justify-content:space-between;align-items:baseline}.ch b{font-size:17px}.ch span{font-size:11.5px}
.cb{padding:7px 10px}.story{background:#FFF6EC;border-left:4px solid #F28C28;padding:5px 9px;margin-bottom:5px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lbl{font-weight:800;color:#0F4C81;font-size:12.5px;margin-top:4px}
ol,ul{margin:2px 0 2px 18px;padding:0}.cl td{font-size:11.5px;padding:2px 6px}.cl td:first-child{width:43%}
.fe{color:#2E7D4F;font-weight:700}.be{color:#0F4C81;font-weight:700}
.auto{background:#EEF6EF;border-left:4px solid #2E9E6B;padding:5px 9px;margin-top:5px;font-size:12.5px}
.res{display:flex;gap:16px;margin-top:5px;font-size:12px;border-top:1px dashed #aaa;padding-top:4px}.box{display:inline-block;width:12px;height:12px;border:1.5px solid #333;margin-right:4px;vertical-align:-2px}
.warn{background:#FDECEC;border-left:4px solid #D9483B;padding:6px 10px;margin:6px 0}
'''


def card(d):
    rows = ''.join('<tr><td><code>%s:%d</code></td><td>%s</td><td class="%s">%s</td></tr>' % (
        e(f), n, e(w), 'fe' if f.startswith(FE) else 'be', 'หน้าบ้าน' if f.startswith(FE) else 'หลังบ้าน') for f, n, w in d['lines'])
    auto = ' · '.join('<code>npx playwright test --headed tests/system/acceptance.spec.js:%d</code>' % acline(a) for a in d['ac'])
    return ('<div class="card"><div class="ch"><b>%s %s</b><span>%s · %s</span></div><div class="cb">'
            '<div class="story">%s</div><div class="lbl">เครื่องที่ใช้: <span style="font-weight:400;color:#1b2430">%s</span></div>'
            '<div class="row"><div><div class="lbl">ขั้นตอน</div><ol>%s</ol></div><div><div class="lbl">ผลที่ต้องเห็น</div><ul>%s</ul></div></div>'
            '<div class="lbl">เปิดโค้ดให้ดู (ในโค้ดมีคอมเมนต์ <code>◀ [%s]</code> ต่อท้ายบรรทัด ค้นหาด้วย Cmd+Shift+F ได้)</div>'
            '<table class="cl"><tr><th>ไฟล์:บรรทัด</th><th>บรรทัดนี้ทำอะไร</th><th>ใครอธิบาย</th></tr>%s</table>'
            '<div class="auto"><b>System test อัตโนมัติของข้อนี้:</b> %s</div>'
            '<div class="res"><span><i class="box"></i>ซ้อมแล้วผ่าน</span><span><i class="box"></i>ไม่ผ่าน</span><span>หมายเหตุ ____________________________</span></div>'
            '</div></div>') % (d['code'], e(d['name']), e(d['uc']), e(d['tc']), e(d['story']), e(d['device']),
                               ''.join('<li>%s</li>' % e(x) for x in d['steps']), ''.join('<li>%s</li>' % e(x) for x in d['expect']),
                               d['code'], rows, auto)


def build():
    idx = ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (d['code'], e(d['name']), e(d['uc']), e(d['tc'])) for d in D)
    body = ('<h1>ใบลำดับเดโม System Test แบบ e2e · อำพร OMS</h1>'
            '<div>เดโมเป็นเรื่องเดียวต่อกัน ตั้งแต่ลูกค้ามาซื้อจนผู้จัดการดูยอด 8 สถานการณ์ แต่ละข้อบอก use case กรณีทดสอบ ขั้นตอน ผลที่ต้องเห็น และบรรทัดโค้ดที่จะเปิดให้ดู</div>'
            '<h2>ภาพรวม 8 สถานการณ์</h2><table><tr><th>ข้อ</th><th>สถานการณ์</th><th>Use Case / ความต้องการ</th><th>กรณีทดสอบ</th></tr>%s</table>'
            '<h2>บทบาทและงานที่รับผิดชอบของแต่ละคน (อาจารย์ประเมินรายบุคคล)</h2>'
            '<table><tr><th>ผู้จัดทำ</th><th>รับผิดชอบ (ตารางที่ 1.3)</th><th>ตอนเดโมทำอะไร</th></tr>'
            '<tr><td>นายตรัยรัตน์ วงษ์สิทธิ์</td><td>ระบบหลังบ้าน BE-01 ถึง BE-10 ส่วนสนับสนุน SP-01 ถึง SP-03 ฐานข้อมูล บริการพิมพ์ และชุดทดสอบหลังบ้าน</td>'
            '<td>อธิบายโค้ดบรรทัดที่เขียนว่า "หลังบ้าน" รัน npm test และ system test</td></tr>'
            '<tr><td>นายพนาวุฒน์ อภิปสันติ</td><td>ส่วนติดต่อผู้ใช้ หน้าจอ FE-01 ถึง FE-09 และการแสดงผลบนมือถือ</td>'
            '<td>กดหน้าจอตามขั้นตอน และอธิบายโค้ดบรรทัดที่เขียนว่า "หน้าบ้าน"</td></tr></table>'
            '<div class="warn">ต้องพูดได้ว่าตัวเองทำอะไร เปิดไฟล์ของตัวเองได้ และอธิบายบรรทัดในตารางของตัวเองได้โดยไม่ต้องดูโพย ถ้าการแบ่งงานจริงต่างจากตารางนี้ ให้แก้ตามจริงก่อนสอบ</div>'
            '<h2>เรื่อง UAT (พูดตามนี้)</h2><div>UAT ยังไม่ได้ทดสอบ เพราะต้องให้พนักงานจริงใช้งานต่อเนื่อง 1 สัปดาห์ตาม scenario ในสไลด์ ขออนุญาตกรรมการขอเวลาเพื่อทำ UAT ครับ</div>'
            '<h2>เตรียมก่อนเข้าห้อง</h2><ol>'
            '<li><code>cd soml</code> แล้ว <code>npm run db:reset</code> เพื่อเริ่มจากข้อมูลสะอาด แล้ว <code>npm run dev</code></li>'
            '<li>ผู้จัดการตั้งสินค้าตัวหนึ่งให้เหลือ 1 ชิ้น (ใช้ D-6) และอีกตัวสต็อก 12 จุดสั่งซื้อเพิ่ม 10 (ใช้ D-7)</li>'
            '<li>มือถือต่อ Wi-Fi วงเดียวกับคอม เปิด <code>http://&lt;IP เครื่อง&gt;:5173</code> เข้าบัญชีพนักงานคลัง แผนสำรอง: hotspot มือถือ หรือเปิดสองหน้าต่างบนคอม</li>'
            '<li>คอมเปิดสองหน้าต่าง หน้าต่างปกติเป็นพนักงานขาย หน้าต่างไม่ระบุตัวตนเป็นผู้จัดการ</li>'
            '<li>VS Code เปิดโฟลเดอร์ <code>soml</code> ไว้ กด Cmd+P พิมพ์ <code>ไฟล์:บรรทัด</code> หรือ Cmd+Shift+F ค้น <code>[D-4]</code> เพื่อไปที่จุดของข้อนั้น</li>'
            '<li>System test อัตโนมัติสร้างข้อมูลจริงลงฐาน ให้รันหลังเดโมด้วยมือ และลองโหมด --headed ล่วงหน้าหนึ่งรอบ</li></ol>'
            '<div style="page-break-after:always"></div>%s') % (idx, ''.join(card(d) for d in D))
    io.open(os.path.join(HERE, 'demo.html'), 'w', encoding='utf-8').write(
        '<!doctype html><html><head><meta charset="utf-8"><title>ใบลำดับเดโม</title><style>%s</style></head><body>%s</body></html>' % (CSS, body))


if __name__ == '__main__':
    resolve()
    if '--comment' in sys.argv:
        add_comments()
        resolve()
    build()
    for d in D:
        print(d['code'], ' '.join('%s:%d' % (f.split('/')[-2] + '/' + f.split('/')[-1], n) for f, n, _ in d['lines']))
