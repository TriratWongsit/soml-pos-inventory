# -*- coding: utf-8 -*-
"""แผนภาพในเล่มที่ต้องอ่านได้บนกระดาษ A4 แนวตั้ง          [แก้ตามกรรมการสอบ 16 ต.ค. 2569]

อ.นริศ และ อ.นุรักษ์ ทำเครื่องหมายว่ารูปที่ 3.7 (ER) และ 3.9 (Sequence UC-07) อ่านไม่ออก และขอให้วาด C1 C2 ให้ชัด
เพราะภาพจาก Mermaid กว้างมาก พอย่อลงกว้าง 14.5 ซม. ตัวหนังสือเหลือราว 4 พอยต์และเส้นสีจาง
ไฟล์นี้วาดใหม่เป็น SVG แนวตั้ง กว้าง 1000 หน่วย ตัวหนังสือ 19-21 หน่วย (ราว 8-9 พอยต์บนกระดาษ)
เนื้อหาเหมือนไฟล์ .mmd เดิมทุกบรรทัด (ตาราง คอลัมน์ ความสัมพันธ์ และลำดับข้อความ)

    python3 book_diagrams.py      # ได้ fig3-02 (C1) fig3-03 (C2) fig3-05 (ER) fig3-10 fig3-11 (Sequence)
"""
import os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "font-family=\"'Sarabun','TH Sarabun New',sans-serif\""
INK, MUTED, NAVY, ORANGE, LINE = '#111827', '#4b5563', '#0F4C81', '#B5531A', '#374151'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text(x, y, s, size=20, weight=400, color=INK, anchor='middle'):
    return '<text x="%.1f" y="%.1f" font-size="%d" font-weight="%d" fill="%s" text-anchor="%s">%s</text>' % (
        x, y, size, weight, color, anchor, esc(s))


def svg(w, h, body):
    defs = ('<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">'
            '<path d="M0,0L10,5L0,10z" fill="%s"/></marker>'
            '<marker id="op" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto">'
            '<path d="M0,0L10,5L0,10" fill="none" stroke="%s" stroke-width="1.8"/></marker></defs>') % (LINE, LINE)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" %s>'
            '<rect width="100%%" height="100%%" fill="#fff"/>%s%s</svg>') % (w, h, w, h, FONT, defs, body)


# ---------------------------------------------------------------- Sequence
def sequence(parts, steps, W=1000):
    """parts: [(key, ชื่อบรรทัดที่ 1, บรรทัดที่ 2 หรือ '', x, actor?)]
    steps: ('m', จาก, ถึง, ข้อความ, เส้นประ?) · ('note', จาก, ถึง, ข้อความ) · ('box', ชื่อ) ... ('else', ชื่อ) ... ('end',)"""
    X = {k: x for k, _, _, x, _ in parts}
    top, row, b = 128, 44, []
    y = top + 30
    n = 0
    boxes = []                              # [y เริ่ม, ชื่อ, [y ของ else]]
    body = []
    for st in steps:
        if st[0] == 'box':
            boxes.append([y, st[1], [], st[2] if len(st) > 2 else (90, W - 10)])
            y += 78
        elif st[0] == 'else':
            boxes[-1][2].append((y - 14, st[1]))
            y += 64
        elif st[0] == 'end':
            y0, label, elses, (bx0, bx1) = boxes.pop()
            b.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#E8F0F8" fill-opacity="0.45" stroke="%s" stroke-width="1.6" stroke-dasharray="6 4"/>'
                     % (bx0, y0, bx1 - bx0, y - y0 - 14, NAVY))
            b.append(text(bx0 + 10, y0 + 30, label, 19, 700, NAVY, 'start'))
            for ey, el in elses:
                b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.6" stroke-dasharray="6 4"/>' % (bx0, ey, bx1, ey, NAVY))
                b.append(text(bx0 + 10, ey + 30, el, 19, 700, NAVY, 'start'))
            y += 34
        elif st[0] == 'note':
            _, a, c, msg = st
            x0, x1 = min(X[a], X[c]) - 60, max(X[a], X[c]) + 60
            lines = msg.split('\n')
            h = 14 + 26 * len(lines)
            body.append('<rect x="%d" y="%d" width="%d" height="%d" rx="6" fill="#FFF7E6" stroke="%s" stroke-width="1.4"/>'
                        % (x0, y - 18, x1 - x0, h, ORANGE))
            for i, l in enumerate(lines):
                body.append(text((x0 + x1) / 2, y + 6 + 26 * i, l, 19, 600, INK))
            y += h + 20
        else:
            _, a, c, msg, dash = st
            n += 1
            lines = msg.split('\n')
            y += 26 * (len(lines) - 1)
            x1, x2 = X[a], X[c]
            if a == c:                      # ข้อความถึงตัวเอง
                body.append('<path d="M%d %d h48 v24 h-44" fill="none" stroke="%s" stroke-width="2"%s marker-end="url(#ar)"/>'
                            % (x1, y - 12, LINE, ' stroke-dasharray="7 5"' if dash else ''))
                right = x1 < W / 2           # ข้อความอยู่ฝั่งที่มีที่ว่าง ไม่ให้ล้นขอบภาพ
                for i, l in enumerate(lines):
                    body.append(text(x1 + 58 if right else x1 - 18, y - 26 * (len(lines) - 1 - i) + 6, l, 19, 400, INK,
                                     'start' if right else 'end'))
                y += 24
            else:
                d = 1 if x2 > x1 else -1
                body.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="2"%s marker-end="url(#%s)"/>'
                            % (x1, y, x2 - d * 2, y, LINE, ' stroke-dasharray="7 5"' if dash else '', 'op' if dash else 'ar'))
                # ข้อความเริ่มจากต้นลูกศร อ่านไปทางเดียวกับลูกศร (ยาวเกินเส้นได้เพราะแต่ละแถวมีข้อความเดียว)
                # ลูกศรไปทางขวา: ข้อความเริ่มหลังวงกลมเลขลำดับ · ไปทางซ้าย: เริ่มหลังหัวลูกศร ไม่ล้นขอบซ้าย
                tx = x1 + 30 if d > 0 else x2 + 20
                anchor = 'start'
                for i, l in enumerate(lines):
                    body.append(text(tx, y - 10 - 26 * (len(lines) - 1 - i), l, 19, 400, INK, anchor))
            body.append('<circle cx="%d" cy="%d" r="12" fill="%s"/>' % (x1, y, NAVY))
            body.append(text(x1, y + 6, str(n), 14, 700, '#fff'))
            y += row
    H = y + 20
    for k, l1, l2, x, is_actor in parts:  # เส้นชีวิตวาดก่อน ข้อความวาดทับ
        b.insert(0, '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#9ca3af" stroke-width="1.6" stroke-dasharray="3 4"/>' % (x, top, x, H - 10))
        if is_actor:
            b.append('<circle cx="%d" cy="22" r="13" fill="#fff" stroke="%s" stroke-width="2.5"/>' % (x, INK)
                     + '<path d="M%d 35 v30 M%d 46 h40 M%d 65 l-16 22 M%d 65 l16 22" stroke="%s" stroke-width="2.5" fill="none"/>'
                     % (x, x - 20, x, x, INK))
            b.append(text(x, 112, l1, 19, 700))
        else:
            w = 136
            b.append('<rect x="%d" y="18" width="%d" height="%d" rx="6" fill="#E8F0F8" stroke="%s" stroke-width="2"/>' % (x - w / 2, w, 92, NAVY))
            if l2:
                b.append(text(x, 58, l1, 17, 700) + text(x, 84, l2, 16, 400, MUTED))
            else:
                b.append(text(x, 70, l1, 17, 700))
    return svg(W, H, ''.join(b + body))


