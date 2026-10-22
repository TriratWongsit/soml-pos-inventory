# -*- coding: utf-8 -*-
# สร้างแบบฟอร์ม ENG.P.03, ENG.P.07/1, ENG.P.07/2 ที่กรอกชื่อโครงงาน นักศึกษา และอาจารย์แล้ว
import os, html
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/Users/triratwongsit/Library/Fonts/THSarabunNew.ttf'
FONTB = '/Users/triratwongsit/Library/Fonts/THSarabunNew Bold.ttf'
FONTI = '/Users/triratwongsit/Library/Fonts/THSarabunNew Italic.ttf'

TITLE_TH = 'ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า กรณีศึกษาร้านวัสดุก่อสร้างอำพรคอนกรีต'
TITLE_EN = 'Order Management and Inventory Control System: A Case Study of Amporn Concrete Construction Materials Store'
STUDENTS = [('นายตรัยรัตน์ วงษ์สิทธิ์', '67543210028-6', 'วิศวกรรมซอฟต์แวร์'),
            ('นายพนาวุฒน์ อภิปสันติ', '67543210040-1', 'วิศวกรรมซอฟต์แวร์'),
            ('', '', '')]
ADVISOR = 'อาจารย์ธนิต เกตุแก้ว'
COURSE = 'ผู้ช่วยศาสตราจารย์ ดร.รุจิพันธุ์ โกษารัตน์'

CSS = '''
@font-face { font-family: S; src: url("file://%s"); }
@font-face { font-family: S; font-weight: bold; src: url("file://%s"); }
@font-face { font-family: S; font-style: italic; src: url("file://%s"); }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: S; font-size: 16pt; line-height: 21pt; color: #000; }
.page { width: 595.3pt; height: 841.9pt; position: relative; padding: 108pt 72pt 0 72pt; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.hdr { position: absolute; top: 20pt; right: 72pt; font-size: 14pt; }
.hdr b { font-family: Cambria, Georgia, serif; font-weight: normal; font-size: 13pt; color: #1f3864; margin-left: 3pt; }
.code { position: absolute; top: 46pt; right: 72pt; font-family: Calibri, Arial, sans-serif; font-weight: bold; font-size: 9.5pt; }
.logo { position: absolute; left: 66pt; top: 82pt; width: 62pt; }
.title { text-align: center; font-weight: bold; margin: 0 0 22pt 0; }
.foot { position: absolute; left: 72pt; right: 72pt; top: 795pt; border-top: 3.5pt solid #92c353; padding-top: 6pt; text-align: right; font-style: italic; font-size: 14pt; }
.f { display: inline-block; border-bottom: 1px dotted #000; line-height: 18pt; text-align: center; vertical-align: baseline; }
.fl { text-align: left; padding-left: 4pt; }
.row { display: flex; align-items: baseline; white-space: nowrap; gap: 0 3pt; }
.d { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: top; letter-spacing: -0.5pt; }
.cl { border-bottom: 1px dotted #000; height: 20pt; }
.pn { display: inline-block; text-align: center; }
.lab { display: inline-block; }
p { margin: 0; }
.ind { text-indent: 36pt; }
table { border-collapse: collapse; width: 100%%; font-size: 14pt; line-height: 18pt; }
td, th { border: 0.75pt solid #000; padding: 1pt 4pt; }
th { font-weight: bold; text-align: center; white-space: nowrap; }
.compact table { line-height: 15.5pt; }
.compact .title { margin-bottom: 14pt; }
td.c { text-align: center; }
.sig { margin-left: 180pt; }
.sig .row { justify-content: flex-start; }
''' % (FONT, FONTB, FONTI)


def f(text, width, left=False):
    # ช่องที่ยังว่างพิมพ์เป็นจุดไข่ปลาเหมือนต้นฉบับ ให้ลายมือเขียนทับได้และอยู่บนเส้นบรรทัดเดียวกับข้อความ
    if not text:
        return '<span class="d" style="width:%spt">%s</span>' % (width, '\u2026' * 60)
    return '<span class="f%s" style="width:%spt">%s</span>' % (' fl' if left else '', width, html.escape(text))


def paren(name, width):
    # ชื่อในวงเล็บใต้ลายเซ็น ตัวธรรมดา กึ่งกลาง ถ้ายังว่างใช้จุดไข่ปลาเหมือนต้นฉบับ
    inner = html.escape(name) if name else '\u2026' * round(width / 8.7)
    return '<span class="pn" style="min-width:%spt">(%s)</span>' % (width, inner)


