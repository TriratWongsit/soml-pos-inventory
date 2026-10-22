# -*- coding: utf-8 -*-
# ลำดับการใช้หน้าจอของผู้ใช้แต่ละบทบาท (User Flow) รหัสหน้าจอตรงกับตารางที่ 3.18
# หน้าแรกหลังเข้าสู่ระบบตรงกับ frontend/src/App.jsx และตารางที่ 3.3
# ใช้: python3 fig3-userflow.py แล้ว node render-svg.js fig3-userflow.svg fig3-userflow.png 3
import io

W, H = 1200, 640
BW, BH = 180, 70
out = []
add = out.append
add('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
    'font-family="Sarabun, TH Sarabun New, sans-serif">' % (W, H, W, H))
add('<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
    '<path d="M0,0L10,5L0,10z" fill="#333"/></marker></defs>')
add('<rect width="%d" height="%d" fill="#fff"/>' % (W, H))

LANES = [('พนักงานขาย', 20, 180), ('พนักงานคลังสินค้า', 210, 190), ('ผู้จัดการ', 410, 210)]
for name, y, h in LANES:
    add('<rect x="10" y="%d" width="%d" height="%d" fill="#f7f8fc" stroke="#c8cdd8"/>' % (y, W - 20, h))
    add('<rect x="10" y="%d" width="40" height="%d" fill="#e8e2f5" stroke="#c8cdd8"/>' % (y, h))
    add('<text transform="translate(36,%d) rotate(-90)" font-size="19" font-weight="bold" text-anchor="middle" fill="#111">%s</text>' % (y + h / 2, name))

def box(x, y, code, name, fill='#fdf6e3', stroke='#8a6a12'):
    add('<rect x="%d" y="%d" width="%d" height="%d" rx="6" fill="%s" stroke="%s" stroke-width="1.4"/>' % (x, y, BW, BH, fill, stroke))
    add('<text x="%d" y="%d" font-size="19" font-weight="bold" text-anchor="middle" fill="#111">%s</text>' % (x + BW / 2, y + 28, code))
    add('<text x="%d" y="%d" font-size="18" text-anchor="middle" fill="#111">%s</text>' % (x + BW / 2, y + 52, name))
    return (x, y)

def arr(x1, y1, x2, y2, label=None, lx=0, ly=0):
    add('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#333" stroke-width="1.5" marker-end="url(#a)"/>' % (x1, y1, x2, y2))
    if label:
        add('<text x="%d" y="%d" font-size="16" text-anchor="middle" fill="#333">%s</text>' % (lx, ly, label))

X = [70, 300, 530, 760, 990]
# พนักงานขาย
box(X[0], 75, 'FE-01', 'เข้าสู่ระบบ', '#dbe6f7', '#1a4a8a')
box(X[1], 75, 'FE-02', 'ขายหน้าร้าน')
box(X[2], 75, 'FE-02', 'แสดงรหัสคิวอาร์')
box(X[3], 75, 'ยืนยันรับชำระ', 'บันทึก พิมพ์ ส่งเข้าคิว', '#e8e2f5', '#5a3a8a')
arr(X[0] + BW, 110, X[1], 110)
arr(X[1] + BW, 110, X[2], 110)
arr(X[2] + BW, 110, X[3], 110)
add('<path d="M%d,%d v28 H%d v-28" fill="none" stroke="#333" stroke-width="1.5" marker-end="url(#a)"/>' % (X[3] + BW / 2, 145, X[1] + BW / 2))
add('<text x="%d" y="190" font-size="16" text-anchor="middle" fill="#333">ขายรายการถัดไป</text>' % ((X[1] + X[3]) / 2 + BW / 2))
# พนักงานคลังสินค้า
box(X[0], 270, 'FE-01', 'เข้าสู่ระบบ', '#dbe6f7', '#1a4a8a')
box(X[1], 270, 'FE-03', 'คิวรอจ่ายสินค้า')
box(X[2], 270, 'FE-04', 'ยืนยันจ่ายสินค้า')
box(X[3], 270, 'ยืนยันซ้ำ', 'ตัดสต็อก ส่งมอบสำเร็จ', '#e8e2f5', '#5a3a8a')
box(X[4], 270, 'FE-05 · FE-08', 'แดชบอร์ด · แจ้งเตือน')
arr(X[0] + BW, 305, X[1], 305)
arr(X[1] + BW, 305, X[2], 305)
arr(X[2] + BW, 305, X[3], 305)
add('<path d="M%d,%d v28 H%d v-28" fill="none" stroke="#333" stroke-width="1.5" marker-end="url(#a)"/>' % (X[3] + BW / 2, 340, X[1] + BW / 2))
add('<text x="%d" y="385" font-size="16" text-anchor="middle" fill="#333">กลับคิว รายการหายจากคิวทุกเครื่อง</text>' % ((X[1] + X[3]) / 2 + BW / 2))
add('<text x="%d" y="260" font-size="16" text-anchor="middle" fill="#333">เมนูด้านข้าง</text>' % (X[4] + BW / 2))
# ผู้จัดการ
box(X[0], 470, 'FE-01', 'เข้าสู่ระบบ', '#dbe6f7', '#1a4a8a')
box(X[1], 470, 'FE-05', 'แดชบอร์ดปฏิบัติการ')
box(X[2], 430, 'FE-07', 'จัดการข้อมูลสินค้า')
box(X[2], 520, 'FE-08', 'การแจ้งเตือน')
box(X[3], 430, 'FE-09', 'ประวัติการทำรายการ')
box(X[3], 520, 'FE-06', 'แดชบอร์ดระดับบริหาร')
box(X[4], 475, 'FE-02 ถึง FE-04', 'ทำงานแทนพนักงาน')
arr(X[0] + BW, 505, X[1], 505)
arr(X[1] + BW, 495, X[2], 465)
arr(X[1] + BW, 515, X[2], 555)
add('<text x="%d" y="625" font-size="16" text-anchor="middle" fill="#333">ลิงก์จากกล่องต้องดูแลวันนี้และเมนูด้านข้าง เปิดได้ทุกหน้าจอของผู้จัดการ</text>' % (W / 2))
add('</svg>')
io.open('fig3-userflow.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('wrote fig3-userflow.svg')
