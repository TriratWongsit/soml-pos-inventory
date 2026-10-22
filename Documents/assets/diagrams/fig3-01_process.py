# -*- coding: utf-8 -*-
# รูปที่ 3.1 กระบวนการดำเนินงาน: หกระยะตามตารางที่ 1.2 แบบน้ำตกที่ทวนกลับได้ (หัวข้อ 1.4)
# ใช้: python3 fig3-01_process.py แล้ว node render-svg.js fig3-01_process.svg fig3-01_process.png 3
import io

W, H, BW, BH = 1000, 370, 300, 122
PH = [  # ชื่อระยะ, รายละเอียด, คอลัมน์, แถว
    ('ระยะที่ 1 · เดือนที่ 1', 'วิเคราะห์ความต้องการ', 'ผลลัพธ์ M1 | เอกสารข้อกำหนดความต้องการ', 0, 0),
    ('ระยะที่ 2 · เดือนที่ 2', 'ออกแบบระบบ', 'ผลลัพธ์ M2 | เอกสารการออกแบบและต้นแบบหน้าจอ', 1, 0),
    ('ระยะที่ 3 · เดือนที่ 3', 'พัฒนาโมดูลหลักระยะที่ 1', 'เข้าสู่ระบบ สินค้า | งานขาย และใบเสร็จ', 2, 0),
    ('ระยะที่ 4 · เดือนที่ 4', 'พัฒนาโมดูลหลักระยะที่ 2', 'คิวเรียลไทม์ ยืนยันจ่าย | และประวัติ', 2, 1),
    ('ระยะที่ 5 · เดือนที่ 5', 'พัฒนาแดชบอร์ดและการแจ้งเตือน', 'ผลลัพธ์ M5 | ระบบรุ่นสมบูรณ์', 1, 1),
    ('ระยะที่ 6 · เดือนที่ 6', 'ทดสอบและประเมินผล', 'ทดสอบสี่ระดับ ติดตั้งที่ร้าน | และรูปเล่ม', 0, 1),
]
X = [10, 350, 690]
Y = [16, 226]
out = []
add = out.append
add('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
    'font-family="Sarabun, TH Sarabun New, sans-serif">' % (W, H, W, H))
add('<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
    '<path d="M0,0L10,5L0,10z" fill="#333"/></marker></defs>')
add('<rect width="%d" height="%d" fill="#fff"/>' % (W, H))
for t, name, sub, c, r in PH:
    x, y = X[c], Y[r]
    add('<rect x="%d" y="%d" width="%d" height="%d" rx="6" fill="#eef3fb" stroke="#33507a" stroke-width="1.5"/>' % (x, y, BW, BH))
    add('<text x="%d" y="%d" font-size="17" text-anchor="middle" fill="#33507a">%s</text>' % (x + BW / 2, y + 28, t))
    add('<text x="%d" y="%d" font-size="19" font-weight="bold" text-anchor="middle" fill="#111">%s</text>' % (x + BW / 2, y + 55, name))
    for i, part in enumerate(sub.split(' | ')):
        add('<text x="%d" y="%d" font-size="16" text-anchor="middle" fill="#333">%s</text>' % (x + BW / 2, y + 80 + 22 * i, part))

def arr(x1, y1, x2, y2, dash=False):
    add('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#333" stroke-width="1.6" %s marker-end="url(#a)"/>'
        % (x1, y1, x2, y2, 'stroke-dasharray="6 4"' if dash else ''))

arr(X[0] + BW, Y[0] + 50, X[1], Y[0] + 50)
arr(X[1] + BW, Y[0] + 50, X[2], Y[0] + 50)
arr(X[2] + BW / 2, Y[0] + BH, X[2] + BW / 2, Y[1])
arr(X[2], Y[1] + 50, X[1] + BW, Y[1] + 50)
arr(X[1], Y[1] + 50, X[0] + BW, Y[1] + 50)
# ทวนกลับ: พบข้อบกพร่องในระยะหลังแล้วย้อนไปแก้ระยะก่อนหน้า
add('<path d="M%d,%d C%d,%d %d,%d %d,%d" fill="none" stroke="#9a5a12" stroke-width="1.6" stroke-dasharray="6 4" marker-end="url(#a)"/>'
    % (X[0] + 60, Y[1], X[0] + 60, Y[1] - 40, X[1] + 60, Y[0] + BH + 40, X[1] + 60, Y[0] + BH))
add('<text x="%d" y="%d" font-size="16" fill="#9a5a12">ย้อนไปแก้ระยะก่อนหน้าเมื่อพบข้อบกพร่อง</text>' % (X[1] + 85, Y[0] + BH + 42))
add('</svg>')
io.open('fig3-01_process.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('wrote fig3-01_process.svg')
