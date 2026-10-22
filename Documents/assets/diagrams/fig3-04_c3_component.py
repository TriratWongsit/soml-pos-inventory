# -*- coding: utf-8 -*-
# รูปที่ 3.5 แผนภาพส่วนประกอบภายในระบบหลังบ้าน (C3) วาดเป็น SVG บนตารางคงที่
# ความสัมพันธ์ตรงกับการ require ในโค้ด soml/backend (ดูคำอธิบายใต้รูปในบทที่ 3)
# 20 ต.ค. 2569 จัดใหม่จากหกคอลัมน์เป็นสี่คอลัมน์ ให้ตัวอักษรใหญ่ขึ้นราวหนึ่งเท่าครึ่งเมื่อพิมพ์กว้าง 14.5 ซม.
# ใช้: python3 fig3-04_c3_component.py แล้ว node render-svg.js ได้ไฟล์ .png
import io

W, BW, BH, PITCH, X0 = 1000, 228, 104, 246, 14
def cx(c): return X0 + BW / 2 + PITCH * (c - 1)
ROW = {0: 10, 1: 140, 2: 290, 3: 460, 4: 650, 5: 800}
FS = 19                                    # ขนาดตัวอักษรในกล่อง (ฟอนต์ Sarabun)

FILL = {'comp': ('#e8e2f5', '#5a3a8a'), 'sup': ('#fbefd9', '#9a6a12'),
        'other': ('#dbe6f7', '#1a4a8a'), 'db': ('#d8ece8', '#136055')}

# รหัส, ชื่อตามไฟล์, หน้าที่ (· แบ่งบรรทัด), คอลัมน์, แถว, ชนิด, บันทึกประวัติผ่าน BE-09
BOX = {
    'FE':    ('FE-01 ถึง FE-09', 'ส่วนติดต่อผู้ใช้', '[รีแอ็กต์]', 2.5, 0, 'other', False),
    'MW':    ('SP-01', 'Auth Middleware', 'ตรวจโทเคนและบทบาท · ทุกคำขอ', 2.5, 1, 'sup', False),
    'QR':    ('SP-03', 'PromptPay Library', 'สร้างข้อความ · รหัสคิวอาร์', 4, 1, 'sup', False),
    'AUTH':  ('BE-01', 'Auth Controller', 'เข้าสู่ระบบ · ออกโทเคน', 1, 2, 'comp', True),
    'PROD':  ('BE-02', 'Product Controller', 'สินค้าและ · จุดสั่งซื้อเพิ่ม', 2, 2, 'comp', True),
    'DISP':  ('BE-05', 'Dispatch Controller', 'รับคำขอ · ยืนยันจ่ายสินค้า', 3, 2, 'comp', False),
    'ORD':   ('BE-03', 'Order Controller', 'คำนวณยอด · เลขที่ไม่ซ้ำ', 4, 2, 'comp', True),
    'DASH':  ('BE-07', 'Dashboard Aggregator', 'รวมตัวเลข · แดชบอร์ด', 1, 3, 'comp', False),
    'ALERT': ('BE-08', 'Alert Engine', 'สินค้าใกล้หมด · คิวค้าง', 2, 3, 'comp', True),
    'STOCK': ('BE-06', 'Stock Deduction Service', 'ธุรกรรมตัดสต็อก · กันจ่ายซ้ำ', 3, 3, 'comp', True),
    'QUEUE': ('BE-04', 'Queue Manager', 'คิวงาน · ผลักเหตุการณ์', 4, 3, 'comp', True),
    'AUDIT': ('BE-09', 'Audit Log Service', 'บันทึกและ · ค้นประวัติ', 1, 4, 'comp', False),
    'DBC':   ('SP-02', 'Database Config', 'พูลการเชื่อมต่อ · ธุรกรรม', 2.5, 4, 'sup', False),
    'PRTC':  ('BE-10', 'Print Service Client', 'ส่งงานพิมพ์ · ใบเสร็จ', 4, 4, 'comp', False),
    'PSVC':  ('', 'บริการพิมพ์ใบเสร็จ', '', 4, 5, 'other', False),
}
SMALL = {'PSVC': 70}

