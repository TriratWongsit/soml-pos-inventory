# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------
# ความกว้างคอลัมน์ของตารางใน docx คำนวณจากข้อความจริงในแต่ละคอลัมน์
#
# ใช้ร่วมกันโดย build-thesis-docx.py (บทที่ 1-4) และ srs-postprocess.py (SRS, Use Case X ฯลฯ)
# ปัญหาที่แก้: เมื่อไม่กำหนดความกว้าง LibreOffice แบ่งทุกคอลัมน์เท่ากัน คอลัมน์ที่มีแค่ตัวเลข
# จึงกว้างเกิน ส่วนคอลัมน์ข้อความยาวถูกบีบจนหักบรรทัดถี่
#
# หลักการอยู่ที่ content_widths: คอลัมน์สั้น (รหัส ตัวเลข บทบาท) ได้เกือบเต็มความยาวข้อความ
# คอลัมน์ข้อความยาวรับส่วนที่เหลือ และคำภาษาอังกฤษหรือรหัสที่ตัดบรรทัดไม่ได้ไม่ถูกตัดกลางคำ
# ---------------------------------------------------------------------
import re
import unicodedata

PAD_TW = 260   # ขอบในเซลล์ซ้ายขวารวมกัน (ค่าเริ่มต้นของ Word 108 ทวิปต่อข้าง) และเผื่อเล็กน้อย


def _text(xml):
    return ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', xml))


def _vis_len(s):
    # สระบน-ล่างและวรรณยุกต์ไทยไม่กินที่ในแนวนอน
    return sum(0 if unicodedata.category(ch) in ('Mn', 'Me') else 1 for ch in s)


def _unbreakable(s):
    # คำที่ไม่มีอักษรไทยปนตัดบรรทัดกลางคำไม่ได้ (รหัส เลขที่ ชื่อไฟล์ ศัพท์อังกฤษ)
    words = [w for w in re.split(r'\s+', s) if w and not re.search(r'[\u0E00-\u0E7F]', w)]
    return max((len(w) for w in words), default=0)


def _thai_chunk(s):
    # วลีไทยที่คั่นด้วยช่องว่าง Word ตัดคำไทยกลางวลีได้ จึงนับได้ไม่เกิน 10 ตัวอักษร
    words = [w for w in re.split(r'\s+', s) if w and re.search(r'[\u0E00-\u0E7F]', w)]
    return min(10, max((_vis_len(w) for w in words), default=0))


def content_widths(tbl, total_tw, char_tw):
    """แบ่งความกว้างแบบเดียวกับการจัดตารางอัตโนมัติของเว็บเบราว์เซอร์
    ความกว้างต่ำสุดของคอลัมน์ = คำที่ยาวที่สุดที่ตัดไม่ได้ · ความกว้างที่ต้องการ = บรรทัดยาวที่สุด
    ถ้าพื้นที่ไม่พอให้ทุกคอลัมน์ได้ความกว้างที่ต้องการ ให้ทุกคอลัมน์ได้ความกว้างต่ำสุดก่อน
    แล้วแบ่งส่วนที่เหลือตามส่วนต่างระหว่างสองค่านั้น คอลัมน์สั้นจึงได้เกือบเต็มที่ต้องการ"""
    rows = re.findall(r'<w:tr[ >].*?</w:tr>', tbl, re.S)
    table = [re.findall(r'<w:tc>.*?</w:tc>', r, re.S) for r in rows]
    n = max((len(r) for r in table), default=0)
    if n == 0:
        return []
    longest, least = [0] * n, [0.0] * n
    for cells in table:
        for j, c in enumerate(cells[:n]):
            paras = [_text(p) for p in re.findall(r'<w:p[ >].*?</w:p>', c, re.S)] or ['']
            longest[j] = max(longest[j], max(_vis_len(p) for p in paras))
            least[j] = max(least[j], max(max(_unbreakable(p) * 1.1, _thai_chunk(p)) for p in paras))
    want = [longest[j] * char_tw + PAD_TW for j in range(n)]
    low = [min(want[j], max(3, least[j]) * char_tw + PAD_TW) for j in range(n)]
    if sum(want) <= total_tw:
        k = float(total_tw) / sum(want)
        widths = [w * k for w in want]
    elif sum(low) >= total_tw:
        k = float(total_tw) / sum(low)
        widths = [w * k for w in low]
    else:
        k = float(total_tw - sum(low)) / (sum(want) - sum(low))
        widths = [low[j] + (want[j] - low[j]) * k for j in range(n)]
    widths = [int(round(w)) for w in widths]
    widths[-1] += total_tw - sum(widths)
    return widths


def apply_widths(tbl, widths):
    """เขียนความกว้างลง tblGrid และทุกเซลล์ พร้อมบังคับ layout แบบ fixed"""
    grid = '<w:tblGrid>' + ''.join('<w:gridCol w:w="%d"/>' % w for w in widths) + '</w:tblGrid>'
    if '<w:tblGrid>' in tbl:
        tbl = re.sub(r'<w:tblGrid>.*?</w:tblGrid>', grid, tbl, flags=re.S)
    else:
        tbl = tbl.replace('</w:tblPr>', '</w:tblPr>' + grid, 1)
    tbl = re.sub(r'<w:tblLayout[^/]*/>', '', tbl)
    tbl = tbl.replace('</w:tblPr>', '<w:tblLayout w:type="fixed"/></w:tblPr>', 1)
    tbl = re.sub(r'<w:tc>(?!<w:tcPr>)', '<w:tc><w:tcPr></w:tcPr>', tbl)
    tbl = re.sub(r'<w:tcW[^/]*/>', '', tbl)

    def per_row(m):
        row = m.group(0)
        k = iter(widths)
        return re.sub(r'<w:tc><w:tcPr>',
                      lambda _: '<w:tc><w:tcPr><w:tcW w:w="%d" w:type="dxa"/>' % next(k, widths[-1]), row)
    return re.sub(r'<w:tr[ >].*?</w:tr>', per_row, tbl, flags=re.S)
