#!/usr/bin/env python3
# coding: utf-8
# หาหน้าที่โล่งในเล่มรวม: ข้อความหรือชื่อรูปบรรทัดสุดท้ายจบเหนือร้อยละ 70 ของกรอบพิมพ์
# และหน้าถัดไปไม่ใช่หน้าแรกของบท (หน้าท้ายบทสั้นได้ตามปกติ)
#
#   python3 check-gaps.py [เล่ม.pdf]
import html, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'เอกสารรูปเล่ม', 'รวมเล่ม', 'ปริญญานิพนธ์_อำพรOMS_รวมเล่ม.pdf')
TOP, BOTTOM = 100.0, 769.9
START = re.compile(r'^(บทที่ \d|เอกสารอ้างอิง|ภาคผนวก( [ก-ฮ])?|ประวัติผู้เขียน)$')

out = subprocess.run(['pdftotext', '-bbox', PDF, '-'], capture_output=True, text=True).stdout
pages = re.findall(r'<page [^>]*>(.*?)</page>', out, re.S)
info = []
for pg in pages:
    words = [(float(y0), float(y1), html.unescape(t).replace('\u200d', '').replace('\u2060', '')) for y0, y1, t in
             re.findall(r'<word xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">(.*?)</word>', pg)]
    body = [w for w in words if w[0] > TOP - 10 and not re.fullmatch(r'\d+|[ก-ฮ]', w[2])]
    top = [w for w in words if w[0] > TOP - 10]
    first = ' '.join(w[2] for w in top if abs(w[0] - top[0][0]) < 3) if top else ''
    info.append((max((w[1] for w in body), default=0), first.strip()))

bad = 0
for i, (bottom, _) in enumerate(info[:-1]):
    if i < 22:                                   # ส่วนนำ (ปก สารบัญ) จัดหน้าเอง
        continue
    nxt = info[i + 1][1]
    if START.match(nxt):
        continue
    used = (bottom - TOP) / (BOTTOM - TOP)
    if used < 0.70:
        bad += 1
        print('หน้า PDF %3d (เลขหน้า %3d) ใช้พื้นที่ %3d%%  หน้าถัดไปเริ่มด้วย: %s' % (i + 1, i + 1 - 22, used * 100, nxt[:50]))
print('หน้าโล่ง %d หน้า' % bad)

# คำที่ถูกตัดกลางคำตอนขึ้นบรรทัดใหม่ (เช่น สต็ / อก)
text = subprocess.run(['pdftotext', '-layout', PDF, '-'], capture_output=True, text=True).stdout
for n, page in enumerate(text.split('\f'), 1):
    for line in page.split('\n'):
        if re.search(r'สต็$', line.rstrip()):
            print('ตัดกลางคำ หน้า PDF %d: ...%s' % (n, line.strip()[-40:]))

