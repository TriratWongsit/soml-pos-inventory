#!/usr/bin/env python3
# coding: utf-8
# ---------------------------------------------------------------------
# ตรวจความเรียบร้อยของเล่มรวม (PDF) ตามคู่มือปริญญานิพนธ์
#
#   python3 check-book.py
#
# ตรวจ: ส่วนประกอบครบและเรียงถูก · เลขหน้าในสารบัญ สารบัญรูป สารบัญตาราง ตรงกับหน้าจริง
#       เลขหน้าบนหัวกระดาษ · หน้าแรกของบทไม่พิมพ์เลข · หน้าว่าง · ช่องที่ยังไม่กรอก
#       การอ้างเอกสารอ้างอิง · ชื่อระบบเดิมที่หลงเหลือ · จำนวนรูปที่ฝังในเล่ม
# ---------------------------------------------------------------------
import re, subprocess, sys, unicodedata

HERE = __import__('os').path.dirname(__import__('os').path.abspath(__file__))
BOOK = HERE + '/เอกสารรูปเล่ม/รวมเล่ม/ปริญญานิพนธ์_อำพรOMS_รวมเล่ม.pdf'
THAI = 'กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ'

def sh(a):
    return subprocess.run(a, capture_output=True, text=True).stdout

pages = sh(['pdftotext', '-layout', BOOK, '-']).split('\f')
if pages and not pages[-1].strip():
    pages = pages[:-1]
N = len(pages)
problems, notes = [], []

def lines(i):
    return [l.rstrip() for l in pages[i].split('\n') if l.strip()]

def norm(s):
    s = unicodedata.normalize('NFC', s)
    return re.sub(r'\s+', '', s)

# ---- หาหน้าแรกของเนื้อความ (บทที่ 1) ----
body0 = next(i for i in range(N) if lines(i) and lines(i)[0].strip() == 'บทที่ 1')
front = body0
notes.append('ส่วนนำ %d หน้า · เนื้อความ %d หน้า (1–%d) · รวม %d หน้า' % (front, N - front, N - front, N))

def page_of_body(n):
    return front + n - 1

# ---- 1) ส่วนประกอบตามลำดับในข้อ 3.4 ของคู่มือ ----
want = ['บทคัดย่อ', 'ABSTRACT', 'กิตติกรรมประกาศ', 'สารบัญ', 'สารบัญรูป', 'สารบัญตาราง', 'ประมวลศัพท์และคำย่อ',
        'บทที่ 1', 'บทที่ 2', 'บทที่ 3', 'บทที่ 4', 'บทที่ 5', 'เอกสารอ้างอิง', 'ภาคผนวก', 'ภาคผนวก ก', 'ภาคผนวก ข', 'ภาคผนวก ค', 'ภาคผนวก ง', 'ภาคผนวก จ', 'ภาคผนวก ฉ', 'ภาคผนวก ช',
        'ประวัติผู้เขียน']
found, last = [], -1
for w in want:
    hit = next((i for i in range(N) if any(l.strip() == w for l in lines(i)[:15])), None)
    if hit is None:
        problems.append('ไม่พบส่วน "%s"' % w)
    elif hit < last:
        problems.append('ส่วน "%s" อยู่ผิดลำดับ (หน้า PDF %d)' % (w, hit + 1))
    else:
        last = hit
        found.append(w)
notes.append('ส่วนประกอบที่พบ %d/%d ส่วน' % (len(found), len(want)))

# ---- 2) เลขหน้าบนหัวกระดาษ ----
first_pages = set()
for i in range(front, N):
    ls = lines(i)
    top = ls[0].strip() if ls else ''
    if re.match(r'^(บทที่ \d|เอกสารอ้างอิง$|ภาคผนวก( [ก-ช])?$|ประวัติผู้เขียน$)', top):
        first_pages.add(i)
for i in range(front, N):
    ls = lines(i)
    if not ls:
        problems.append('หน้า PDF %d ว่าง' % (i + 1))
        continue
    expect = i - front + 1
    top = ls[0].strip()
    is_num = re.fullmatch(r'\d+', top)
    unnumbered_ok = i in first_pages or (ls[0].strip() == 'ภาคผนวก ก' and len(ls) <= 3)
    if unnumbered_ok:
        if is_num:
            problems.append('หน้า %d เป็นหน้าแรกของส่วน แต่มีเลขหน้า' % expect)
    elif not is_num:
        # หน้าคั่นภาคผนวกและหน้าแรกของประวัติ ไม่พิมพ์เลข
        if not (len(ls) <= 3 and 'ภาคผนวก' in ls[0]):
            problems.append('หน้า %d ไม่มีเลขหน้า (บรรทัดบนสุด: %s)' % (expect, top[:40]))
    elif int(top) != expect:
        problems.append('หน้า PDF %d พิมพ์เลข %s แต่ควรเป็น %d' % (i + 1, top, expect))

# ---- 3) ตัวอักษรกำกับหน้าส่วนนำ ----
seq = []
for i in range(1, front):   # หน้า 1 คือปกนอก ไม่นับ
    ls = lines(i)
    top = ls[0].strip() if ls else ''
    seq.append(top if len(top) == 1 and top in THAI else '-')
for k, lab in enumerate(seq):
    if lab != '-' and lab != THAI[k]:
        problems.append('ส่วนนำหน้า PDF %d พิมพ์ "%s" แต่ลำดับควรเป็น "%s"' % (k + 2, lab, THAI[k]))
