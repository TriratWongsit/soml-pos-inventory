# -*- coding: utf-8 -*-
"""แผนภาพขนาดใหญ่สำหรับสไลด์ (วาดเป็น SVG แนวนอน ตัวหนังสือใหญ่ อ่านได้จากหลังห้อง)
เนื้อหาตรงกับรูปในเล่ม: Use Case รูปที่ 3.2 · C1 รูปที่ 3.3 · C2 รูปที่ 3.4 · ER รูปที่ 3.7"""
import math

W, H = 1768, 800
FONT = "font-family=\"'Noto Sans Thai',sans-serif\""
NAVY, ORANGE, GREEN, BROWN = '#0F4C81', '#F28C28', '#2E7D4F', '#9A5A12'


def svg(body, h=H):
    defs = ('<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" orient="auto">'
            '<path d="M0,0L10,5L0,10z" fill="#33414f"/></marker>'
            '<marker id="op" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" orient="auto">'
            '<path d="M0,0L10,5L0,10" fill="none" stroke="#33414f" stroke-width="1.6"/></marker></defs>')
    return '<svg viewBox="0 0 %d %d" width="%d" height="%d" %s>%s%s</svg>' % (W, h, W, h, FONT, defs, body)


def text(x, y, s, size=22, weight=400, color='#1b2430', anchor='middle'):
    return '<text x="%d" y="%d" font-size="%d" font-weight="%d" fill="%s" text-anchor="%s">%s</text>' % (x, y, size, weight, color, anchor, s)


def label(x, y, s, size=20):
    w = len(s) * size * 0.52 + 16
    return ('<rect x="%d" y="%d" width="%d" height="%d" rx="8" fill="#fff" stroke="#cdd5df"/>' % (x - w / 2, y - size, w, size + 12)
            + text(x, y, s, size, 600, '#33414f'))


def arrow(x1, y1, x2, y2, dash=False, marker='ar', w=2.4):
    return '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#33414f" stroke-width="%s"%s marker-end="url(#%s)"/>' % (
        x1, y1, x2, y2, w, ' stroke-dasharray="10 7"' if dash else '', marker)


def actor(x, y, name, color=GREEN):
    s = ('<circle cx="%d" cy="%d" r="17" fill="#fff" stroke="%s" stroke-width="3"/>' % (x, y, color) +
         '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>' % (x, y + 17, x, y + 66, color) +
         '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>' % (x - 28, y + 36, x + 28, y + 36, color) +
         '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>' % (x, y + 66, x - 22, y + 100, color) +
         '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>' % (x, y + 66, x + 22, y + 100, color))
    return s + text(x, y + 134, name, 25, 700)


# ---------------------------------------------------------------- Use Case
UC = {'UC-03': ('สร้างคำสั่งซื้อและออกใบเสร็จ', 560, 85), 'UC-01': ('เข้าสู่ระบบและควบคุมสิทธิ์', 560, 205),
      'UC-05': ('ดูคิวรอจ่ายสินค้าแบบเรียลไทม์', 560, 325), 'UC-06': ('ปรับสถานะการจัดของในคิว', 560, 445),
      'UC-07': ('ยืนยันจ่ายสินค้าและตัดสต็อก', 560, 735),
      'UC-04': ('สร้างเลขที่คำสั่งซื้อไม่ซ้ำ', 1000, 85), 'UC-08': ('แดชบอร์ดปฏิบัติการ', 1000, 560), 'UC-11': ('รับการแจ้งเตือนในแอป', 1000, 680),
      'UC-02': ('จัดการสินค้าและจุดสั่งซื้อเพิ่ม', 1440, 85), 'UC-09': ('แดชบอร์ดระดับบริหาร', 1440, 205), 'UC-10': ('ค้นหาประวัติการทำรายการ', 1440, 325)}
URX, URY = 192, 48
UACT = {'sales': ('พนักงานขาย', 130, 70), 'wh': ('พนักงานคลังสินค้า', 130, 505), 'mgr': ('ผู้จัดการ', 1690, 200), 'sys': ('ระบบอัตโนมัติ', 1690, 620)}
UASSOC = [('sales', 'UC-01'), ('sales', 'UC-03'), ('wh', 'UC-01'), ('wh', 'UC-05'), ('wh', 'UC-06'), ('wh', 'UC-07'), ('wh', 'UC-08'), ('wh', 'UC-11'),
          ('mgr', 'UC-08'), ('mgr', 'UC-11'), ('mgr', 'UC-02'), ('mgr', 'UC-09'), ('mgr', 'UC-10'), ('sys', 'UC-11')]