SEQ_UC07 = sequence(
    [('W', 'พนักงานคลัง', '', 62, True), ('UI', 'หน้าจอคิว', 'คลังสินค้า', 185, False),
     ('API', 'Backend API', 'Dispatch', 310, False), ('SVC', 'Stock', 'Deduction', 460, False),
     ('AL', 'Alert Engine', '', 600, False), ('MUI', 'หน้าจอ', 'ผู้จัดการ', 740, False),
     ('DB', 'MySQL', '(InnoDB)', 920, False)],
    [('m', 'W', 'UI', 'เลือกคำสั่งซื้อจากคิว', False),
     ('m', 'UI', 'API', 'GET /api/orders/:id', False),
     ('m', 'API', 'DB', 'SELECT orders + order_items', False),
     ('m', 'DB', 'API', 'รายการสินค้าของคำสั่งซื้อ', True),
     ('m', 'API', 'UI', 'แสดงรายการให้ตรวจสอบ', True),
     ('m', 'W', 'UI', 'ตรวจสินค้าแล้วกดยืนยันจ่าย', False),
     ('m', 'UI', 'API', 'POST /api/orders/:id/dispatch', False),
     ('m', 'API', 'SVC', 'เรียกธุรกรรมตัดสต็อก', False),
     ('m', 'SVC', 'DB', 'START TRANSACTION', False),
     ('m', 'SVC', 'DB', "UPDATE orders SET status='delivered' WHERE order_id=?\nAND status IN ('awaiting_dispatch','picking')", False),
     ('box', 'alt  เปลี่ยนสถานะได้ 1 แถว และหักยอดได้ครบทุกรายการ', (100, 990)),
     ('m', 'SVC', 'DB', 'SELECT order_items ORDER BY product_id', False),
     ('m', 'SVC', 'DB', 'UPDATE products SET stock_qty = stock_qty - qty\nWHERE stock_qty >= qty (ล็อกแถวสินค้าจนจบธุรกรรม)', False),
     ('m', 'SVC', 'DB', 'INSERT stock_movements (sale_dispatch)', False),
     ('m', 'SVC', 'DB', 'INSERT audit_logs (CONFIRM_DISPATCH)', False),
     ('m', 'SVC', 'DB', 'COMMIT', False),
     ('m', 'SVC', 'API', 'ส่งมอบสำเร็จ', True),
     ('m', 'API', 'UI', 'ลบคำสั่งซื้อออกจากคิว', False),
     ('m', 'API', 'AL', 'ตรวจ stock_qty เทียบ reorder_point', False),
     ('m', 'AL', 'DB', 'INSERT notifications (low_stock)', False),
     ('m', 'AL', 'MUI', 'แจ้งเตือนในแอป', False),
     ('else', 'เปลี่ยนสถานะได้ 0 แถว (ถูกจ่ายไปแล้ว E1)'),
     ('m', 'SVC', 'DB', 'ROLLBACK', False),
     ('m', 'SVC', 'API', 'ปฏิเสธการจ่ายซ้ำ', True),
     ('m', 'API', 'UI', 'แจ้ง "คำสั่งซื้อนี้ถูกจ่ายไปแล้ว"', True),
     ('else', 'หักยอดได้ 0 แถว (สต็อกไม่พอ E2)'),
     ('m', 'SVC', 'DB', 'ROLLBACK (สถานะและยอดที่หักไปแล้วย้อนกลับทั้งหมด)', False),
     ('m', 'API', 'UI', 'แจ้ง "สต็อกไม่พอ"', True),
     ('end',),
     ('m', 'UI', 'W', 'แสดงผลลัพธ์', True)])

