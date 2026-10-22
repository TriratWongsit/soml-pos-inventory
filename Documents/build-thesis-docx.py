#!/usr/bin/env python3
# coding: utf-8
# ---------------------------------------------------------------------
# แปลงบทของปริญญานิพนธ์จาก Markdown เป็นไฟล์ Word ตามคู่มือปริญญานิพนธ์
# คณะวิศวกรรมศาสตร์ มทร.ล้านนา พ.ศ. 2568 บทที่ 3 การจัดพิมพ์รายงาน
#
#   python3 build-thesis-docx.py รูปเล่ม/บทที่1_ฉบับตรวจแก้.md ...
#
# ข้อกำหนดที่ทำตาม
#   3.1 ตัวอักษร TH Sarabun New ขนาด 16 พอยต์ สีดำ จัดข้อความแบบกระจายแบบไทย
#   3.2 กระดาษ A4 พิมพ์หน้าเดียว
#   3.3 ขอบบน 1.5 นิ้ว ขอบซ้าย 1.5 นิ้ว ขอบขวา 1 นิ้ว ขอบล่าง 1 นิ้ว
#   3.4 เลขหน้าอยู่ห่างขอบบน 1 นิ้ว ชิดขอบขวา ตัวปกติ 16 พอยต์
#       หน้าแรกของบทไม่ใส่เลขหน้า แต่นับรวมด้วย
#   3.5 ชื่อบทตัวหนา 18 พอยต์ กึ่งกลาง · หัวข้อสำคัญตัวหนา 16 พอยต์ ชิดซ้าย
#       หัวข้อย่อยตัวหนา 16 พอยต์ ระดับแรกเยื้อง 0.5 นิ้ว ระดับถัดไปตรงกับอักษรตัวแรกของชื่อหัวข้อก่อนหน้า (indent_by_level)
#   3.6 ตัวอักษรในตารางขนาด 12 พอยต์ ชื่อตารางอยู่เหนือตาราง ชิดซ้าย
#   3.7 ชื่อรูปอยู่ใต้รูป กึ่งกลางหน้ากระดาษ
# ---------------------------------------------------------------------
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from table_widths import content_widths, apply_widths
import io, os, re, shutil, subprocess, sys, tempfile, zipfile

FONT = 'TH Sarabun New'
SZ_BODY, SZ_CHAPTER, SZ_TABLE = 32, 36, 24     # หน่วยครึ่งพอยต์: 16, 18, 12 พอยต์
INDENT = 720                                    # 0.5 นิ้ว = 720 ทวิป
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

FONTS = '<w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:cs="{f}" w:eastAsia="{f}"/>'.format(f=FONT)


def style(sid, name, based, ppr, rpr, stype='paragraph'):
    return ('<w:style w:type="%s" w:styleId="%s"><w:name w:val="%s"/>'
            '<w:basedOn w:val="%s"/><w:qFormat/>%s%s</w:style>'
            % (stype, sid, name, based,
               ('<w:pPr>%s</w:pPr>' % ppr) if ppr else '',
               ('<w:rPr>%s</w:rPr>' % rpr) if rpr else ''))


