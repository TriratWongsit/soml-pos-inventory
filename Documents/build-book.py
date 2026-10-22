#!/usr/bin/env python3
# coding: utf-8
# ---------------------------------------------------------------------
# รวมเล่มปริญญานิพนธ์ SOML เป็น PDF ไฟล์เดียว
#
#   python3 build-book.py
#
# โครงของเล่มตามตัวอย่างที่อาจารย์ให้ ส่วนขนาดตัวอักษร ระยะขอบ และการลำดับหน้า
# ตามคู่มือปริญญานิพนธ์ คณะวิศวกรรมศาสตร์ มทร.ล้านนา พ.ศ. 2568 (บทที่ 2 และ 3)
#
#   ส่วนนำ    ปกนอก · ปกในไทย · ปกในอังกฤษ · ใบรับรอง · บทคัดย่อ · Abstract · กิตติกรรมประกาศ
#             สารบัญ · สารบัญรูป · สารบัญตาราง · ประมวลศัพท์และคำย่อ   (ลำดับหน้าด้วย ก ข ค)
#   เนื้อความ  บทที่ 1–5 · เอกสารอ้างอิง · ภาคผนวก ก (SRS) ถึง ช (แบบประเมิน) ตามคู่มือ v3 · ประวัติผู้เขียน   (ลำดับหน้าด้วย 1 2 3)
#
# หน้าแรกของบท เอกสารอ้างอิง ภาคผนวก และประวัติผู้เขียนไม่พิมพ์เลขหน้า แต่นับรวม (ข้อ 3.4)
# ตารางที่ต่อหน้าพิมพ์ "ตารางที่ x.x ... (ต่อ)" พร้อมหัวตารางซ้ำ (ข้อ 3.6.5)
# เลขหน้าในสารบัญทั้งสามชุดอ่านจาก PDF ที่สร้างจริง ด้วยเครื่องหมายขนาด 1 พอยต์ที่ฝังไว้ชั่วคราว
# ---------------------------------------------------------------------
import importlib.util, io, math, os, re, shutil, subprocess, sys, unicodedata, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
_spec = importlib.util.spec_from_file_location('bt', os.path.join(HERE, 'build-thesis-docx.py'))
bt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bt)
from table_widths import apply_widths, _text, _vis_len

OUT = os.path.join(HERE, 'เอกสารรูปเล่ม', 'รวมเล่ม')
WORK = os.path.join(OUT, '_work')
LOGO = os.path.join(HERE, 'assets', 'branding', 'logo_rmutl.png')
TEXT_W = 8306                       # ความกว้างกรอบพิมพ์ (ทวิป) A4 หักขอบซ้าย 1.5 นิ้ว ขวา 1 นิ้ว
BLANK = '………………………………………'   # ช่องที่ยังไม่มีข้อมูล ต้องกรอกก่อนส่งเล่ม

# ---------------------------------------------------------------------
# ข้อมูลของเล่ม — ช่องที่เป็น BLANK ยังไม่มีข้อมูลจริง
# ---------------------------------------------------------------------
BOOK = dict(
    title_th='ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า กรณีศึกษาร้านวัสดุก่อสร้างอำพรคอนกรีต',
    title_th_cover='ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า\nกรณีศึกษาร้านวัสดุก่อสร้างอำพรคอนกรีต',
    title_en='Order Management and Inventory Control System: A Case Study of Amporn Concrete Construction Materials Store',
    students=[
        dict(prefix='นาย', th='ตรัยรัตน์ วงษ์สิทธิ์', en_prefix='Mr.', en='Trirat Wongsit', id='67543210028-6',
             dob='17 มิถุนายน 2541',
             home='จังหวัดเชียงใหม่',      # ตัวอย่างประวัติผู้เขียนในคู่มือ: ภูมิลำเนาระบุเพียงจังหวัด
             addr='บ้านเลขที่ 251 หมู่ 2 ตำบลมะขามหลวง อำเภอสันป่าตอง จังหวัดเชียงใหม่',
             email='nicky2011abcd@gmail.com',
             edu=['วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา (กำลังศึกษา)',
                  'ประกาศนียบัตรวิชาชีพชั้นสูง วิทยาลัยการอาชีพจอมทอง',
                  'มัธยมศึกษาตอนปลาย โรงเรียนปรินส์รอยแยลส์วิทยาลัย'],
             photo='trirat.png'),
        dict(prefix='นาย', th='พนาวุฒน์ อภิปสันติ', en_prefix='Mr.', en='Phanawut Aphipasunti', id='67543210040-1',
             dob='20 กรกฎาคม 2546',
             home='จังหวัดลำปาง',
             addr='บ้านเลขที่ 53 บ้านทุ่งจี้ศรีเจริญ หมู่ 14 ตำบลทุ่งกว๋าว อำเภอเมืองปาน จังหวัดลำปาง',
             email='phanawut2003@gmail.com',
             edu=['วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา (กำลังศึกษา)',
                  'ประกาศนียบัตรวิชาชีพชั้นสูง วิทยาลัยเทคนิคลำปาง'],
             photo='phanawut.png'),
    ],
    # หลักสูตรเป็นชื่อปริญญา สาขาวิชาเป็นวิศวกรรมซอฟต์แวร์ ตามแบบฟอร์มกลางของคณะ (อาจารย์ที่ปรึกษาให้แก้ 21 ต.ค. 2569)
    curriculum_th='วิศวกรรมศาสตรบัณฑิต', major_th='วิศวกรรมซอฟต์แวร์',
    curriculum_en='Bachelor of Engineering', major_en='Software Engineering',
    # ชื่อพร้อมตำแหน่งวิชาการเต็ม ไม่ใช้ตัวย่อ (ข้อ 2.1.3 และตัวอย่างการเขียนยศและตำแหน่งในคู่มือ)
    advisor_th='อาจารย์ ธนิต เกตุแก้ว', advisor_en='Thanit Keatkaew',
    head_th='อาจารย์ สัญญา อุทธโยธา',
    # ตามกำหนดการสอบ 15 ตุลาคม 2569 ห้องที่ 2 (C3-402) SE : Software Development
    committee=[('ประธานกรรมการ', 'อาจารย์ ธนิต เกตุแก้ว'),
               ('กรรมการ', 'อาจารย์ นุรักษ์ ไชยศรี'),
               ('กรรมการ', 'อาจารย์ นริศ กำแพงแก้ว'),
               ('กรรมการ', 'ผู้ช่วยศาสตราจารย์ ดร.รุจิพันธุ์ โกษารัตน์')],
    year_be='2569', year_ce='2026',
)

ABSTRACT_TH = [
    'โครงงานนี้มีวัตถุประสงค์เพื่อพัฒนาระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้าสำหรับร้านวัสดุก่อสร้างอำพรคอนกรีต '
    'ซึ่งเดิมใช้บิลกระดาษส่งคำสั่งซื้อจากหน้าร้านไปยังคลังสินค้า ทำให้เกิดข้อผิดพลาดในการบันทึก ลูกค้ารอรับสินค้านาน '
    'และยอดสต็อกไม่ตรงกับของจริง การดำเนินงานใช้แบบจำลองน้ำตกที่ทวนกลับได้ เริ่มจากเก็บความต้องการด้วยการสังเกตและสอบถามเจ้าของร้านและพนักงาน '
    'ระบบพัฒนาเป็นเว็บแอปพลิเคชันตามสถาปัตยกรรมสามชั้นด้วยรีแอ็กต์ โหนดเจเอส และมายเอสคิวแอล '
    'รองรับผู้ใช้สามบทบาท ได้แก่ พนักงานขาย พนักงานคลังสินค้า และผู้จัดการ พนักงานขายสร้างคำสั่งซื้อและรับชำระเงินผ่านรหัสคิวอาร์พร้อมเพย์ '
    'ระบบพิมพ์ใบเสร็จภาษาไทยและส่งคำสั่งซื้อไปยังหน้าจอคิวของคลังแบบเรียลไทม์ผ่านเว็บซ็อกเก็ต พนักงานคลังยืนยันจ่ายสินค้า '
    'โดยระบบตัดสต็อกในธุรกรรมฐานข้อมูลเดียวซึ่งป้องกันการจ่ายซ้ำ และผู้จัดการติดตามยอดขาย สินค้าคงคลัง และคิวงานผ่านแดชบอร์ดและการแจ้งเตือนภายในระบบ',
    'ผลการทดสอบระดับหน่วยและระดับการรวมส่วน 134 ข้อ การทดสอบระดับระบบ 13 ข้อ '
    'และกรณีทดสอบ 13 กรณี ซึ่งครอบคลุมเกณฑ์การยอมรับทั้ง 15 ข้อ ผ่านทั้งหมด เหตุการณ์คำสั่งซื้อใหม่ไปถึงผู้รับบนช่องทางที่เปิดค้างไว้ภายใน 80 มิลลิวินาทีเมื่อวัดบนเครื่องเดียวกัน ระบบรองรับผู้ใช้พร้อมกัน 10 เซสชันโดยไม่มีคำขอใดล้มเหลว '
    'และพิมพ์ใบเสร็จภาษาไทยได้ในเวลาประมาณ 2.3 วินาที การทดสอบการยอมรับโดยผู้ใช้ที่ร้านระหว่างวันที่ 16 ถึง 20 ตุลาคม 2569 ซึ่งมีพนักงานของร้านบทบาทละหนึ่งคนเป็นผู้ทดสอบ '
    'ผ่าน 15 จาก 16 สถานการณ์ โดยการนับสต็อกไม่มีข้อมูลยืนยัน ส่วนความพึงพอใจของผู้ใช้สามคนที่ประเมินก่อนการสอบมีค่าเฉลี่ย 4.78 จากคะแนนเต็ม 5',
]
KEYWORDS_TH = 'ระบบจัดการคำสั่งซื้อ, การตรวจสอบคลังสินค้า, คิวงานแบบเรียลไทม์, การตัดสต็อกแบบอะตอมมิก, พร้อมเพย์'
ABSTRACT_EN = [
    'This project aimed to develop an order management and inventory control system for Amporn Concrete, a construction '
    'materials store whose paper bills caused recording errors, long waits, and stock records that did not match the '
    'physical stock. Requirements were gathered by observing the store and interviewing the owner and staff, and the work '
    'followed an iterative waterfall model. The system was developed as a three-tier web application with React, '
    'Node.js, and MySQL for sales staff, warehouse staff, and the manager. Sales staff received PromptPay QR payments, '
    'after which the system printed a Thai receipt and pushed the order to the warehouse queue in real time. Dispatch '
    'deducted stock in a single database transaction, preventing double dispatch, and the manager monitored sales, '
    'stock, and the queue through dashboards and alerts.',
    'All 134 unit and integration tests, 13 system tests, and 13 test cases, covering all 15 acceptance criteria, pass. '
    'On a single machine, new-order events reach a connected client within 80 milliseconds; 10 concurrent sessions run '
    'without a failed request, and a Thai receipt prints in about 2.3 seconds. From 16 to 20 October 2026, store staff '
    'pass 15 of 16 acceptance scenarios (stock counts unverified); three users surveyed before the examination rate '
    'satisfaction at 4.78 out of 5.',
]
KEYWORDS_EN = 'order management, inventory control, real-time queue, atomic stock deduction, PromptPay'
ACK = [
    'ปริญญานิพนธ์ฉบับนี้สำเร็จลุล่วงได้ด้วยความกรุณาจาก%s อาจารย์ที่ปรึกษาโครงงาน ที่ได้ให้คำแนะนำ ตรวจทาน '
    'และชี้แนะแนวทางในการวิเคราะห์ความต้องการ การออกแบบ และการทดสอบระบบตลอดระยะเวลาการทำโครงงาน '
    'รวมถึงดูแลการแก้ไขระบบและรูปเล่มตามข้อเสนอแนะของคณะกรรมการหลังการสอบ และการทดสอบการยอมรับโดยผู้ใช้ที่ร้านกรณีศึกษา '
    'ผู้จัดทำขอกราบขอบพระคุณเป็นอย่างสูง',
    'ขอขอบพระคุณคณะกรรมการสอบโครงงานทุกท่านที่ให้ข้อเสนอแนะอันเป็นประโยชน์ต่อการปรับปรุงโครงงาน '
    'และคณาจารย์หลักสูตรวิศวกรรมซอฟต์แวร์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา ที่ได้ประสิทธิ์ประสาทความรู้',
    'ขอขอบคุณเจ้าของร้านวัสดุก่อสร้างอำพรคอนกรีตและพนักงานทุกท่าน ที่อนุญาตให้ใช้ร้านเป็นสถานที่ศึกษา '
    'ให้ข้อมูลสินค้าและขั้นตอนการทำงานจริง และสละเวลาทดลองใช้และประเมินระบบ',
    'สุดท้ายนี้ ขอกราบขอบพระคุณบิดา มารดา และครอบครัว ที่ให้การสนับสนุนและเป็นกำลังใจตลอดมา',
]
# ประมวลศัพท์และคำย่อ — ใส่เฉพาะคำที่ปรากฏในเล่มจริง (ตรวจตอนสร้าง) เรียงตามตัวอักษร
ABBR = {
    'AC': 'Acceptance Criteria', 'ACID': 'Atomicity, Consistency, Isolation, Durability',
    'API': 'Application Programming Interface', 'BR': 'Business Rule', 'EV': 'Evidence',
    'ERD': 'Entity Relationship Diagram', 'ESC/POS': 'Epson Standard Code for Point of Sale',
    'FR': 'Functional Requirement', 'HTTP': 'Hypertext Transfer Protocol',
    'HTTPS': 'Hypertext Transfer Protocol Secure', 'NFR': 'Non-functional Requirement',
    'QR': 'Quick Response', 'RBAC': 'Role-Based Access Control', 'REST': 'Representational State Transfer',
    'SQL': 'Structured Query Language', 'SRS': 'Software Requirements Specification',
    'SSE': 'Server-Sent Events', 'TC': 'Test Case', 'TIS-620': 'Thai Industrial Standard 620',
    'UAT': 'User Acceptance Testing', 'UC': 'Use Case', 'UI': 'User Interface', 'US': 'User Story',
    'USB': 'Universal Serial Bus', 'ADR': 'Architecture Decision Record', 'BE': 'Backend Module',
    'FE': 'Frontend Screen', 'SP': 'Supporting Part', 'DF': 'Defect', 'CON': 'Constraint', 'TBD': 'To Be Determined',
    'ISO': 'International Organization for Standardization', 'IEC': 'International Electrotechnical Commission',
    'OWASP': 'Open Worldwide Application Security Project', 'RTM': 'Requirements Traceability Matrix',
    'SDD': 'Software Design Description', 'OMS': 'Order Management System', 'CAP': 'Capability', 'REF': 'Reference', 'M-xx': 'Model Element',
    'CSV': 'Comma-Separated Values', 'RFC': 'Request for Comments', 'K': 'Committee Recommendation', 'UX': 'User Experience', 'URL': 'Uniform Resource Locator', 'M1–M6': 'Milestones 1–6 (ผลลัพธ์ที่ส่งมอบ)',
    'C4': 'Context, Container, Component, Code Model',
}
# ชื่อตารางใน SRS (ภาคผนวก ก) เรียงตามลำดับที่ตารางปรากฏ — SRS ต้นฉบับไม่มีชื่อตาราง
SRS_TABLES = [
    'ขอบเขตของระบบเทียบกับขอบเขตของโครงงานในบทที่ 1', 'นิยาม คำย่อ และคำศัพท์', 'คุณลักษณะของผู้ใช้',
    'ข้อสมมติและการพึ่งพา', 'หน้าจอของระบบและบทบาทที่เข้าถึงได้', 'ข้อกำหนดของเครื่องพิมพ์ใบเสร็จ',
    'ส่วนต่อประสานซอฟต์แวร์', 'ส่วนต่อประสานการสื่อสาร', 'ความต้องการเชิงหน้าที่',
    'รายละเอียดกรณีการใช้งาน (Use Case) UC-03', 'รายละเอียดกรณีการใช้งาน (Use Case) UC-07', 'ความต้องการนอกเหนือหน้าที่',
    'วิธีทวนสอบและเกณฑ์ผ่านของความต้องการ', 'หลักฐานจากหน้างาน', 'ตัวอย่างข้อมูลสินค้า',
    'ดัชนีความต้องการและการสอบกลับ',
]