SEQ_UC03 = sequence(
    [('S', 'พนักงานขาย', '', 62, True), ('UI', 'หน้าจอ POS', '(React)', 185, False),
     ('API', 'Backend API', 'Order', 330, False), ('QR', 'PromptPay', 'QR Module', 480, False),
     ('P', 'Print', 'Service', 610, False), ('WUI', 'หน้าจอคิว', 'คลังสินค้า', 750, False),
     ('DB', 'MySQL', '', 920, False)],
    [('m', 'S', 'UI', 'เลือกสินค้าและระบุจำนวน', False),
     ('m', 'UI', 'API', 'POST /api/orders/quote', False),
     ('m', 'API', 'DB', 'SELECT ราคาปัจจุบันของสินค้า', False),
     ('m', 'DB', 'API', 'ราคาต่อหน่วย', True),
     ('m', 'API', 'API', 'คำนวณยอดรวมจากราคาในฐานข้อมูล', False),
     ('m', 'API', 'QR', 'ขอสร้าง QR ตามยอดชำระ', False),
     ('m', 'QR', 'API', 'ข้อมูล QR มาตรฐาน EMVCo', True),
     ('m', 'API', 'UI', 'ยอดรวม + QR Code', True),
     ('m', 'UI', 'S', 'แสดง QR พร้อมเพย์', True),
     ('note', 'S', 'UI', 'ลูกค้าสแกนและโอนเงิน\nผ่านแอปธนาคาร'),
     ('m', 'S', 'UI', 'กดยืนยันรับชำระเงิน', False),
     ('m', 'UI', 'API', 'POST /api/orders', False),
     ('box', 'ธุรกรรมเดียว: เขียนคำสั่งซื้อเมื่อรับชำระแล้วเท่านั้น', (250, 990)),
     ('m', 'API', 'DB', 'START TRANSACTION', False),
     ('m', 'API', 'DB', 'สร้างเลขที่คำสั่งซื้อไม่ซ้ำ (UC-04)', False),
     ('m', 'API', 'DB', "INSERT orders\n(status='awaiting_dispatch', paid_at=NOW())", False),
     ('m', 'API', 'DB', 'INSERT order_items', False),
     ('m', 'API', 'DB', 'INSERT audit_logs (CREATE_ORDER)', False),
     ('m', 'API', 'DB', 'COMMIT', False),
     ('end',),
     ('m', 'API', 'P', 'สั่งพิมพ์ใบเสร็จ (ESC/POS)', False),
     ('m', 'P', 'API', 'พิมพ์สำเร็จ (ภายใน 5 วินาที NFR-05)', True),
     ('m', 'API', 'WUI', 'WebSocket: order.created', False),
     ('m', 'WUI', 'WUI', 'แสดงในคิว (ภายใน 3 วินาที NFR-02)', True),
     ('m', 'API', 'UI', 'เลขที่คำสั่งซื้อ + ผลการพิมพ์', True),
     ('m', 'UI', 'S', 'แจ้งผล พร้อมรับคำสั่งซื้อถัดไป', True)])