notes.append('ตัวอักษรกำกับส่วนนำ: ' + ' '.join(seq))

# ---- 4) เลขหน้าในสารบัญ สารบัญรูป สารบัญตาราง ----
def listing(title):
    entries = []
    for i in range(front):
        ls = lines(i)
        head = [l.strip() for l in ls[:3]]
        if title in head or (title + ' (ต่อ)') in head:
            buf = ''
            for l in ls:
                t = l.strip()
                if t in (title, title + ' (ต่อ)', 'หน้า') or re.fullmatch(r'[ก-ฮ]', t):
                    continue
                m = re.match(r'^(.*\S)\s{2,}(\d+|[ก-ฮ])$', t)
                if m:
                    entries.append(((buf + ' ' + m.group(1)).strip(), m.group(2)))
                    buf = ''
                else:
                    buf = (buf + ' ' + t).strip()
    return entries

def locate(text, pg):
    """ข้อความหัวข้ออยู่บนหน้านั้นจริงหรือไม่ (เทียบแบบไม่สนช่องว่าง)"""
    key = norm(text)[:28]
    return key in norm(pages[pg])

for title in ('สารบัญ', 'สารบัญรูป', 'สารบัญตาราง'):
    ents = listing(title)
    bad = 0
    for text, pg in ents:
        if not pg.isdigit():
            continue
        n = int(pg)
        t = text
        if title == 'สารบัญ':
            t = re.sub(r'^บทที่ \d+ ', '', t)
        if n < 1 or n > N - front or not locate(t, page_of_body(n)):
            # ยอมให้อยู่หน้าถัดไปไม่ได้ ต้องตรงหน้า
            bad += 1
            problems.append('%s: "%s" ระบุหน้า %s แต่ไม่พบข้อความบนหน้านั้น' % (title, text[:50], pg))
    notes.append('%s %d รายการ · ผิด %d' % (title, len(ents), bad))

# ---- 5) รูปและตารางทุกชิ้นอยู่ในสารบัญ ----
cap_fig = sorted(set(re.findall(r'รูปที่ ((?:\d+|ก)\.\d+) ', '\n'.join(pages[front:]))))
cap_tab = sorted(set(re.findall(r'ตารางที่ ((?:\d+|ก)\.\d+) ', '\n'.join(pages[front:]))))
lf = {re.match(r'รูปที่ (\S+)', t).group(1) for t, _ in listing('สารบัญรูป') if t.startswith('รูปที่')}
lt = {re.match(r'ตารางที่ (\S+)', t).group(1) for t, _ in listing('สารบัญตาราง') if t.startswith('ตารางที่')}
for x in cap_fig:
    if x not in lf:
        problems.append('รูปที่ %s มีในเล่มแต่ไม่อยู่ในสารบัญรูป' % x)
for x in cap_tab:
    if x not in lt:
        problems.append('ตารางที่ %s มีในเล่มแต่ไม่อยู่ในสารบัญตาราง' % x)

# ---- 6) เอกสารอ้างอิง ----
body = '\n'.join(pages[front:])
refs_at = next(i for i in range(front, N) if lines(i)[0].strip() == 'เอกสารอ้างอิง')
refs_text = '\n'.join(pages[refs_at:refs_at + 4])
listed = set(int(x) for x in re.findall(r'^\s*\[(\d+)\]', refs_text, re.M))
cited = set(int(x) for x in re.findall(r'\[(\d+)\]', '\n'.join(pages[front:refs_at])))
for c in sorted(cited - listed):
    problems.append('อ้าง [%d] ในเนื้อหา แต่ไม่มีในเอกสารอ้างอิง' % c)
for c in sorted(listed - cited):
    problems.append('เอกสารอ้างอิง [%d] ไม่ถูกอ้างในเนื้อหา' % c)
notes.append('เอกสารอ้างอิง %d รายการ · อ้างในเนื้อหา %d รายการ' % (len(listed), len(cited)))

# ---- 7) ช่องที่ยังไม่กรอก และชื่อระบบเดิม ----
# ภาคผนวก ช คือแบบประเมินเปล่าที่มีช่องให้ผู้ตอบกรอกโดยเจตนา จึงไม่นับเป็นช่องที่ยังไม่กรอก
form = [i for i in range(N) if any(l.strip() == 'ภาคผนวก ช' for l in lines(i)[:15])]
bio = [i for i in range(N) if any(l.strip() == 'ประวัติผู้เขียน' for l in lines(i)[:15])]
form_pages = set(range(form[0], bio[-1])) if form and bio else set()
for i in range(N):
    for l in lines(i):
        t = l.strip()
        if i not in form_pages and re.search(r'…{6,}', t) and not re.fullmatch(r'…+(\s+\S.*)?', t):
            problems.append('หน้า PDF %d มีช่องที่ยังไม่กรอก: %s' % (i + 1, t[:60]))
        if 'SOML' in t and 'Receipt' not in t:
            problems.append('หน้า PDF %d ยังมีคำว่า SOML: %s' % (i + 1, t[:60]))

# ---- 8) รูปที่ฝังในเล่ม ----
imgs = [l for l in sh(['pdfimages', '-list', BOOK]).split('\n')[2:] if l.strip()]
notes.append('รูปที่ฝังในเล่ม %d ภาพ · คำบรรยายรูป %d รายการ' % (len(imgs), len(cap_fig)))

print('\n'.join('• ' + n for n in notes))
print('\nพบปัญหา %d จุด' % len(problems))
print('\n'.join('  ✗ ' + p for p in problems))
