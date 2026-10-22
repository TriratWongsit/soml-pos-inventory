# -*- coding: utf-8 -*-
"""สร้างเสียงพากย์ทีละจังหวะ คำนวณไทม์ไลน์ และเขียนหน้า anim.html ที่วาดภาพตามเวลา t
จากนั้น anim_render.js เปิดหน้านี้ เลื่อนเวลาทีละเฟรม แล้วส่งภาพให้ ffmpeg"""
import hashlib, html, io, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'soml')
ASSET = os.path.join(ROOT, 'Documents', 'assets')
W = os.path.join(HERE, '_anim')
TTS = os.path.join(W, 'tts')
sys.path.insert(0, HERE)
from anim_script import SCENES  # noqa: E402

VOICE, RATE = 'th-TH-NiwatNeural', '-12%'
INTRO, GAP, OUTRO, THINK = 0.9, 0.5, 0.9, 4.0
e = html.escape


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


def code_lines(sc):
    L = io.open(os.path.join(SRC, sc['file']), encoding='utf-8').read().split('\n')
    i = next(k for k, l in enumerate(L) if sc['start'] in l)
    rows = [(k + 1, L[k]) for k in range(i, min(i + sc['n'], len(L)))]
    for bt in sc['beats']:
        pats = bt.get('hl', [])
        bt['lines'] = [j for j, (_, t) in enumerate(rows) if any(p in t for p in pats)]
        if pats and not bt['lines']:
            raise SystemExit('ไม่พบบรรทัดที่ไฮไลต์ %r ใน %s' % (pats, sc['file']))
    return rows


def timeline():
    t, parts, out = 0.0, [], []
    for i, sc in enumerate(SCENES):
        start = t
        parts.append(silence(INTRO)); t += INTRO
        beats = []
        for j, bt in enumerate(sc['beats']):
            if sc['kind'] == 'qa' and bt.get('answer'):
                parts.append(silence(THINK)); t += THINK
            wav, d = tts(bt['say'])
            beats.append(dict(start=round(t - start, 3), dur=round(d, 3)))
            parts.append(wav); t += d
            parts.append(silence(GAP)); t += GAP
        parts.append(silence(OUTRO)); t += OUTRO
        out.append(dict(start=round(start, 3), end=round(t, 3), beats=beats))
        print('ฉาก %2d %-38s %.1f วินาที' % (i + 1, sc['title'].replace('<br>', ' ')[:38], t - start), flush=True)
    lst = os.path.join(W, 'audio.txt')
    io.open(lst, 'w').write(''.join("file '%s'\n" % p for p in parts))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'pcm_s16le',
                    os.path.join(W, 'narration.wav')], check=True)
    return out, t


def vis(i, sc):
    k = sc['kind']
    if k == 'big':
        return '<div class="big"><div class="bt">%s</div><div class="bs">%s</div></div>' % (sc['text'], sc['sub2'])
    if k == 'flow':
        bx = []
        for n, (a, d, c) in enumerate(sc['boxes']):
            if n:
                bx.append('<div class="arr" id="ar%d_%d">▼</div>' % (i, n))
            bx.append('<div class="fb" id="fb%d_%d" style="--c:%s"><b>%s</b><span>%s</span></div>' % (i, n, c, e(a), e(d)))
        return '<div class="flow" id="flow%d">%s<div class="pkt" id="pk%d"></div></div>' % (i, ''.join(bx), i)
    if k == 'code':
        rows = sc['rows']
        ln = ''.join('<div class="ln" id="ln%d_%d"><span class="no">%d</span><span class="tx">%s</span></div>'
                     % (i, j, no, e(t) or ' ') for j, (no, t) in enumerate(rows))
        return ('<div class="code"><div class="fn">%s <em>บรรทัด %d–%d</em></div><div class="vp" id="vp%d"><div class="inner" id="in%d">%s</div></div></div>'
                % (e(sc['file']), rows[0][0], rows[-1][0], i, i, ln))
    if k == 'shot':
        return ('<div class="shot"><div class="frame"><img id="im%d" src="file://%s"></div><div class="sl">%s</div></div>'
                % (i, os.path.join(ASSET, 'screens', sc['img']), e(sc['label'])))
    if k == 'race':
        return '''<div class="race" id="race%d">
<div class="dev a" id="da%d"><div class="dn">เครื่อง A</div><div class="dd">พนักงานคลังคนที่ 1</div><div class="res" id="ra%d"></div></div>
<div class="dev b" id="db%d"><div class="dn">เครื่อง B</div><div class="dd">พนักงานคลังคนที่ 2</div><div class="res" id="rb%d"></div></div>
<div class="gate" id="gt%d">🔒 ล็อกแถว orders</div>
<div class="db" id="dbx%d"><div class="cyl"></div><div class="dbt">MySQL</div><div class="dbs">ORD-0042 · <span id="st%d">รอจ่าย</span></div></div>
<div class="stock" id="sk%d">สต็อกปูน 10 ถุง → <b id="sv%d">10</b></div>
<div class="pk pa" id="pa%d">A</div><div class="pk pb" id="pb%d">B</div>
<div class="rl" id="rl%d"></div></div>''' % tuple([i] * 13)
    if k == 'qa':
        return ('<div class="qa"><div class="q">กรรมการถาม</div><div class="qq">%s</div>'
                '<div class="think" id="th%d"><div class="ring" id="rg%d"></div><span>คิดก่อนตอบ</span></div>'
                '<div class="ans" id="an%d"><div class="q a">ตอบแบบนี้</div><div class="aa">%s</div></div></div>' % (sc['q'], i, i, i, sc['a']))
    raise ValueError(k)


def main():
    os.makedirs(W, exist_ok=True)
    for sc in SCENES:
        if sc['kind'] == 'code':
            sc['rows'] = code_lines(sc)
    tl, total = timeline()
    data = []
    for i, (sc, t) in enumerate(zip(SCENES, tl)):
        d = dict(kind=sc['kind'], start=t['start'], end=t['end'], beats=[])
        for bt, bm in zip(sc['beats'], t['beats']):
            x = dict(bm)
            for key in ('lines', 'show', 'hl', 'packet', 'phase', 'answer'):
                if key in bt and not (key == 'hl' and sc['kind'] == 'code'):
                    x[key] = bt[key]
            d['beats'].append(x)
        data.append(d)
    secs = []
    for i, sc in enumerate(SCENES):
        subs = ''.join('<div class="st" id="su%d_%d">%s</div>' % (i, j, e(bt['say'])) for j, bt in enumerate(sc['beats']))
        secs.append('<section class="sc" id="s%d"><div class="top"><span class="chip">%s</span><span class="brand">อำพร OMS · %d/%d</span></div>'
                    '<h1 id="h%d">%s</h1><div class="vis">%s</div><div class="subs">%s</div></section>'
                    % (i, sc['chap'], i + 1, len(SCENES), i, sc['title'], vis(i, sc), subs))
    tpl = io.open(os.path.join(HERE, 'anim_template.html'), encoding='utf-8').read()
    page = tpl.replace('/*SCENES*/', ''.join(secs)).replace('/*DATA*/', json.dumps(dict(total=round(total, 3), scenes=data), ensure_ascii=False))
    io.open(os.path.join(W, 'anim.html'), 'w', encoding='utf-8').write(page)
    print('รวม %.1f นาที' % (total / 60))


if __name__ == '__main__':
    main()
