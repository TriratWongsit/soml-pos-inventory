# coding: utf-8
"""กันไม่ให้ LibreOffice ตัดบรรทัดกลางคำภาษาไทย                      [ผลตรวจตามพรอมต์ของอาจารย์ 20 ต.ค. 2569]

ตัวตัดคำของ LibreOffice ใช้พจนานุกรมของ ICU ซึ่งแบ่งคำทับศัพท์และคำกำกวมผิด เช่น ว่ายอด → ว่าย|อด
เป็นกระบวนการ → เป็นก|ระ|บวน|การ เว็บซ็อกเก็ต → เว็บ|ซ็|อก|เก็ต แล้วขึ้นบรรทัดใหม่ตรงรอยแบ่งที่ผิดนั้น
โมดูลนี้ถามรอยแบ่งของ ICU จาก Intl.Segmenter ของ Node (ใช้พจนานุกรมชุดเดียวกัน ได้รอยแบ่งตรงกับในเล่ม)
เทียบกับรอยแบ่งคำของ pythainlp แล้วใส่ตัวเชื่อมความกว้างศูนย์เฉพาะตรงรอยแบ่งของ ICU ที่อยู่กลางคำ
ทำซ้ำจนไม่เหลือรอยแบ่งกลางคำ เพราะตัวเชื่อมคำทำให้ ICU แบ่งข้อความข้างเคียงใหม่
ไม่ใส่ตัวเชื่อมคำทุกตัวอักษร เพราะทดสอบแล้ว LibreOffice ยืดช่องไฟตรงตัวเชื่อมคำจนตัวอักษรห่างกันทั้งบรรทัด
"""
import json, os, re, subprocess
from pythainlp.corpus import thai_words
from pythainlp.tokenize import Tokenizer

# ตัวเชื่อมแบบไม่มีความกว้าง U+200D (ZWJ) — กฎการตัดบรรทัดห้ามตัดหลัง ZWJ และ ZWJ เป็นส่วนหนึ่งของกลุ่มอักษร
# จึงไม่ถูกขยายตอนจัดเต็มบรรทัด ต่างจาก U+2060 ที่ทดสอบแล้วเห็นเป็นช่องว่าง 1.6 พอยต์กลางคำ "แด ชบอร์ด"
WJ = os.environ.get('THAI_JOINER', '\u200d')
# คำทับศัพท์ในเล่มที่พจนานุกรมไม่มี | คือรอยต่อพยางค์ที่ยอมให้ขึ้นบรรทัดใหม่ได้
LOAN = ['แดชบอร์ด', 'ด็อกเกอร์', 'เว็บ|ซ็อกเก็ต', 'ซ็อกเก็ต', 'สมาร์ตโฟน', 'ไฟร์ฟอกซ์', 'ลินุกซ์', 'อินโนดีบี',
        'เอสเอ็มอี', 'เอชทีทีพีเอส', 'เอชทีทีพี', 'มายเอสคิวแอล', 'สต็อก', 'โหนดเจเอส', 'รี|แอ็กต์', 'เอ็กซ์|เพรส|เจเอส',
        'เอ็กซ์|เพรส', 'ไวต์', 'เจสต์', 'เพลย์|ไรต์', 'โคร|เมียม', 'เอดจ์', 'วิน|โดวส์', 'แมค|โอเอส', 'เบรา|ว์|เซอร์',
        'เซิร์ฟ|เวอร์', 'แท็บเล็ต', 'โทเคน', 'เจ|ดับ|เบิล|ยู|ที', 'บี|คริปต์', 'เจสัน', 'อีเอสซีโพส', 'อีเอ็มวี|โค',
        'โอ|วาสป์', 'ท็อป|เท็น', 'คิวอาร์', 'พร้อม|เพย์', 'เรียลไทม์', 'คอน|เทน|เนอร์', 'ซอฟต์|แวร์', 'ฮาร์ด|แวร์',
        'มิลลิวินาที', 'อีเวนต์', 'ไลบรารี', 'โมดูล', 'แฮช',
        # คำนำหน้าเลขที่ห้ามแยก เช่น "บท / ที่ 5" (ผลตรวจรอบที่ 3)
        'บทที่', 'ตารางที่', 'รูปที่', 'ข้อที่', 'ขั้นตอนที่', 'ขั้นที่', 'ครั้งที่', 'ประการที่', 'วันที่', 'หัวข้อที่', 'ภาคผนวก', 'รีเฟรช', 'อัป|เดต', 'ดาวน์|โหลด', 'อัป|โหลด', 'แอป|พลิ|เค|ชัน']
_LOAN = {w.replace('|', ''): w for w in LOAN}
_WORDS = set(thai_words()) | set(_LOAN)
_tok = Tokenizer(_WORDS, engine='newmm')
# คำประสมที่ยาวเกินจำนวนอักขระนี้ยอมให้ตัดที่รอยต่อคำย่อยได้ เพื่อไม่ให้บรรทัดก่อนหน้าถูกยืด คำที่สั้นกว่าห้ามตัด
COMPOUND_MIN = int(os.environ.get('THAI_COMPOUND_MIN', '8'))
_RUN = re.compile(r'[ก-๎]+')
_NODE = r'''
const seg = new Intl.Segmenter('th', {granularity: 'word'});
const runs = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(runs.map(s => [...seg.segment(s)].map(x => x.index))));
'''