# หัวข้อสำคัญ (x.x) หัวข้อรอง (x.x.x) และชื่อตารางต้องเว้นหนึ่งบรรทัดก่อนหน้า ยกเว้นอยู่บนสุดของหน้า (ข้อ 3.5.2, 3.6)
# ระยะบรรทัดปกติ 21.3 พอยต์ ถ้าระยะจากบรรทัดก่อนหน้าน้อยกว่า 33 พอยต์ แปลว่าไม่ได้เว้นบรรทัด
HEAD = re.compile(r'^(\d+\.\d+(\.\d+)?\s+\S|ตารางที่\s+[\dก-ฮ]+\.\d+\s)')
nohead = 0
for n, pg in enumerate(pages, 1):
    if n <= 23:
        continue
    words = [(float(x0), float(y0), html.unescape(t)) for x0, y0, t in
             re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">(.*?)</word>', pg)]
    rows = {}
    for x0, y0, t in words:
        key = next((k for k in rows if abs(k - y0) < 3), y0)
        rows.setdefault(key, []).append((x0, t))
    ys = sorted(k for k in rows if k > TOP - 10)
    for a, b in zip(ys, ys[1:]):
        line = ' '.join(t for x, t in sorted(rows[b]))
        x_first = min(x for x, t in rows[b])
        if HEAD.match(line) and x_first < 200 and b - a < 33 and not line.endswith('(ต่อ)') and '(ต่อ)' not in line:
            nohead += 1
            print('ไม่เว้นบรรทัดก่อน หน้า PDF %d: %s' % (n, line[:60]))
print('หัวข้อหรือชื่อตารางที่ไม่เว้นบรรทัดก่อน %d จุด' % nohead)

# คำสั้น ๆ หรือตัวเลขที่หลุดไปอยู่บรรทัดใหม่คนเดียวท้ายย่อหน้า เช่น "ข้อ / 2" (บรรทัดยาวไม่เกิน 4 อักขระ ชิดขอบซ้าย)
lone = 0
for n, pg in enumerate(pages, 1):
    if n <= 23:
        continue
    words = [(float(x0), float(y0), float(x1), html.unescape(t)) for x0, y0, x1, t in
             re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">(.*?)</word>', pg)]
    rows = {}
    for x0, y0, x1, t in words:
        key = next((k for k in rows if abs(k - y0) < 3), y0)
        rows.setdefault(key, []).append((x0, x1, t))
    for y, ws in rows.items():
        if y < TOP - 10:
            continue
        txt = ''.join(t for _, _, t in sorted(ws))
        x0 = min(w[0] for w in ws)
        if len(txt) <= 4 and x0 < 120 and not re.fullmatch(r'\d+\)|[ก-ฮ]\)|-', txt):
            lone += 1
            print('คำหลุดบรรทัดเดียว หน้า PDF %d: "%s"' % (n, txt))
print('คำหลุดบรรทัดเดียว %d จุด' % lone)

# คำที่ถูกตัดกลางพยางค์ตอนขึ้นบรรทัดใหม่ (ผลตรวจตามพรอมต์ของอาจารย์ 20 ต.ค. 2569 เช่น "แด / ชบอร์ด" "ก / ระบวนการ")
# ตัดผิดเมื่อจุดตัดอยู่กลางพยางค์ หรือบรรทัดก่อนจบด้วยไม้ไต่คู้หรือสระหน้า หรือบรรทัดใหม่ขึ้นต้นด้วยสระหรือวรรณยุกต์
try:
    from pythainlp.tokenize import syllable_tokenize
except ImportError:
    syllable_tokenize = None
TH_END = re.compile(r'[฀-๿]+$')
TH_START = re.compile(r'^[฀-๿]+')
split = 0
for n in range(24, len(pages) + 1):
    raw = subprocess.run(['pdftotext', '-f', str(n), '-l', str(n), PDF, '-'], capture_output=True, text=True).stdout
    lines = [l.strip().replace('\u2060', '').replace('\u200d', '') for l in raw.split('\n')]
    for a, b in zip(lines, lines[1:]):
        m, k = TH_END.search(a), TH_START.search(b)
        if not m or not k:
            continue
        x, y = m.group(), k.group()
        if len(x) == 1 or len(y) == 1:            # ป้ายภาคผนวก ก ข และตัวอักษรเดี่ยวในตาราง
            continue
        bad = x.endswith('็') or x[-1] in 'เแโใไ' or y[0] in 'ะัาำิีึืุู็่้๊๋์ๅ' or re.match(r'^[ก-ฮ]์', y)
        if not bad and syllable_tokenize:
            pos = 0
            for t in syllable_tokenize(x + y, engine='dict'):
                if pos < len(x) < pos + len(t):
                    bad = True
                pos += len(t)
        if bad:
            split += 1
            print('ตัดกลางคำ หน้า PDF %d: ...%s | %s...' % (n, x[-12:], y[:12]))
print('ตัดกลางคำ %d จุด' % split)

# บรรทัดที่ตัวอักษรถูกยืดห่างกัน (จัดเต็มบรรทัดแล้วกระจายช่องไฟระหว่างตัวอักษร เพราะคำถัดไปลงบรรทัดไม่ได้)
# เทียบความกว้างจริงของคำใน PDF กับความกว้างตามฟอนต์ TH Sarabun New 16 พอยต์ บรรทัดปกติได้ไม่เกินราว 1.07 เท่า
sys.path.insert(0, HERE)
from ttf_widths import Widths
FONT = Widths(os.path.expanduser('~/Library/Fonts/THSarabunNew.ttf'))
spread = 0
for n, pg in enumerate(pages, 1):
    if n <= 23:
        continue
    ws = [(float(x0), float(y0), float(x1), float(y1), html.unescape(t).replace('\u2060', '').replace('\u200d', '')) for x0, y0, x1, y1, t in
          re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
    rows = {}
    for w in ws:
        if re.fullmatch(r'[\u0E00-\u0E7F]{4,}', w[4]) and 19 < w[3] - w[1] < 23:
            key = next((k for k in rows if abs(k - w[1]) < 3), w[1])
            rows.setdefault(key, []).append(((w[2] - w[0]) / FONT.width(w[4], 16), w[4]))
    for y, rs in rows.items():
        mean = sum(r for r, _ in rs) / len(rs)
        if mean > 1.10:
            spread += 1
            print('ตัวอักษรถูกยืด หน้า PDF %d (%.2f เท่า): %s' % (n, mean, ' '.join(t for _, t in rs)[:50]))
print('บรรทัดที่ตัวอักษรถูกยืด %d จุด' % spread)

# ตารางต่อหน้า (ผลตรวจรอบที่ 4): ชื่อตาราง "(ต่อ)" ต้องอยู่บนสุดของหน้า และหน้าที่ขึ้นต้นด้วยหัวตารางซ้ำต้องมีชื่อ "(ต่อ)" นำ
HEADS = ('รหัส', 'ขั้นที่', 'หัวข้อ', 'ระดับ', 'คำศัพท์', 'สิ่งเร้า', 'คอลัมน์', 'วิธีเรียก', 'ข้อกำหนด')
cont_bad = 0
for n, page in enumerate(text.split('\f'), 1):
    if n <= 23:
        continue
    L = [l.strip().replace('‍', '').replace('⁠', '') for l in page.split('\n')
         if l.strip() and not re.fullmatch(r'\d+', l.strip())]
    if not L:
        continue
    if any(l.startswith('ตารางที่') and '(ต่อ)' in l for l in L[1:]):
        cont_bad += 1
        print('(ต่อ) ไม่อยู่บนสุด หน้า PDF %d' % n)
    if re.match(r'^(%s)\s{2,}' % '|'.join(HEADS), L[0]):
        cont_bad += 1
        print('หัวตารางซ้ำโดยไม่มีชื่อ (ต่อ) หน้า PDF %d: %s' % (n, L[0][:40]))
print('ตารางต่อหน้าที่ผิดรูปแบบ %d จุด' % cont_bad)
