#!/usr/bin/env python3
# coding: utf-8
# ---------------------------------------------------------------------
# ปรับไฟล์ .docx ที่ pandoc สร้าง ให้มีรูปแบบตรงกับเอกสารต้นแบบของรายวิชา
#
#   python3 casex-postprocess.py <ไฟล์.docx> <ไฟล์ต้นแบบ.docx>
#
# ทำสี่อย่าง
#   1. จัดหน้าปก โลโก้กึ่งกลาง ชื่อเรื่องใช้สไตล์ Title และ Subtitle
#   2. ชี้หัวกระดาษและท้ายกระดาษไปยังไฟล์ที่มีอยู่จริง เพราะ pandoc ออกเลข
#      ความสัมพันธ์ใหม่ ทำให้เลขที่อ้างไว้ใน sectPr ของไฟล์ต้นแบบไม่ตรงอีกต่อไป
#   3. ตีกรอบตารางและใส่พื้นหัวตารางสีน้ำเงินเข้มตัวอักษรขาว แบบเดียวกับต้นแบบ
#      ซึ่งต้นแบบก็กำหนดไว้ในตัวตารางโดยตรงเช่นกัน ไม่ได้พึ่งสไตล์ตาราง
#   4. ลบภาพของกรณีศึกษาต้นแบบที่ติดมากับไฟล์อ้างอิงรูปแบบ พร้อมความสัมพันธ์
#      ที่ชี้ไปยังภาพเหล่านั้น มิฉะนั้นแฟ้มจะอ้างถึงไฟล์ที่ไม่มีอยู่
#   5. คัดลอกเนื้อหาหัวกระดาษและท้ายกระดาษจากต้นแบบมาใส่ เพราะ pandoc สร้าง
#      ส่วนนี้ขึ้นใหม่เป็นแฟ้มเปล่า ตราสัญลักษณ์บรรทัดหัวกระดาษจึงหายไป
# ---------------------------------------------------------------------
import re, shutil, sys, zipfile

HEADER_FILL = '183B63'   # สีพื้นหัวตารางเดียวกับต้นแบบ

docx = sys.argv[1]
template = sys.argv[2] if len(sys.argv) > 2 else None
zin = zipfile.ZipFile(docx)
doc = zin.read('word/document.xml').decode('utf-8')
rels = zin.read('word/_rels/document.xml.rels').decode('utf-8')
ctypes = zin.read('[Content_Types].xml').decode('utf-8')

# ---------- 1. หน้าปก ----------
# ขนาดและฟอนต์ของบรรทัดบนหน้าปก คัดมาจากที่ต้นแบบกำหนดไว้ในย่อหน้าโดยตรง
# ต้นแบบไม่ได้ปล่อยให้ใช้ค่าจากสไตล์ เช่นสไตล์ Title กำหนด 36 พอยต์ แต่หน้าปก
# ของต้นแบบเขียนทับเป็น 28 พอยต์ ถ้าไม่คัดมาด้วยชื่อเรื่องจะใหญ่กว่าต้นแบบและตกบรรทัด
SARABUN = 'w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New" w:hint="cs"'
COVER_RUN = {
    'Title':    '<w:rFonts %s/><w:sz w:val="56"/><w:szCs w:val="48"/>' % SARABUN,
    'Subtitle': '<w:rFonts %s/>' % SARABUN,
    'Plain':    '<w:rFonts w:cs="TH Sarabun New" w:hint="cs"/><w:sz w:val="32"/>',
}

def restyle(p, style=None, run_props=None):
    """ตั้งสไตล์ จัดกึ่งกลาง และกำหนดฟอนต์กับขนาดของย่อหน้าเดียว โดยคงเนื้อหาเดิมไว้"""
    s = re.sub(r'<w:pStyle w:val="[^"]+"\s*/>', '', p)
    # ลำดับสมบัติย่อหน้าใน OOXML บังคับให้ pStyle มาก่อน jc เสมอ
    props = (('<w:pStyle w:val="%s"/>' % style) if style else '') + '<w:jc w:val="center"/>'
    if run_props:
        props += '<w:rPr>' + run_props + '</w:rPr>'
    if '<w:pPr>' in s:
        s = s.replace('<w:pPr>', '<w:pPr>' + props, 1)
    else:
        s = re.sub(r'(<w:p(?: [^>]*)?>)', r'\1<w:pPr>' + props + '</w:pPr>', s, count=1)
    if run_props:
        s = re.sub(r'<w:r><w:rPr>', '<w:r><w:rPr>' + run_props, s)
        s = re.sub(r'<w:r>(?!<w:rPr)', '<w:r><w:rPr>' + run_props + '</w:rPr>', s)
    return s

