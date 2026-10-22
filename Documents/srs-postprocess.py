#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------
# ปรับไฟล์ .docx ที่ pandoc สร้าง ให้ตรงกับเทมเพลต SRS ISO 29148 ของหลักสูตร
#   1. หน้าปก 7 ย่อหน้าแรก: กึ่งกลาง ตัวหนา ขนาดตามเทมเพลต ตัวอักษรดำ แล้วขึ้นหน้าใหม่
#   2. ตาราง: เส้นกรอบดำบาง หัวตารางพื้นเทาอ่อนตัวหนา ตัวอักษร 15 พอยต์ (แบบเรียบ ไม่ใช้สีของเทมเพลต)
#   3. ขอบกระดาษตามเทมเพลต (บน/ซ้าย 1.5 นิ้ว ขวา/ล่าง 1 นิ้ว)
# ---------------------------------------------------------------------
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from table_widths import content_widths, apply_widths
import re, sys, zipfile, shutil

docx = sys.argv[1]
profile = sys.argv[2] if len(sys.argv) > 2 else 'iso'   # iso = เทมเพลตหลักสูตร, w07 = เทมเพลตนักศึกษาสัปดาห์ที่ 7
zin = zipfile.ZipFile(docx)
doc = zin.read('word/document.xml').decode('utf-8')

# ---------- 1. หน้าปก ----------
COVER = [  # (sz, color, before, after) — แบบเรียบ ตัวอักษรดำทั้งหมด (6 บรรทัด ไม่มีบรรทัดมาตรฐาน)
    (46, None, 2000, 160), (40, None, 0, 500),
    (34, None, 0, 90), (30, None, 0, 700), (30, None, 0, 40), (28, None, 500, 0),
]
if profile == 'w07':  # หน้าปกตามเทมเพลต W07: ชื่อเอกสาร ชื่อโครงงาน คำขวัญ แล้วตารางสถานะ/สแนปช็อตอยู่หน้าเดียวกัน
    COVER = [(36, None, 600, 120), (44, None, 0, 200), (26, None, 0, 400),
             (28, None, 0, 60), (28, None, 0, 60), (26, None, 0, 300)]
if profile in ('be', 'survey', 'status', 'testplan', 'ucmap', 'study', 'stake', 'script', 'talk', 'changes', 'appdemo', 'wininstall'):   # สรุปหลังบ้าน แบบประเมิน และสถานะโครงงาน: ชื่อเอกสาร ชื่อระบบ แล้วบรรทัดผู้จัดทำ
    COVER = [(36, None, 400, 120), (42, None, 0, 200), (26, None, 0, 300)]
if profile == 'ucx':  # Use Case X: ชื่อเอกสารและชื่อระบบสองบรรทัด แล้วตารางข้อมูลเอกสารต่อในหน้าเดียวกัน
    COVER = [(36, None, 400, 120), (44, None, 0, 300)]
if profile == 'wininstall':  # คู่มือติดตั้ง เริ่มที่หัวข้อแรกเลย ไม่มีหน้าปก
    COVER = []
PAGE_BREAK_AFTER_COVER = profile not in ('w07', 'ucx', 'be', 'survey', 'status', 'testplan', 'ucmap', 'study', 'stake', 'script', 'talk', 'changes', 'appdemo', 'wininstall')
TEXT_WIDTH = 9638 if profile in ('w07', 'ucx', 'be', 'survey', 'status', 'testplan', 'ucmap', 'study', 'stake', 'script', 'talk', 'changes', 'appdemo', 'wininstall') else 8306      # ความกว้างพื้นที่พิมพ์ A4 หักขอบกระดาษ (twips)
TABLE_SZ = 28 if profile == 'survey' else (26 if profile in ('w07', 'ucx', 'be', 'status', 'testplan', 'ucmap', 'study', 'stake', 'script', 'talk', 'changes', 'appdemo', 'wininstall') else 30)             # ตัวอักษรในตาราง (half-points)
# ประมาณว่าหนึ่งหน้าพิมพ์ได้กี่บรรทัดของตาราง ใช้ตัดสินว่าจะบังคับให้ตารางอยู่หน้าเดียวหรือไม่
TEXT_HEIGHT = 16838 - (2040 if profile in ('w07', 'ucx', 'be') else 3600)   # A4 สูง 16838 ทวิป หักขอบบน-ล่าง
LINE_TW = int(TABLE_SZ * 10 * 1.15)          # ความสูงหนึ่งบรรทัด (half-point → twip = ×10) เผื่อระยะบรรทัด
PAGE_LINES = TEXT_HEIGHT // LINE_TW
CHAR_TW = int(TABLE_SZ * 4.3)                # ความกว้างเฉลี่ยของอักษรไทยหนึ่งตัว ใช้ประมาณจำนวนบรรทัดในเซลล์             # ตัวอักษรในตาราง (half-points)
def style_para(p, sz, color, before, after, page_break=False):
    p = re.sub(r'<w:pPr>.*?</w:pPr>', '', p, count=1, flags=re.S)
    ppr = '<w:pPr><w:jc w:val="center"/><w:spacing w:before="%d" w:after="%d"/></w:pPr>' % (before, after)
    rpr = '<w:rPr><w:b/><w:bCs/>%s<w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr>' % (
        ('<w:color w:val="%s"/>' % color) if color else '', sz, sz)
    p = re.sub(r'<w:rPr>.*?</w:rPr>', '', p, flags=re.S)
    p = p.replace('<w:r>', '<w:r>' + rpr)
    p = re.sub(r'^(<w:p(?: [^>]*)?>)', lambda mm: mm.group(1) + ppr, p, count=1)
    if page_break:
        p = p.replace('</w:p>', '<w:r><w:br w:type="page"/></w:r></w:p>')
    return p