def _edge(cx, cy, tx, ty):
    a = math.atan2(ty - cy, tx - cx)
    k = 1 / math.sqrt((math.cos(a) / URX) ** 2 + (math.sin(a) / URY) ** 2)
    return cx + k * math.cos(a), cy + k * math.sin(a)


def usecase():
    b = ['<rect x="320" y="18" width="1340" height="776" rx="14" fill="#F6F8FC" stroke="#5a6b8a" stroke-width="2.5"/>',
         text(1440, 560, 'ระบบอำพร OMS', 34, 800, NAVY), text(1440, 600, '(System Boundary)', 20, 600, '#5b6876')]
    for a, u in UASSOC:
        _, ax, ay = UACT[a]
        _, cx, cy = UC[u]
        sx = ax + (40 if ax < cx else -40)
        sy = ay + 50
        ex, ey = _edge(cx, cy, sx, sy)
        b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#5b6876" stroke-width="2.2"/>' % (sx, sy, ex, ey))
    sx, sy = UC['UC-03'][1] + URX, UC['UC-03'][2]
    b.append(arrow(sx, sy, UC['UC-04'][1] - URX, sy, dash=True, marker='op'))
    b.append(text((sx + UC['UC-04'][1] - URX) / 2, sy + 34, '«include»', 19, 700, '#33414f'))
    for code, (name, cx, cy) in UC.items():
        b.append('<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="#FFF7E6" stroke="%s" stroke-width="2.4"/>' % (cx, cy, URX, URY, BROWN))
        b.append(text(cx, cy - 6, code, 23, 800, NAVY))
        b.append(text(cx, cy + 25, name, 21))
    for k, (name, x, y) in UACT.items():
        b.append(actor(x, y, name, '#6b7380' if k == 'sys' else GREEN))
    return svg(''.join(b))


# ---------------------------------------------------------------- C1
def box(x, y, w, h, title, kind, desc, fill, stroke, tsize=27):
    lines = desc if isinstance(desc, list) else [desc]
    s = '<rect x="%d" y="%d" width="%d" height="%d" rx="16" fill="%s" stroke="%s" stroke-width="3"/>' % (x, y, w, h, fill, stroke)
    cy = y + h / 2 - (len(lines) + 1) * 17 + 8
    s += text(x + w / 2, cy, title, tsize, 800)
    s += text(x + w / 2, cy + 34, kind, 21, 600, '#5b6876')
    for i, l in enumerate(lines):
        s += text(x + w / 2, cy + 72 + i * 34, l, 24)
    return s


PERSON = ('#E8F3EA', GREEN)
SYSTEM = ('#DCE8F7', NAVY)
EXT = ('#FBEBD9', BROWN)


def c1():
    b = []
    people = [('พนักงานขาย', 'ขาย รับชำระด้วย QR พิมพ์ใบเสร็จ', 30), ('พนักงานคลังสินค้า', 'ดูคิว ยืนยันจ่ายสินค้า', 290), ('ผู้จัดการ', 'แดชบอร์ด ประวัติ แจ้งเตือน', 550)]
    for n, d, y in people:
        b.append(box(20, y, 400, 200, n, '[Person]', d, *PERSON))
        b.append(arrow(420, y + 100, 640, 400))
    b.append(label(520, 230, 'ใช้ผ่านเบราว์เซอร์ (HTTP)', 20))
    b.append(box(650, 250, 520, 300, 'ระบบอำพร OMS', '[Software System]', ['ระบบจัดการคำสั่งซื้อ', 'และตรวจสอบคลังสินค้า', 'เว็บแอปพลิเคชันแบบ 3 ชั้น'], *SYSTEM, tsize=34))
    b.append(box(1340, 90, 410, 220, 'PromptPay QR Library', '[External System]', 'สร้าง QR มาตรฐาน EMVCo', *EXT))
    b.append(box(1340, 490, 410, 220, 'เครื่องพิมพ์ใบเสร็จความร้อน', '[External Hardware]', 'พิมพ์ใบเสร็จภาษาไทย', *EXT, tsize=25))
    b.append(arrow(1170, 330, 1336, 220)); b.append(label(1255, 250, 'ขอสร้าง QR ตามยอด', 20))
    b.append(arrow(1170, 470, 1336, 590)); b.append(label(1255, 560, 'ส่งคำสั่งพิมพ์ ESC/POS', 20))
    b.append(text(910, 640, 'ไม่เชื่อมธนาคาร · ลูกค้าสแกน QR จ่ายผ่านแอปธนาคารของตัวเอง', 22, 600, '#B5531A'))
    return svg(''.join(b))