# ---------------------------------------------------------------- ER
# คอลัมน์ตรงกับ soml/db/schema/schema.sql ของระบบวันสอบ (ตรวจซ้ำ 20 ต.ค. 2569) ส่วนที่เพิ่มหลังสอบอยู่ในภาคผนวก ซ
T = {
    'users': [('user_id', 'int', 'PK', 'รหัสผู้ใช้งาน'), ('username', 'varchar', 'UK', 'ชื่อผู้ใช้'),
              ('password_hash', 'varchar', '', 'ค่าแฮชของรหัสผ่าน'), ('full_name', 'varchar', '', 'ชื่อ-นามสกุล'),
              ('role', 'enum', '', 'บทบาท (ขาย/คลัง/ผู้จัดการ)'), ('is_active', 'boolean', '', 'สถานะบัญชี')],
    'orders': [('order_id', 'int', 'PK', 'รหัสคำสั่งซื้อ'), ('order_no', 'varchar', 'UK', 'เลขที่ไม่ซ้ำ'),
               ('total_amount', 'decimal', '', 'ยอดรวม'), ('status', 'enum', '', 'สถานะคำสั่งซื้อ'),
               ('created_by', 'int', 'FK', 'พนักงานขายผู้สร้าง'), ('paid_at', 'datetime', '', 'เวลายืนยันรับชำระ'),
               ('dispatched_by', 'int', 'FK', 'พนักงานคลังผู้จ่าย'), ('dispatched_at', 'datetime', '', 'เวลายืนยันจ่าย')],
    'order_items': [('order_item_id', 'int', 'PK', 'รหัสรายการ'), ('order_id', 'int', 'FK', 'คำสั่งซื้อ'),
                    ('product_id', 'int', 'FK', 'สินค้า'), ('qty', 'int', '', 'จำนวน'),
                    ('unit_price', 'decimal', '', 'ราคาต่อหน่วยขณะขาย')],
    'audit_logs': [('log_id', 'bigint', 'PK', 'รหัสบันทึก'), ('user_id', 'int', 'FK', 'ผู้กระทำ'),
                   ('action', 'varchar', '', 'การกระทำ'), ('entity_type', 'varchar', '', 'ชนิดข้อมูล'),
                   ('entity_id', 'int', '', 'รหัสข้อมูล'),
                   ('ip_address', 'varchar', '', 'หมายเลขไอพี'), ('created_at', 'datetime', '', 'เวลาที่เกิดเหตุการณ์')],
    'products': [('product_id', 'int', 'PK', 'รหัสสินค้า'), ('sku', 'varchar', 'UK', 'รหัสอ้างอิงสินค้า'),
                 ('name', 'varchar', '', 'ชื่อสินค้า'), ('category', 'varchar', '', 'หมวดหมู่'),
                 ('unit', 'varchar', '', 'หน่วยนับ'),
                 ('price', 'decimal', '', 'ราคาต่อหน่วย'), ('stock_qty', 'int', '', 'จำนวนคงเหลือ'),
                 ('reorder_point', 'int', '', 'จุดสั่งซื้อเพิ่ม'), ('is_active', 'boolean', '', 'สถานะเปิดขาย')],
    'stock_movements': [('movement_id', 'int', 'PK', 'รหัสการเคลื่อนไหว'), ('product_id', 'int', 'FK', 'สินค้า'),
                        ('order_id', 'int', 'FK', 'คำสั่งซื้อที่เกี่ยวข้อง'), ('change_qty', 'int', '', 'จำนวนที่เปลี่ยน'),
                        ('balance_after', 'int', '', 'คงเหลือหลังรายการ'), ('reason', 'enum', '', 'เหตุผลการเคลื่อนไหว'),
                        ('note', 'varchar', '', 'หมายเหตุ'), ('created_by', 'int', 'FK', 'ผู้ทำรายการ'),
                        ('created_at', 'datetime', '', 'เวลาที่เกิดรายการ')],
    'notifications': [('notification_id', 'int', 'PK', 'รหัสแจ้งเตือน'), ('type', 'enum', '', 'low_stock / queue_delay'),
                      ('ref_product_id', 'int', 'FK', 'สินค้าที่เกี่ยวข้อง'), ('ref_order_id', 'int', 'FK', 'คำสั่งซื้อที่เกี่ยวข้อง'),
                      ('message', 'varchar', '', 'ข้อความแจ้งเตือน'), ('is_read', 'boolean', '', 'สถานะการอ่าน'),
                      ('created_at', 'datetime', '', 'เวลาแจ้งเตือน')],
}
TW, RH, HH, GAP = 430, 31, 40, 46
LX, RX = 0, 570                              # ตารางคอลัมน์ซ้ายและขวา ช่องกลางกว้าง 140 ไว้เดินเส้นความสัมพันธ์
COLS = {'users': LX, 'orders': LX, 'order_items': LX, 'audit_logs': LX,
        'products': RX, 'stock_movements': RX, 'notifications': RX}
ORDER = [['users', 'orders', 'order_items', 'audit_logs'], ['products', 'stock_movements', 'notifications']]
# (ตารางฝั่ง 1, ตารางฝั่ง N, คอลัมน์คีย์นอก, คำอธิบาย) ตามไฟล์ fig3-05_erd.mmd
REL = [('users', 'orders', 'created_by', 'สร้างคำสั่งซื้อ'),
       ('users', 'stock_movements', 'created_by', 'ทำรายการสต็อก'),
       ('users', 'audit_logs', 'user_id', 'ถูกบันทึกประวัติ'),
       ('orders', 'order_items', 'order_id', 'ประกอบด้วย'),
       ('products', 'order_items', 'product_id', 'ถูกสั่งซื้อใน'),
       ('products', 'stock_movements', 'product_id', 'มีการเคลื่อนไหว'),
       ('products', 'notifications', 'ref_product_id', 'แจ้งเตือนสต็อกต่ำ'),
       ('orders', 'stock_movements', 'order_id', 'ทำให้เกิดการตัดสต็อก'),
       ('orders', 'notifications', 'ref_order_id', 'แจ้งเตือนคิวค้าง')]


