# coding: utf-8
"""สร้างทีละบทแล้วหาบรรทัดที่ตัวอักษรถูกยืดและคำที่ตัดกลางคำ เร็วกว่าสร้างทั้งเล่ม (การตัดบรรทัดไม่ขึ้นกับเลขหน้า)

    python3 quick_check.py ch2 ch4 appx      # ชื่อส่วนตาม build-book.py
"""
import html, importlib.util, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location('bb', os.path.join(HERE, 'build-book.py'))
bb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bb)
from ttf_widths import Widths
FONT = Widths(os.path.expanduser('~/Library/Fonts/THSarabunNew.ttf'))

bb.WORK = os.environ.get("QC_DIR") or tempfile.mkdtemp()
ref = bb.bt.make_reference(bb.WORK)
rdir = os.path.join(HERE, 'รูปเล่ม')
ch = {n: bb.chapter_md(n) for n in range(1, 6)}
ch[2], refs = bb.split_refs(ch[2])
PARTS = {'ch%d' % n: (ch[n], rdir) for n in range(1, 6)}
PARTS.update({'refs': (refs, rdir), 'appx': (bb.srs_appendix_md(), HERE), 'appx2': (bb.appendix_b_md(), rdir),
              'appx3': (bb.appendix_rtm_md(), rdir), 'appx4': (bb.appendix_c_md(), HERE),
              'appx5': (bb.appendix_d_md(), rdir), 'appx6': (bb.appendix_code_md(), rdir),
              'appx7': (bb.appendix_e_md(), HERE), 'appx8': (bb.appendix_h_md(), rdir)})

for name in sys.argv[1:] or PARTS:
    md, rd = PARTS[name]
    docx = bb.pandoc_part(name, md, rd, ref)
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', bb.WORK, docx], capture_output=True)
    pdf = docx[:-5] + '.pdf'
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    n = 0
    for p, pg in enumerate(re.findall(r'<page [^>]*>(.*?)</page>', out, re.S), 1):
        rows = {}
        for x0, y0, x1, y1, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg):
            t = html.unescape(t).replace('\u2060', '').replace('\u200d', '')
            if re.fullmatch(r'[฀-๿]{4,}', t) and 19 < float(y1) - float(y0) < 23:
                key = next((k for k in rows if abs(k - float(y0)) < 3), float(y0))
                rows.setdefault(key, []).append(((float(x1) - float(x0)) / FONT.width(t, 16), t))
        for y, rs in sorted(rows.items()):
            mean = sum(r for r, _ in rs) / len(rs)
            if mean > float(os.environ.get("TH", "1.09")):
                n += 1
                print('%s หน้า %d (%.2f): %s' % (name, p, mean, ' '.join(t for _, t in rs)[:70]))
    print('== %s ยืด %d บรรทัด' % (name, n))

    # คำที่ตัดกลางพยางค์ และช่องว่างแทรกกลางคำ (ตัวเชื่อมคำถูกขยายตอนจัดเต็มบรรทัด)
    from pythainlp.tokenize import syllable_tokenize
    raw = subprocess.run(['pdftotext', pdf, '-'], capture_output=True, text=True).stdout
    lines = [l.strip().replace('\u2060', '').replace('\u200d', '') for l in raw.split('\n')]
    bad = 0
    for a, b in zip(lines, lines[1:]):
        m, k = re.search(r'[฀-๿]+$', a), re.match(r'[฀-๿]+', b)
        if not m or not k or len(m.group()) < 2 or len(k.group()) < 2:
            continue
        x, y = m.group(), k.group()
        pos, cut = 0, False
        for s in syllable_tokenize(x + y, engine='dict'):
            cut |= pos < len(x) < pos + len(s)
            pos += len(s)
        if cut or x.endswith('็') or y[0] in 'ะัาำิีึืุู็่้๊๋์':
            bad += 1
            print('%s ตัดกลางคำ: %s | %s' % (name, x[-10:], y[:10]))
    gaps = 0
    for pg in re.findall(r'<page [^>]*>(.*?)</page>', out, re.S):
        ws = [(float(x0), float(x1), float(y0), html.unescape(t)) for x0, y0, x1, y1, t in
              re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        for (a0, a1, ay, at), (b0, b1, by, bt_) in zip(ws, ws[1:]):
            if abs(ay - by) < 1 and 1.0 < b0 - a1 < 2.5 and re.search(r'[฀-๿]$', at) and re.match(r'[฀-๿]', bt_):
                gaps += 1
                print('%s ช่องว่างกลางคำ: %s|%s (%.1f pt)' % (name, at[-8:], bt_[:8], b0 - a1))
    print('== %s ตัดกลางคำ %d ช่องว่างกลางคำ %d' % (name, bad, gaps))
