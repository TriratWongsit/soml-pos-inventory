# -*- coding: utf-8 -*-
# สร้างหน้าสืบย้อนความต้องการ ข้อความทุกช่องดึงจากเอกสารจริง ส่วนการจับคู่ที่เล่มไม่ได้เขียนไว้ตรง ๆ ระบุว่าเป็นการไล่เทียบ
import io, json, re, os
D = '/Users/triratwongsit/project/.claude/worktrees/read-work-notes-f1c6a5/Documents/'
OUT = os.path.dirname(os.path.abspath(__file__))
ch1 = io.open(D + 'รูปเล่ม/บทที่1_ฉบับตรวจแก้.md', encoding='utf-8').read()
ch3 = io.open(D + 'รูปเล่ม/บทที่3_ฉบับตรวจแก้.md', encoding='utf-8').read()
ch4 = io.open(D + 'รูปเล่ม/บทที่4_ฉบับตรวจแก้.md', encoding='utf-8').read()
stk = io.open(D + 'ผู้มีส่วนได้ส่วนเสีย.md', encoding='utf-8').read()


def rows(text, prefix):
    out = {}
    for line in text.split('\n'):
        m = re.match(r'^\| (%s-\d\d) \|(.*)\|\s*$' % prefix, line)
        if m and m.group(1) not in out:
            out[m.group(1)] = [c.strip() for c in m.group(2).split('|')]
    return out


def numbered(text, sec):
    # หัวข้อที่มีแต่เลข เช่น ### 1.3.2 ตามด้วยย่อหน้า
    out = {}
    for m in re.finditer(r'^### (%s\.\d)\s*\n\n(.+?)\n' % re.escape(sec), text, re.M):
        out[m.group(1)] = m.group(2).strip()
    return out


SCOPE = numbered(ch1, '1.3')
OBJ = numbered(ch1, '1.2')
EV = {k: {'text': v[0], 'obj': v[1]} for k, v in rows(ch3, 'EV').items()}
FR = {k: {'text': v[0], 'ev': v[1]} for k, v in rows(ch3, 'FR').items()}
NFR = {k: {'text': v[0], 'verify': v[1]} for k, v in rows(ch3, 'NFR').items()}
BR = {k: {'text': v[0], 'design': v[1]} for k, v in rows(ch3, 'BR').items()}
US = {k: {'as': v[0], 'want': v[1], 'so': v[2]} for k, v in rows(ch3, 'US').items()}
AC = {k: {'given': v[0], 'when': v[1], 'then': v[2], 'ref': v[3]} for k, v in rows(ch3, 'AC').items()}
UC = {k: {'name': v[0], 'actor': v[1], 'req': v[2]} for k, v in rows(ch3, 'UC').items()}
TC = {k: {'what': v[0], 'how': v[1], 'expect': v[2], 'ref': v[3]} for k, v in rows(ch3, 'TC').items()}
RTM = {}
for line in ch4.split('\n'):
    m = re.match(r'^\| ((?:FR|NFR)-\d\d) \|(.*)\|\s*$', line)
    if m and m.group(1) not in RTM:
        c = [x.strip() for x in m.group(2).split('|')]
        RTM[m.group(1)] = {'uc': c[1], 'mod': c[2], 'tc': c[3], 'result': c[4]}   # ตารางที่ 4.8: รหัส ย่อ UC โมดูล TC ผล
assert len(SCOPE) == 6 and len(OBJ) == 4 and len(EV) == 9 and len(FR) == 9 and len(NFR) == 9
assert len(BR) == 5 and len(US) == 6 and len(AC) == 15 and len(UC) == 11 and len(TC) == 13 and len(RTM) == 18, \
    (len(SCOPE), len(OBJ), len(EV), len(FR), len(NFR), len(BR), len(US), len(AC), len(UC), len(TC), len(RTM))

# ผู้มีส่วนได้ส่วนเสียทั้ง 8 กลุ่ม จากเอกสารผู้มีส่วนได้ส่วนเสีย หัวข้อ 1
STK = []
sec = stk[stk.index('# 1. ผู้มีส่วนได้ส่วนเสียทั้งหมด'):stk.index('# 2.')]
for line in sec.split('\n'):
    if line.startswith('| ') and not line.startswith('| ผู้มีส่วนได้ส่วนเสีย') and not line.startswith('|---'):
        c = [x.strip() for x in line.strip('|').split('|')]
        STK.append({'name': c[0], 'type': c[1], 'how': c[2], 'gain': c[3], 'ev': c[4]})
assert len(STK) == 8, len(STK)