def box(k):
    code, name, desc, c, r = BOX[k][:5]
    return cx(c) - BW / 2, ROW[r], BW, SMALL.get(k, BH)

out = []
def add(s): out.append(s)

H = 975
add('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
    'font-family="Sarabun, TH Sarabun New, sans-serif">' % (W, H, W, H))
add('<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
    'orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#333"/></marker></defs>')
add('<rect width="%d" height="%d" fill="#fff"/>' % (W, H))

# กรอบระบบหลังบ้าน
add('<rect x="22" y="126" width="%d" height="644" rx="6" fill="#f7f8fc" stroke="#9aa6c8" stroke-dasharray="6 4"/>' % (W - 30))
add('<text x="34" y="150" font-size="18" font-weight="bold" fill="#333">ระบบหลังบ้าน</text>')
add('<text x="34" y="174" font-size="16" fill="#333">[โหนดเจเอส + เอ็กซ์เพรสเจเอส]</text>')

def line(pts, dashed=False, label=None, lx=None, ly=None, anchor='start', head=True):
    d = 'M' + ' L'.join('%.0f,%.0f' % p for p in pts)
    add('<path d="%s" fill="none" stroke="#333" stroke-width="1.8" %s %s/>'
        % (d, 'stroke-dasharray="6 4"' if dashed else '', 'marker-end="url(#a)"' if head else ''))
    if label:
        add('<text x="%.0f" y="%.0f" font-size="16" fill="#333" text-anchor="%s">%s</text>' % (lx, ly, anchor, label))

def top(k, dx=0): x, y, w, h = box(k); return (x + w / 2 + dx, y)
def bot(k, dx=0): x, y, w, h = box(k); return (x + w / 2 + dx, y + h)
def left(k, dy=0): x, y, w, h = box(k); return (x, y + h / 2 + dy)
def right(k, dy=0): x, y, w, h = box(k); return (x + w, y + h / 2 + dy)

line([bot('FE'), top('MW')])
# SP-01 ส่งต่อคำขอให้โมดูลชั้นรับคำขอ (เส้นแนวนอนร่วม)
BUS = 266
line([bot('MW'), (cx(2.5), BUS)], head=False)
line([(cx(1), BUS), (cx(4) - 40, BUS)], head=False)
for k in ('AUTH', 'PROD', 'DISP'):
    line([(top(k)[0], BUS), top(k)])
line([(cx(4) - 40, BUS), top('ORD', -40)])
line([(X0 + BW + 9, BUS), (X0 + BW + 9, 440), (cx(1), 440), top('DASH')])     # BE-07 รับคำขอผ่านช่องระหว่างคอลัมน์
line([top('ORD', 50), bot('QR', 50)])                                          # BE-03 ใช้ SP-03
line([bot('ORD'), top('QUEUE')])
line([right('ORD'), (W - 14, right('ORD')[1]), (W - 14, right('PRTC')[1]), right('PRTC')])
line([bot('DISP'), top('STOCK')], label='ธุรกรรมเดียวกัน', lx=cx(3) + 8, ly=452)
line([bot('DISP', -50), top('ALERT', 50)])
line([bot('DISP', 50), top('QUEUE', -50)])
line([bot('PROD', -30), top('ALERT', -30)])
# BE-08 แจ้งเหตุการณ์ให้ BE-04 (อ้อมใต้ BE-06)
line([bot('ALERT', -40), (cx(2) - 40, 592), (cx(4) - 40, 592), bot('QUEUE', -40)])
# BE-04 ผลักเหตุการณ์ไปหน้าจอด้วยเว็บซ็อกเก็ต (อ้อมซ้ายนอกกรอบ)
line([bot('QUEUE', 40), (cx(4) + 40, 614), (8, 614), (8, 62), left('FE')],
     label='เว็บซ็อกเก็ต', lx=16, ly=104)