body_at = doc.index('<w:body>')
paras = [m.group() for m in re.finditer(r'<w:p(?: [^>]*)?>.*?</w:p>', doc[body_at:], re.S)][:4]
cover = [(None, None), ('Title', COVER_RUN['Title']),
         ('Subtitle', COVER_RUN['Subtitle']), (None, COVER_RUN['Plain'])]
for para, (style, run_props) in zip(paras, cover):
    doc = doc.replace(para, restyle(para, style, run_props), 1)

# ---------- 2. หัวกระดาษและท้ายกระดาษ ----------
for kind in ('header', 'footer'):
    m = re.search(r'Id="([^"]+)"[^>]*Target="%s1\.xml"' % kind, rels)
    if m:
        doc = re.sub(r'(<w:%sReference r:id=")[^"]+(")' % kind, r'\g<1>%s\g<2>' % m.group(1), doc)

# ---------- 3. เส้นตารางและหัวตาราง ----------
BORDERS = ('<w:tblBorders>' + ''.join(
    '<w:%s w:val="single" w:sz="4" w:space="0" w:color="auto"/>' % side
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')) + '</w:tblBorders>')

def paint_first_row(row):
    """ใส่พื้นสีให้ทุกช่องในแถวหัวตาราง และทำตัวอักษรเป็นสีขาวตัวหนา"""
    shd = '<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % HEADER_FILL
    # pandoc เขียนสมบัติของช่องเป็นแท็กว่าง <w:tcPr /> เมื่อไม่มีค่าอะไร จึงต้องรับทั้งสองรูปแบบ
    row = re.sub(r'<w:tcPr\s*/>', '<w:tcPr>' + shd + '</w:tcPr>', row)
    row = re.sub(r'<w:tcPr>(?!<w:shd)', '<w:tcPr>' + shd, row)
    row = row.replace('<w:tc><w:p', '<w:tc><w:tcPr>' + shd + '</w:tcPr><w:p')
    row = re.sub(r'<w:rPr>', '<w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/>', row)
    row = re.sub(r'<w:r>(<w:t)', r'<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/></w:rPr>\1', row)
    return row

def fix_table(m):
    t = m.group()
    t = t.replace('<w:tblStyle w:val="Table" />', '<w:tblStyle w:val="TableGrid"/>')
    t = t.replace('<w:tblStyle w:val="Table"/>', '<w:tblStyle w:val="TableGrid"/>')
    if '<w:tblBorders>' not in t:
        t = re.sub(r'(<w:tblStyle[^>]*/>)', r'\1' + BORDERS, t, count=1)
    first = re.search(r'<w:tr(?: [^>]*)?>.*?</w:tr>', t, re.S)
    if first:
        t = t.replace(first.group(), paint_first_row(first.group()), 1)
    return t

doc = re.sub(r'<w:tbl>.*?</w:tbl>', fix_table, doc, flags=re.S)

# ---------- 4. ลบภาพที่ไม่ได้ใช้ พร้อมความสัมพันธ์ของภาพนั้น ----------
ids = set(re.findall(r'r:embed="([^"]+)"', doc)) | set(re.findall(r'r:link="([^"]+)"', doc))
target = dict(re.findall(r'Id="([^"]+)"[^>]*Target="(media/[^"]+)"', rels))
keep = {'word/' + t for i, t in target.items() if i in ids}
drop_ids = [i for i in target if i not in ids]
for i in drop_ids:
    rels = re.sub(r'<Relationship Id="%s"[^>]*/>' % re.escape(i), '', rels)
drop_files = {'word/' + t for i, t in target.items() if i in drop_ids} - keep

# ---------- 5. หัวกระดาษและท้ายกระดาษจากต้นแบบ ----------
parts = {}
if template:
    ztpl = zipfile.ZipFile(template)
    for name, replacements in (('word/header1.xml', [('Case X SRS', 'SOML Use Case SRS')]),
                               ('word/footer1.xml', [])):
        if name in ztpl.namelist():
            text = ztpl.read(name).decode('utf-8')
            for old, new in replacements:
                text = text.replace(old, new)
            parts[name] = text.encode('utf-8')
    ztpl.close()

tmp = docx + '.tmp'
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    if item.filename in drop_files:
        continue
    if item.filename in parts:
        data = parts[item.filename]
    elif item.filename == 'word/document.xml':
        data = doc.encode('utf-8')
    elif item.filename == 'word/_rels/document.xml.rels':
        data = rels.encode('utf-8')
    else:
        data = zin.read(item.filename)
    zout.writestr(item, data)
zout.close(); zin.close()
shutil.move(tmp, docx)
print('  จัดหน้าปก ตาราง หัวกระดาษจากต้นแบบ %d ส่วน และลบภาพที่ไม่ได้ใช้ %d ไฟล์' % (len(parts), len(drop_files)))