# ---- การจับคู่ ----
# ev, uc, ac, tc, br: ตามตารางที่ 3.3 3.8 3.11 3.12 3.23 และ 4.8 ของเล่ม
# scope, stk: ผู้จัดทำไล่เทียบเอง (เล่มไม่มีตารางจับคู่ขอบเขตกับความต้องการ) — แสดงป้ายบอกไว้ในหน้า
MAP = {
    'FR-01': dict(scope=['1.3.2', '1.3.1'], ev=['EV-02'], br=[], us=[], stk=['พนักงานขาย', 'พนักงานคลังสินค้า', 'ผู้จัดการ']),
    'FR-02': dict(scope=['1.3.2'], ev=['EV-09'], br=['BR-05'], us=[], stk=['ผู้จัดการ', 'เจ้าของร้าน']),
    'FR-03': dict(scope=['1.3.3'], ev=['EV-01'], br=['BR-01'], us=['US-01'], stk=['พนักงานขาย', 'ลูกค้าของร้าน', 'ระบบอัตโนมัติ']),
    'FR-04': dict(scope=['1.3.3', '1.3.4'], ev=['EV-03', 'EV-04'], br=['BR-03'], us=['US-02'], stk=['พนักงานคลังสินค้า', 'ลูกค้าของร้าน', 'ระบบอัตโนมัติ']),
    'FR-05': dict(scope=['1.3.4'], ev=['EV-05'], br=[], us=[], stk=['พนักงานคลังสินค้า', 'ลูกค้าของร้าน']),
    'FR-06': dict(scope=['1.3.4'], ev=['EV-06', 'EV-07'], br=['BR-02'], us=['US-03'], stk=['พนักงานคลังสินค้า', 'ผู้จัดการ']),
    'FR-07': dict(scope=['1.3.5'], ev=['EV-08'], br=['BR-04'], us=['US-04'], stk=['ผู้จัดการ', 'พนักงานคลังสินค้า', 'เจ้าของร้าน']),
    'FR-08': dict(scope=['1.3.5'], ev=['EV-09'], br=['BR-05'], us=['US-05'], stk=['ผู้จัดการ', 'พนักงานคลังสินค้า', 'ระบบอัตโนมัติ']),
    'FR-09': dict(scope=['1.3.5'], ev=['EV-02'], br=[], us=['US-06'], stk=['ผู้จัดการ', 'ระบบอัตโนมัติ']),
    'NFR-01': dict(scope=['1.3.2'], ev=[], br=[], us=[], stk=['พนักงานขาย', 'พนักงานคลังสินค้า', 'ผู้จัดการ']),
    'NFR-02': dict(scope=['1.3.3', '1.3.4'], ev=['EV-03', 'EV-04'], br=['BR-03'], us=['US-02'], stk=['พนักงานคลังสินค้า', 'ลูกค้าของร้าน']),
    'NFR-03': dict(scope=['1.3.1'], ev=[], br=[], us=[], stk=['พนักงานคลังสินค้า']),
    'NFR-04': dict(scope=['1.3.4'], ev=['EV-06'], br=['BR-02'], us=['US-03'], stk=['พนักงานคลังสินค้า', 'ผู้จัดการ']),
    'NFR-05': dict(scope=['1.3.3'], ev=[], br=['BR-01'], us=[], stk=['พนักงานขาย', 'ลูกค้าของร้าน']),
    'NFR-06': dict(scope=['1.3.1'], ev=[], br=[], us=[], stk=['พนักงานขาย', 'พนักงานคลังสินค้า', 'ผู้จัดการ']),
    'NFR-07': dict(scope=['1.3.1'], ev=[], br=[], us=[], stk=['พนักงานขาย', 'พนักงานคลังสินค้า', 'ผู้จัดการ']),
    'NFR-08': dict(scope=[], ev=[], br=[], us=[], stk=['ผู้จัดทำ', 'อาจารย์ที่ปรึกษา'], note='มาจากสมมติฐานข้อ 1.4.1 สถาปัตยกรรมระบบแบบ 3 ชั้น ไม่ได้มาจากข้อขอบเขตโดยตรง'),
    'NFR-09': dict(scope=[], ev=[], br=[], us=[], stk=['เจ้าของร้าน', 'ผู้จัดทำ'], note='เป็นคุณภาพที่ระบบต้องมีเพื่อนำไปติดตั้งที่ร้านได้ ไม่ได้มาจากข้อขอบเขตหรือหลักฐานข้อใดโดยตรง'),
}
for k in MAP:
    for s in MAP[k]['stk']:
        assert any(x['name'] == s for x in STK), s
# AC และ TC ของแต่ละความต้องการ: ดึงจากช่องอ้างอิงของตารางที่ 3.11 และ 3.23
for k in MAP:
    MAP[k]['ac'] = [a for a, v in AC.items() if re.search(r'\b%s\b' % k, v['ref'])]
    tcs = [t for t, v in TC.items() if re.search(r'\b%s\b' % k, v['ref'])] + re.findall(r'TC-\d\d', RTM[k]['tc'])
    MAP[k]['tc'] = sorted(set(tcs))
    MAP[k]['uc'] = re.findall(r'UC-\d\d', RTM[k]['uc'])

FIG = {'UC-01': 'fig32', 'UC-02': 'fig32', 'UC-03': 'fig33', 'UC-04': 'fig33', 'UC-05': 'fig34', 'UC-06': 'fig34',
       'UC-07': 'fig34', 'UC-08': 'fig35', 'UC-09': 'fig35', 'UC-10': 'fig35', 'UC-11': 'fig35'}

DATA = dict(SCOPE=SCOPE, OBJ=OBJ, EV=EV, FR=FR, NFR=NFR, BR=BR, US=US, AC=AC, UC=UC, TC=TC, RTM=RTM, STK=STK, MAP=MAP, FIG=FIG)
html = io.open(os.path.join(OUT, 'template.html'), encoding='utf-8').read()
html = html.replace('/*DATA*/', 'const DATA = ' + json.dumps(DATA, ensure_ascii=False) + ';')
io.open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
print('ok', {k: len(v) for k, v in DATA.items()})