def head(no, page, title_lines):
    t = ''.join('<div>%s</div>' % x for x in title_lines)
    # ไม่พิมพ์หัวกระดาษของคู่มือรายวิชา (ชื่อคู่มือและเลขหน้าในคู่มือ) เพราะฟอร์มถูกแยกออกมาใช้เดี่ยว ๆ
    # เก็บเฉพาะรหัสฟอร์มไว้อ้างอิง
    return ('<div class="code">%s</div><img class="logo" src="logo.png">'
            '<div class="title">%s</div>') % (no, t)


# ไม่พิมพ์ท้ายกระดาษ (เส้นขอบล่างและชื่อคณะ) และไม่มีเลขหน้า ตามที่ผู้จัดทำขอ
FOOT = ''


def students(label, first_indent):
    out = []
    for i, (n, sid, prog) in enumerate(STUDENTS):
        lab = '<span class="lab" style="width:%spt">%s</span>' % (first_indent, label if i == 0 else '')
        out.append('<div class="row">%s%d.&nbsp;%s&nbsp;&nbsp;รหัสนักศึกษา%s หลักสูตร%s</div>'
                   % (lab, i + 1, f(n, 128), f(sid, 88), f(prog, 92)))
    return ''.join(out)


def titles():
    return ('<div class="row" style="white-space:normal;align-items:flex-start"><span class="lab" style="width:108pt;flex:none">ชื่อเรื่อง (ภาษาไทย)</span>'
            '<span class="f fl" style="flex:1;text-align:left">%s</span></div>'
            '<div class="row" style="white-space:normal;align-items:flex-start;margin-bottom:6pt"><span class="lab" style="width:108pt;flex:none">ชื่อเรื่อง (ภาษาอังกฤษ)</span>'
            '<span class="f fl" style="flex:1;text-align:left">%s</span></div>') % (html.escape(TITLE_TH).replace(' กรณีศึกษา', '<br>กรณีศึกษา'), html.escape(TITLE_EN))


def date_line(prefix=''):
    return '%sวันที่ %s เดือน%s พ.ศ. %s' % (prefix, f('', 30), f('', 78), f('', 44))


def sign(role_after, name, role_below='', left=180):
    return ('<div class="sig" style="margin-left:%spt">'
            '<div class="row">ลงชื่อ %s %s</div>'
            '<div class="row" style="padding-left:%spt">%s %s</div></div>') % (left, f('', 150), role_after, 26 if len(name) < 30 else 0, paren(name, 150), role_below)


