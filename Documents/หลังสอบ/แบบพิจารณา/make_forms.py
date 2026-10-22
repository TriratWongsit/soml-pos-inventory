# -*- coding: utf-8 -*-
"""แบบพิจารณาผลการสอบโครงงาน (ENG.P.06/2) สามแผ่น แผ่นละกรรมการ ตามข้อเสนอแนะในวันสอบ 16 ต.ค. 2569

    python3 make_forms.py && node render_forms.js

พื้นหลังคือหน้า 14 ของแบบฟอร์มคณะ (form-14.png) ตำแหน่งข้อความวัดจากภาพขนาด 827 x 1169
ช่องลงชื่อและวันที่ลงชื่อเว้นว่างให้กรรมการเขียนเอง
"""
import io, os

HERE = os.path.dirname(os.path.abspath(__file__))
TITLE_TH = 'ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า กรณีศึกษาร้านวัสดุก่อสร้างอำพรคอนกรีต'
TITLE_EN = 'Order Management and Inventory Control System: A Case Study of Amporn Concrete Construction Materials Store'

FORMS = [
    ('อาจารย์นริศ กำแพงแก้ว', [
        'ใบเสร็จพิมพ์ชื่อย่อของพนักงานขาย ไม่พิมพ์ชื่อ-นามสกุลเต็ม',
        'เพิ่มการป้องกันความเสียหายของธุรกิจกรณีรหัส QR สร้างผิดพลาด',
        'บทที่ 2 เพิ่มทฤษฎีเว็บซ็อกเก็ตและการตอบสนองแบบเรียลไทม์ และโยงกับระบบ',
        'แก้ชื่อหลักสูตรและสาขาวิชาบนปกให้ตรงกับหน้าอนุมัติ และรายชื่อกรรมการ',
        'จัดรูปแบบเล่ม: ข้อความชิดขอบ สารบัญ หัวข้อที่ยาวเกินบรรทัด ตารางที่ถูกตัดข้ามหน้า',
        'วัตถุประสงค์ใช้ลำดับเลข 1) 2) และเปลี่ยนคำว่า "หมุดหมาย" ให้ชัดเจน',
        'ขยายความชื่อ อำพร OMS และหัวข้อ 2.4 เพิ่มระบบที่เชื่อมหน้าร้านกับคลังแบบเรียลไทม์',
        'ระบุที่มาของเวลาเดินในเกณฑ์ NFR-02 และแก้เลขตารางที่อ้างในหัวข้อ 3.2.5',
        'วาดแผนภาพลำดับ (รูปที่ 3.8 และ 3.9) ใหม่ให้อ่านได้ชัด',
        'เรียงเอกสารอ้างอิงใหม่ และแก้รายการ [26] [27] [28] [30] ให้ตรงต้นฉบับ',
        'กิตติกรรมประกาศเพิ่มคำขอบคุณอาจารย์ที่ปรึกษา',
    ]),
    ('อาจารย์นุรักษ์ ไชยศรี', [
        'แก้กรณียืนยันจ่ายสินค้าพร้อมกันสองเครื่อง เมื่อสินค้าในคลังเหลือ 1 ชิ้น',
        'คิวของคลังสินค้าแสดงสถานะการชำระของแต่ละใบ "จ่ายแล้ว" หรือ "ขายเชื่อ"',
        'เพิ่มบันทึกการขายรายวันที่พิมพ์ได้ สำหรับใช้ทำเรื่องภาษี',
        'ทำให้ระบบติดตั้งและรันด้วย Docker ได้',
        'แก้ชื่อสาขาวิชาบนปก',
        'แก้คำว่า "สต็อก" ที่ถูกตัดคร่อมบรรทัด',
        'วัตถุประสงค์ใช้ลำดับเลข 1) 2)',
        'ปรับภาพแผนภาพความสัมพันธ์ระหว่างข้อมูล (รูปที่ 3.7) ให้ชัดเจน',
    ]),
    ('อาจารย์ธนิต เกตุแก้ว', [
        'เพิ่มการขายเชื่อ ลูกค้ารับสินค้าก่อนแล้วชำระภายหลัง',
        'ใบส่งของขายเชื่อพิมพ์ 2 ใบ ให้ลูกค้า 1 ใบ ร้านเก็บ 1 ใบ พร้อมช่องลงชื่อผู้รับของ',
        'วางแผนการทดสอบการยอมรับโดยผู้ใช้ (UAT) และทดสอบกับพนักงานที่ร้าน',
        'สรุปผลการทดสอบการยอมรับโดยผู้ใช้ในบทที่ 4 และบทที่ 5',
    ]),
]

LINES = [567 + 29 * i for i in range(14)]        # เส้นจุดของช่อง "ผ่าน มีแก้ไข"


def t(x, y, s, size=14, anchor='start', weight=400):
    tx = {'start': '', 'middle': 'transform:translateX(-50%);'}[anchor]
    return '<div style="position:absolute;left:%dpx;top:%dpx;font-size:%dpx;font-weight:%d;white-space:nowrap;%s">%s</div>' % (
        x, y - size - 3, size, weight, tx, s)


pages = []
for name, items in FORMS:
    b = [t(252, 277, TITLE_TH, 14), t(252, 323, TITLE_EN, 10.5), t(218, 364, '16', 14), t(318, 364, 'ตุลาคม', 14), t(440, 364, '2569', 14),
         t(102, 546, '✓', 20, weight=700)]
    for i, item in enumerate(items):
        b.append(t(152, LINES[i], '%d. %s' % (i + 1, item), 14))
    b.append(t(494, 1002, name, 14, 'middle'))
    pages.append('<div class="pg"><img src="form-14.png">%s</div>' % ''.join(b))

CSS = '''@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
@page{size:A4;margin:0}body{margin:0;font-family:Sarabun,sans-serif;color:#000}
.wrap{width:210mm;height:297mm;overflow:hidden;page-break-after:always}
.pg{position:relative;width:827px;height:1169px;transform:scale(0.9598);transform-origin:0 0}
.pg img{position:absolute;left:0;top:0;width:827px;height:1169px}'''
io.open(os.path.join(HERE, 'forms.html'), 'w', encoding='utf-8').write(
    '<!doctype html><html><head><meta charset="utf-8"><style>%s</style></head><body>%s</body></html>'
    % (CSS, ''.join('<div class="wrap">%s</div>' % p for p in pages)))
print('ok', [len(i) for _, i in FORMS])