# ---------------------------------------------------------------- C2
CONT = ('#DCE8F7', NAVY)


def c2():
    b = ['<rect x="300" y="14" width="1462" height="560" rx="18" fill="none" stroke="#7d8fa8" stroke-width="2.5" stroke-dasharray="12 8"/>',
         text(1030, 48, 'ขอบเขตระบบอำพร OMS (4 หน่วยติดตั้ง)', 23, 800, '#5b6876')]
    for i, n in enumerate(['พนักงานขาย', 'พนักงานคลัง', 'ผู้จัดการ']):
        y = 110 + i * 150
        b.append(box(10, y, 230, 110, n, '[Person]', [], *PERSON, tsize=25))
        b.append(arrow(240, y + 55, 336, 300))
    b.append(label(288, 95, 'HTTP', 20))
    b.append(box(340, 150, 380, 300, 'Frontend', '[React + Vite]', ['หน้าขาย · คิวคลัง', 'แดชบอร์ด', 'ใช้บนมือถือได้'], *CONT, tsize=32))
    b.append(box(850, 150, 400, 300, 'Backend API', '[Node.js + Express]', ['ตรรกะธุรกิจ · ตรวจสิทธิ์', 'ตัดสต็อกแบบอะตอมมิก', 'แจ้งเตือน · ผลักข้อมูลสด'], *CONT, tsize=32))
    b.append(arrow(720, 240, 846, 240)); b.append(label(785, 222, 'REST API', 20))
    b.append(arrow(850, 370, 724, 370)); b.append(label(785, 410, 'WebSocket · สำรอง SSE', 19))
    b.append(box(1380, 70, 370, 210, 'Database', '[MySQL 8 InnoDB]', ['7 ตาราง · ACID Transaction'], '#DDF0EA', '#136055', tsize=30))
    b.append(box(1380, 330, 370, 210, 'Print Service', '[Node.js + ESC/POS]', ['รับคำสั่งพิมพ์จาก Backend'], *CONT, tsize=30))
    b.append(arrow(1250, 220, 1376, 175)); b.append(label(1312, 170, 'SQL', 20))
    b.append(arrow(1250, 400, 1376, 430)); b.append(label(1312, 460, 'สั่งพิมพ์', 20))
    b.append(box(850, 610, 400, 170, 'PromptPay QR Library', '[External Library]', ['สร้าง QR ตามยอด'], *EXT, tsize=25))
    b.append(box(1380, 610, 370, 170, 'เครื่องพิมพ์ความร้อน', '[External Hardware]', ['ESC/POS ผ่าน USB'], *EXT, tsize=25))
    b.append(arrow(1050, 450, 1050, 606))
    b.append(arrow(1565, 540, 1565, 606))
    return svg(''.join(b))


# ---------------------------------------------------------------- ER
TABLES = {
    'users': ('ผู้ใช้', 10, 20, [('user_id', 'PK'), ('username', 'UK'), ('password_hash', ''), ('full_name', ''), ('role', ''), ('is_active', '')]),
    'orders': ('คำสั่งซื้อ', 462, 20, [('order_id', 'PK'), ('order_no', 'UK'), ('total_amount', ''), ('status', ''), ('created_by', 'FK'), ('paid_at', ''),
                                         ('dispatched_by', 'FK'), ('dispatched_at', '')]),
    'order_items': ('รายการในคำสั่งซื้อ', 914, 20, [('order_item_id', 'PK'), ('order_id', 'FK'), ('product_id', 'FK'), ('qty', ''), ('unit_price', ''), ('line_total', '')]),
    'products': ('สินค้า', 1358, 20, [('product_id', 'PK'), ('sku', 'UK'), ('name', ''), ('unit', ''), ('price', ''), ('stock_qty', ''), ('reorder_point', ''), ('is_active', '')]),
    'audit_logs': ('ประวัติการทำรายการ', 10, 455, [('log_id', 'PK'), ('user_id', 'FK'), ('action', ''), ('entity_type', ''), ('entity_id', ''), ('ip_address', ''), ('created_at', '')]),
    'stock_movements': ('สต็อกเข้าออก', 462, 455, [('movement_id', 'PK'), ('product_id', 'FK'), ('order_id', 'FK'), ('change_qty', ''), ('balance_after', ''), ('reason', ''), ('created_by', 'FK')]),
    'notifications': ('การแจ้งเตือน', 1358, 455, [('notification_id', 'PK'), ('type', ''), ('ref_product_id', 'FK'), ('ref_order_id', 'FK'), ('message', ''), ('is_read', '')]),
}
TW, RH, HH = 400, 37, 54
REL = [('users', 'orders', 'r', 'l'), ('orders', 'order_items', 'r', 'l'), ('products', 'order_items', 'l', 'r'),
       ('users', 'audit_logs', 'b', 't'), ('orders', 'stock_movements', 'b', 't'), ('products', 'notifications', 'b', 't'),
       ('users', 'stock_movements', 'br', 'tl'), ('products', 'stock_movements', 'bl', 'tr'), ('orders', 'notifications', 'br', 'tl')]