def make_reference(work):
    """สร้างไฟล์อ้างอิงรูปแบบจากค่าเริ่มต้นของ pandoc แล้วเขียนทับสไตล์ตามคู่มือ"""
    ref = os.path.join(work, 'pandoc-ref.docx')
    with open(ref, 'wb') as fh:
        fh.write(subprocess.run(['pandoc', '--print-default-data-file', 'reference.docx'],
                                capture_output=True).stdout)
    root = os.path.join(work, 'ref')
    os.makedirs(root)
    with zipfile.ZipFile(ref) as z:
        z.extractall(root)

    p = os.path.join(root, 'word', 'styles.xml')
    s = io.open(p, encoding='utf-8').read()

    # ค่าตั้งต้นของทั้งเอกสาร ตามข้อ 3.1
    s = re.sub(r'<w:docDefaults>.*?</w:docDefaults>',
               '<w:docDefaults><w:rPrDefault><w:rPr>' + FONTS +
               '<w:color w:val="000000"/><w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (SZ_BODY, SZ_BODY) +
               '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>'
               '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>'
               '</w:pPr></w:pPrDefault></w:docDefaults>', s, flags=re.S)

    # ลบสไตล์เดิมที่จะเขียนทับ เพื่อไม่ให้มีสองนิยามซ้อนกัน
    for sid in ['Normal', 'BodyText', 'FirstParagraph', 'Compact', 'Heading1', 'Heading2',
                'Heading3', 'Heading4', 'Heading5', 'Table', 'ImageCaption', 'TableCaption',
                'SourceCode', 'VerbatimChar']:
        s = re.sub(r'<w:style [^>]*w:styleId="%s".*?</w:style>' % sid, '', s, flags=re.S)

    body_ppr = '<w:jc w:val="both"/><w:ind w:firstLine="%d"/>' % INDENT
    add = [
        # เนื้อความปกติ ย่อหน้าแรกเข้า 0.5 นิ้ว จัดแบบกระจายแบบไทย
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>'
        '<w:qFormat/><w:pPr>' + body_ppr + '</w:pPr><w:rPr>' + FONTS +
        '<w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr></w:style>' % (SZ_BODY, SZ_BODY),
        style('BodyText', 'Body Text', 'Normal', body_ppr, ''),
        style('FirstParagraph', 'First Paragraph', 'Normal', body_ppr, ''),
        # ย่อหน้าในช่องตาราง ไม่ต้องย่อหน้าและใช้ขนาด 12 พอยต์ ตามข้อ 3.6.1
        style('Compact', 'Compact', 'Normal',
              '<w:jc w:val="left"/><w:ind w:firstLine="0"/><w:spacing w:after="0"/>',
              '<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (SZ_TABLE, SZ_TABLE)),
        # ชื่อบท ตัวหนา 18 พอยต์ กึ่งกลาง ตามข้อ 3.5.1
        style('Heading1', 'heading 1', 'Normal',
              '<w:keepNext/><w:jc w:val="center"/><w:ind w:firstLine="0"/>'
              '<w:spacing w:after="240"/><w:outlineLvl w:val="0"/>',
              '<w:b/><w:bCs/><w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (SZ_CHAPTER, SZ_CHAPTER)),
        # หัวข้อสำคัญ ชิดซ้าย เว้นหนึ่งบรรทัดก่อนหัวข้อ ตามข้อ 3.5.2
        style('Heading2', 'heading 2', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:left="0" w:firstLine="0"/>'
              '<w:spacing w:before="426" w:after="0"/><w:outlineLvl w:val="1"/>',
              '<w:b/><w:bCs/>'),
        # หัวข้อย่อยระดับที่หนึ่งและสอง ย่อหน้าเข้าไประดับละ 0.5 นิ้ว ตามข้อ 3.5.4
        style('Heading3', 'heading 3', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:left="%d" w:firstLine="0"/>'
              '<w:spacing w:before="426" w:after="0"/><w:outlineLvl w:val="2"/>' % INDENT,
              '<w:b/><w:bCs/>'),
        style('Heading4', 'heading 4', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:left="%d" w:firstLine="0"/>'
              '<w:spacing w:before="213" w:after="0"/><w:outlineLvl w:val="3"/>' % LEVEL_AT[4],
              '<w:b/><w:bCs/>'),
        style('Heading5', 'heading 5', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:left="%d" w:firstLine="0"/>'
              '<w:spacing w:before="213" w:after="0"/><w:outlineLvl w:val="4"/>' % LEVEL_AT[5],
              '<w:b/><w:bCs/>'),
        # ชื่อตารางและชื่อรูป ไม่ย่อหน้า ชื่อรูปจัดกึ่งกลางตามข้อ 3.7.2
        style('TableCaption', 'Table Caption', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:firstLine="0"/><w:spacing w:before="426"/>', ''),
        style('ImageCaption', 'Image Caption', 'Normal',
              '<w:jc w:val="center"/><w:ind w:firstLine="0"/><w:spacing w:after="426"/>', ''),
        # ที่มาของรูปที่ไม่ได้สร้างเอง เช่น สัญลักษณ์ของเทคโนโลยี อยู่ใต้ชื่อรูป จัดกึ่งกลาง
        style('ImageSource', 'Image Source', 'Normal',
              '<w:jc w:val="center"/><w:ind w:firstLine="0"/><w:spacing w:after="240"/>', ''),
        # ซอร์สโค้ดในภาคผนวก ข ชิดซ้าย ไม่ย่อหน้า พื้นหลังเทาอ่อนให้แยกจากเนื้อความ
        # ตัวอักษรละตินใช้ฟอนต์ความกว้างคงที่ 9 พอยต์ ส่วนคำอธิบายภาษาไทยในโค้ดใช้ TH Sarabun New
        '<w:style w:type="paragraph" w:customStyle="1" w:styleId="SourceCode"><w:name w:val="Source Code"/>'
        '<w:basedOn w:val="Normal"/><w:link w:val="VerbatimChar"/><w:pPr>'
        '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>'
        '<w:spacing w:before="120" w:after="240" w:line="240" w:lineRule="auto"/>'
        '<w:ind w:left="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>',
        '<w:style w:type="character" w:customStyle="1" w:styleId="VerbatimChar"><w:name w:val="Verbatim Char"/>'
        '<w:link w:val="SourceCode"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" '
        'w:eastAsia="Courier New" w:cs="TH Sarabun New"/><w:sz w:val="18"/><w:szCs w:val="26"/></w:rPr></w:style>',
        # ตาราง เส้นทึบทุกด้าน ข้อความในตาราง 12 พอยต์
        '<w:style w:type="table" w:styleId="Table"><w:name w:val="Table"/>'
        '<w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>'
        '<w:tblPr><w:tblBorders>' + ''.join(
            '<w:%s w:val="single" w:sz="4" w:space="0" w:color="000000"/>' % side
            for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')) +
        '</w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>'
        '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>'
        '<w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:bCs/></w:rPr></w:tblStylePr></w:style>',
    ]
    s = s.replace('</w:styles>', ''.join(add) + '</w:styles>')
    io.open(p, 'w', encoding='utf-8').write(s)

    out = os.path.join(work, 'reference.docx')
    z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
    for base, _, files in os.walk(root):
        for fn in files:
            full = os.path.join(base, fn)
            z.write(full, os.path.relpath(full, root))
    z.close()
    return out


HEADER_NUM = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              '<w:hdr %s %s><w:p><w:pPr><w:jc w:val="right"/><w:ind w:firstLine="0"/>'
              '<w:rPr>%s<w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr></w:pPr>'
              '<w:r><w:rPr>%s<w:sz w:val="%d"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'
              '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
              '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
              '<w:r><w:rPr>%s<w:sz w:val="%d"/></w:rPr><w:t>1</w:t></w:r>'
              '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>'
              % (W, R, FONTS, SZ_BODY, SZ_BODY, FONTS, SZ_BODY, FONTS, SZ_BODY))
HEADER_BLANK = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<w:hdr %s %s><w:p><w:pPr><w:jc w:val="right"/><w:ind w:firstLine="0"/></w:pPr></w:p></w:hdr>'
                % (W, R))

SECT = ('<w:sectPr><w:headerReference r:id="rIdHdrNum" w:type="default"/>'
        '<w:headerReference r:id="rIdHdrFirst" w:type="first"/>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="2160" w:right="1440" w:bottom="1440" w:left="2160" '
        'w:header="1440" w:footer="1440" w:gutter="0"/>'
        '<w:titlePg/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>')


def postprocess(docx):
    zin = zipfile.ZipFile(docx)
    doc = zin.read('word/document.xml').decode('utf-8')
    rels = zin.read('word/_rels/document.xml.rels').decode('utf-8')
    ctypes = zin.read('[Content_Types].xml').decode('utf-8')

    # ---- หน้ากระดาษ ระยะขอบ และเลขหน้า ตามข้อ 3.3 และ 3.4 ----
    doc = re.sub(r'<w:sectPr.*?</w:sectPr>', SECT, doc, flags=re.S)
    rels = rels.replace('</Relationships>',
        '<Relationship Id="rIdHdrNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
        '<Relationship Id="rIdHdrFirst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>'
        '</Relationships>')
    if '/word/header1.xml' not in ctypes:
        ctypes = ctypes.replace('</Types>',
            '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
            '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
            '</Types>')

    paras = [m.group() for m in re.finditer(r'<w:p(?: [^>]*)?>.*?</w:p>', doc[doc.index('<w:body>'):], re.S)]

    def text_of(p):
        return ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))

    def first_bold(p):
        # คำบรรยายรูปและตารางขึ้นต้นด้วย **รูปที่ N.N** ตัวหนาเสมอ
        # ย่อหน้าเนื้อความที่ขึ้นต้นว่า "รูปที่ 3.11 แสดง..." เป็นตัวธรรมดา ไม่ใช่คำบรรยาย
        r = re.search(r'<w:r(?: [^>]*)?>.*?</w:r>', p, re.S)
        return bool(r) and re.search(r'<w:b\s*/>', r.group()) is not None

    def set_style(p, sid):
        s = re.sub(r'<w:pStyle w:val="[^"]+"\s*/>', '', p)
        if '<w:pPr>' in s:
            return s.replace('<w:pPr>', '<w:pPr><w:pStyle w:val="%s"/>' % sid, 1)
        return re.sub(r'(<w:p(?: [^>]*)?>)', r'\1<w:pPr><w:pStyle w:val="%s"/></w:pPr>' % sid, s, count=1)

    # ---- เส้นคั่นแนวนอนจากไฟล์ต้นทาง ไม่มีในรูปแบบของคู่มือ ----
    doc = re.sub(r'<w:p(?: [^>]*)?><w:pPr><w:pBdr>.*?</w:p>', '', doc, flags=re.S)

    paras = [m.group() for m in re.finditer(r'<w:p(?: [^>]*)?>.*?</w:p>', doc[doc.index('<w:body>'):], re.S)]
    heads = [p for p in paras if re.search(r'<w:pStyle w:val="Heading\d"', p)]
    # ชื่อบทซึ่งอยู่ถัดจากคำว่า "บทที่ N" ต้องจัดกึ่งกลางตัวหนา 18 พอยต์เช่นเดียวกัน
    if len(heads) >= 2 and text_of(heads[0]).startswith('บทที่'):
        doc = doc.replace(heads[1], set_style(heads[1], 'Heading1'), 1)

    # ---- ตารางต้องเต็มความกว้างของกรอบพิมพ์ และให้ Word เกลี่ยความกว้างคอลัมน์ตามเนื้อหา ----
    TEXT_WIDTH_TW = 8306   # A4 กว้าง 11906 ทวิป หักขอบซ้าย 1.5 นิ้วและขอบขวา 1 นิ้ว

    def fit_table(m):
        # ความกว้างคอลัมน์คำนวณจากข้อความจริง (table_widths.py) — คอลัมน์รหัสหรือตัวเลขแคบพอดี
        # คอลัมน์ข้อความยาวได้พื้นที่ที่เหลือ แทนการให้โปรแกรมแบ่งเท่ากันจนตารางดูโหรงเหรง
        t = m.group()
        t = re.sub(r'<w:tblW[^/]*/>', '', t)
        t = t.replace('<w:tblPr>', '<w:tblPr><w:tblW w:w="5000" w:type="pct"/>', 1)
        return apply_widths(t, content_widths(t, TEXT_WIDTH_TW, int(SZ_TABLE * 4.3)))

    doc = re.sub(r'<w:tbl>.*?</w:tbl>', fit_table, doc, flags=re.S)

    # ---- รูปต้องอยู่ในกรอบพิมพ์ทั้งกว้างและสูง พร้อมที่ว่างสำหรับชื่อรูปใต้รูปในหน้าเดียวกัน (ข้อ 3.7) ----
    # pandoc จำกัดแค่ความกว้าง รูปแนวตั้งยาว ๆ เช่น แผนภาพกรณีการใช้งานทั้งระบบ จึงล้นขอบล่างจนรูปขาด
    # ความสูงของกรอบพิมพ์ 9.19 นิ้ว (A4 11.69 หักขอบบน 1.5 ขอบล่าง 1) เผื่อชื่อรูปและระยะเว้นไว้ 1.2 นิ้ว
    EMU = 914400
    MAX_W, MAX_H = TEXT_WIDTH_TW * 635, int(8.0 * EMU)

    def fit_drawing(m):
        d = m.group()
        ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', d)
        if not ext:
            return d
        cx, cy = int(ext.group(1)), int(ext.group(2))
        k = min(1.0, MAX_W / cx, MAX_H / cy)
        if k >= 1.0:
            return d
        nx, ny = int(cx * k), int(cy * k)
        d = d.replace(ext.group(), '<wp:extent cx="%d" cy="%d"' % (nx, ny))
        return re.sub(r'<a:ext cx="%d" cy="%d"' % (cx, cy), '<a:ext cx="%d" cy="%d"' % (nx, ny), d)

    doc = re.sub(r'<w:drawing>.*?</w:drawing>', fit_drawing, doc, flags=re.S)
    # รายการย่อหน้าต้องอ่านใหม่หลังปรับขนาดรูป ไม่งั้นการจัดรูปกึ่งกลางด้านล่างหาย่อหน้าเดิมไม่เจอ
    paras = [m.group() for m in re.finditer(r'<w:p(?: [^>]*)?>.*?</w:p>', doc[doc.index('<w:body>'):], re.S)]

    # ---- หัวข้อระดับบทถัดจากบทแรก เช่น เอกสารอ้างอิง ต้องขึ้นหน้าใหม่ ตามข้อ 3.5.1 ----
    for p in [h for h in heads[2:] if re.search(r'<w:pStyle w:val="Heading1"', h)]:
        doc = doc.replace(p, p.replace('<w:pPr>', '<w:pPr><w:pageBreakBefore/>', 1), 1)

    for p in paras:
        t = text_of(p).strip()
        if '<w:drawing>' in p and not t:
            # ย่อหน้าที่มีแต่รูป ต้องจัดกึ่งกลางและไม่ย่อหน้าแรก ตามข้อ 3.7
            # keepNext ทำให้รูปกับชื่อรูปไม่ถูกแยกคนละหน้า
            # แทน pPr ทั้งก้อน (ลำดับตามสคีมา) และไม่ใช้สไตล์เนื้อความ เพราะสไตล์นั้นย่อหน้าบรรทัดแรก 0.5 นิ้ว
            # ทำให้รูปเยื้องไปทางขวาและล้นขอบขวาเมื่อรูปกว้างเต็มกรอบพิมพ์
            ppr = ('<w:pPr><w:keepNext/><w:spacing w:before="426" w:after="60"/>'
                   '<w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="center"/></w:pPr>')
            q = re.sub(r'<w:pPr>.*?</w:pPr>', ppr, p, count=1, flags=re.S) if '<w:pPr>' in p else \
                re.sub(r'^(<w:p(?: [^>]*)?>)', r'\1' + ppr, p, count=1)
            doc = doc.replace(p, q, 1)
        elif not t and ('<w:pBdr>' in p or 'o:hr=' in p):
            # เส้นคั่นแนวนอนจากไฟล์ต้นทาง ไม่มีในรูปแบบของคู่มือ
            # pandoc เขียนออกมาเป็นรูปวาด VML ที่มี o:hr="t" ไม่ใช่เส้นขอบย่อหน้า
            doc = doc.replace(p, '', 1)
        elif re.match(r'^\[\d+\]\s', t):
            # รายการเอกสารอ้างอิงเริ่มชิดซ้าย ไม่ย่อหน้าแรก และไม่จัดแบบกระจาย
            # เพราะรายการที่มี URL ยาวตัดบรรทัดไม่ได้ จะถูกยืดจนตัวอักษรห่างผิดปกติ
            doc = doc.replace(p, p.replace(
                '<w:pPr>', '<w:pPr><w:jc w:val="left"/><w:ind w:firstLine="0"/>', 1), 1)
        elif re.match(r'^ตารางที่\s', t) and first_bold(p):
            doc = doc.replace(p, set_style(p, 'TableCaption'), 1)
        elif re.match(r'^รูปที่\s', t) and first_bold(p):
            doc = doc.replace(p, set_style(p, 'ImageCaption'), 1)
        elif re.match(r'^ที่มา \(https?://', t):
            doc = doc.replace(p, set_style(p, 'ImageSource'), 1)

    # ชื่อรูปที่มีบรรทัดที่มาตามหลัง ต้องอยู่หน้าเดียวกับบรรทัดที่มา และไม่เว้นระยะคั่นกลาง
    doc = re.sub(r'(<w:p(?: [^>]*)?><w:pPr><w:pStyle w:val="ImageCaption"/>)(.*?</w:p>)(\s*<w:p(?: [^>]*)?><w:pPr><w:pStyle w:val="ImageSource"/>)',
                 lambda m: m.group(1) + '<w:keepNext/><w:spacing w:after="0"/>' + m.group(2) + m.group(3), doc, flags=re.S)
    # รายการเลขแบบชิดกัน pandoc ใช้สไตล์ Compact ซึ่งเป็นสไตล์ของช่องตาราง (12 พอยต์)
    # นอกตารางต้องเป็นตัวอักษรเนื้อความ 16 พอยต์ ตามข้อ 3.1
    def body_compact(m):
        x = m.group()
        return x if x.startswith('<w:tbl') else re.sub(r'<w:pStyle w:val="Compact"\s*/>', '<w:pStyle w:val="BodyText"/>', x)
    doc = re.sub(r'<w:tbl>.*?</w:tbl>|<w:p(?: [^>]*)?>.*?</w:p>', body_compact, doc, flags=re.S)
    # ข้อความต่อจากตารางเว้นหนึ่งบรรทัด ตามตัวอย่างการพิมพ์ตารางในคู่มือ (หนึ่งบรรทัดของ TH Sarabun New 16 พอยต์ สูง 21.3 พอยต์ = 426 ทวิป วัดจากเล่มจริง)
    def gap_after_table(m):
        p = m.group(2)
        if 'w:before="426"' in p or 'TableCaption' in p:
            return m.group()
        if '<w:pPr>' in p:
            p = re.sub(r'(<w:pPr>(?:<w:pStyle [^>]*/>)?)', r'\1<w:spacing w:before="426"/>', p, count=1) if '<w:spacing' not in p.split('</w:pPr>')[0] \
                else re.sub(r'<w:spacing (?:w:before="\d+" )?', '<w:spacing w:before="426" ', p, count=1)
        else:
            p = re.sub(r'^(<w:p(?: [^>]*)?>)', r'\1<w:pPr><w:spacing w:before="426"/></w:pPr>', p, count=1)
        return m.group(1) + p
    doc = re.sub(r'(</w:tbl>\s*)(<w:p(?: [^>]*)?>.*?</w:p>)', gap_after_table, doc, flags=re.S)
    doc = indent_by_level(doc, text_of)
    doc = keep_with_code(doc)

    tmp = docx + '.tmp'
    zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        data = {'word/document.xml': doc.encode('utf-8'),
                'word/_rels/document.xml.rels': rels.encode('utf-8'),
                '[Content_Types].xml': ctypes.encode('utf-8')}.get(item.filename)
        zout.writestr(item, data if data is not None else zin.read(item.filename))
    zout.writestr('word/header1.xml', HEADER_NUM.encode('utf-8'))
    zout.writestr('word/header2.xml', HEADER_BLANK.encode('utf-8'))
    zout.close(); zin.close()
    shutil.move(tmp, docx)


