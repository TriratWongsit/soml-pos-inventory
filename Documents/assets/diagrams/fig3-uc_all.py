# -*- coding: utf-8 -*-
# แผนภาพกรณีการใช้งานรวมทั้งระบบ ตามสัญลักษณ์ยูเอ็มแอล: ผู้กระทำอยู่นอกกรอบระบบ กรณีการใช้งานเป็นวงรี
# ชื่อกรณีการใช้งานตรงกับตารางที่ 3.8 ผู้จัดการรับสิทธิ์ของพนักงานขายและพนักงานคลังสินค้า (เส้นหัวสามเหลี่ยมโปร่ง)
# ใช้: python3 fig3-uc_all.py แล้ว node render-svg.js fig3-uc_all.svg fig3-uc_all.png 3
import io, math

W, H = 1010, 1190
UC = {  # รหัส: (ชื่อ, cx, cy)
    'UC-01': ('เข้าสู่ระบบและควบคุมสิทธิ์ตามบทบาท', 440, 80),
    'UC-03': ('สร้างคำสั่งซื้อและออกใบเสร็จ', 440, 190),
    'UC-04': ('สร้างเลขที่คำสั่งซื้อไม่ซ้ำอัตโนมัติ', 720, 272),
    'UC-05': ('ดูคิวรอจ่ายสินค้าแบบเรียลไทม์', 440, 360),
    'UC-06': ('ปรับสถานะการจัดของในคิวงาน', 440, 460),
    'UC-07': ('ยืนยันจ่ายสินค้าและตัดสต็อก', 440, 560),
    'UC-08': ('แสดงแดชบอร์ดปฏิบัติการ', 440, 670),
    'UC-11': ('รับการแจ้งเตือนภายในแอปพลิเคชัน', 440, 780),
    'UC-02': ('จัดการข้อมูลสินค้าและจุดสั่งซื้อเพิ่ม', 440, 890),
    'UC-09': ('แสดงแดชบอร์ดระดับบริหาร', 440, 990),
    'UC-10': ('ค้นหาและดูประวัติการทำรายการ', 440, 1090),
}
RX, RY = 165, 40
ACT = {  # ชื่อ, x, y (ตำแหน่งศีรษะ)
    'sales': ('พนักงานขาย', 120, 105),
    'wh': ('พนักงานคลังสินค้า', 120, 465),
    'mgr': ('ผู้จัดการ', 120, 940),
    'sys': ('ระบบอัตโนมัติ', 935, 742),
}
ASSOC = [('sales', 'UC-01'), ('sales', 'UC-03'),
         ('wh', 'UC-01'), ('wh', 'UC-05'), ('wh', 'UC-06'), ('wh', 'UC-07'), ('wh', 'UC-08'), ('wh', 'UC-11'),
         ('mgr', 'UC-08'), ('mgr', 'UC-11'), ('mgr', 'UC-02'), ('mgr', 'UC-09'), ('mgr', 'UC-10'),
         ('sys', 'UC-11')]

out = []
add = out.append
add('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
    'font-family="Sarabun, TH Sarabun New, sans-serif">' % (W, H, W, H))
add('<defs><marker id="open" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto">'
    '<path d="M0,0L10,5L0,10" fill="none" stroke="#333" stroke-width="1.3"/></marker>'
    '<marker id="tri" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="14" markerHeight="14" orient="auto">'
    '<path d="M0,0L12,6L0,12z" fill="#fff" stroke="#333" stroke-width="1.2"/></marker></defs>')
add('<rect width="%d" height="%d" fill="#fff"/>' % (W, H))
add('<rect x="250" y="20" width="650" height="%d" fill="#f7f8fc" stroke="#5a6b8a" stroke-width="1.5"/>' % (H - 50))
add('<text x="%d" y="44" font-size="20" font-weight="bold" text-anchor="middle" fill="#222">ระบบอำพร OMS</text>' % 575)

def edge_pt(code, tx, ty):
    """จุดบนขอบวงรีที่หันไปทางจุด (tx, ty)"""
    _, cx, cy = UC[code]
    a = math.atan2(ty - cy, tx - cx)
    return cx + RX * math.cos(a), cy + RY * math.sin(a)

def actor_pt(k, tx, ty):
    _, x, y = ACT[k]
    return (x + 24 if tx > x else x - 24), y + 40

for a, u in ASSOC:
    _, ux, uy = UC[u]
    ax, ay = actor_pt(a, ux, uy)
    ex, ey = ux - RX, uy   # ต่อที่จุดซ้ายสุดของวงรี เส้นจึงไม่ลอดใต้วงรีอื่น
    if a == 'sys':
        ex = ux + RX
    add('<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1.4"/>' % (ax, ay, ex, ey))

# UC-03 รวม UC-04 เสมอ («include»)
sx, sy = edge_pt('UC-03', 720, 260)
ex, ey = edge_pt('UC-04', 440, 190)
add('<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1.4" stroke-dasharray="7 5" marker-end="url(#open)"/>' % (sx, sy, ex, ey))
add('<text x="%.0f" y="%.0f" font-size="17" fill="#333">«include»</text>' % ((sx + ex) / 2 + 8, (sy + ey) / 2 - 6))

# ผู้จัดการรับบทบาทของพนักงานคลังสินค้าและพนักงานขาย (generalization)
add('<line x1="120" y1="938" x2="120" y2="580" stroke="#333" stroke-width="1.4" marker-end="url(#tri)"/>')
add('<polyline points="96,975 40,975 40,150 90,150" fill="none" stroke="#333" stroke-width="1.4" marker-end="url(#tri)"/>')

for code, (name, cx, cy) in UC.items():
    add('<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="#fdf6e3" stroke="#8a6a12" stroke-width="1.5"/>' % (cx, cy, RX, RY))
    add('<text x="%d" y="%d" font-size="19" font-weight="bold" text-anchor="middle" fill="#111">%s</text>' % (cx, cy - 4, code))
    add('<text x="%d" y="%d" font-size="18" text-anchor="middle" fill="#111">%s</text>' % (cx, cy + 20, name))

for k, (name, x, y) in ACT.items():
    s = '#1f5a2e'
    add('<circle cx="%d" cy="%d" r="11" fill="#fff" stroke="%s" stroke-width="1.8"/>' % (x, y, s))
    add('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.8"/>' % (x, y + 11, x, y + 46, s))
    add('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.8"/>' % (x - 18, y + 24, x + 18, y + 24, s))
    add('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.8"/>' % (x, y + 46, x - 15, y + 70, s))
    add('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.8"/>' % (x, y + 46, x + 15, y + 70, s))
    add('<text x="%d" y="%d" font-size="19" text-anchor="middle" fill="#111">%s</text>' % (x, y + 92, name))

add('</svg>')
io.open('fig3-uc_all.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('wrote fig3-uc_all.svg')
