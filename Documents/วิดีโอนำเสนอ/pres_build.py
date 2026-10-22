# -*- coding: utf-8 -*-
"""สร้างเสียงพากย์ ไทม์ไลน์ และหน้า pres.html สำหรับวิดีโอนำเสนอสไลด์ (16:9)
ใช้ภาพสไลด์และตำแหน่งองค์ประกอบจาก slide_png.js แล้ว pres_render.js เรนเดอร์ทีละเฟรม"""
import hashlib, html, io, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'soml')
W = os.path.join(HERE, '_pres')
TTS = os.path.join(W, 'tts')
sys.path.insert(0, HERE)
from pres_script import ITEMS  # noqa: E402

VOICE, RATE = 'th-TH-NiwatNeural', '-10%'
INTRO, GAP, OUTRO = 0.8, 0.45, 0.7
e = html.escape
RECTS = json.load(io.open(os.path.join(W, 'rects.json'), encoding='utf-8'))


def tts(text):
    os.makedirs(TTS, exist_ok=True)
    h = hashlib.md5((VOICE + RATE + text).encode()).hexdigest()[:16]
    mp3, wav = os.path.join(TTS, h + '.mp3'), os.path.join(TTS, h + '.wav')
    if not os.path.exists(wav):
        for _ in range(4):
            r = subprocess.run(['python3', '-m', 'edge_tts', '--voice', VOICE, '--rate=' + RATE, '--text', text, '--write-media', mp3])
            if r.returncode == 0 and os.path.exists(mp3) and os.path.getsize(mp3) > 1000:
                break
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', wav], check=True)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
                             capture_output=True, text=True).stdout)
    return wav, d


def silence(sec):
    os.makedirs(TTS, exist_ok=True)
    p = os.path.join(TTS, 'sil_%d.wav' % round(sec * 1000))
    if not os.path.exists(p):
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '%.3f' % sec,
                        '-c:a', 'pcm_s16le', p], check=True)
    return p


def rect_of(n, f):
    """แปลงชื่อส่วนของสไลด์ เช่น 'li1.2' 'row0-3' เป็นสี่เหลี่ยม [x, y, w, h] ในพิกัดสไลด์ 1920x1080"""
    R = RECTS[n - 1]
    if f == 'all':
        return None
    m = re.match(r'^li(\d+)\.(\d+)$', f)
    if m:
        return R['li'][int(m.group(1))][int(m.group(2))]
    m = re.match(r'^([a-z]+)(\d+)-(\d+)$', f)
    if m:
        rs = R[m.group(1)][int(m.group(2)):int(m.group(3)) + 1]
        return union(rs)
    m = re.match(r'^([a-z]+)(\d*)$', f)
    k, i = m.group(1), m.group(2)
    if i == '':
        return union(R[k])
    return R[k][int(i)]


def union(rs):
    x0 = min(r[0] for r in rs); y0 = min(r[1] for r in rs)
    x1 = max(r[0] + r[2] for r in rs); y1 = max(r[1] + r[3] for r in rs)
    return [x0, y0, x1 - x0, y1 - y0]


def focus_rect(n, focus):
    fs = focus if isinstance(focus, list) else [focus]
    rs = [rect_of(n, f) for f in fs]
    rs = [r for r in rs if r]
    return union(rs) if rs else None


def code_rows(it):
    L = io.open(os.path.join(SRC, it['file']), encoding='utf-8').read().split('\n')
    i = next(k for k, l in enumerate(L) if it['start'] in l)
    rows = [(k + 1, L[k]) for k in range(i, min(i + it['n'], len(L)))]
    for bt in it['beats']:
        pats = bt.get('hl', [])
        bt['lines'] = [j for j, (_, t) in enumerate(rows) if any(p in t for p in pats)]
        if pats and not bt['lines']:
            raise SystemExit('ไม่พบบรรทัด %r ใน %s' % (pats, it['file']))
    return rows