# ตำแหน่งเริ่มของหมายเลขหัวข้อแต่ละระดับ วัดจากขอบซ้ายของกรอบพิมพ์ (ทวิป) ตามข้อ 3.5.4
#   ระดับ 3 (1.1.1) เยื้อง 0.5 นิ้ว
#   ระดับถัดไปเริ่มตรงกับอักษรตัวแรกของชื่อหัวข้อระดับก่อนหน้า
#   วัดจากเล่มจริง: "1.4.1 " ตัวหนา กว้าง 0.38 นิ้ว · "1.4.1.1 " กว้าง 0.49 นิ้ว · "1) " กว้าง 0.25 นิ้ว
LEVEL_AT = {2: 0, 3: INDENT, 4: 1267, 5: 1973, 6: 2333}
STEP_HANG = 300                                         # ความกว้างของ "1. " ที่ 16 พอยต์


def indent_by_level(doc, text_of):
    """
    ย่อหน้าตามระดับหัวข้อ ตามข้อ 3.5.4 และตัวอย่างการพิมพ์หัวข้อย่อยระดับต่าง ๆ ในคู่มือ

        1.1 หัวข้อหลัก
        //////เนื้อความ (0.5 นิ้ว)
        //////1.1.1 หัวข้อรอง
                  เนื้อความ และ 1.1.1.1 เริ่มตรงกับอักษรตัวแรกของชื่อหัวข้อรอง
                          เนื้อความใต้ 1.1.1.1 และ 1) เริ่มตรงกับอักษรตัวแรกหลังหมายเลข 1.1.1.1

    บรรทัดแรกของเนื้อความใต้หัวข้อระดับใด เริ่มที่ตำแหน่งของหัวข้อระดับถัดไป
    บรรทัดถัดไปของทุกย่อหน้ากลับมาชิดขอบซ้ายตามตัวอย่างในคู่มือ
    หัวข้อที่มีแต่หมายเลข (prepare() รวมเข้ากับย่อหน้าถัดไป) เช่น "1.4.1.1 ระบบถูกออกแบบ..."
    เป็นย่อหน้าธรรมดาที่ขึ้นต้นด้วยหมายเลข จึงตั้งระยะของหมายเลขนั้นตรงนี้
    ไม่แตะตาราง รูป คำบรรยาย รายการ และย่อหน้าที่กำหนดระยะไว้เองแล้ว เช่น เอกสารอ้างอิง
    """
    head_depth = {'Heading1': 2, 'Heading2': 2, 'Heading3': 3, 'Heading4': 4, 'Heading5': 5}
    state = {'depth': 2}

    def fix(m):
        x = m.group()
        if x.startswith('<w:tbl'):
            return x
        st = re.search(r'<w:pStyle w:val="([^"]+)"', x)
        st = st.group(1) if st else None
        if st in head_depth:
            state['depth'] = head_depth[st]
            return x
        t = text_of(x).strip()
        ppr = re.search(r'<w:pPr>.*?</w:pPr>', x, re.S)
        ppr = ppr.group() if ppr else ''
        if (st not in (None, 'BodyText', 'FirstParagraph') or not t or '<w:drawing>' in x
                or '<w:numPr>' in ppr or '<w:ind ' in ppr or 'w:val="center"' in ppr):
            return x
        num = re.match(r'^((?:\d+|ก)(?:\.\d+){2,})\s', t)
        if num:
            depth = min(num.group(1).count('.') + 1, 5)  # 1.4.1.1 → 4
            at = LEVEL_AT[depth]
            state['depth'] = depth
        else:
            at = LEVEL_AT[min(state['depth'], 5) + 1]
        if not num and re.match(r'^\d+\. ', t):
            # ขั้นตอนลำดับเลข เลขข้ออยู่ที่ระยะของเนื้อความ บรรทัดที่ตัดลงมาตรงกับข้อความหลังเลขข้อ
            # ขั้นตอนสั้นและคอลัมน์แคบ จัดชิดซ้ายเพื่อไม่ให้บรรทัดที่ตัดลงมาถูกยืดจนตัวอักษรห่างกัน
            ind = '<w:ind w:left="%d" w:hanging="%d"/><w:jc w:val="left"/>' % (at + STEP_HANG, STEP_HANG)
        elif at == INDENT:
            return x                                     # 0.5 นิ้ว ตามรูปแบบปกติของเนื้อความอยู่แล้ว
        else:
            ind = '<w:ind w:firstLine="%d"/>' % at
        if ppr:
            # ลำดับใน pPr ตามสคีมา: pStyle ต้องมาก่อน ind
            sty = re.search(r'<w:pStyle [^>]*/>', ppr)
            if sty:
                return x.replace(sty.group(), sty.group() + ind, 1)
            return x.replace('<w:pPr>', '<w:pPr>' + ind, 1)
        return re.sub(r'(<w:p(?: [^>]*)?>)', r'\1<w:pPr>%s</w:pPr>' % ind, x, count=1)

    body_at = doc.index('<w:body>')
    return doc[:body_at] + re.sub(r'<w:tbl>.*?</w:tbl>|<w:p(?: [^>]*)?>.*?</w:p>', fix, doc[body_at:], flags=re.S)