def er():
    Y = {}
    for col in ORDER:
        y = 10
        for t in col:
            Y[t] = y
            y += HH + RH * len(T[t]) + GAP
    def row_y(t, c):
        i = [r[0] for r in T[t]].index(c)
        return Y[t] + HH + RH * i + RH / 2
    b, lines = [], []
    # ช่องเดินเส้น: เส้นในฝั่งเดียวกันใช้ขอบนอก เส้นข้ามฝั่งใช้ช่องกลางคนละแนว
    lanes_mid = iter([470, 490, 510, 530, 550])
    lanes_left = iter([-22, -42, -62])
    lanes_right = iter([1022, 1042])
    for one, many, fk, label in REL:
        y1 = Y[one] + HH + RH / 2          # แถวคีย์หลัก
        y2 = row_y(many, fk)
        if COLS[one] == COLS[many]:
            if COLS[one] == LX:
                lx = next(lanes_left); x1 = x2 = LX
            else:
                lx = next(lanes_right); x1 = x2 = RX + TW
            d = 'M%d %.1f H%d V%.1f H%d' % (x1, y1, lx, y2, x2)
            lab = (lx, (y1 + y2) / 2)
        else:
            lx = next(lanes_mid)
            x1 = LX + TW if COLS[one] == LX else RX
            x2 = RX if COLS[many] == RX else LX + TW
            d = 'M%d %.1f H%d V%.1f H%d' % (x1, y1, lx, y2, x2)
            lab = None
        lines.append('<path d="%s" fill="none" stroke="%s" stroke-width="2"/>' % (d, LINE))
        # ปลายฝั่ง 1: ขีดคู่ (||) · ปลายฝั่ง N: ตีนกา
        s1 = 1 if lx > x1 else -1
        lines.append('<path d="M%d %.1f v16 M%d %.1f v16" stroke="%s" stroke-width="2"/>' % (x1 + s1 * 8, y1 - 8, x1 + s1 * 13, y1 - 8, LINE))
        s2 = 1 if lx > x2 else -1
        lines.append('<path d="M%d %.1f L%d %.1f M%d %.1f L%d %.1f" stroke="%s" stroke-width="2"/>'
                     % (x2, y2 - 9, x2 + s2 * 14, y2, x2, y2 + 9, x2 + s2 * 14, y2, LINE))
    for t, rows in T.items():
        x, y = COLS[t], Y[t]
        h = HH + RH * len(rows)
        b.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#fff" stroke="%s" stroke-width="2"/>' % (x, y, TW, h, NAVY))
        b.append('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x, y, TW, HH, NAVY))
        b.append(text(x + TW / 2, y + 28, t, 21, 700, '#fff'))
        for i in range(1, len(rows), 2):    # พื้นแถวสลับสีวาดก่อนตัวหนังสือ ไม่ให้ทับขีดล่างของชื่อคอลัมน์
            b.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#F1F4F8"/>' % (x + 1, y + HH + RH * i, TW - 2, RH))
        for i, (c, ty, k, desc) in enumerate(rows):
            yy = y + HH + RH * i
            col = {'PK': ORANGE, 'FK': NAVY, 'UK': '#2E7D4F'}.get(k, INK)
            b.append(text(x + 8, yy + 22, ty, 15, 400, MUTED, 'start'))
            b.append(text(x + 74, yy + 22, c, 18, 700 if k else 400, col, 'start'))
            b.append(text(x + 226, yy + 22, k, 14, 700, col, 'start'))
            b.append(text(x + 254, yy + 22, desc, 16, 400, INK, 'start'))
    H = max(Y[c[-1]] + HH + RH * len(T[c[-1]]) for c in ORDER) + 20
    # คำอธิบายสัญลักษณ์ ใต้คอลัมน์ขวา
    ly = Y['notifications'] + HH + RH * len(T['notifications']) + 50
    legend = [text(RX, ly, 'สัญลักษณ์', 18, 700, INK, 'start'),
              '<path d="M%d %d h60 M%d %d v16 M%d %d v16" stroke="%s" stroke-width="2"/>' % (RX, ly + 30, RX + 8, ly + 22, RX + 13, ly + 22, LINE),
              text(RX + 74, ly + 36, 'ฝั่งหนึ่ง (1) · ตารางที่ถูกอ้างถึง', 16, 400, INK, 'start'),
              '<path d="M%d %d h60 M%d %d L%d %d M%d %d L%d %d" stroke="%s" stroke-width="2"/>'
              % (RX, ly + 66, RX + 60, ly + 57, RX + 46, ly + 66, RX + 60, ly + 75, RX + 46, ly + 66, LINE),
              text(RX + 74, ly + 72, 'ฝั่งหลาย (N) · แถวที่มีคีย์นอก', 16, 400, INK, 'start'),
              text(RX, ly + 106, 'PK คีย์หลัก · FK คีย์นอก · UK ห้ามซ้ำ', 16, 400, INK, 'start')]
    H = max(H, ly + 120)
    body = ''.join(lines + b + legend)
    return svg(1140, H, '<g transform="translate(76,0)">%s</g>' % body)


# ---------------------------------------------------------------- C1 / C2
GREEN, BROWN = '#2f6b2f', '#9A5A12'
FILL = {'person': ('#E6F0E6', GREEN), 'system': ('#DBE6F7', NAVY), 'cont': ('#DBE6F7', NAVY),
        'db': ('#D8ECE8', '#136055'), 'ext': ('#F7E9D8', BROWN)}


def cbox(x, y, w, h, kind, title, tag, lines=(), tsize=21):
    fill, stroke = FILL[kind]
    b = []
    if kind == 'db':                         # ทรงกระบอกแทนฐานข้อมูล
        ry = 16
        b.append('<path d="M%d %d v%d a%d %d 0 0 0 %d 0 v-%d" fill="%s" stroke="%s" stroke-width="2.4"/>'
                 % (x, y + ry, h - 2 * ry, w / 2, ry, w, h - 2 * ry, fill, stroke))
        b.append('<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="%s" stroke="%s" stroke-width="2.4"/>' % (x + w / 2, y + ry, w / 2, ry, fill, stroke))
        y0 = y + 2 * ry + 26
    else:
        b.append('<rect x="%d" y="%d" width="%d" height="%d" rx="10" fill="%s" stroke="%s" stroke-width="%s"/>'
                 % (x, y, w, h, fill, stroke, 3 if kind == 'system' else 2.2))
        n = 2 + len(lines)
        y0 = y + h / 2 - (n - 1) * 13 + 4
    b.append(text(x + w / 2, y0, title, tsize, 700))
    b.append(text(x + w / 2, y0 + 26, tag, 16, 400, MUTED))
    for i, l in enumerate(lines):
        b.append(text(x + w / 2, y0 + 54 + 25 * i, l, 17, 400, INK))
    return ''.join(b)


def carrow(x1, y1, x2, y2, label=(), lx=None, ly=None, anchor='start', dash=False):
    b = ['<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="2.2"%s marker-end="url(#ar)"/>'
         % (x1, y1, x2, y2, LINE, ' stroke-dasharray="8 5"' if dash else '')]
    if label:
        lx = (x1 + x2) / 2 + 10 if lx is None else lx
        ly = (y1 + y2) / 2 if ly is None else ly
        for i, l in enumerate(label):
            b.append(text(lx, ly + 22 * i, l, 17, 600 if i == 0 else 400, INK, anchor))
    return ''.join(b)


PEOPLE = [('พนักงานขาย', ('บันทึกคำสั่งซื้อ รับชำระ QR', 'พิมพ์ใบเสร็จ')),
          ('พนักงานคลังสินค้า', ('ดูคิวงาน', 'ยืนยันจ่ายสินค้า')),
          ('ผู้จัดการ', ('ดูแดชบอร์ด ตรวจประวัติ', 'รับการแจ้งเตือน'))]


def c1():
    b = []
    xs = [10, 350, 690]
    for x, (name, desc) in zip(xs, PEOPLE):
        b.append(cbox(x, 10, 300, 150, 'person', name, '[Person]', desc))
    sx, sy, sw, sh = 150, 330, 700, 190
    b.append(cbox(sx, sy, sw, sh, 'system', 'ระบบอำพร OMS', '[Software System]',
                  ('ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า', 'เว็บแอปพลิเคชันแบบสามชั้น',
                   'สร้างรหัส QR พร้อมเพย์ภายในระบบ'), 24))
    for x in xs:
        cx = x + 150
        tx = max(sx + 60, min(sx + sw - 60, cx))
        b.append(carrow(cx, 160, tx, sy - 2))
    b.append(text(512, 238, 'ทุกบทบาทใช้งานผ่านเบราว์เซอร์ (HTTP)', 17, 600, INK, 'start'))
    # ไลบรารีสร้างรหัส QR พร้อมเพย์ทำงานในระบบหลังบ้าน (SP-03) จึงไม่ใช่ระบบภายนอก — ดูรูปที่ 3.5
    # แอปพลิเคชันธนาคารของลูกค้าอ่านรหัส QR ที่ระบบแสดง แต่ไม่ส่งข้อมูลใดกลับมา (ภาคผนวก ก หัวข้อ ก.2.1)
    b.append(cbox(60, 700, 380, 160, 'ext', 'แอปพลิเคชันธนาคารของลูกค้า', '[External System]', ('สแกนรหัส QR เพื่อโอนเงิน',)))
    b.append(cbox(560, 700, 380, 160, 'ext', 'เครื่องพิมพ์ใบเสร็จความร้อน', '[External Hardware]', ('พิมพ์ใบเสร็จกระดาษ',)))
    b.append(carrow(330, sy + sh, 250, 698, ('แสดงรหัส QR ให้สแกน', 'ไม่มีข้อมูลส่งกลับ'), 318, 600, dash=True))
    b.append(carrow(670, sy + sh, 750, 698, ('ส่งคำสั่งพิมพ์', 'ESC/POS'), 724, 600))
    return svg(1000, 880, ''.join(b))


def c2():
    b = []
    xs = [10, 290, 570]
    names = ['พนักงานขาย', 'พนักงานคลังสินค้า', 'ผู้จัดการ']
    for x, n in zip(xs, names):
        b.append(cbox(x, 10, 240, 96, 'person', n, '[Person]'))
    # ขอบเขตระบบ
    BX0, BY0, BX1, BY1 = 0, 200, 790, 1150
    b.append('<rect x="%d" y="%d" width="%d" height="%d" rx="12" fill="none" stroke="%s" stroke-width="2.4" stroke-dasharray="12 7"/>'
             % (BX0, BY0, BX1 - BX0, BY1 - BY0, NAVY))
    b.append(text(BX0 + 16, BY1 - 16, 'ขอบเขตระบบอำพร OMS [Software System]', 18, 700, NAVY, 'start'))
    fe = (170, 250, 460, 170)
    be = (170, 560, 460, 200)
    db = (40, 930, 330, 190)
    ps = (450, 950, 300, 150)
    b.append(cbox(*fe, 'cont', 'Web Application (Frontend)', '[Container: React.js]',
                  ('หน้าจอ POS · คิวคลังสินค้า · แดชบอร์ด', 'ปรับตามขนาดจอ (Responsive)')))
    b.append(cbox(*be, 'cont', 'Backend API', '[Container: Node.js + Express.js]',
                  ('ตรรกะธุรกิจ · ตรวจสิทธิ์ตามบทบาท', 'ผลักคิวงานแบบเรียลไทม์', 'ตัดสต็อกในธุรกรรมเดียว · แจ้งเตือน',
                   'สร้างรหัส QR พร้อมเพย์ (ไลบรารีภายใน)')))
    b.append(cbox(*db, 'db', 'Database', '[Container: MySQL 8.0 / InnoDB]',
                  ('users · products · orders', 'order_items · stock_movements', 'notifications · audit_logs')))
    b.append(cbox(*ps, 'cont', 'Receipt Print Service', '[Container: Node.js]', ('รับคำสั่งพิมพ์จาก Backend',)))
    b.append(cbox(450, 1200, 300, 120, 'ext', 'เครื่องพิมพ์ใบเสร็จ', '[External Hardware]', ('ความร้อน 80 มม.',), 19))
    for x in xs:                                # ผู้ใช้ทั้งสามใช้งานผ่านหน้าเว็บ
        cx = x + 120
        tx = max(fe[0] + 40, min(fe[0] + fe[2] - 40, cx))
        b.append(carrow(cx, 106, tx, fe[1] - 2))
    b.append(text(700, 170, 'ใช้งานผ่านเบราว์เซอร์ (HTTP)', 17, 600, INK, 'start'))
    fx = fe[0] + fe[2] / 2
    b.append(carrow(fx - 70, fe[1] + fe[3], fx - 70, be[1] - 2, ('REST API', '(JSON/HTTP)'), fx - 82, 470, 'end'))
    b.append(carrow(fx + 70, be[1], fx + 70, fe[1] + fe[3] + 2, ('WebSocket (สำรองด้วย SSE)', 'ผลักคิวงานเรียลไทม์'), fx + 82, 470))
    b.append(carrow(260, be[1] + be[3], 205, db[1] - 2, ('SQL แบบ', 'ธุรกรรม ACID'), 250, 850))
    b.append(carrow(560, be[1] + be[3], 600, ps[1] - 2, ('ส่งคำสั่งพิมพ์',), 594, 860))
    b.append(carrow(600, ps[1] + ps[3], 600, 1198, ('ESC/POS ผ่าน USB',), 612, 1172))
    return svg(1000, 1330, ''.join(b))

# ---------------------------------------------------------------- Activity (รูปที่ 3.10)
# อ.ทั้งสองท่านและผู้จัดทำเห็นว่ารูปจาก Mermaid เล็กจนพิมพ์แล้วอ่านไม่ออก วาดใหม่ เนื้อหาตาม fig3-12_activity.mmd
def activity():
    b = []
    ACT, DEC, BAD = ('#EEF3FB', '#33507A'), ('#FDF6E3', '#8A6D1A'), ('#F9E3E3', '#8A2A2A')

    def box(cx, cy, w, lines, col=ACT, h=None):
        h = h or 30 + 28 * len(lines)
        b.append('<rect x="%d" y="%d" width="%d" height="%d" rx="10" fill="%s" stroke="%s" stroke-width="2.2"/>'
                 % (cx - w / 2, cy - h / 2, w, h, col[0], col[1]))
        for i, l in enumerate(lines):
            b.append(text(cx, cy - 14 * (len(lines) - 1) + 28 * i + 8, l, 21))
        return h

    def dia(cx, cy, w, h, lines):
        b.append('<path d="M%d %d L%d %d L%d %d L%d %d Z" fill="%s" stroke="%s" stroke-width="2.2"/>'
                 % (cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy, DEC[0], DEC[1]))
        for i, l in enumerate(lines):
            b.append(text(cx, cy - 13 * (len(lines) - 1) + 26 * i + 8, l, 20, 600))

    def oval(cx, cy, l):
        b.append('<rect x="%d" y="%d" width="170" height="50" rx="25" fill="#fff" stroke="%s" stroke-width="2.4"/>' % (cx - 85, cy - 25, INK))
        b.append(text(cx, cy + 8, l, 21, 700))

    def arr(pts, label=None, lx=None, ly=None, anchor='start'):
        d = 'M%d %d ' % pts[0] + ' '.join('L%d %d' % p for p in pts[1:])
        b.append('<path d="%s" fill="none" stroke="%s" stroke-width="2.2" marker-end="url(#ar)"/>' % (d, LINE))
        if label:
            b.append(text(lx, ly, label, 19, 700, NAVY, anchor))

    M, L, R, X = 400, 200, 600, 860          # คอลัมน์หลัก ทางแยกซ้าย ขวา และคอลัมน์กรณีปฏิเสธ
    oval(M, 40, 'เริ่มต้น')
    arr([(M, 65), (M, 98)])
    box(M, 130, 520, ['พนักงานขายบันทึกรายการสินค้าและจำนวน'])
    arr([(M, 159), (M, 196)])
    box(M, 228, 520, ['ระบบคำนวณยอดรวมจากราคาในฐานข้อมูล'])
    arr([(M, 257), (M, 294)])
    box(M, 326, 520, ['ระบบแสดง QR พร้อมเพย์ตามยอดชำระ'])
    arr([(M, 355), (M, 382)])
    dia(M, 440, 360, 116, ['ลูกค้าชำระเงิน', 'แล้วหรือไม่?'])
    arr([(M + 180, 440), (X - 100, 440)], 'ไม่', M + 196, 428)
    box(X, 440, 200, ['ยกเลิกรายการขาย', 'ไม่บันทึก', 'คำสั่งซื้อ'], BAD)
    arr([(M, 498), (M, 522)], 'ใช่', M + 12, 516)
    box(M, 567, 560, ['พนักงานยืนยันรับชำระเงิน', 'ระบบออกเลขที่และบันทึกคำสั่งซื้อในธุรกรรมเดียว'])
    arr([(M, 610), (M, 624), (L, 624), (L, 642)])
    arr([(M, 624), (R, 624), (R, 642)])
    box(L, 686, 340, ['ระบบสั่งพิมพ์ใบเสร็จกระดาษ'], h=88)
    box(R, 686, 340, ['ระบบผลักคำสั่งซื้อเข้าคิวคลัง', 'แบบเรียลไทม์ (awaiting_dispatch)'], h=88)
    arr([(L, 730), (L, 762)])
    arr([(R, 730), (R, 762)])
    box(L, 806, 340, ['ลูกค้าถือใบเสร็จ', 'เดินไปจุดรับของ'], h=88)
    box(R, 806, 340, ['พนักงานคลังเห็นคิว', 'และเริ่มจัดสินค้าล่วงหน้า'], h=88)
    arr([(L, 850), (L, 872), (M, 872), (M, 896)])
    b.append('<path d="M%d 850 V872 H%d" fill="none" stroke="%s" stroke-width="2.2"/>' % (R, M, LINE))
    box(M, 928, 520, ['พนักงานคลังจับคู่คำสั่งซื้อจากเลขที่ใบเสร็จ'])
    arr([(M, 957), (M, 984)])
    dia(M, 1044, 400, 120, ['สถานะเป็นรอจ่ายสินค้า', 'หรือกำลังจัดของ?'])
    arr([(M + 200, 1044), (X - 100, 1044)], 'ไม่', M + 212, 1032)
    box(X, 1044, 200, ['ระบบปฏิเสธ', 'การจ่ายซ้ำ', 'และแจ้งพนักงาน'], BAD)
    arr([(M, 1104), (M, 1142)], 'ใช่', M + 12, 1131)
    box(M, 1188, 520, ['ระบบเปลี่ยนสถานะเป็นส่งมอบสำเร็จ', 'แบบมีเงื่อนไข (กันจ่ายซ้ำ)'])
    arr([(M, 1231), (M, 1262)])
    box(M, 1306, 520, ['ตัดสต็อกและบันทึก stock_movements', 'ในธุรกรรมเดียวกัน แล้วนำออกจากคิว'])
    arr([(M, 1349), (M, 1380)])
    box(M, 1412, 520, ['บันทึกประวัติการทำรายการ (audit log)'])
    arr([(M, 1441), (M, 1468)])
    dia(M, 1528, 380, 120, ['สต็อกคงเหลือต่ำกว่า', 'จุดสั่งซื้อเพิ่ม?'])
    arr([(M + 190, 1528), (X - 100, 1528)], 'ใช่', M + 206, 1516)
    box(X, 1528, 200, ['สร้างการแจ้งเตือน', 'ในแอปถึงผู้จัดการ'])
    arr([(M, 1588), (M, 1626)], 'ไม่', M + 12, 1615)
    arr([(X, 1564), (X, 1658), (M + 262, 1658)])
    box(M, 1658, 520, ['อัปเดตแดชบอร์ดปฏิบัติการ'])
    arr([(M, 1687), (M, 1722)])
    oval(M, 1748, 'สิ้นสุด')
    # กรณียกเลิกและปฏิเสธการจ่ายซ้ำ ไปจบที่จุดสิ้นสุด ทางเส้นขวาสุด
    arr([(X + 100, 440), (985, 440), (985, 1748), (M + 87, 1748)])
    b.append('<path d="M%d 1044 H985" stroke="%s" stroke-width="2.2" fill="none"/>' % (X + 100, LINE))
    return svg(1000, 1790, ''.join(b))

def render(name, content, scale=3):
    p = os.path.join(HERE, name)
    open(p + '.svg', 'w', encoding='utf-8').write(content)
    subprocess.run(['node', os.path.join(HERE, 'render-svg.js'), p + '.svg', p + '.png', str(scale)], check=True)
    print('เขียน', name + '.png')


if __name__ == '__main__':
    render('fig3-02_c1_context', c1())
    render('fig3-03_c2_container', c2())
    render('fig3-05_erd', er())
    render('fig3-12_activity', activity())
    render('fig3-10_seq_uc03', SEQ_UC03)
    render('fig3-11_seq_uc07', SEQ_UC07)