THAI_LETTERS = 'กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ'


def sh(args, **kw):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kw).stdout


def to_pdf(docx):
    sh(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', os.path.dirname(docx), docx])
    return os.path.splitext(docx)[0] + '.pdf'


def pages_of(pdf):
    return int(re.search(r'Pages:\s+(\d+)', sh(['pdfinfo', pdf])).group(1))


def page_texts(pdf):
    # ตัดตัวเชื่อมคำที่ thai_breaks.py ใส่ไว้ ให้การหาข้อความ เช่น "ตารางที่ … (ต่อ)" ทำงานเหมือนเดิม
    return re.sub('[‍⁠]', '', sh(['pdftotext', '-layout', pdf, '-'])).split('\f')


def read_docx(path):
    with zipfile.ZipFile(path) as z:
        return {n: z.read(n) for n in z.namelist()}


def write_docx(path, parts):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, d in parts.items():
            z.writestr(n, d)


# ---------------------------------------------------------------------
# เนื้อความ: สร้างด้วย build-thesis-docx.py แล้วปรับเพิ่มสำหรับการรวมเล่ม
# ---------------------------------------------------------------------
def _plain_code(t):
    t = re.sub(r'([/.:_-])', '\\1\u200b', t)
    t = re.sub(r'(?<=[a-z])(?=[A-Z])', '​', t)           # ชื่อแบบ camelCase ตัดบรรทัดได้ที่รอยต่อคำ
    return re.sub(r'([\\*_<>\[\]#])', r'\\\1', t)


def _plain_code_body(t):
    # ตัดได้หลัง / _ . : เพื่อไม่ให้บรรทัดก่อนหน้าถูกยืด แต่ไม่ตัดกลางชื่อแบบ camelCase เช่น nextOrderNo
    t = re.sub(r'([/.:_])(?=.)', '\\1\u200b', t)
    return re.sub(r'([\\*_<>\[\]#])', r'\\\1', t)


def no_bullets(md):
    """เล่มห้ามมีสัญลักษณ์หัวข้อย่อย (บูเล็ต): รวมรายการแบบขีดที่อยู่ติดกันเป็นย่อหน้าเดียว
    และเปลี่ยนจุดกลางที่ใช้คั่นรายการเป็นจุลภาค ไม่แตะบล็อกโค้ด"""
    out, items, code = [], [], False
    def flush():
        if items:
            out.append(' '.join(items))
            out.append('')
            items.clear()
    for line in md.split('\n'):
        if line.startswith('```'):
            code = not code
        if not code and not line.startswith('```'):
            # โค้ดในบรรทัดใช้ฟอนต์ TH Sarabun New ขนาดเดียวกับเนื้อความตามข้อ 3.1 ของคู่มือ
            # ฟอนต์ความกว้างคงที่ทำให้บรรทัดแบบกระจายไทยถูกยืดจนตัวอักษรห่างกัน
            # แทรกจุดตัดคำที่มองไม่เห็นหลังเครื่องหมาย / . _ - : เพื่อให้ชื่อยาวตัดบรรทัดได้
            # ผลตรวจรอบที่ 3: ชื่อตัวระบุถูกตัดกลางชื่อ เช่น order_ / items, UPDATE_ / PRODUCT ในเนื้อความ
            # เนื้อความกว้างพอ จึงยอมตัดเฉพาะหลัง / (ที่อยู่ไฟล์และเส้นทาง) ส่วนช่องตารางที่แคบยังตัดที่ _ . : และรอยต่อ camelCase ได้
            table = line.startswith('|')
            line = re.sub(r'`([^`]+)`', lambda m: _plain_code(m.group(1)) if table else _plain_code_body(m.group(1)), line)
            if '](' not in line and table:
                # ชื่อฟังก์ชันและรหัสเหตุการณ์ที่พิมพ์เป็นข้อความธรรมดา ให้ตัดบรรทัดได้เช่นเดียวกัน
                line = re.sub(r'(?<![\w/.\\])([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+|[a-z]+(?:[A-Z][a-z0-9]*)+)(?![\w(])',
                              lambda m: re.sub(r'(_)|(?<=[a-z])(?=[A-Z])', lambda k: (k.group(1) or '') + '​', m.group(1)), line)
        m = None if code else re.match(r'^\s*[-*•] (.*)$', line)
        if m:
            items.append(m.group(1).strip())
            continue
        if items and not line.strip():
            continue
        flush()
        if not code:
            # รายการลำดับเลขอัตโนมัติใช้ขนาดตัวอักษรเล็กกว่าเนื้อความ จึงเป็นย่อหน้าธรรมดาที่ขึ้นต้นด้วยเลขข้อ
            # build-thesis-docx.py ตั้งระยะแขวนให้บรรทัดที่ตัดลงมาตรงกับข้อความหลังเลขข้อ
            n = re.match(r'^(\d+)\. (.*)$', line)
            if n:
                out.append('%s\\. %s' % (n.group(1), n.group(2)))
                out.append('')
                continue
        out.append(line if code else line.replace(' · ', ', '))
    flush()
    return '\n'.join(out)


# คำที่ตัวตัดคำของ LibreOffice แยกกลางคำตอนขึ้นบรรทัดใหม่ (อ.นุรักษ์ ขีดเส้น "ยอดสต็ / อก" หน้า 1 และผลตรวจตามพรอมต์
# ของอาจารย์ 20 ต.ค. 2569 เช่น "แด / ชบอร์ด" "ว่าย / อด") — thai_breaks.py ใส่ตัวเชื่อมคำเฉพาะจุดที่ตัวตัดคำแบ่งผิด
sys.path.insert(0, HERE)
from thai_breaks import protect_md as no_split


# คำนำหน้าเลขกับตัวเลขต้องอยู่บรรทัดเดียวกัน ไม่ให้เลขหลุดไปอยู่บรรทัดใหม่คนเดียว เช่น "วัตถุประสงค์ข้อ / 2"
# (ผู้จัดทำพบในรูปที่ 3.10 หน้า 53) ใช้ช่องว่างไม่ตัดบรรทัด U+00A0 แทนช่องว่างปกติ ไม่แตะบรรทัดหัวข้อ รูป และโค้ด
GLUE_BEFORE = r'(ข้อ|ตารางที่|รูปที่|หัวข้อ|บทที่|ภาคผนวก|ขั้นตอนที่|ประการที่|ครั้งที่|วันที่|หน้า|ชั้น|ระดับ|จำนวน)'
GLUE_AFTER = r'(วินาที|มิลลิวินาที|นาที|ชั่วโมง|วัน|เดือน|ปี|ครั้ง|ข้อ|รายการ|ตาราง|บาท|คน|หน้า|ใบ|ราย|เซสชัน|บทบาท|หน่วย|ชุด|กรณี|สถานการณ์|เครื่อง|หมวดหมู่|แผ่นงาน|ชิ้น|เส้น|พอยต์|นิ้ว|ซม\.)'


def glue_numbers(md):
    out = []
    for line in md.split('\n'):
        # ชื่อตารางและรูป (**ตารางที่ N**) ต้องคงช่องว่างปกติ build-thesis-docx.py ใช้รูปแบบนี้กำหนดสไตล์ชื่อตาราง
        if line.startswith(('#', '![', '    ', '```', '**ตารางที่', '**รูปที่')) or line.startswith('|') and '---' in line:
            out.append(line)
            continue
        table = line.startswith('|')
        # ในช่องตารางที่แคบ ก้อนข้อความที่ผูกไว้ยาวเกินช่องจะถูกตัดกลางตัวเลข เช่น "3. / 16" "1 / 6" (ผลตรวจรอบที่ 4)
        # จึงไม่ผูกเลขที่มีจุด และไม่ผูกช่วงตัวเลขกับวันที่ในตาราง
        line = re.sub(GLUE_BEFORE + (r' (?=[\dก-ฮ](?:[\s,)|]|$))' if table else r' (?=[\dก-ฮ][\d.,]*(?:[\s,)|]|$))'),
                      '\\1\u00a0', line)
        line = re.sub(r'(?<![\w.])(\d[\d,.]*) ' + GLUE_AFTER + r'(?![ก-๙])', '\\1\u00a0\\2', line)
        line = re.sub(r'(?<![\w.])(\d[\d,.]*) ' + GLUE_AFTER, '\\1\u00a0\\2', line)
        if table:
            if re.match(r'^\|\s*:?-', line) is None:
                line = re.sub(r'(?<![\w.])(\d{1,2}\)) (?=\S)', '\\1\u00a0', line)
                # เลขหัวข้อในช่องตาราง "3. / 16" (ผลตรวจรอบที่ 5): ห้ามตัดหลังจุดระหว่างตัวเลข ช่องตารางชิดซ้ายจึงใช้ U+2060 ได้
                line = re.sub(r'(?<=\d)\.(?=\d)', '.\u2060', line)
            out.append(line)
            continue
        # ผลตรวจรอบที่ 3: ช่วงตัวเลข "2 / ถึง 3" วันที่ "28 / ก.ค. 2569" เลขมาตรฐาน "มอก. / 620" เลขรุ่น "มายเอสคิวแอล / 8.0"
        # และเลขข้อในช่องตาราง "4) / ข้อความ" ถูกแยกข้ามบรรทัด
        line = re.sub(r'(\d) ถึง (?=\d)', '\\1\u00a0ถึง\u00a0', line)
        line = re.sub(r'(\d) ((?:ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค)\.)(?: (\d{2,4}))?',
                      lambda m: m.group(1) + '\u00a0' + m.group(2) + ('\u00a0' + m.group(3) if m.group(3) else ''), line)
        line = re.sub(r'(มอก\.|รุ่น|มายเอสคิวแอล|โหนดเจเอส|โครเมียม|ไฟร์ฟอกซ์|เอดจ์) (?=\d)', '\\1\u00a0', line)
        if line.startswith('|'):
            line = re.sub(r'(?<![\w.])(\d{1,2}\)) (?=\S)', '\\1\u00a0', line)
        out.append(line)
    return '\n'.join(out)


def pandoc_part(name, md_text, resource_dir, ref):
    md_text = no_bullets(md_text)
    md_text = glue_numbers(md_text)        # ก่อนใส่ตัวเชื่อมคำ ไม่เช่นนั้นคำว่า "ตารางที่" ที่มีตัวเชื่อมจะไม่ตรงรูปแบบ
    md_text = no_split(md_text)
    src = os.path.join(WORK, name + '.md')
    io.open(src, 'w', encoding='utf-8').write(md_text)
    out = os.path.join(WORK, name + '.docx')
    subprocess.run(['pandoc', bt.prepare(src, WORK), '-f', 'markdown+pipe_tables-implicit_figures',
                    '--reference-doc', ref, '--resource-path', resource_dir, '-o', out], check=True)
    bt.postprocess(out)
    if name == 'refs':
        parts = read_docx(out)
        doc = parts['word/document.xml'].decode('utf-8')
        doc = doc.replace('<w:jc w:val="left"/><w:ind w:firstLine="0"/>',
                          '<w:jc w:val="left"/><w:ind w:left="567" w:hanging="567"/>')
        parts['word/document.xml'] = doc.encode('utf-8')
        write_docx(out, parts)
    return out


def natural_width(tbl):
    """ความกว้างที่ตารางต้องการจริงตามข้อความ (ทวิป) ต่อคอลัมน์ — ใช้ตัดสินว่าตารางแคบหรือไม่"""
    rows = re.findall(r'<w:tr[ >].*?</w:tr>', tbl, re.S)
    table = [re.findall(r'<w:tc>.*?</w:tc>', r, re.S) for r in rows]
    n = max((len(r) for r in table), default=0)
    longest = [0] * n
    for cells in table:
        for j, c in enumerate(cells[:n]):
            paras = [_text(p) for p in re.findall(r'<w:p[ >].*?</w:p>', c, re.S)] or ['']
            longest[j] = max(longest[j], max(_vis_len(p) for p in paras))
    return [int(l * bt.SZ_TABLE * 4.3 * 1.15) + 300 for l in longest]


def tune_tables(doc):
    def one(m):
        t = m.group()
        # ตารางที่เนื้อหาน้อย ไม่ยืดเต็มความกว้างหน้า ให้กว้างเท่าที่ข้อความต้องใช้
        want = natural_width(t)
        if want and sum(want) < TEXT_W * 0.75:
            t = re.sub(r'<w:tblW[^/]*/>', '<w:tblW w:w="%d" w:type="dxa"/>' % sum(want), t, 1)
            t = apply_widths(t, want)
        # แถวไม่ถูกตัดกลางแถวข้ามหน้า
        def row(r):
            x = r.group()
            if '<w:cantSplit/>' in x:
                return x
            if '<w:trPr>' in x:
                return x.replace('<w:trPr>', '<w:trPr><w:cantSplit/>', 1)
            return re.sub(r'^(<w:tr[^>]*>)', r'\1<w:trPr><w:cantSplit/></w:trPr>', x, count=1)
        return re.sub(r'<w:tr[ >].*?</w:tr>', row, t, flags=re.S)
    return re.sub(r'<w:tbl>.*?</w:tbl>', one, doc, flags=re.S)


# ตารางสั้นที่ต้องอยู่หน้าเดียวทั้งตาราง ไม่ตัดข้ามหน้า (อ.นริศ 22 ต.ค. 2569: ตาราง 3.23)
KEEP_TOGETHER = ['ตารางที่ 3.23']


def keep_tables_together(doc):
    """ใส่ keepNext ให้ย่อหน้าในทุกแถวยกเว้นแถวสุดท้าย ตารางจึงย้ายไปหน้าถัดไปทั้งตารางแทนการตัดข้ามหน้า"""
    for label in KEEP_TOGETHER:
        for m in re.finditer(r'<w:p(?: [^>]*)?>(?:(?!</w:p>).)*?' + re.escape(label.split()[0]) + r'.*?</w:p>\s*(<w:tbl>.*?</w:tbl>)', doc, re.S):
            cap = m.group(0)[:m.start(1) - m.start(0)]
            if label.split()[1] not in re.sub(r'<[^>]+>', '', cap):
                continue
            tbl = m.group(1)
            rows = re.findall(r'<w:tr[ >].*?</w:tr>', tbl, re.S)
            new = tbl
            for r in rows[:-1]:
                r2 = re.sub(r'<w:pPr>(?!<w:keepNext/>)', '<w:pPr><w:keepNext/>', r)
                r2 = re.sub(r'<w:p>', '<w:p><w:pPr><w:keepNext/></w:pPr>', r2)
                new = new.replace(r, r2, 1)
            doc = doc.replace(tbl, new, 1)
            break
    return doc


def set_start(doc, start):
    # ลำดับใน sectPr: pgSz · pgMar · pgNumType · cols · titlePg
    return re.sub(r'<w:cols ', '<w:pgNumType w:start="%d"/><w:cols ' % start, doc, count=1)


PARA = re.compile(r'<w:p(?: [^>]*)?>.*?</w:p>', re.S)


def marker_run(tag):
    # ย่อความกว้างเหลือร้อยละ 1 ไม่ให้เครื่องหมายดันบรรทัดในช่องตารางแคบ ฉบับทดลองจึงตัดหน้าตรงกับฉบับจริง (ผลตรวจรอบที่ 4)
    return ('<w:r><w:rPr><w:color w:val="FFFFFF"/><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>'
            '<w:t>@@%s@@</w:t></w:r>' % tag)


def style_of(p):
    m = re.search(r'<w:pStyle w:val="([^"]+)"', p)
    return m.group(1) if m else ''


def add_marks(doc):
    """ฝังเครื่องหมายในหัวข้อ ชื่อตาราง ชื่อรูป และทุกแถวของตาราง เพื่ออ่านเลขหน้าจาก PDF"""
    marks = []
    body = doc.index('<w:body>')
    out, pos = [doc[:body]], body
    tcount = [0]
    fcount = [0]

    def mark_table(tbl):
        t = tcount[0]
        tcount[0] += 1
        rows = list(re.finditer(r'<w:tr[ >].*?</w:tr>', tbl, re.S))
        new, last = [], 0
        for r_i, r in enumerate(rows):
            x = r.group()
            if r_i > 0:
                x = re.sub(r'(<w:tc>.*?<w:p(?: [^>]*)?>.*?)(</w:p>)',
                           lambda m: m.group(1) + marker_run('R%dx%d' % (t, r_i)) + m.group(2), x, count=1, flags=re.S)
            new.append(tbl[last:r.start()] + x)
            last = r.end()
        new.append(tbl[last:])
        return ''.join(new)

    token = re.compile(r'<w:tbl>.*?</w:tbl>|<w:p(?: [^>]*)?>.*?</w:p>', re.S)
    for m in token.finditer(doc, body):
        out.append(doc[pos:m.start()])
        x = m.group()
        if x.startswith('<w:tbl>'):
            x = mark_table(x)
        else:
            st = style_of(x)
            if st in ('Heading1', 'Heading2', 'TableCaption', 'ImageCaption'):
                marks.append((st, _text(x).replace('\u2060', '').replace('\u200d', '').strip()))
                x = x[:-len('</w:p>')] + marker_run('P%d' % (len(marks) - 1)) + '</w:p>'
            elif '<w:drawing>' in x and not _text(x).strip():
                # ย่อหน้ารูป: ใช้หาตำแหน่งขอบล่างของรูปเพื่อปิดช่องว่างท้ายหน้า (ดู fill_gap)
                x = x[:-len('</w:p>')] + marker_run('F%d' % fcount[0]) + '</w:p>'
                fcount[0] += 1
        out.append(x)
        pos = m.end()
    out.append(doc[pos:])
    return ''.join(out), marks


def strip_marks(xml):
    return re.sub(r'<w:r><w:rPr><w:color w:val="FFFFFF"/>(?:)?<w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>'
                  r'<w:t>@@[^@]+@@</w:t></w:r>', '', xml)


def split_tables(doc, splits, breaks):
    """แบ่งตารางที่ต่อหน้าตามแถวใน splits พร้อมชื่อตาราง "(ต่อ)" และหัวตารางซ้ำ"""
    token = re.compile(r'<w:tbl>.*?</w:tbl>|<w:p(?: [^>]*)?>.*?</w:p>', re.S)
    body = doc.index('<w:body>')
    out, pos, t, last_caption = [doc[:body]], body, 0, None
    for m in token.finditer(doc, body):
        out.append(doc[pos:m.start()])
        x = m.group()
        if x.startswith('<w:tbl>'):
            if t in breaks and last_caption is not None:
                i = len(out) - 1
                while i >= 0 and out[i] != last_caption:
                    i -= 1
                if i >= 0:
                    out[i] = out[i].replace('<w:pPr>', '<w:pPr><w:pageBreakBefore/>', 1)
            if splits.get(t) and last_caption is not None:
                head = re.search(r'^(<w:tbl>.*?)(<w:tr[ >].*)$', x, re.S)
                pre = head.group(1)
                rows = re.findall(r'<w:tr[ >].*?</w:tr>', x, re.S)
                cont = strip_marks(last_caption)
                cont = cont[:-len('</w:p>')] + '<w:r><w:t xml:space="preserve"> (ต่อ)</w:t></w:r></w:p>'
                # ชื่อตาราง (ต่อ) ขึ้นหน้าใหม่เสมอ (ผลตรวจรอบที่ 4: "(ต่อ)" ไปอยู่กลางหน้าเมื่อแถวในฉบับจริงเตี้ยกว่าฉบับทดลอง)
                cont = cont.replace('<w:pageBreakBefore/>', '')
                cont = cont.replace('<w:pPr>', '<w:pPr><w:pageBreakBefore/>', 1) if '<w:pPr>' in cont else cont
                cuts = [0] + sorted(splits[t]) + [len(rows)]
                segs = []
                for a, b in zip(cuts, cuts[1:]):
                    body_rows = rows[a:b] if a == 0 else [strip_marks(rows[0])] + rows[a:b]
                    segs.append(pre + ''.join(body_rows) + '</w:tbl>')
                x = ('\n' + cont).join(segs)
            t += 1
            last_caption = None
        elif style_of(x) == 'TableCaption':
            last_caption = x
        out.append(x)
        pos = m.end()
    out.append(doc[pos:])
    return ''.join(out)


def locate(pdf):
    """ตำแหน่งหน้า (นับจาก 0) ของเครื่องหมายทุกตัวใน PDF"""
    where = {}
    for i, txt in enumerate(page_texts(pdf)):
        for tag in re.findall(r'@@([A-Z0-9x]+)@@', txt):
            where.setdefault(tag, i)
    return where


# ---- ห้ามมีช่องว่างในเอกสาร: รูปที่ไม่พอดีท้ายหน้าจะถูกดันไปหน้าถัดไป เหลือที่ว่างท้ายหน้าก่อน ----
# แก้ทีละจุดจากหน้าแรกไปหน้าท้าย: ถ้าย่อรูปแล้วพอดีช่องว่างโดยไม่เล็กเกินไป ให้ย่อรูป
# ถ้าย่อไม่ได้ ให้ยกย่อหน้าเนื้อความที่อยู่ถัดจากรูปขึ้นไปไว้ก่อนรูป เพื่อเติมช่องว่างท้ายหน้า
BODY_TOP, BODY_BOTTOM = 100.0, 769.9          # พอยต์จากขอบบน: กรอบพิมพ์ A4 ขอบบน 1.5 นิ้ว ขอบล่าง 1 นิ้ว
GAP_MIN = 0.15 * (BODY_BOTTOM - BODY_TOP)     # ช่องว่างท้ายหน้าที่ถือว่าเป็นช่องว่าง
FIG_MIN = 0.72                                # ย่อรูปได้ไม่ต่ำกว่าร้อยละ 72 ของขนาดเดิม รูปต้องยังอ่านออก (ข้อ 3.7.1)


def word_boxes(pdf):
    import html as _h
    out = sh(['pdftotext', '-bbox', pdf, '-'])
    pages = []
    for pg in re.findall(r'<page [^>]*>(.*?)</page>', out, re.S):
        pages.append([(float(b), float(d), _h.unescape(t)) for a, b, c, d, t in re.findall(
            r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)])
    return pages


def fill_gap(doc, pdf, moves):
    """แก้ช่องว่างท้ายหน้าจุดแรกที่พบ คืน (doc, True) ถ้ามีการแก้"""
    pages = word_boxes(pdf)
    pos = {}
    real = []
    for i, ws in enumerate(pages):
        body = []
        for y0, y1, t in ws:
            for tag in re.findall(r'@@([A-Z0-9x]+)@@', t):
                pos.setdefault(tag, (i, y1))
            if re.sub(r'@@[A-Z0-9x]+@@', '', t).strip() and y0 > BODY_TOP - 10:
                body.append((y0, y1))
        real.append(body)
    paras = list(PARA.finditer(doc))
    for idx, m in enumerate(paras):
        f = re.search(r'@@F(\d+)@@', m.group())
        if not f or 'F' + f.group(1) not in pos:
            continue
        p, fy = pos['F' + f.group(1)]
        if p == 0:
            continue
        ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', m.group())
        h = int(ext.group(2)) / 12700.0
        top = fy - h
        above = [y1 for y0, y1 in real[p] if y1 < top - 4]
        head_h = 0
        if above:
            # ยอมให้มีหัวข้อที่ผูกติดกับรูปอยู่ด้านบนได้ (หัวข้อต้องอยู่หน้าเดียวกับรูป)
            if (idx > 0 and style_of(paras[idx - 1].group()).startswith('Heading')
                    and max(above) - min(y0 for y0, y1 in real[p]) < 45):
                head_h = top - min(y0 for y0, y1 in real[p])
            else:
                continue                                  # รูปไม่ได้อยู่ต้นหน้า
        if not real[p - 1]:
            continue
        gap = BODY_BOTTOM - max(y1 for y0, y1 in real[p - 1])
        if gap < GAP_MIN:
            continue
        # ความสูงของชื่อรูปและบรรทัดที่มา (ถ้ามี) ที่ต้องตามรูปขึ้นไปด้วย
        cap = paras[idx + 1].group() if idx + 1 < len(paras) else ''
        cm = re.search(r'@@(P\d+)@@', cap)
        cap_h = (pos[cm.group(1)][1] - fy) if cm and cm.group(1) in pos and pos[cm.group(1)][0] == p else 30
        nxt = idx + 2
        if nxt < len(paras) and style_of(paras[nxt].group()) == 'ImageSource':
            cap_h += 22 * (1 + len(_text(paras[nxt].group())) // 95)
            nxt += 1
        room = gap - cap_h - head_h - 18
        key = f.group(1)
        cx0, cy0 = int(ext.group(1)), int(ext.group(2))
        least = 0.6 if cy0 > 2 * cx0 else FIG_MIN   # ภาพจอโทรศัพท์แนวตั้งแคบ ย่อได้มากกว่าเล็กน้อยโดยยังอ่านได้
        if cy0 > 1.3 * cx0 and cy0 > 6.5 * 914400 and cy0 <= 2 * cx0:
            least = 0.95                            # แผนภาพแนวตั้งเต็มหน้า (รูปที่ 3.10) ย่อแล้วพิมพ์ไม่ชัด ให้ขึ้นหน้าใหม่แทน
        if room >= least * h and room >= 72 and moves.get('S' + key, 0) < 3:
            # ความสูงชื่อรูปและบรรทัดที่มาเป็นค่าประมาณ ถ้าคำนวณแล้วไม่ต้องย่อแต่รูปยังไม่ขึ้นไป
            # แสดงว่าประมาณต่ำไป จึงย่ออย่างน้อยร้อยละ 8 ต่อรอบ ไม่เกินสามรอบต่อรูป
            moves['S' + key] = moves.get('S' + key, 0) + 1
            k = min(room / h * 0.97, 0.92)
            d = m.group()
            cx, cy = int(ext.group(1)), int(ext.group(2))
            nx, ny = int(cx * k), int(cy * k)
            d = d.replace(ext.group(), '<wp:extent cx="%d" cy="%d"' % (nx, ny))
            d = re.sub(r'<a:ext cx="%d" cy="%d"' % (cx, cy), '<a:ext cx="%d" cy="%d"' % (nx, ny), d)
            return doc[:m.start()] + d + doc[m.end():], True
        if moves.get(key, 0) < 8 and nxt < len(paras):
            q = paras[nxt]
            qs = style_of(q.group())
            if (qs in ('BodyText', 'FirstParagraph', '') and '<w:drawing>' not in q.group()
                    and _text(q.group()).strip()
                    and doc[paras[nxt - 1].end():q.start()].strip() == ''):
                moves[key] = moves.get(key, 0) + 1
                return doc[:m.start()] + q.group() + doc[m.start():q.start()] + doc[q.end():], True
    return doc, False


def pull_text_before_table(doc, t):
    """ย้ายย่อหน้าเนื้อความที่อยู่ถัดจากตารางลำดับที่ t ขึ้นไปไว้ก่อนชื่อตาราง คืน None ถ้าย้ายไม่ได้"""
    tbls = list(re.finditer(r'<w:tbl>.*?</w:tbl>', doc, re.S))
    if t >= len(tbls):
        return None
    m = tbls[t]
    cap = None
    for c in PARA.finditer(doc, max(0, m.start() - 20000), m.start()):
        cap = c
    if cap is None or style_of(cap.group()) != 'TableCaption' or doc[cap.end():m.start()].strip():
        return None
    q = PARA.search(doc, m.end())
    if (q is None or doc[m.end():q.start()].strip() or '<w:drawing>' in q.group()
            or style_of(q.group()) not in ('BodyText', 'FirstParagraph', '') or not _text(q.group()).strip()):
        return None
    return doc[:cap.start()] + q.group() + doc[cap.start():q.start()] + doc[q.end():]


def unannounced_break(doc, pages, splits):
    """หาตารางที่ไหลไปหน้าถัดไปเองโดยไม่มีชื่อตาราง (ต่อ) คืน (ลำดับตาราง, แถวแรกบนหน้าใหม่) หรือ None"""
    norm = lambda x: re.sub(r'[\s ​‍⁠]+', '', x)     # ตัดตัวเชื่อมคำจาก thai_breaks.py ด้วย
    tables = []
    for m in re.finditer(r'<w:tbl>.*?</w:tbl>', strip_marks(doc), re.S):
        rows = re.findall(r'<w:tr[ >].*?</w:tr>', m.group(), re.S)
        cells = [[norm(_text(c)) for c in re.findall(r'<w:tc>.*?</w:tc>', r, re.S)] for r in rows]
        tables.append(cells)
    for pi in range(1, len(pages)):
        txt = pages[pi]
        lines = [l for l in txt.split('\n') if l.strip() and not re.fullmatch(r'\s*\d+\s*', l)]
        if len(lines) < 2 or lines[0].strip().startswith('ตารางที่'):
            continue
        first, second = norm(lines[0]), norm(lines[1])
        prev = norm(pages[pi - 1])[-4000:]
        for t, cells in enumerate(tables):
            if len(cells) < 2 or not cells[0] or first != ''.join(cells[0])[:len(first)] or len(first) < 4:
                continue
            for r in range(1, len(cells)):
                key = ''.join(cells[r][:2])[:24]
                # ตารางในภาคผนวก ง ใช้หัวตารางเหมือนกันทุกตาราง แถวก่อนหน้าต้องอยู่ท้ายหน้าก่อนด้วย จึงจะเป็นตารางเดียวกัน
                pkey = ''.join(cells[r - 1][:2])[:16] if r > 1 else ''
                if (key and second.startswith(key[:min(len(key), len(second))]) and r not in splits.get(t, set())
                        and (r == 1 or (pkey and pkey in prev))):
                    return (t, r)
    return None


def unannounced_breaks(doc, pages, splits):
    """ทุกจุดที่ตารางไหลไปหน้าถัดไปเองโดยไม่มีชื่อตาราง (ต่อ) หน้าละไม่เกินหนึ่งจุด"""
    out = []
    for i in range(1, len(pages)):
        hit = unannounced_break(doc, [pages[i - 1], pages[i]], splits)
        if hit and hit not in out:
            out.append(hit)
    return out


def first_table_break(doc, pages, splits, breaks):
    """หาแถวแรกของตารางที่ฉบับจริงขึ้นหน้าใหม่โดยยังไม่มีชื่อ (ต่อ) คืน (ลำดับตาราง, แถว) หรือ None
    หาตำแหน่งของแต่ละแถวจากข้อความต้นแถว ไล่ตามลำดับในเล่ม ข้อความที่ซ้ำกันในตารางอื่นจึงไม่ปน"""
    norm = lambda x: re.sub(r'[\s\u00a0\u200b\u200d\u2060]+', '', x)
    lines = []                                     # (หน้า, ข้อความบรรทัด)
    for p, txt in enumerate(pages):
        for l in txt.split('\n'):
            if l.strip() and not re.fullmatch(r'\s*\d+\s*', l):
                lines.append((p, norm(l)))
    body = strip_marks(doc)
    caps = [(c.start(), norm(_text(c.group()))[:20]) for c in PARA.finditer(body) if style_of(c.group()) == 'TableCaption']
    cur = 0
    for t, m in enumerate(re.finditer(r'<w:tbl>.*?</w:tbl>', body, re.S)):
        rows = re.findall(r'<w:tr[ >].*?</w:tr>', m.group(), re.S)
        # เริ่มหาแถวหลังชื่อตาราง ไม่ให้บรรทัดเนื้อความก่อนตารางที่ขึ้นต้นด้วยคำเดียวกับหัวตารางถูกนับเป็นแถว (ผลตรวจรอบที่ 4: ตาราง 5.3)
        cap = [c for pos, c in caps if pos < m.start()]
        if cap and cap[-1]:
            j = next((j for j in range(cur, min(len(lines), cur + 400)) if lines[j][1].startswith(cap[-1])), None)
            if j is not None:
                cur = j + 1
        keys = []
        for r in rows:
            cells = [norm(_text(c)) for c in re.findall(r'<w:tc>.*?</w:tc>', r, re.S)]
            keys.append(cells[0][:6] if cells and cells[0] else '')
        pages_of_rows = []
        for r, key in enumerate(keys):
            if not key:
                pages_of_rows.append(None)
                continue
            j = next((j for j in range(cur, min(len(lines), cur + 400)) if lines[j][1].startswith(key)), None)
            if j is None:
                pages_of_rows.append(None)
                continue
            pages_of_rows.append(lines[j][0])
            cur = j + 1
        known = [(r, p) for r, p in enumerate(pages_of_rows) if p is not None]
        for (ra, pa), (rb, pb) in zip(known, known[1:]):
            if pb > pa and rb not in splits.get(t, set()) and not (rb <= 1 and t in breaks):
                return (t, rb)
    return None


def build_body_part(name, docx, start):
    parts = read_docx(docx)
    doc = parts['word/document.xml'].decode('utf-8')
    doc = set_start(keep_tables_together(tune_tables(doc)), start)
    marked, marks = add_marks(doc)
    splits, breaks = {}, set()
    moves, fixes, pulls = {}, 0, {}
    for rnd in range(120):
        probe = os.path.join(WORK, '%s.probe.docx' % name)
        parts['word/document.xml'] = split_tables(marked, splits, breaks).encode('utf-8')
        write_docx(probe, parts)
        where = locate(to_pdf(probe))
        changed = False
        rows = {}
        for tag, pg in where.items():
            m = re.match(r'R(\d+)x(\d+)$', tag)
            if m:
                rows.setdefault(int(m.group(1)), {})[int(m.group(2))] = pg
        for t, rp in rows.items():
            order = sorted(rp)
            for a, b in zip(order, order[1:]):
                if rp[b] > rp[a] and b not in splits.get(t, set()):
                    pulled = None
                    if b <= 2 and not splits.get(t) and pulls.get(t, 0) < 3:
                        # หน้าแรกเหลือแค่หัวตารางกับแถวเดียว (อ.นริศ ทำลูกศรที่ตารางที่ 1.1)
                        # ดึงย่อหน้าหลังตารางขึ้นไปไว้ก่อนชื่อตาราง ให้ข้อความเติมท้ายหน้าและตารางเริ่มหน้าใหม่ทั้งตาราง
                        # ไม่ย้ายตารางไปหน้าใหม่เฉย ๆ เพราะจะเหลือหน้าโล่ง
                        pulled = pull_text_before_table(marked, t)
                        pulls[t] = pulls.get(t, 0) + 1
                    if pulled:
                        marked = pulled
                    else:
                        splits.setdefault(t, set()).add(b)
                    changed = True
                    break
                if rp[b] == rp[a] and b in splits.get(t, set()):
                    # จุดแบ่งที่ไม่จำเป็นแล้ว (แถวก่อนหน้าอยู่หน้าเดียวกัน) ทำให้ชื่อตาราง (ต่อ) ซ้ำกลางหน้า
                    splits[t].discard(b)
                    changed = True
                    break
        if not changed:
            marked, changed = fill_gap(marked, probe[:-5] + '.pdf', moves)
            fixes += changed
            if changed:
                splits.clear()     # ตำแหน่งตารางเปลี่ยน ต้องหาจุดแบ่งตารางต่อหน้าใหม่
        if not changed:
            break
    final = os.path.join(WORK, name + '.final.docx')
    # ผลตรวจรอบที่ 4: จุดแบ่งตารางจากฉบับทดลองคลาดจากฉบับจริง เพราะเครื่องหมายในช่องตารางทำให้แถวสูงขึ้น
    # จึงเริ่มฉบับจริงโดยไม่มีจุดแบ่ง หาหน้าของทุกแถวจากข้อความในฉบับจริงเอง แล้วแบ่งตรงแถวแรกที่ขึ้นหน้าใหม่ทีละจุด
    # ชื่อตาราง (ต่อ) บังคับขึ้นหน้าใหม่ จึงไม่เลื่อนหน้าก่อน ๆ และทุกจุดแบ่งเป็นจุดที่ตารางขึ้นหน้าใหม่จริง
    splits = {}
    for _ in range(150):
        parts['word/document.xml'] = strip_marks(split_tables(marked, splits, breaks)).encode('utf-8')
        write_docx(final, parts)
        pdf = to_pdf(final)
        hit = first_table_break(marked, page_texts(pdf), splits, breaks)
        if hit is None:
            break
        t, b = hit
        if b <= 1:
            breaks.add(t)                     # หน้าแรกมีแค่ชื่อและหัวตาราง ให้ทั้งตารางขึ้นหน้าใหม่
        else:
            splits.setdefault(t, set()).add(b)
    n = pages_of(pdf)
    # เลขหน้าในสารบัญอ่านจากฉบับจริงที่ไม่มีเครื่องหมาย เพราะเครื่องหมายทำให้แถวตารางบางแถวสูงขึ้นจนหน้าเลื่อน
    # (ผลตรวจรอบที่ 3: สารบัญตารางภาคผนวก ก มากกว่าหน้าจริงหนึ่งหน้า 20 รายการ) หาข้อความหัวข้อหรือชื่อตารางทีละรายการตามลำดับ
    norm = lambda t: re.sub(r'[\s ​‍⁠]+', '', t)
    # เทียบกับต้นบรรทัดเท่านั้น เพราะประโยคในเนื้อความ เช่น "จากรูปที่ 4.1 หน้าจอเข้าสู่ระบบ…" มีข้อความเดียวกับชื่อรูป
    texts = [[norm(l) for l in t.split('\n') if l.strip()] for t in page_texts(pdf)]
    found, cur = [], 0
    for i, (st, text) in enumerate(marks):
        key = norm(text)[:24]
        pg = next((j for j in range(cur, len(texts)) if key and any(l.startswith(key) for l in texts[j])), None)
        if pg is None:
            pg = where.get('P%d' % i)
        else:
            cur = pg
        found.append((st, text, None if pg is None else start + pg))
    print('  ✓ %-10s หน้า %d–%d  ตารางต่อหน้า %d จุด  ปิดช่องว่าง %d จุด' % (name, start, start + n - 1,
                                                         sum(len(v) for v in splits.values()), fixes))
    return pdf, n, found


# ---------------------------------------------------------------------
# ต้นฉบับของแต่ละส่วน
# ---------------------------------------------------------------------
def chapter_md(n):
    return io.open(os.path.join(HERE, 'รูปเล่ม', 'บทที่%d_ฉบับตรวจแก้.md' % n), encoding='utf-8').read()


def split_refs(ch2):
    i = ch2.index('\n# เอกสารอ้างอิง')
    return ch2[:i].rstrip() + '\n', ch2[i + 1:]


def srs_appendix_md():
    # ภาคผนวก ก: เอกสารข้อกำหนดความต้องการซอฟต์แวร์ตามโครงเอกสาร ENGSE206 CaseX ฉบับ 3.0
    s = io.open(os.path.join(HERE, 'SRS_อำพรOMS_v3.0_TH.md'), encoding='utf-8').read()
    s = s[s.index('# 1. บทนำ'):]
    # อ้างถึงส่วนภายในเอกสาร: ส่วนที่ N เป็นหัวข้อ ก.N
    s = re.sub(r'ส่วนที่ ((?:\d+(?:\.\d+)*)(?:(?:, | และ | ถึง |ถึงส่วนที่ )\d+(?:\.\d+)*)*)',
               lambda m: 'หัวข้อ ' + re.sub(r'(?<![\d.])(\d+(?:\.\d+)*)', r'ก.\1', m.group(1).replace('ถึงส่วนที่ ', 'ถึง ')), s)
    # หัวข้อ: # N. → ## ก.N · ## N.M → ### ก.N.M · ### ไม่มีเลข → #### เดิม
    s = re.sub(r'^(#{1,3}) (\d+(?:\.\d+)*)\.? ', lambda m: '#' * (len(m.group(1)) + 1) + ' ก.' + m.group(2) + ' ', s, flags=re.M)
    s = re.sub(r'^### (?!ก\.)', '#### ', s, flags=re.M)
    def _num_sub(t):
        out, cur, k = [], None, 0
        for line in t.split('\n'):
            m = re.match(r'^### (ก\.[\d.]+) ', line)
            if m:
                cur, k = m.group(1), 0
            elif line.startswith('## '):
                cur = None
            m4 = re.match(r'^#### (.*)$', line)
            if m4 and cur:
                k += 1
                line = '#### %s.%d %s' % (cur, k, m4.group(1))
            out.append(line)
        return '\n'.join(out)
    s = _num_sub(s)
    # ลำดับเหตุการณ์หลักที่เป็นรายการเลข ทำเป็นตาราง ขั้นที่ | เหตุการณ์ ให้อ่านง่ายและไม่โล่ง (ขอเพิ่มหลังสอบ 19 ต.ค. 2569)
    def _flow_table(t):
        out, lines, i = [], t.split('\n'), 0
        while i < len(lines):
            line = lines[i]
            out.append(line)
            i += 1
            if not re.match(r'^#### .*ลำดับเหตุการณ์หลัก', line):
                continue
            while i < len(lines) and not lines[i].strip():
                out.append(lines[i]); i += 1
            steps = []
            while i < len(lines) and re.match(r'^\d+\. ', lines[i]):
                n, txt = re.match(r'^(\d+)\. (.*)$', lines[i]).groups()
                i += 1
                while i < len(lines) and re.match(r'^\s{2,}\S', lines[i]):
                    txt += ' ' + lines[i].strip(); i += 1
                steps.append((n, txt.replace('|', '\\|')))
            if steps:
                out += ['| ขั้นที่ | เหตุการณ์ |', '|:---:|----------------------------------------------------------------|']
                out += ['| %s | %s |' % st for st in steps]
        return '\n'.join(out)
    s = _flow_table(s)
    s = re.sub(r'^\*รูปที่ (\d+) (.*)\*$', r'**รูปที่ ก.\1** \2', s, flags=re.M)
    s = re.sub(r'(?<=[฀-๿]) {2,}(?=[฀-๿])', ' ', s)
    # ตาราง: ตั้งชื่อตารางจากหัวข้อที่ตารางอยู่และหัวคอลัมน์แรก
    KIND = {'ระดับความสำคัญ': 'ระดับความสำคัญและที่มาของ', 'หัวข้อ': 'รายละเอียดของ', 'สิ่งเร้าหรือเงื่อนไข': 'สิ่งเร้าและการตอบสนองของ'}
    lines, out, k, prev, head, sub = s.split('\n'), [], 0, '', '', ''
    for line in lines:
        m = re.match(r'^#{2,3} ก\.[\d.]+ (.*)$', line)
        if m:
            head, sub = m.group(1), ''
        m4 = re.match(r'^#### (?:ก\.[\d.]+ )?(.*)$', line)
        if m4:
            sub = m4.group(1)
        if line.startswith('|') and not prev.startswith('|'):
            k += 1
            cols = [c.strip() for c in line.strip('|').split('|')]
            uc = re.search(r'UC-\d\d', head)
            name = re.sub(r'\s*\([^)]*\)$', '', re.sub(r'\s*—\s*UC-\d\d$', '', head))
            if uc and cols[0] in KIND:
                cap = '%s %s %s' % (KIND[cols[0]], uc.group(), name)
            elif uc and cols[1:2] == ['ความต้องการ']:
                cap = 'ความต้องการที่ %s %s รองรับ' % (uc.group(), name)
            elif uc and sub:
                cap = '%sของ %s %s' % (sub, uc.group(), name)
            elif cols[1:2] == ['เรื่องเล่าของผู้ใช้']:
                cap = 'สรุปเรื่องเล่าของผู้ใช้'
            else:
                cap = name
            out.append('**ตารางที่ ก.%d** %s' % (k, cap))
            out.append('')
        out.append(line)
        prev = line
    return ('# ภาคผนวก ก\n\n# ข้อกำหนดความต้องการซอฟต์แวร์ (Software Requirements Specification)\n\n'
            'ภาคผนวกนี้เป็นเอกสารข้อกำหนดความต้องการซอฟต์แวร์ฉบับเต็มของระบบอำพร OMS จัดตามโครงเอกสารข้อกำหนดความต้องการของรายวิชา ENGSE206 '
            'ซึ่งบทที่ 3 หัวข้อ 3.2 สรุปไว้แล้ว เลขตาราง รูป และหัวข้อที่ระบุว่าเป็นของปริญญานิพนธ์ หมายถึงเลขในเนื้อบทของเล่มนี้\n\n'
            + '\n'.join(out))


def appendix_b_md():
    # เอกสารการออกแบบซอฟต์แวร์ สร้างด้วย รูปเล่ม/make_appx_sdd_rtm.py จากโครงสร้างฐานข้อมูลและไฟล์ประกาศเส้นทาง
    return io.open(os.path.join(HERE, 'รูปเล่ม', 'ภาคผนวกข_เอกสารการออกแบบ.md'), encoding='utf-8').read()


def appendix_rtm_md():
    return io.open(os.path.join(HERE, 'รูปเล่ม', 'ภาคผนวกค_ตารางสอบกลับ.md'), encoding='utf-8').read()


def appendix_code_md():
    # ที่อยู่คลังเก็บโค้ดและตัวอย่างซอร์สโค้ดส่วนสำคัญ คัดจากไฟล์จริงตามเลขบรรทัดที่ระบุในไฟล์
    s = io.open(os.path.join(HERE, 'รูปเล่ม', 'ภาคผนวกข_ซอร์สโค้ด.md'), encoding='utf-8').read()
    s = s.replace('# ภาคผนวก ข', '# ภาคผนวก ฉ', 1).replace('# ตัวอย่างซอร์สโค้ดส่วนสำคัญของระบบ', '# ที่อยู่คลังเก็บโค้ดและคำอธิบายซอร์สโค้ดส่วนสำคัญ (Repository and Source Code)', 1)
    s = re.sub(r'^## ข\.(\d)', lambda m: '## ฉ.%d' % (int(m.group(1)) + 1), s, flags=re.M)
    i = s.index('\n## ฉ.2')
    repo = ('\n## ฉ.1 ที่อยู่คลังเก็บโค้ด (Repository)\n\nซอร์สโค้ดทั้งหมดของระบบจัดเก็บด้วยกิตบนคลังเก็บโค้ดกิตฮับที่ '
            '`https://github.com/TriratWongsit/soml-pos-inventory` กิ่ง main เป็นโค้ดฉบับสุดท้ายซึ่งรวมงานหลังการสอบในภาคผนวก ซ ณ วันที่ 22 ตุลาคม 2569 โฟลเดอร์ `soml/` เก็บซอร์สโค้ดของระบบตามโครงสร้างในบทที่ 4 ตารางที่ 4.2 '
            'ส่วนข้อมูลภายในของร้าน เช่น ไฟล์ข้อมูลสินค้าต้นฉบับ หมายเลขพร้อมเพย์ และรหัสผ่าน ไม่ถูกเก็บในคลังเก็บโค้ด\n')
    return s[:i] + '\n' + repo + s[i:]


def _captioned(lines_in, caption_for):
    """ใส่ชื่อตาราง ตารางที่ X.N ไว้หน้าทุกตารางที่ยังไม่มีชื่อ"""
    out, prev, k = [], '', 0
    for line in lines_in:
        if line.startswith('|') and not prev.startswith('|') and not (out and out[-2:-1] and out[-2].startswith('**ตารางที่')):
            k += 1
            out.append(caption_for(k))
            out.append('')
        out.append(line)
        prev = line
    return out


def appendix_c_md():
    # กรณีทดสอบฉบับเต็ม จากเอกสารกรณีทดสอบ ตัดภาพหน้าจอออกเพราะแสดงไว้แล้วในบทที่ 4
    s = io.open(os.path.join(HERE, 'กรณีทดสอบ_อำพรOMS.md'), encoding='utf-8').read()
    s = s[s.index('# 1. สรุปกรณีทดสอบ'):]
    s = re.sub(r'^!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?\n\n\*\*รูปที่ \d+\*\*[^\n]*\n', '', s, flags=re.M)
    s = re.sub(r'^# (\d)\. ', lambda m: '## ง.%s ' % m.group(1), s, flags=re.M)
    tc = [0]
    def tch(m):
        tc[0] += 1
        return '### ง.3.%d %s' % (tc[0], m.group(1))
    s = re.sub(r'^## (TC-\d\d .*)$', tch, s, flags=re.M)
    head = {'ง.1': 'สรุปกรณีทดสอบและสถานะ', 'ง.2': 'สภาพแวดล้อมที่ใช้ทดสอบ', 'ง.4': 'การทวนสอบความต้องการที่ไม่ใช้กรณีทดสอบ'}
    cur, names, out, prev, k = '', [], [], '', 0
    for line in s.split('\n'):
        m = re.match(r'^#{2,3} (ง\.[\d.]+) (.*)$', line)
        if m:
            cur = m.group(2) if m.group(1).count('.') == 2 else head.get(m.group(1), m.group(2))
            first = True
        if line.startswith('|') and not prev.startswith('|'):
            k += 1
            if cur.startswith('TC-'):
                cap = 'รายละเอียดและผลของ ' + cur
            elif cur == 'สภาพแวดล้อมที่ใช้ทดสอบ' and not first:
                cap = 'คำสั่งสำหรับรันการทดสอบซ้ำ'
            else:
                cap = cur
            first = False
            out.append('**ตารางที่ ง.%d** %s' % (k, cap))
            out.append('')
        out.append(line)
        prev = line
    intro = ('ภาคผนวกนี้รวบรวมกรณีทดสอบ TC-01 ถึง TC-13 ฉบับเต็ม แต่ละกรณีระบุความต้องการที่ทวนสอบ '
             'เงื่อนไขก่อนทดสอบ ขั้นตอน ผลที่คาดหวัง ผลจริง และหลักฐาน กรณีทดสอบชุดนี้ออกแบบไว้ในตารางที่ 3.29 '
             'และสรุปผลไว้ในตารางที่ 4.8 ภาพหน้าจอที่ใช้ประกอบการทดสอบแสดงไว้ในหัวข้อ 4.2 และ 4.3 ของบทที่ 4')
    return ('# ภาคผนวก ง\n\n# กรณีทดสอบและผลการทดสอบ (Test Cases and Results)\n\n' + intro + '\n\n'
            + '\n'.join(out))


def appendix_d_md():
    return io.open(os.path.join(HERE, 'รูปเล่ม', 'ภาคผนวกจ_คู่มือการใช้งานและติดตั้ง.md'), encoding='utf-8').read()


def appendix_e_md():
    # แบบประเมินความพึงพอใจฉบับที่ใช้เก็บข้อมูลจริง (ผลอยู่ในหัวข้อ 4.3)
    s = io.open(os.path.join(HERE, 'แบบประเมินความพึงพอใจ_SOML.md'), encoding='utf-8').read()
    s = s[s.index('| รายการ |'):]
    s = s.replace('**ส่วนที่ 1 ข้อมูลผู้ตอบ**', '## ช.1 ข้อมูลผู้ตอบ (Respondent Information)')
    s = s.replace('**ส่วนที่ 2 ความพึงพอใจต่อระบบ**', '## ช.2 ความพึงพอใจต่อระบบ (Satisfaction)')
    s = s.replace('**ส่วนที่ 3 ข้อเสนอแนะ**', '## ช.3 ข้อเสนอแนะ (Suggestions)')
    caps = ['ข้อมูลของแบบประเมิน', 'ข้อมูลผู้ตอบ', 'ข้อคำถามความพึงพอใจต่อระบบ']
    out, prev, k = [], '', 0
    for line in s.split('\n'):
        if line.startswith('|') and not prev.startswith('|'):
            out.append('**ตารางที่ ช.%d** %s' % (k + 1, caps[k]))
            out.append('')
            k += 1
        out.append(line)
        prev = line
    intro = ('ภาคผนวกนี้แสดงแบบประเมินความพึงพอใจที่ผู้ใช้ของร้านประเมินเมื่อวันที่ 29 กันยายน 2569 ก่อนการสอบ '
             'ข้อคำถามแต่ละข้อสอดคล้องกับความต้องการตามตารางที่ 3.30 ผลการประเมินรายงานไว้ในหัวข้อ 4.4')
    # แบบประเมินที่ผู้ใช้กรอกจริง (อ.นริศ ให้แนบ 22 ต.ค. 2569) ภาพจาก soml/evidence/survey ไม่มีชื่อผู้ตอบ
    forms = ['', '## ช.4 แบบประเมินที่ผู้ใช้กรอก (Completed Forms)', '',
             'แบบประเมินที่ผู้ใช้ทั้งสามบทบาทกรอกเมื่อวันที่ 29 กันยายน 2569 แสดงดังรูปที่ ช.1 ถึงรูปที่ ช.6 '
             'ผู้ตอบระบุเพียงบทบาทและระยะเวลาที่ทำงานกับร้าน ไม่ระบุชื่อ', '']
    k = 0
    for role, th in [('sales', 'พนักงานขาย'), ('warehouse', 'พนักงานคลังสินค้า'), ('manager', 'ผู้จัดการ')]:
        for page in (1, 2):
            k += 1
            forms += ['![แบบประเมินของ%s หน้า %d](assets/survey/%s-%d.png){height=20cm}' % (th, page, role, page), '',
                      '**รูปที่ ช.%d** แบบประเมินที่%sกรอก หน้า %d' % (k, th, page), '']
    return ('# ภาคผนวก ช\n\n# แบบประเมินความพึงพอใจของผู้ใช้งาน (User Satisfaction Form)\n\n' + intro + '\n\n'
            + '\n'.join(out) + '\n' + '\n'.join(forms))


def appendix_h_md():
    # งานแก้ตามข้อเสนอแนะของกรรมการสอบและความสามารถที่เพิ่มหลังสอบ (ไม่แก้ขอบเขตในบทที่ 1)
    return io.open(os.path.join(HERE, 'รูปเล่ม', 'ภาคผนวกซ_ปรับปรุงหลังสอบ.md'), encoding='utf-8').read()


# ---------------------------------------------------------------------
# ส่วนที่จัดหน้าเอง (ส่วนนำ หน้าคั่นภาคผนวก ประวัติผู้เขียน) ด้วย python-docx
# ---------------------------------------------------------------------
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, Twips

FONT = bt.FONT


def font(run, size=16, bold=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rpr.insert(0, rf)
    for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rf.set(qn(a), FONT)
    for tag in ('w:szCs',):
        e = OxmlElement(tag)
        e.set(qn('w:val'), str(size * 2))
        rpr.append(e)
    if bold:
        rpr.append(OxmlElement('w:bCs'))


class Pages:
    """เอกสารที่แต่ละหน้าเป็นหนึ่งส่วน (section) จึงกำหนดตัวอักษรหรือเลขหน้าเองได้ทุกหน้า"""

    def __init__(self):
        self.doc = Document()
        # แม่แบบของ python-docx ตั้งภาษาเป็น en-US ทำให้ LibreOffice ตัดบรรทัดภาษาไทยได้เฉพาะที่ช่องว่าง
        # เมื่อจัดเต็มบรรทัด ช่องว่างระหว่างคำจึงถ่างมาก จึงตั้งภาษาเป็นไทยเพื่อให้ตัดบรรทัดตามคำ
        for lang in self.doc.styles.element.iter(qn('w:lang')):
            for a in ('w:val', 'w:eastAsia', 'w:bidi'):
                lang.set(qn(a), 'th-TH')
        st = self.doc.styles['Normal']
        st.font.name = FONT
        st.font.size = Pt(16)
        pf = st.paragraph_format
        pf.space_before = pf.space_after = Pt(0)
        pf.line_spacing = 1.0
        self.first = True
        self.count = 0

    def page(self, label=None, top=1.5, bottom=1.0):
        if self.first:
            sec = self.doc.sections[0]
            self.first = False
        else:
            sec = self.doc.add_section(WD_SECTION.NEW_PAGE)
        sec.page_width, sec.page_height = Twips(11906), Twips(16838)
        sec.top_margin, sec.bottom_margin = Inches(top), Inches(bottom)
        sec.left_margin, sec.right_margin = Inches(1.5), Inches(1)
        sec.header_distance = Inches(1)
        sec.header.is_linked_to_previous = False
        hp = sec.header.paragraphs[0]
        for r in list(hp.runs):
            r._element.getparent().remove(r._element)
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        if label:
            font(hp.add_run(label))
        self.count += 1
        self._first_para = True
        return sec

    def p(self, parts, size=16, align='left', before=0, after=0, first=None, left=None, hanging=None,
          tabs=None, right=None, keep=False):
        if isinstance(parts, str):
            parts = [(parts, False)]
        para = self.doc.add_paragraph()
        para.alignment = {'left': WD_ALIGN_PARAGRAPH.LEFT, 'center': WD_ALIGN_PARAGRAPH.CENTER,
                          'right': WD_ALIGN_PARAGRAPH.RIGHT, 'both': WD_ALIGN_PARAGRAPH.JUSTIFY}[align]
        # จัดเต็มบรรทัดแบบเดียวกับเนื้อความ (w:jc both) LibreOffice ไม่รองรับ thaiDistribute จึงแสดงชิดซ้าย ขอบขวาไม่ตรง
        pf = para.paragraph_format
        pf.space_before, pf.space_after = Pt(before), Pt(after)
        if first is not None:
            pf.first_line_indent = Inches(first)
        if left is not None:
            pf.left_indent = Inches(left)
        if hanging is not None:
            pf.first_line_indent = Inches(-hanging)
        if right is not None:
            pf.right_indent = Inches(right)
        for pos, kind in (tabs or []):
            pf.tab_stops.add_tab_stop(Inches(pos), kind)
        for text, bold in parts:
            # ส่วนนำตั้งภาษาไทยแล้ว LibreOffice จึงตัดคำได้ ต้องใส่ตัวเชื่อมคำแบบเนื้อความ ไม่ให้ตัดกลางคำ เช่น "ล้าน / นา"
            font(para.add_run(no_split(text) if re.search('[ก-๙]', text) else text), size, bold)
        return para

    def picture(self, path, height_in):
        para = self.doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.add_run().add_picture(path, height=Inches(height_in))
        return para

    def save(self, path):
        self.doc.save(path)
        return path


def names_th(prefix=False):
    return [(s['prefix'] if prefix else '') + s['th'] for s in BOOK['students']]


def cover_block(pg, lang):
    """ข้อความส่วนล่างของปก ตามตัวอย่างในภาคผนวกของคู่มือ"""
    if lang == 'th':
        # หลักสูตรและสาขาวิชาให้ตรงกับหน้าอนุมัติ (อ.นริศ และ อ.นุรักษ์ ทำเครื่องหมายที่ปก 16 ต.ค. 2569)
        lines = ['ปริญญานิพนธ์นี้เป็นส่วนหนึ่งของการศึกษาตามหลักสูตร%s' % BOOK['curriculum_th'],
                 'สาขาวิชา%s คณะวิศวกรรมศาสตร์' % BOOK['major_th'],
                 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา เชียงใหม่',
                 'ปีการศึกษา %s' % BOOK['year_be']]
    else:
        lines = ['A PROJECT REPORT SUBMITTED IN PARTIAL FULFILLMENT OF THE REQUIREMENTS',
                 'FOR THE DEGREE OF BACHELOR OF ENGINEERING',
                 'PROGRAM OF %s FACULTY OF ENGINEERING' % BOOK['major_en'].upper(),
                 'RAJAMANGALA UNIVERSITY OF TECHNOLOGY LANNA',
                 'ACADEMIC YEAR %s' % BOOK['year_ce']]
    for i, l in enumerate(lines):
        # ภาษาอังกฤษ 18 พอยต์ยาวเกินบรรทัด คำว่า REQUIREMENTS ตกไปบรรทัดใหม่ จึงใช้ 16 พอยต์ให้ได้บรรทัดตามตัวอย่างในคู่มือ
        pg.p(l, size=18 if lang == 'th' else 16, align='center')


def build_front(toc, figs, tabs, abbr, first_pass=False):
    pg = Pages()
    letters = iter(THAI_LETTERS)

    # ปกนอก: ตรามหาวิทยาลัยสูงประมาณ 2 นิ้ว ห่างขอบบน 1.5 นิ้ว ชื่อเรื่อง 20 พอยต์ ส่วนอื่น 18 พอยต์ (ข้อ 2.1.1)
    pg.page(None, top=1.5, bottom=1.5)
    if os.path.exists(LOGO):
        pg.picture(LOGO, 2.0)
    # ชื่อเรื่องบนปกนอก 18 พอยต์ (ผู้จัดทำขอแก้ 22 ต.ค. 2569)
    pg.p([(BOOK['title_th_cover'], True)], size=18, align='center', before=36)
    # ขึ้นบรรทัดใหม่หลังเครื่องหมายทวิภาค ตามที่ ผศ.ดร.รุจิพันธุ์ กำหนด (22 ต.ค. 2569)
    for line in BOOK['title_en'].split(': ', 1):
        pg.p([(line + (':' if line != BOOK['title_en'].split(': ', 1)[-1] else ''), True)], size=18, align='center')
    # บรรทัดสุดท้ายห่างขอบล่าง 1.5 นิ้ว ระยะก่อนและหลังชื่อผู้จัดทำใกล้เคียงกัน (ตัวอย่างปกนอกในคู่มือ)
    pg.p(names_th(prefix=True)[0], size=18, align='center', before=94)
    for n in names_th(prefix=True)[1:]:
        pg.p(n, size=18, align='center')
    pg.p('', size=18, before=75)
    cover_block(pg, 'th')

    # ปกในภาษาไทยและภาษาอังกฤษ: ชื่อเรื่องห่างขอบบน 2 นิ้ว ไม่พิมพ์ตัวอักษรกำกับหน้า แต่นับเป็น ก ข
    next(letters)
    pg.page(None, top=2.0, bottom=1.5)
    pg.p([(BOOK['title_th_cover'], True)], size=18, align='center')        # 18 พอยต์เท่าปกนอก
    # ชื่อผู้จัดทำอยู่กลางหน้า ข้อความส่วนล่างชิดขอบล่าง 1.5 นิ้ว ตามตัวอย่างปกใน (ขอแก้ 20 ต.ค. 2569)
    pg.p(names_th(prefix=True)[0], size=18, align='center', before=173)
    for n in names_th(prefix=True)[1:]:
        pg.p(n, size=18, align='center')
    pg.p('', size=18, before=193)
    cover_block(pg, 'th')

    next(letters)
    pg.page(None, top=2.0, bottom=1.5)
    # ขึ้นบรรทัดใหม่หลังเครื่องหมายทวิภาค ตามที่ ผศ.ดร.รุจิพันธุ์ กำหนด (22 ต.ค. 2569)
    for line in BOOK['title_en'].split(': ', 1):
        pg.p([(line + (':' if line != BOOK['title_en'].split(': ', 1)[-1] else ''), True)], size=18, align='center')
    pg.p(('%s %s' % (BOOK['students'][0]['en_prefix'], BOOK['students'][0]['en'])).upper(), size=18, align='center', before=175)
    for s in BOOK['students'][1:]:
        pg.p(('%s %s' % (s['en_prefix'], s['en'])).upper(), size=18, align='center')
    pg.p('', size=18, before=180)                 # ข้อความส่วนล่างอยู่ต่ำลงมาใกล้ขอบล่าง ตามตัวอย่างปกในภาษาอังกฤษ
    cover_block(pg, 'en')

    # ใบรับรองจากคณะกรรมการสอบ (ข้อ 2.1.3) ไม่พิมพ์ตัวอักษรกำกับหน้า นับเป็น ค
    next(letters)
    pg.page(None)
    TAB = [(1.9, WD_TAB_ALIGNMENT.LEFT)]
    def field(label, value, extra=()):
        pg.p([(label, True), ('\t' + value, False)], tabs=TAB, left=1.9, hanging=1.9)
        for v in extra:
            pg.p('\t' + v, tabs=TAB, left=1.9, hanging=1.9)
    field('ปริญญานิพนธ์เรื่อง', BOOK['title_th'])
    st = ['%s%s รหัสนักศึกษา %s' % (s['prefix'], s['th'], s['id']) for s in BOOK['students']]
    field('ชื่อนักศึกษา', st[0], st[1:])
    field('หลักสูตร', BOOK['curriculum_th'])
    field('สาขาวิชา', BOOK['major_th'])
    field('คณะ', 'วิศวกรรมศาสตร์')
    field('อาจารย์ที่ปรึกษา', BOOK['advisor_th'])
    field('ปีการศึกษา', BOOK['year_be'])
    pg.p('คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา อนุมัติให้ปริญญานิพนธ์นี้เป็นส่วนหนึ่ง'
         'ของการศึกษาตามหลักสูตร%s สาขาวิชา%s' % (BOOK['curriculum_th'], BOOK['major_th']),
         align='both', first=0.5, before=16)
    # ตัวอย่างใบรับรองในคู่มือ: ชื่อในวงเล็บอยู่กึ่งกลางใต้เส้นจุด ตำแหน่งกรรมการอยู่ท้ายเส้นจุด
    SIG = [(3.4, WD_TAB_ALIGNMENT.LEFT)]
    DOTS = '…' * 24                      # ยาวประมาณ 3 นิ้ว พอสำหรับชื่อที่ยาวที่สุด
    UNDER = 8.27 - 1.5 - 1.0 - 3.0         # ระยะขวาที่ทำให้ชื่ออยู่กลางเส้นจุด
    pg.p(DOTS, align='center', before=14)
    pg.p('หัวหน้าหลักสูตร วศ.บ. %s' % BOOK['major_th'], align='center')
    pg.p('(%s)' % BOOK['head_th'], align='center')
    pg.p('คณะกรรมการสอบโครงงานวิศวกรรมซอฟต์แวร์', before=14)
    for role, name in BOOK['committee']:
        pg.p('%s\t%s' % (DOTS, role), tabs=SIG, before=5)
        pg.p('(%s)' % name, align='center', right=UNDER)
    pg.p('ลิขสิทธิ์ของคณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา', align='center', before=12)

    # บทคัดย่อภาษาไทย (ข้อ 2.1.4) — เริ่มพิมพ์ตัวอักษรกำกับหน้าจากหน้านี้
    labels = {}
    labels['abstract_th'] = next(letters)
    pg.page(labels['abstract_th'])
    field('ปริญญานิพนธ์เรื่อง', BOOK['title_th'])
    field('ชื่อนักศึกษา', st[0], st[1:])
    field('หลักสูตร', BOOK['curriculum_th'])
    field('สาขาวิชา', BOOK['major_th'])
    field('คณะ', 'วิศวกรรมศาสตร์')
    field('อาจารย์ที่ปรึกษา', BOOK['advisor_th'])
    field('ปีการศึกษา', BOOK['year_be'])
    pg.p([('บทคัดย่อ', True)], size=18, align='center', before=16, after=8)
    for para in ABSTRACT_TH:
        pg.p(para, align='both', first=0.5)
    pg.p([('คำสำคัญ : ', True), (KEYWORDS_TH, False)], before=16)

    # Abstract (ข้อ 2.1.5)
    labels['abstract_en'] = next(letters)
    pg.page(labels['abstract_en'])
    ENT = [(1.6, WD_TAB_ALIGNMENT.LEFT)]
    def efield(label, value, extra=()):
        pg.p([(label, True), ('\t' + value, False)], tabs=ENT, left=1.6, hanging=1.6)
        for v in extra:
            pg.p('\t' + v, tabs=ENT, left=1.6, hanging=1.6)
    efield('Project Title', BOOK['title_en'])
    ens = ['%s %s  Student ID %s' % (s['en_prefix'], s['en'], s['id']) for s in BOOK['students']]
    efield('Students', ens[0], ens[1:])
    efield('Curriculum', BOOK['curriculum_en'])
    efield('Major Field', BOOK['major_en'])
    efield('Faculty', 'Faculty of Engineering')
    efield('Project Advisor', BOOK['advisor_en'])
    efield('Academic Year', BOOK['year_ce'])
    pg.p([('ABSTRACT', True)], size=18, align='center', before=16, after=8)
    for para in ABSTRACT_EN:
        pg.p(para, align='both', first=0.5)
    pg.p([('Keywords : ', True), (KEYWORDS_EN, False)], before=16)

    # กิตติกรรมประกาศ (ข้อ 2.1.6)
    labels['ack'] = next(letters)
    pg.page(labels['ack'])
    pg.p([('กิตติกรรมประกาศ', True)], size=18, align='center', after=16)
    for i, para in enumerate(ACK):
        pg.p(para % BOOK['advisor_th'] if '%s' in para else para, align='both', first=0.5)
    pg.p('คณะผู้จัดทำ', align='center', left=3.2, before=40)
    for n in names_th(prefix=True):
        pg.p(n, align='center', left=3.2)

    # สารบัญ สารบัญรูป สารบัญตาราง ประมวลศัพท์ — แบ่งหน้าเอง หน้าละไม่เกิน LINES บรรทัด
    LINES = 27

    def lines_of(text, indent):
        return max(1, math.ceil(_vis_len(text) / (58 - indent * 8)))

    def paginate(entries):
        pages, cur, used = [], [], 0
        for e in entries:
            n = lines_of(e[0], e[2]) + (1 if e[3] else 0)
            if cur and used + n > LINES:
                pages.append(cur)
                cur, used = [], 0
            cur.append(e)
            used += n
        pages.append(cur)
        return pages

    RT = [(5.77, WD_TAB_ALIGNMENT.RIGHT)]

    def listing(title, entries, show_first):
        pages = paginate(entries)
        first_label = None
        for i, chunk in enumerate(pages):
            lab = next(letters)
            if i == 0:
                first_label = lab
            pg.page(lab if (i > 0 or show_first) else None)
            pg.p([(title + (' (ต่อ)' if i else ''), True)], size=18, align='center', after=8)
            pg.p([('หน้า', True)], align='right', after=6)
            for text, page, indent, gap, bold in chunk:
                pg.p([(text, bold), ('\t' + str(page), bold)], tabs=RT, left=0.5 * indent, right=0.4,
                     hanging=None, before=10 if gap else 0)
        return first_label

    # เลขหน้าส่วนนำของรายการในสารบัญ ต้องรู้จำนวนหน้าของสารบัญก่อน จึงคำนวณจากจำนวนรายการ
    ntoc = len(paginate(toc + [('x', 'ก', 0, False, False)] * 6))
    nfig = len(paginate(figs))
    ntab = len(paginate(tabs))
    base = THAI_LETTERS.index(labels['ack']) + 1
    lab_fig = THAI_LETTERS[base + ntoc]
    lab_tab = THAI_LETTERS[base + ntoc + nfig]
    lab_abbr = THAI_LETTERS[base + ntoc + nfig + ntab]
    head = [('บทคัดย่อภาษาไทย', labels['abstract_th'], 0, False, False),
            ('บทคัดย่อภาษาอังกฤษ', labels['abstract_en'], 0, False, False),
            ('กิตติกรรมประกาศ', labels['ack'], 0, False, False),
            ('สารบัญรูป', lab_fig, 0, False, False),
            ('สารบัญตาราง', lab_tab, 0, False, False),
            ('ประมวลศัพท์และคำย่อ', lab_abbr, 0, False, False)]
    # หน้าแรกของสารบัญไม่พิมพ์ตัวอักษรกำกับหน้า (ข้อ 3.4)
    listing('สารบัญ', head + toc, show_first=False)
    listing('สารบัญรูป', figs, show_first=True)
    listing('สารบัญตาราง', tabs, show_first=True)

    pg.page(next(letters))
    pg.p([('ประมวลศัพท์และคำย่อ', True)], size=18, align='center', after=16)
    AT = [(1.3, WD_TAB_ALIGNMENT.LEFT), (1.6, WD_TAB_ALIGNMENT.LEFT)]
    keys = sorted(abbr, key=str.upper)
    # หน้าหนึ่งพอดีราว 29 คำ ถ้าเกินเล็กน้อยให้บีบระยะบรรทัดลงให้จบในหน้าเดียว ไม่ให้เหลือคำเดียวบนหน้าใหม่ (ขอแก้ 19 ต.ค. 2569)
    # ผลตรวจรอบที่ 3: เพิ่มคำย่อแล้วล้นไปหน้าใหม่ อักษรกำกับหน้า "น" ซ้ำ จึงบีบระยะบรรทัดตามจำนวนคำ
    spacing = max(0.7, min(1.0, 28.5 / len(keys))) if keys else 1.0
    for k in keys:
        para = pg.p('%s\t=\t%s' % (k, abbr[k]), tabs=AT, left=1.6, hanging=1.6)
        if spacing < 1.0:
            para.paragraph_format.line_spacing = spacing
    return pg


def build_divider(start):
    # หน้าแรกของภาคผนวกมีคำว่า ภาคผนวก อยู่กลางหน้ากระดาษ (ข้อ 2.4)
    # ภาคผนวก ก และ ข แต่ละภาคขึ้นหน้าใหม่ โดยพิมพ์ชื่อภาคผนวกกึ่งกลางที่หัวหน้าแรกของตนเอง
    pg = Pages()
    pg.page(None)
    pg.p('', before=300)
    pg.p([('ภาคผนวก', True)], size=18, align='center')
    return pg


def build_bio(start):
    pg = Pages()
    TAB = [(2.3, WD_TAB_ALIGNMENT.LEFT)]
    for i, s in enumerate(BOOK['students']):
        # หน้าแรกของประวัติผู้เขียนไม่พิมพ์เลขหน้า (ข้อ 3.4)
        pg.page(None if i == 0 else str(start + i))
        pg.p([('ประวัติผู้เขียน', True)], size=18, align='center', after=16)
        pg.picture(os.path.join(HERE, 'assets', 'people', s['photo']), 4 / 2.54)
        rows = [('ชื่อ – นามสกุล', '%s%s' % (s['prefix'], s['th']), True),   # ข้อ 3.9 ชื่อ นามสกุล ใช้ตัวหนา
                ('รหัสนักศึกษา', s['id']),
                ('วัน เดือน ปี เกิด', s['dob']), ('ภูมิลำเนา', s['home']), ('ที่อยู่ปัจจุบัน', s['addr']),
                ('อีเมล', s['email']), ('ประวัติการศึกษา', s['edu'][0])]
        for j, row in enumerate(rows):
            k, v, bold = row if len(row) == 3 else row + (False,)
            pg.p([(k, True), ('\t' + v, bold)], tabs=TAB, left=2.3, hanging=2.3, before=24 if j == 0 else 0)
        for v in s['edu'][1:]:
            pg.p('\t' + v, tabs=TAB, left=2.3, hanging=2.3)
    return pg


# ---------------------------------------------------------------------
def main():
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK)
    ref = bt.make_reference(WORK)

    ch = {n: chapter_md(n) for n in range(1, 6)}
    ch[2], refs = split_refs(ch[2])
    rdir = os.path.join(HERE, 'รูปเล่ม')
    body = [('ch%d' % n, ch[n], rdir) for n in range(1, 6)] + [('refs', refs, rdir)]

    print('เนื้อความ')
    page, pdfs, marks = 1, [], []
    for name, md, rd in body:
        docx = pandoc_part(name, md, rd, ref)
        pdf, n, found = build_body_part(name, docx, page)
        pdfs.append(pdf)
        marks.append((name, found))
        page += n

    div_page = page
    div_pdf = to_pdf(build_divider(page).save(os.path.join(WORK, 'appx-divider.docx')))
    pdfs.append(div_pdf)
    page += pages_of(div_pdf)

    for name, md, rd in [('appx', srs_appendix_md(), HERE), ('appx2', appendix_b_md(), rdir),
                         ('appx3', appendix_rtm_md(), rdir), ('appx4', appendix_c_md(), HERE),
                         ('appx5', appendix_d_md(), rdir), ('appx6', appendix_code_md(), rdir),
                         ('appx7', appendix_e_md(), HERE), ('appx8', appendix_h_md(), rdir)]:
        docx = pandoc_part(name, md, rd, ref)
        pdf, n, found = build_body_part(name, docx, page)
        pdfs.append(pdf)
        marks.append((name, found))
        page += n

    bio_page = page
    bio_pdf = to_pdf(build_bio(page).save(os.path.join(WORK, 'bio.docx')))
    pdfs.append(bio_pdf)
    last = page + pages_of(bio_pdf) - 1

    # ---- รายการในสารบัญ ----
    toc, figs, tabs = [], [], []
    for name, found in marks:
        if name.startswith('ch'):
            h1 = [x for x in found if x[0] == 'Heading1']
            toc.append(('%s %s' % (h1[0][1], h1[1][1]), h1[0][2], 0, True, True))
            for st, text, pg_ in found:
                if st == 'Heading2' and re.match(r'^\d+\.\d+ ', text):
                    toc.append((text, pg_, 1, False, False))
        elif name == 'refs':
            toc.append(('เอกสารอ้างอิง', found[0][2], 0, True, True))
        elif name.startswith('appx'):
            if name == 'appx':
                toc.append(('ภาคผนวก', div_page, 0, True, True))
            h1 = [x for x in found if x[0] == 'Heading1']
            toc.append(('%s %s' % (h1[0][1], h1[1][1]), h1[0][2], 1, False, False))
        for st, text, pg_ in found:
            if st == 'ImageCaption' and text.startswith('รูปที่'):
                figs.append((text, pg_, 0, False, False))
            if st == 'TableCaption' and text.startswith('ตารางที่') and not text.endswith('(ต่อ)'):
                tabs.append((text, pg_, 0, False, False))
    toc.append(('ประวัติผู้เขียน', bio_page, 0, True, True))

    alltext = '\n'.join(ch.values()) + srs_appendix_md() + appendix_b_md() + appendix_rtm_md() + appendix_c_md() + appendix_d_md() + appendix_code_md() + appendix_e_md() + appendix_h_md() + refs
    abbr = {k: v for k, v in ABBR.items() if re.search(r'(?<![A-Za-z])%s(?![A-Za-z])' % re.escape(k), alltext)}

    print('ส่วนนำ')
    front_pdf = to_pdf(build_front(toc, figs, tabs, abbr).save(os.path.join(WORK, 'front.docx')))
    print('  ✓ ส่วนนำ %d หน้า' % pages_of(front_pdf))

    book = os.path.join(OUT, 'ปริญญานิพนธ์_อำพรOMS_รวมเล่ม.pdf')
    sh(['pdfunite', front_pdf] + pdfs + [book])
    print('รวมเล่ม %s  (%d หน้า · เนื้อความ 1–%d)' % (book, pages_of(book), last))


if __name__ == '__main__':
    main()