def keep_with_code(doc):
    """
    ย่อหน้าที่บอกชื่อไฟล์และเลขบรรทัดของโค้ด (ภาคผนวก ข) ต้องอยู่หน้าเดียวกับโค้ดที่ตามมา
    จึงตั้ง keepNext ให้ย่อหน้าที่อยู่ก่อนย่อหน้าสไตล์ SourceCode ทุกย่อหน้า
    """
    body_at = doc.index('<w:body>')
    body = doc[body_at:]
    items = list(re.finditer(r'<w:tbl>.*?</w:tbl>|<w:p(?: [^>]*)?>.*?</w:p>', body, re.S))
    out, last = [], 0
    for i, m in enumerate(items):
        x = m.group()
        nxt = items[i + 1].group() if i + 1 < len(items) else ''
        if (x.startswith('<w:p') and 'w:val="SourceCode"' in nxt and 'w:val="SourceCode"' not in x
                and '<w:keepNext/>' not in x):
            sty = re.search(r'<w:pStyle [^>]*/>', x)
            if sty:
                x = x.replace(sty.group(), sty.group() + '<w:keepNext/>', 1)
            elif '<w:pPr>' in x:
                x = x.replace('<w:pPr>', '<w:pPr><w:keepNext/>', 1)
            else:
                x = re.sub(r'(<w:p(?: [^>]*)?>)', r'\1<w:pPr><w:keepNext/></w:pPr>', x, count=1)
        out.append(body[last:m.start()])
        out.append(x)
        last = m.end()
    out.append(body[last:])
    return doc[:body_at] + ''.join(out)