def vis(i, it):
    k = it['kind']
    if k == 'slide':
        return '<div class="cam" id="cam%d"><img src="slides/s%02d.png"><div class="spot" id="sp%d"></div></div>' % (i, it['n'], i)
    if k == 'title':
        return '<div class="ttl"><div class="tk">สาธิตโค้ดจริง</div><div class="tt">%s</div><div class="ts">%s</div></div>' % (it['text'], it['sub'])
    if k == 'code':
        rows = it['rows']
        ln = ''.join('<div class="ln" id="ln%d_%d"><span class="no">%d</span><span class="tx">%s</span></div>' % (i, j, no, e(t) or ' ')
                     for j, (no, t) in enumerate(rows))
        return ('<div class="cw"><div class="ch">%s</div><div class="code"><div class="fn">%s <em>บรรทัด %d–%d</em></div>'
                '<div class="vp" id="vp%d"><div class="inner" id="in%d">%s</div></div></div></div>'
                % (e(it['title']), e(it['file']), rows[0][0], rows[-1][0], i, i, ln))
    if k == 'race':
        return '''<div class="cw"><div class="ch">%s</div><div class="race" id="race%d">
<div class="dev a" id="da%d"><div class="dn">เครื่อง A</div><div class="dd">พนักงานคลังคนที่ 1</div><div class="res" id="ra%d"></div></div>
<div class="dev b" id="db%d"><div class="dn">เครื่อง B</div><div class="dd">พนักงานคลังคนที่ 2</div><div class="res" id="rb%d"></div></div>
<div class="gate" id="gt%d">🔒 ล็อกแถว orders</div>
<div class="db" id="dbx%d"><div class="dbt">MySQL</div><div class="dbs">ORD-0042 · <span id="st%d">รอจ่าย</span></div></div>
<div class="stock" id="sk%d">สต็อกปูน 10 ถุง → <b id="sv%d">10</b></div>
<div class="pk pa" id="pa%d">A</div><div class="pk pb" id="pb%d">B</div><div class="rl" id="rl%d"></div></div></div>''' % ((e(it['title']),) + (i,) * 13)
    raise ValueError(k)


def main():
    os.makedirs(W, exist_ok=True)
    t, parts, data, secs = 0.0, [], [], []
    for i, it in enumerate(ITEMS):
        if it['kind'] == 'code':
            it['rows'] = code_rows(it)
        start = t
        parts.append(silence(INTRO)); t += INTRO
        beats = []
        for bt in it['beats']:
            wav, d = tts(bt['say'])
            x = dict(start=round(t - start, 3), dur=round(d, 3))
            if it['kind'] == 'slide':
                x['rect'] = focus_rect(it['n'], bt.get('focus', 'all'))
            for key in ('lines', 'phase'):
                if key in bt:
                    x[key] = bt[key]
            beats.append(x)
            parts.append(wav); t += d
            parts.append(silence(GAP)); t += GAP
        parts.append(silence(OUTRO)); t += OUTRO
        data.append(dict(kind=it['kind'], start=round(start, 3), end=round(t, 3), beats=beats))
        subs = ''.join('<div class="st" id="su%d_%d">%s</div>' % (i, j, e(bt['say'])) for j, bt in enumerate(it['beats']))
        label = 'สไลด์ %d / 25' % it['n'] if it['kind'] == 'slide' else 'สาธิตโค้ด'
        secs.append('<section class="sc k-%s" id="s%d"><div class="vis">%s</div><div class="tag">%s</div><div class="subs">%s</div></section>'
                    % (it['kind'], i, vis(i, it), label, subs))
        print('%2d %-6s %5.1f วินาที' % (i + 1, it['kind'], t - start), flush=True)
    lst = os.path.join(W, 'audio.txt')
    io.open(lst, 'w').write(''.join("file '%s'\n" % p for p in parts))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'pcm_s16le',
                    os.path.join(W, 'narration.wav')], check=True)
    tpl = io.open(os.path.join(HERE, 'pres_template.html'), encoding='utf-8').read()
    page = tpl.replace('/*SCENES*/', ''.join(secs)).replace('/*DATA*/', json.dumps(dict(total=round(t, 3), scenes=data), ensure_ascii=False))
    io.open(os.path.join(W, 'pres.html'), 'w', encoding='utf-8').write(page)
    print('รวม %.1f นาที' % (t / 60))


if __name__ == '__main__':
    main()