paras = list(re.finditer(r'<w:p[ >].*?</w:p>', doc, re.S))
seen = 0
out, last = [], 0
for m in paras:
    p = m.group(0)
    text = ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))
    is_heading = re.search(r'<w:pStyle w:val="Heading', p) is not None
    if seen < len(COVER) and text.strip() and not is_heading:
        sz, color, before, after = COVER[seen]
        newp = style_para(p, sz, color, before, after, page_break=(PAGE_BREAK_AFTER_COVER and seen == len(COVER) - 1))
        out.append(doc[last:m.start()]); out.append(newp); last = m.end(); seen += 1
    elif seen < len(COVER) and is_heading:
        break
out.append(doc[last:]); doc = ''.join(out)
if not PAGE_BREAK_AFTER_COVER and COVER:  # ขึ้นหน้าใหม่ก่อนหัวข้อแรก เพื่อให้ตารางบนหน้าปกอยู่หน้าเดียวกับชื่อเอกสาร
    doc = re.sub(r'(<w:p(?: [^>]*)?><w:pPr><w:pStyle w:val="Heading1"\s*/>)',
                 lambda m: '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + m.group(1), doc, count=1)

# ---------- 2. ตาราง ----------
BORDERS = ('<w:tblBorders>' + ''.join('<w:%s w:val="single" w:sz="4" w:space="0" w:color="000000"/>' % s
           for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')) + '</w:tblBorders>')
def fix_table(m):
    t = m.group(0)
    t = re.sub(r'<w:tblBorders>.*?</w:tblBorders>', '', t, flags=re.S)
    t = re.sub(r'<w:tblW [^>]*/>', '', t)
    t = re.sub(r'(<w:tblPr>)', r'\1<w:tblW w:w="5000" w:type="pct"/>' + BORDERS, t, count=1)  # ตารางกว้างเต็มหน้า
    # ความกว้างคอลัมน์คำนวณจากข้อความจริงในตาราง (table_widths.py) แทนสัดส่วนจากแถวคั่นหัวตาราง
    t = apply_widths(t, content_widths(t, TEXT_WIDTH, CHAR_TW))
    grid = [int(x) for x in re.findall(r'<w:gridCol w:w="(\d+)"', t)]
    rows = re.findall(r'<w:tr[ >].*?</w:tr>', t, re.S)
    for i, r in enumerate(rows):
        fill = 'F2F2F2' if i == 0 else None
        nr = re.sub(r'<w:tc>(?!<w:tcPr>)', '<w:tc><w:tcPr></w:tcPr>', r)  # ให้ทุกเซลล์มี tcPr ไว้ใส่พื้นสี
        cells = re.findall(r'<w:tc>.*?</w:tc>', nr, re.S)
        for j, c in enumerate(cells):
            if j < len(grid):
                nc = re.sub(r'<w:tcW [^>]*/>', '', c)
                nc = nc.replace('<w:tcPr>', '<w:tcPr><w:tcW w:w="%d" w:type="dxa"/>' % grid[j], 1)
                nr = nr.replace(c, nc, 1)
        if fill:
            nr = re.sub(r'<w:shd [^>]*/>', '', nr)
            nr = re.sub(r'(<w:tcPr>)', r'\1<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % fill, nr)
        rpr = '<w:rPr>%s<w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr>' % ('<w:b/><w:bCs/>' if i == 0 else '', TABLE_SZ, TABLE_SZ)
        nr = re.sub(r'<w:rPr>.*?</w:rPr>', '', nr, flags=re.S)
        nr = nr.replace('<w:r>', '<w:r>' + rpr)
        t = t.replace(r, nr, 1)

    # ประมาณความสูงของตารางเป็นจำนวนบรรทัด จากความยาวข้อความเทียบความกว้างคอลัมน์
    rows = re.findall(r'<w:tr[ >].*?</w:tr>', t, re.S)
    est = 0
    for r in rows:
        cells = re.findall(r'<w:tc>.*?</w:tc>', r, re.S)
        tall = 1
        for j, c in enumerate(cells):
            text = ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', c))
            width_chars = max(4, (grid[j] if j < len(grid) else 2000) // CHAR_TW)
            tall = max(tall, -(-len(text) // width_chars))   # ปัดขึ้น
        est += tall
    fits_one_page = est + 2 <= PAGE_LINES * 0.75   # เผื่อหัวข้อและย่อหน้าก่อนตาราง

    out_rows = []
    for i, r in enumerate(rows):
        nr = r
        if '<w:trPr>' not in nr:
            nr = re.sub(r'^(<w:tr[^>]*>)', r'\1<w:trPr></w:trPr>', nr, count=1)
        # ห้ามแถวเดียวถูกตัดคร่อมสองหน้า และให้หัวตารางซ้ำถ้าตารางยาวเกินหนึ่งหน้า
        keep = '<w:cantSplit/>' + ('<w:tblHeader/>' if i == 0 else '')
        nr = nr.replace('<w:trPr>', '<w:trPr>' + keep, 1)
        # ตารางที่พอในหน้าเดียว: ผูกทุกแถวไว้กับแถวถัดไป Word จึงย้ายทั้งตารางไปหน้าใหม่แทนการแบ่ง
        if fits_one_page and i < len(rows) - 1:
            nr = re.sub(r'<w:p(?= |>)', '<w:p__KEEP__', nr)
        out_rows.append(nr)
        t = t.replace(r, '\x00%d\x00' % i, 1)
    for i, nr in enumerate(out_rows):
        t = t.replace('\x00%d\x00' % i, nr, 1)
    return t
doc = re.sub(r'<w:tbl>.*?</w:tbl>', fix_table, doc, flags=re.S)

def keep_next(m):
    p = m.group(0).replace('<w:p__KEEP__', '<w:p', 1)
    if '<w:pPr>' in p:
        return p.replace('<w:pPr>', '<w:pPr><w:keepNext/>', 1)
    return re.sub(r'^(<w:p(?: [^>]*)?>)', r'\1<w:pPr><w:keepNext/></w:pPr>', p, count=1)
doc = re.sub(r'<w:p__KEEP__(?: [^>]*)?>.*?</w:p>', keep_next, doc, flags=re.S)

# ---------- 3. ขอบกระดาษ ----------
if profile in ('w07', 'ucx', 'be', 'survey', 'status', 'testplan', 'ucmap', 'study', 'stake', 'script', 'talk', 'changes', 'appdemo', 'wininstall'):  # ขอบกระดาษตามเทมเพลต W07 (บน/ล่าง 1.8 ซม. ซ้าย/ขวา 2 ซม.)
    doc = re.sub(r'<w:pgMar [^>]*/>', '<w:pgMar w:top="1020" w:right="1134" w:bottom="1020" w:left="1134" w:header="397" w:footer="397" w:gutter="0"/>', doc)
else:
    doc = re.sub(r'<w:pgMar [^>]*/>', '<w:pgMar w:top="2160" w:right="1440" w:bottom="1440" w:left="2160" w:header="708" w:footer="708" w:gutter="0"/>', doc)

# ---------- 4. หัวข้อสีดำ ตัวหนา ----------
styles = zin.read('word/styles.xml').decode('utf-8')
def blacken(m):
    st = re.sub(r'<w:color w:val="[^"]+"/>', '', m.group(0))
    return st.replace('</w:rPr>', '<w:b/><w:bCs/><w:color w:val="000000"/></w:rPr>', 1) if '<w:rPr>' in st else st
styles = re.sub(r'<w:style [^>]*w:styleId="Heading[1-6]".*?</w:style>', blacken, styles, flags=re.S)

tmp = docx + '.tmp'
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    if item.filename == 'word/document.xml': data = doc.encode('utf-8')
    elif item.filename == 'word/styles.xml': data = styles.encode('utf-8')
    else: data = zin.read(item.filename)
    zout.writestr(item, data)
zout.close(); zin.close(); shutil.move(tmp, docx)
print('  จัดหน้าปก ตาราง และขอบกระดาษแล้ว')
