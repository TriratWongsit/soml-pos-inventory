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
#       หัวข้อย่อยตัวหนา 16 พอยต์ ย่อหน้าเข้าไประดับละ 0.5 นิ้ว
#   3.6 ตัวอักษรในตารางขนาด 12 พอยต์ ชื่อตารางอยู่เหนือตาราง ชิดซ้าย
#   3.7 ชื่อรูปอยู่ใต้รูป กึ่งกลางหน้ากระดาษ
# ---------------------------------------------------------------------
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
                'Heading3', 'Heading4', 'Heading5', 'Table', 'ImageCaption', 'TableCaption']:
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
              '<w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="1"/>',
              '<w:b/><w:bCs/>'),
        # หัวข้อย่อยระดับที่หนึ่งและสอง ย่อหน้าเข้าไประดับละ 0.5 นิ้ว ตามข้อ 3.5.4
        style('Heading3', 'heading 3', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:left="%d" w:firstLine="0"/>'
              '<w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="2"/>' % INDENT,
              '<w:b/><w:bCs/>'),
        style('Heading4', 'heading 4', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:left="%d" w:firstLine="0"/>'
              '<w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="3"/>' % (INDENT * 2),
              '<w:b/><w:bCs/>'),
        style('Heading5', 'heading 5', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:left="%d" w:firstLine="0"/>'
              '<w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="4"/>' % (INDENT * 3),
              '<w:b/><w:bCs/>'),
        # ชื่อตารางและชื่อรูป ไม่ย่อหน้า ชื่อรูปจัดกึ่งกลางตามข้อ 3.7.2
        style('TableCaption', 'Table Caption', 'Normal',
              '<w:keepNext/><w:jc w:val="left"/><w:ind w:firstLine="0"/><w:spacing w:before="240"/>', ''),
        style('ImageCaption', 'Image Caption', 'Normal',
              '<w:jc w:val="center"/><w:ind w:firstLine="0"/><w:spacing w:after="240"/>', ''),
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
    def fit_table(m):
        t = m.group()
        t = re.sub(r'<w:tblW[^/]*/>', '', t)
        t = re.sub(r'<w:tblLayout[^/]*/>', '', t)
        t = t.replace('<w:tblPr>', '<w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
                                   '<w:tblLayout w:type="autofit"/>', 1)
        # ความกว้างคอลัมน์ที่ pandoc คำนวณจากไฟล์ต้นทางทำให้บางคอลัมน์แคบจนข้อความหักบรรทัดถี่
        t = re.sub(r'<w:tblGrid>.*?</w:tblGrid>', '', t, flags=re.S)
        t = re.sub(r'<w:tcW[^/]*/>', '', t)
        return t

    doc = re.sub(r'<w:tbl>.*?</w:tbl>', fit_table, doc, flags=re.S)

    # ---- หัวข้อระดับบทถัดจากบทแรก เช่น เอกสารอ้างอิง ต้องขึ้นหน้าใหม่ ตามข้อ 3.5.1 ----
    for p in [h for h in heads[2:] if re.search(r'<w:pStyle w:val="Heading1"', h)]:
        doc = doc.replace(p, p.replace('<w:pPr>', '<w:pPr><w:pageBreakBefore/>', 1), 1)

    for p in paras:
        t = text_of(p).strip()
        if re.match(r'^\[\d+\]\s', t):
            # รายการเอกสารอ้างอิงเริ่มชิดซ้าย ไม่ย่อหน้าแรก
            doc = doc.replace(p, p.replace('<w:pPr>', '<w:pPr><w:ind w:firstLine="0"/>', 1), 1)
        elif re.match(r'^ตารางที่\s', t):
            doc = doc.replace(p, set_style(p, 'TableCaption'), 1)
        elif re.match(r'^รูปที่\s', t):
            doc = doc.replace(p, set_style(p, 'ImageCaption'), 1)

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
            subprocess.run(['pandoc', prepare(src, work), '-f', 'markdown+pipe_tables',
                            '--reference-doc', ref, '--resource-path', os.path.dirname(src),
                            '-o', out], check=True)
            postprocess(out)
            print('  ✓ %s' % os.path.basename(out))
    finally:
        shutil.rmtree(work)


if __name__ == '__main__':
    main(sys.argv[1:])