def _allowed(run):
    """ตำแหน่งที่ยอมให้ขึ้นบรรทัดใหม่: รอยต่อคำของ pythainlp และรอยต่อพยางค์ของคำทับศัพท์"""
    ok, pos = set(), 0
    for t in _tok.word_tokenize(run):
        ok.add(pos)
        w = _LOAN.get(t)
        if w:
            p = pos
            for part in w.split('|')[:-1]:
                p += len(part)
                ok.add(p)
        pos += len(t)
    return ok


# คำประสมที่ LibreOffice ตัดกลางคำในเล่มรอบ 37 (ผลตรวจรอบที่ 6) ตัวตัดคำของ LibreOffice ต่างรุ่นกับของ Node
# จึงใส่ตัวเชื่อมคำตรงรอยต่อของคำเหล่านี้ทุกแห่งโดยตรง
NOSPLIT = ['คำ|สั่ง', 'ผู้|จัดการ', 'ถูก|ต้อง', 'แตก|ต่าง', 'ผิด|พลาด', 'ทวน|สอบ', 'คลาด|เคลื่อน', 'ผู้|ประกอบ|การ',
           'รับ|ผิด|ชอบ', 'ขั้น|ตอน', 'องค์|ประกอบ', 'ดำเนิน|การ', 'เพิ่ม|เติม', 'ต่อ|เนื่อง', 'สถาน|ประกอบ|การ', 'ผู้|ทดสอบ',
           'เคลื่อน|ไหว', 'การ|พิสูจน์']


def _nosplit(run):
    pos = set()
    for w in NOSPLIT:
        plain = w.replace('|', '')
        cuts, p = [], 0
        for part in w.split('|')[:-1]:
            p += len(part)
            cuts.append(p)
        for m in re.finditer(re.escape(plain), run):
            pos |= {m.start() + c for c in cuts}
    return pos


def _icu(strings):
    out = subprocess.run(['node', '-e', _NODE], input=json.dumps(strings), capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def protect_runs(runs):
    """คืน {ข้อความเดิม: ข้อความที่ใส่ตัวเชื่อมคำแล้ว}"""
    state = {r: _nosplit(r) for r in runs}           # ตำแหน่งในข้อความเดิมที่ใส่ตัวเชื่อมคำไว้ข้างหน้า
    allowed = {r: _allowed(r) for r in runs}

    def build(r):
        return ''.join((WJ if i in state[r] else '') + c for i, c in enumerate(r))

    todo = list(runs)
    for _ in range(8):
        if not todo:
            break
        texts = [build(r) for r in todo]
        nxt = []
        for r, t, idx in zip(todo, texts, _icu(texts)):
            # แปลงตำแหน่งในข้อความที่มีตัวเชื่อมคำกลับเป็นตำแหน่งในข้อความเดิม
            orig, k = [], 0
            for c in t:
                orig.append(k)
                if c != WJ:
                    k += 1
            cuts = list(idx) + [len(t)]
            bad = set()
            for j in range(1, len(cuts) - 1):
                i = cuts[j]
                if t[i] == WJ or t[i - 1] == WJ or orig[i] in allowed[r] or orig[i] in state[r]:
                    continue
                left, right = t[cuts[j - 1]:i].replace(WJ, ''), t[i:cuts[j + 1]].replace(WJ, '')
                lo, hi = orig[cuts[j - 1]], orig[cuts[j + 1]] if cuts[j + 1] < len(t) else len(r)
                inside = not any(lo < p < hi and p != orig[i] for p in allowed[r])
                span = [p for p in sorted(allowed[r] | {len(r)})]
                t0 = max([p for p in span if p < orig[i]], default=0)
                t1 = min([p for p in span if p > orig[i]], default=len(r))
                if t1 - t0 > COMPOUND_MIN and inside and len(left) > 1 and len(right) > 1 and left in _WORDS and right in _WORDS:
                    continue                          # รอยต่อคำประสมยาว ตัดได้ ยกเว้นคำใน NOSPLIT
                bad.add(orig[i])
            if bad:
                state[r] |= bad
                nxt.append(r)
        todo = nxt
    return {r: build(r) for r in runs if state[r]}


def protect_md(md):
    lines = md.split('\n')
    keep = re.compile(r'(\]\([^)]*\)|`[^`]*`)')        # ไม่แตะที่อยู่ไฟล์ในลิงก์และโค้ด
    runs, code = set(), False
    for line in lines:
        if line.startswith('```'):
            code = not code
        if code or line.startswith(('![', '    ', '```', '#', '**ตารางที่', '**รูปที่')):
            continue
        for i, part in enumerate(keep.split(line)):
            if i % 2 == 0:
                runs.update(m.group() for m in _RUN.finditer(part) if len(m.group()) > 2)
    fix = protect_runs(sorted(runs))
    out, code = [], False
    for line in lines:
        if line.startswith('```'):
            code = not code
        if code or line.startswith(('![', '    ', '```', '#', '**ตารางที่', '**รูปที่')):
            out.append(line)
            continue
        parts = keep.split(line)
        for i in range(0, len(parts), 2):
            parts[i] = _RUN.sub(lambda m: fix.get(m.group(), m.group()), parts[i])
        out.append(''.join(parts))
    return '\n'.join(out)
