# -*- coding: utf-8 -*-
# แผนภูมิแกนต์ของแผนการดำเนินงาน ข้อมูลตรงกับตารางที่ 1.1 (กิจกรรมละหนึ่งเดือน) และหมุดหมาย M1–M6
# ใช้: python3 fig1-gantt.py แล้ว node render-svg.js fig1-gantt.svg fig1-gantt.png 3
import io

ROWS = [  # กิจกรรม, เดือนเริ่ม, เดือนสิ้นสุด, หมุดหมาย
    ('1 วิเคราะห์ความต้องการ', 1, 1, 'M1 เอกสารข้อกำหนดความต้องการ'),
    ('2 ออกแบบระบบ', 2, 2, 'M2 เอกสารการออกแบบและต้นแบบหน้าจอ'),
    ('3 พัฒนาโมดูลหลักระยะที่ 1', 3, 3, 'M3 ระบบต้นแบบระยะที่ 1'),
    ('4 พัฒนาโมดูลหลักระยะที่ 2', 4, 4, 'M4 ระบบต้นแบบระยะที่ 2'),
    ('5 พัฒนาแดชบอร์ดและการแจ้งเตือน', 5, 5, 'M5 ระบบรุ่นสมบูรณ์สำหรับทดสอบ'),
    ('6 ทดสอบและประเมินผล', 6, 6, 'M6 รายงานผลทดสอบและเล่มฉบับสมบูรณ์'),
]
LEFT, TOP, CW, RH = 300, 60, 110, 46
W, H = LEFT + 6 * CW + 30, TOP + len(ROWS) * RH + 30
out = []
add = out.append
add('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
    'font-family="Sarabun, TH Sarabun New, sans-serif">' % (W, H, W, H))
add('<rect width="%d" height="%d" fill="#fff"/>' % (W, H))
add('<text x="20" y="%d" font-size="19" font-weight="bold" fill="#111">กิจกรรม</text>' % (TOP - 20))
for m in range(6):
    x = LEFT + m * CW
    add('<rect x="%d" y="%d" width="%d" height="%d" fill="%s" stroke="#c8cdd8"/>' % (x, TOP, CW, len(ROWS) * RH, '#f7f8fc' if m % 2 else '#fff'))
    add('<text x="%d" y="%d" font-size="18" text-anchor="middle" fill="#111">เดือนที่ %d</text>' % (x + CW / 2, TOP - 20, m + 1))
for i, (name, a, b, ms) in enumerate(ROWS):
    y = TOP + i * RH
    add('<line x1="20" y1="%d" x2="%d" y2="%d" stroke="#e1e4ea"/>' % (y + RH, W - 10, y + RH))
    add('<text x="20" y="%d" font-size="19" fill="#111">%s</text>' % (y + 30, name))
    x1 = LEFT + (a - 1) * CW + 8
    x2 = LEFT + b * CW - 8
    add('<rect x="%d" y="%d" width="%d" height="22" rx="4" fill="#5a3a8a"/>' % (x1, y + 12, x2 - x1))
    mx = LEFT + b * CW
    add('<path d="M%d,%d l9,11 l-9,11 l-9,-11z" fill="#d9822b" stroke="#9a5a12"/>' % (mx, y + 12))
    add('<text x="%d" y="%d" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="end">%s</text>' % (mx - 12, y + 30, ms.split()[0]))
add('</svg>')
io.open('fig1-gantt.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('wrote fig1-gantt.svg')