def _pt(t, side):
    _, x, y, cols = TABLES[t]
    h = HH + RH * len(cols)
    return {'r': (x + TW, y + HH + RH * 0.5), 'l': (x, y + HH + RH * 0.5), 'b': (x + TW / 2, y + h), 't': (x + TW / 2, y),
            'br': (x + TW - 40, y + h), 'bl': (x + 40, y + h), 'tl': (x + 40, y), 'tr': (x + TW - 40, y)}[side]


def er():
    b = []
    for a, c, sa, sc in REL:
        x1, y1 = _pt(a, sa)
        x2, y2 = _pt(c, sc)
        b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#5b6876" stroke-width="2.6"/>' % (x1, y1, x2, y2))
        if sa in ('r', 'l'):  # ตารางติดกันแนวนอน ช่องแคบ ใส่ 1 กับ N เหนือเส้น
            d = 1 if x2 > x1 else -1
            b.append(text(x1 + d * 10, y1 - 8, '1', 22, 800, NAVY))
            b.append(text(x2 - d * 10, y2 - 8, 'N', 20, 800, ORANGE))
            continue
        f1 = 0.14
        for f, t, c in ((f1, '1', NAVY), (1 - f1, 'N', ORANGE)):
            cx, cy = x1 + (x2 - x1) * f, y1 + (y2 - y1) * f
            b.append('<circle cx="%d" cy="%d" r="17" fill="%s"/>' % (cx, cy, c))
            b.append(text(cx, cy + 7, t, 19, 800, '#fff'))
    for t, (th, x, y, cols) in TABLES.items():
        h = HH + RH * len(cols)
        b.append('<rect x="%d" y="%d" width="%d" height="%d" rx="10" fill="#fff" stroke="%s" stroke-width="2.5"/>' % (x, y, TW, h, NAVY))
        b.append('<path d="M%d %d h%d v%d h-%d z" fill="%s"/>' % (x, y + 10, TW, HH - 10, TW, NAVY))
        b.append('<rect x="%d" y="%d" width="%d" height="20" rx="10" fill="%s"/>' % (x, y, TW, NAVY))
        b.append(text(x + 16, y + 37, t, 25, 800, '#fff', 'start') + text(x + TW - 14, y + 36, th, 19, 600, '#cfe0f2', 'end'))
        for i, (c, k) in enumerate(cols):
            yy = y + HH + RH * i
            if i % 2:
                b.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#F4F6F9"/>' % (x + 2, yy, TW - 4, RH))
            col = {'PK': '#B5531A', 'FK': NAVY, 'UK': '#2E7D4F'}.get(k, '#1b2430')
            b.append(text(x + 16, yy + 27, c, 22, 700 if k else 400, col, 'start'))
            if k:
                b.append(text(x + TW - 16, yy + 27, k, 19, 800, col, 'end'))
    b.append(text(1130, 640, '1 ──── N', 26, 800, NAVY) + text(1130, 676, 'หนึ่งแถว ↔ หลายแถว', 20, 600, '#5b6876'))
    b.append(text(1130, 720, 'PK คีย์หลัก · FK คีย์นอก · UK ห้ามซ้ำ', 20, 600, '#5b6876'))
    return svg(''.join(b))