def prepare(src, work):
    """
    หัวข้อย่อยที่มีแต่หมายเลข เช่น 1.4.6.2 ต้องพิมพ์นำหน้าข้อความในย่อหน้าเดียวกัน
    ไม่ใช่ลอยอยู่บรรทัดบนตามลำพัง จึงรวมเข้ากับย่อหน้าถัดไปก่อนส่งให้ pandoc
    ส่วนหัวข้อย่อยที่มีชื่อกำกับ เช่น 1.4.1 สถาปัตยกรรมระบบแบบ 3 ชั้น ยังคงเป็นหัวข้อตามเดิม
    """
    lines = io.open(src, encoding='utf-8').read().split('\n')
    out, pending = [], None
    for line in lines:
        m = re.match(r'^#{3,6}\s+(\d+(?:\.\d+)+)\s*$', line)
        if m:
            pending = m.group(1)
            continue
        if pending:
            if not line.strip():
                continue
            line = '%s %s' % (pending, line)
            pending = None
        # ข้อย่อยแบบ (1) (2) ต้องเป็นย่อหน้าธรรมดาที่ย่อหน้าแรกเข้าไป ไม่ใช่รายการอัตโนมัติ
        # ซึ่งจะดันบรรทัดถัดไปให้ตรงกับข้อความแทนที่จะกลับมาชิดขอบซ้าย
        line = re.sub(r'^\((\d+)\) ', r'\\(\1\\) ', line)
        out.append(line)
    tmp = os.path.join(work, os.path.basename(src))
    io.open(tmp, 'w', encoding='utf-8').write('\n'.join(out))
    return tmp


def main(sources):
    here = os.path.dirname(os.path.abspath(__file__))
    work = tempfile.mkdtemp()
    try:
        ref = make_reference(work)
        for src in sources:
            src = src if os.path.isabs(src) else os.path.join(here, src)
            out = os.path.splitext(src)[0] + '.docx'
            # ปิด implicit_figures ไม่งั้น pandoc จะเอาข้อความ alt มาพิมพ์เป็นคำบรรยายซ้ำ
            # กับบรรทัด "รูปที่ N.M" ที่เขียนไว้เองในไฟล์ต้นทาง
            subprocess.run(['pandoc', prepare(src, work),
                            '-f', 'markdown+pipe_tables-implicit_figures',
                            '--reference-doc', ref, '--resource-path', os.path.dirname(src),
                            '-o', out], check=True)
            postprocess(out)
            print('  ✓ %s' % os.path.basename(out))
    finally:
        shutil.rmtree(work)


if __name__ == '__main__':
    main(sys.argv[1:])
