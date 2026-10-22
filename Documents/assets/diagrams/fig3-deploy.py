# -*- coding: utf-8 -*-
# แผนภาพการติดตั้ง (Deployment Diagram) ตามการติดตั้งจริงที่ร้าน หัวข้อ 4.5
# พอร์ตตรงกับโค้ด: ไวต์ 5173 (frontend/vite.config.js) ระบบหลังบ้าน 4000 (backend/server.js)
# บริการพิมพ์ 4100 (print-service/server.js) มายเอสคิวแอล 3307 รับเฉพาะเครื่องนี้ (runtime.js)
# ใช้: python3 fig3-deploy.py แล้ว node render-svg.js fig3-deploy.svg fig3-deploy.png 3
import io

W, H = 1040, 670
out = []
add = out.append
add('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
    'font-family="Sarabun, TH Sarabun New, sans-serif">' % (W, H, W, H))
add('<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    '<path d="M0,0L10,5L0,10z" fill="#333"/></marker></defs>')
add('<rect width="%d" height="%d" fill="#fff"/>' % (W, H))

def node3d(x, y, w, h, fill, stroke, title, sub):
    d = 12
    add('<path d="M%d,%d l%d,-%d h%d v%d l-%d,%d" fill="%s" stroke="%s" stroke-width="1.4"/>'
        % (x, y, d, d, w, h, d, d, fill, stroke))
    add('<rect x="%d" y="%d" width="%d" height="%d" fill="%s" stroke="%s" stroke-width="1.4"/>' % (x, y, w, h, fill, stroke))
    add('<text x="%d" y="%d" font-size="20" font-weight="bold" fill="#111">%s</text>' % (x + 14, y + 30, title))
    if sub:
        add('<text x="%d" y="%d" font-size="18" fill="#333">%s</text>' % (x + 14, y + 54, sub))

def comp(x, y, w, h, fill, stroke, lines):
    add('<rect x="%d" y="%d" width="%d" height="%d" rx="4" fill="%s" stroke="%s" stroke-width="1.4"/>' % (x, y, w, h, fill, stroke))
    y0 = y + h / 2 - (len(lines) - 1) * 12 + 7
    for i, t in enumerate(lines):
        add('<text x="%d" y="%.0f" font-size="19" text-anchor="middle" fill="#111"%s>%s</text>'
            % (x + w / 2, y0 + i * 24, ' font-weight="bold"' if i == 0 else '', t))

def arrow(pts, label=None, lx=0, ly=0, anchor='middle'):
    add('<path d="M%s" fill="none" stroke="#333" stroke-width="1.6" marker-end="url(#a)"/>'
        % ' L'.join('%d,%d' % p for p in pts))
    if label:
        for i, t in enumerate(label.split('|')):
            add('<text x="%d" y="%d" font-size="17" fill="#333" text-anchor="%s">%s</text>' % (lx, ly + i * 20, anchor, t))

PC, BE, DB, PS = '#e8e2f5', '#fbefd9', '#d8ece8', '#dbe6f7'
node3d(200, 52, 700, 430, '#f7f8fc', '#5a6b8a', 'เครื่องคอมพิวเตอร์ของร้าน «อุปกรณ์»', 'ระบบปฏิบัติการวินโดวส์ 10 หรือ 11 · เปิดทั้งสี่หน่วยด้วย start.bat')
comp(240, 124, 250, 104, BE, '#9a6a12', ['ส่วนติดต่อผู้ใช้', 'ไวต์ พอร์ต 5173', '(FE-01 ถึง FE-09)'])
comp(620, 124, 250, 104, PC, '#5a3a8a', ['ระบบหลังบ้าน', 'โหนดเจเอส พอร์ต 4000', 'BE-01 ถึง BE-10', 'SP-01 ถึง SP-03'])
comp(620, 262, 250, 80, DB, '#136055', ['ฐานข้อมูลมายเอสคิวแอล', 'พอร์ต 3307 รับเฉพาะเครื่องนี้'])
comp(620, 382, 250, 80, PS, '#1a4a8a', ['บริการพิมพ์ใบเสร็จ', 'โหนดเจเอส พอร์ต 4100'])
comp(240, 382, 250, 80, '#ffffff', '#5a6b8a', ['เบราว์เซอร์บนเครื่องนี้', 'พนักงานขายและผู้จัดการ'])

node3d(20, 560, 300, 84, '#f7f8fc', '#5a6b8a', 'โทรศัพท์หรือแท็บเล็ต', 'เบราว์เซอร์ของพนักงานคลังสินค้า')
node3d(620, 560, 300, 84, '#f7f8fc', '#5a6b8a', 'เครื่องพิมพ์ใบเสร็จความร้อน', 'เอปสัน TM-T82')

arrow([(490, 176), (620, 176)], '/api และ /ws', 555, 166)
arrow([(745, 228), (745, 262)], 'คำสั่งเอสคิวแอล', 755, 250, 'start')
arrow([(870, 200), (890, 200), (890, 422), (870, 422)], 'เอชทีทีพี|งานพิมพ์', 922, 300, 'start')
arrow([(365, 382), (365, 228)], 'localhost:5173', 375, 305, 'start')
arrow([(170, 560), (170, 176), (240, 176)], 'เครือข่ายไร้สาย|ของร้าน :5173', 160, 380, 'end')
arrow([(745, 462), (745, 560)], 'ยูเอสบี ผ่านเครื่องพิมพ์|ที่แชร์ชื่อ AmpornOMS-Receipt', 762, 506, 'start')
add('</svg>')
io.open('fig3-deploy.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('wrote fig3-deploy.svg')
