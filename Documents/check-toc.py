#!/usr/bin/env python3
# coding: utf-8
# ตรวจเลขหน้าในสารบัญรูปและสารบัญตารางเทียบกับหน้าที่ชื่อรูปหรือชื่อตารางอยู่จริง (ผลตรวจรอบที่ 3 พบเลขเกิน 20 รายการ)
# ชื่อรูปและชื่อตารางจริงคือบรรทัดที่ขึ้นต้นด้วย "รูปที่ N ชื่อ" ตรงกับข้อความในสารบัญ ไม่ใช่ประโยคที่อ้างถึงรูป
#
#   python3 check-toc.py [เล่ม.pdf]
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'เอกสารรูปเล่ม', 'รวมเล่ม', 'ปริญญานิพนธ์_อำพรOMS_รวมเล่ม.pdf')
norm = lambda t: re.sub(r'[\s ​‍⁠]+', '', t)
raw = subprocess.run(['pdftotext', '-layout', PDF, '-'], capture_output=True, text=True).stdout
pages = re.sub('[\u200d\u2060]', '', raw).split('\f')
front = next(i for i, t in enumerate(pages) if norm(t).startswith('บทที่1บทนำ'))
lists = [i for i, t in enumerate(pages[:front]) if re.search(r'^\s*สารบัญ(รูป|ตาราง)', t, re.M)]
entries = []
for i in lists:
    for m in re.finditer(r'^\s*((?:รูปที่|ตารางที่) [ก-ฮ]?\.?\d+(?:\.\d+)?) (.*?)\s{2,}(\d+)\s*$', pages[i], re.M):
        entries.append((m.group(1), m.group(2), int(m.group(3))))
bad = 0
for label, title, pg in entries:
    key = norm(label + title)[:28]
    actual = next((j - front + 1 for j in range(front, len(pages))
                   if any(norm(l).startswith(key) for l in pages[j].split('\n'))), None)
    if actual != pg:
        bad += 1
        print('%s %s  สารบัญ %s  จริง %s' % (label, title[:30], pg, actual))
print('ตรวจ %d รายการ ไม่ตรง %d รายการ' % (len(entries), bad))