def p03():
    s = head('ENG.P.03', 26, ['แบบขอสอบโครงงาน', 'คณะวิศวกรรมศาสตร์', 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา'])
    s += '<div class="row"><span class="lab" style="width:36pt">เรียน</span>อาจารย์ผู้รับผิดชอบวิชาการเตรียมโครงงาน/โครงงาน</div>'
    s += '<div style="height:6pt"></div>' + students('ข้าพเจ้า', 60)
    s += ('<p class="ind" style="margin-top:4pt">ข้าพเจ้าฯ ได้จัดทำร่างปริญญานิพนธ์เรื่อง '
          '<span style="border-bottom:1px dotted #000">%s</span> '
          'เสร็จสมบูรณ์แล้ว ในการนี้จึงขอความอนุเคราะห์ตรวจสอบร่างปริญญานิพนธ์และขอสอบโครงงานดังกล่าว</p>') % html.escape(TITLE_TH)
    s += '<p class="ind" style="margin:4pt 0 2pt">จึงเรียนมาเพื่อโปรดพิจารณา</p>'
    for n, _, _ in STUDENTS:
        s += sign('นักศึกษา', n, left=150)
    s += '<p style="margin-top:6pt">ความเห็นอาจารย์ที่ปรึกษาโครงงาน</p>'
    s += '<div class="cl" style="margin-left:36pt"></div><div class="cl"></div>'
    s += sign('อาจารย์ที่ปรึกษาโครงงาน', ADVISOR, left=150)
    s += '<div class="sig" style="margin-left:174pt">%s</div>' % date_line()
    s += '<p style="margin-top:6pt">ความเห็นอาจารย์ผู้รับผิดชอบวิชาการเตรียมโครงงาน/โครงงาน</p>'
    s += '<div class="cl" style="margin-left:36pt"></div><div class="cl"></div>'
    s += sign('อาจารย์ผู้รับผิดชอบวิชา', COURSE, 'เตรียมโครงงาน/โครงงาน', left=96)
    s += '<div class="sig" style="margin-left:120pt">%s</div>' % date_line()
    return '<div class="page">%s%s</div>' % (s, FOOT)


ROWS = [('1. ความถูกต้องของร่างปริญญานิพนธ์', 10), ('2. การบรรลุวัตถุประสงค์ของโครงงาน', 15),
        ('3. การปฏิบัติงานตามขอบเขตที่ได้กำหนดไว้', 15), ('4. ความสมบูรณ์หรือความเรียบร้อยของผลผลิตที่ได้', 15),
        ('5. คุณประโยชน์ของโครงงานในภาพรวม', 15), ('6. การนำเสนอโครงงาน', 10), ('7. องค์ความรู้และการตอบคำถาม', 20)]


def score_table(extra):
    t = ('<table><colgroup><col style="width:50%%"><col style="width:9%%"><col style="width:9%%"><col style="width:9%%"><col style="width:9%%"><col style="width:14%%"></colgroup>'
         '<tr><th rowspan="2">หัวข้อการพิจารณา</th><th rowspan="2">คะแนน<br>เต็ม</th><th colspan="3">คะแนนที่ได้</th><th rowspan="2">หมายเหตุ</th></tr>'
         '<tr><th>นศ. 1</th><th>นศ. 2</th><th>นศ. 3</th></tr>')
    for name, full in ROWS:
        t += '<tr><td>%s</td><td class="c">%d</td><td></td><td></td><td></td><td></td></tr>' % (name, full)
    t += extra + '</table>'
    return t


def exam_block():
    return ('<div class="row" style="margin-bottom:2pt">ได้สอบเมื่อ %s และได้คะแนนในแต่ละหัวข้อการพิจารณา ดังนี้</div>' % date_line())


def p071():
    s = head('ENG.P.07/1', 31, ['แบบสรุปคะแนนสอบโครงงาน', 'คณะวิศวกรรมศาสตร์', 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา'])
    s += titles() + students('ชื่อนักศึกษา', 72) + exam_block()
    extra = ''
    for label in ['คะแนนรวม', 'คะแนนเฉลี่ยจากประธานกรรมการ คิดเป็น 10 %', 'คะแนนเฉลี่ยจากกรรมการ คนที่ 1 คิดเป็น 10 %',
                  'คะแนนเฉลี่ยจากกรรมการ คนที่ 2 คิดเป็น 10 %', 'คะแนนจากอาจารย์ที่ปรึกษาโครงงาน คิดเป็น 40 %',
                  'คะแนนจากอาจารย์ผู้รับผิดชอบวิชาการเตรียมโครงงาน/โครงงาน คิดเป็น 30 %']:
        extra += '<tr><td style="padding-left:24pt">%s</td><td></td><td></td><td></td><td></td><td></td></tr>' % label
    extra += '<tr><th>คะแนนรวมทั้งสิ้น</th><td></td><td></td><td></td><td></td><td></td></tr>'
    s += score_table(extra)
    s += '<div style="height:4pt"></div>' + sign('ประธานกรรมการ', '', left=150)
    s += '<div class="sig" style="margin-left:150pt">%s</div>' % date_line()
    s += sign('อาจารย์ผู้รับผิดชอบวิชา', COURSE, 'เตรียมโครงงาน/โครงงาน', left=96)
    s += '<div class="sig" style="margin-left:120pt">%s</div>' % date_line()
    return '<div class="page compact" style="padding-top:98pt">%s%s</div>' % (s, FOOT)


def p072(name):
    s = head('ENG.P.07/2', 32, ['แบบรายงานคะแนนสอบโครงงาน', 'คณะวิศวกรรมศาสตร์', 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา'])
    s += titles() + students('ชื่อนักศึกษา', 72) + exam_block()
    s += '<div style="height:10pt"></div>' + score_table(
        '<tr><th>คะแนนรวม</th><th>100</th><td></td><td></td><td></td><td></td></tr>')
    s += '<div style="height:40pt"></div>' + sign('กรรมการ', name, left=150)
    s += '<div style="height:14pt"></div><div class="sig" style="margin-left:174pt">%s</div>' % date_line()
    return '<div class="page">%s%s</div>' % (s, FOOT)


def doc(pages):
    return '<!doctype html><html><head><meta charset="utf-8"><style>%s</style></head><body>%s</body></html>' % (CSS, ''.join(pages))


open(os.path.join(HERE, 'P03.html'), 'w', encoding='utf-8').write(doc([p03()]))
open(os.path.join(HERE, 'P07-1.html'), 'w', encoding='utf-8').write(doc([p071()]))
open(os.path.join(HERE, 'P07-2.html'), 'w', encoding='utf-8').write(doc([p072(ADVISOR), p072(''), p072(''), p072('')]))
print('ok')