line([bot('PRTC'), top('PSVC')])
# ทุกโมดูลที่อ่านเขียนข้อมูลใช้ SP-02
line([(cx(2.5), 622), top('DBC')], label='โมดูล BE ทุกตัวเข้าถึงข้อมูลผ่าน SP-02',
     lx=cx(2.5) + 10, ly=640)
line([bot('DBC'), (cx(2.5), ROW[5])])

for k, (code, name, desc, c, r, kind, logs) in BOX.items():
    x, y, w, h = box(k)
    f, s = FILL[kind]
    add('<rect x="%.0f" y="%.0f" width="%d" height="%d" rx="4" fill="%s" stroke="%s" stroke-width="1.6"/>' % (x, y, w, h, f, s))
    lines = [t for t in [code, name] + desc.split(' · ') if t]
    y0 = y + h / 2 - (len(lines) - 1) * 11.5 + 7
    for i, t in enumerate(lines):
        add('<text x="%.0f" y="%.0f" font-size="%d" text-anchor="middle" fill="#111"%s>%s</text>'
            % (x + w / 2, y0 + i * 23, FS, ' font-weight="bold"' if i == 0 and code else '', t))
    if logs:
        add('<rect x="%.0f" y="%.0f" width="70" height="22" rx="3" fill="#fff" stroke="#5a3a8a" stroke-dasharray="4 3"/>' % (x + w - 74, y + 3))
        add('<text x="%.0f" y="%.0f" font-size="14" text-anchor="middle" fill="#5a3a8a">→ BE-09</text>' % (x + w - 39, y + 19))

# ฐานข้อมูล (ทรงกระบอก)
dx, dy, dw, dh = cx(2.5) - BW / 2, ROW[5], BW, 70
f, s = FILL['db']
add('<path d="M%.0f,%.0f v%.0f a%.0f,12 0 0 0 %.0f,0 v-%.0f" fill="%s" stroke="%s" stroke-width="1.6"/>'
    % (dx, dy + 12, dh - 12, BW / 2, BW, dh - 12, f, s))
add('<ellipse cx="%.0f" cy="%.0f" rx="%.0f" ry="12" fill="%s" stroke="%s" stroke-width="1.6"/>' % (dx + BW / 2, dy + 12, BW / 2, f, s))
add('<text x="%.0f" y="%.0f" font-size="%d" text-anchor="middle" fill="#111">มายเอสคิวแอล</text>' % (dx + BW / 2, dy + 52, FS))

# คำอธิบายสัญลักษณ์
LY = 900
add('<rect x="22" y="%d" width="70" height="22" rx="3" fill="#fff" stroke="#5a3a8a" stroke-dasharray="4 3"/>' % LY)
add('<text x="57" y="%d" font-size="14" text-anchor="middle" fill="#5a3a8a">→ BE-09</text>' % (LY + 16))
add('<text x="102" y="%d" font-size="17" fill="#333">โมดูลนี้บันทึกประวัติการทำรายการผ่าน BE-09</text>' % (LY + 17))
add('<rect x="22" y="%d" width="26" height="18" fill="%s" stroke="%s"/>' % (LY + 38, *FILL['sup']))
add('<text x="58" y="%d" font-size="17" fill="#333">ส่วนสนับสนุน (SP)</text>' % (LY + 53))
add('<rect x="250" y="%d" width="26" height="18" fill="%s" stroke="%s"/>' % (LY + 38, *FILL['comp']))
add('<text x="286" y="%d" font-size="17" fill="#333">โมดูลหลัก (BE)</text>' % (LY + 53))
add('</svg>')

io.open('fig3-04_c3_component.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('wrote fig3-04_c3_component.svg')
