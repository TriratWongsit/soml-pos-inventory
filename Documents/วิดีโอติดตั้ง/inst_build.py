# -*- coding: utf-8 -*-
"""สร้างเสียงพากย์ ไทม์ไลน์ และหน้า inst.html ของวิดีโอขั้นตอนติดตั้ง"""
import hashlib, html, io, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SCREEN = os.path.join(ROOT, 'Documents', 'assets', 'screens')
W = os.path.join(HERE, '_inst')
TTS = os.path.join(W, 'tts')
sys.path.insert(0, HERE)
from inst_script import SCENES  # noqa: E402

VOICE, RATE = 'th-TH-NiwatNeural', '-10%'
INTRO, GAP, OUTRO = 0.8, 0.5, 0.8
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


def term_lines(i, sc):
    out, k = [], 0
    for j, bt in enumerate(sc['beats']):
        for ln in bt.get('lines', []):
            kind = ln[0]
            if kind == 'q' or kind == 'cmd':
                body = '<span class="%s">%s</span><span class="typed" data-t="%s"></span>' % ('p' if kind == 'q' else 'pc', e(ln[1]), e(ln[2]))
            elif kind == 'tag':
                body = '<span class="tg %s">[%s]</span> %s' % (ln[1], ln[1], e(ln[2]))
            else:
                body = e(ln[1]) or '&nbsp;'
            out.append('<div class="tl t-%s" id="tl%d_%d" data-b="%d">%s</div>' % (kind, i, k, j, body))
            k += 1
    return ''.join(out)


def vis(i, sc):
    k = sc['kind']
    if k == 'title':
        return '<div class="ttl"><div class="tk">%s</div><div class="tt">%s</div><div class="ts">%s</div></div>' % (sc['top'], sc['text'], sc['sub'])
    if k == 'checklist':
        it = ''.join('<div class="ci" id="ci%d_%d"><span class="cb" id="cb%d_%d"></span><div><b>%s</b><small>%s</small></div></div>'
                     % (i, n, i, n, e(a), e(d)) for n, (a, d) in enumerate(sc['items']))
        return '<div class="cl"><div class="ch">%s</div><div class="cis">%s</div></div>' % (e(sc['title']), it)
    if k == 'stages':
        ps = ''.join('<div class="pn" id="pn%d_%d">%s</div>' % (i, n, p.replace('SCREEN/', 'file://%s/' % SCREEN)) for n, p in enumerate(sc['panels']))
        return '<div class="stg"><div class="mock">ภาพจำลองหน้าจอ</div>%s<div class="cur" id="cu%d"><svg viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#111" stroke-width="1.4"/></svg></div><div class="rip" id="rp%d"></div></div>' % (ps, i, i)
    if k == 'term':
        return ('<div class="tw"><div class="ttb"><span class="tic">▣</span>%s<span class="tx3">— □ ✕</span></div><div class="tbody" id="tb%d"><div class="tin" id="ti%d">%s</div></div></div>'
                % (e(sc['title']), i, i, term_lines(i, sc)))
    raise ValueError(k)


def main():
    os.makedirs(W, exist_ok=True)
    t, parts, data, secs = 0.0, [], [], []
    for i, sc in enumerate(SCENES):
        start = t
        parts.append(silence(INTRO)); t += INTRO
        beats = []
        for bt in sc['beats']:
            wav, d = tts(bt['say'])
            x = dict(start=round(t - start, 3), dur=round(d, 3))
            for key in ('on', 'panel', 'click', 'hl'):
                if key in bt:
                    x[key] = bt[key]
            beats.append(x)
            parts.append(wav); t += d
            parts.append(silence(GAP)); t += GAP
        parts.append(silence(OUTRO)); t += OUTRO
        data.append(dict(kind=sc['kind'], start=round(start, 3), end=round(t, 3), beats=beats))
        subs = ''.join('<div class="st" id="su%d_%d">%s</div>' % (i, j, e(bt['say'])) for j, bt in enumerate(sc['beats']))
        chap = sc.get('chap') or sc.get('title') or sc.get('top', '')
        secs.append('<section class="sc k-%s" id="s%d"><div class="vis">%s</div><div class="tag">%s</div><div class="subs">%s</div></section>'
                    % (sc['kind'], i, vis(i, sc), e(chap), subs))
        print('%2d %-9s %5.1f วินาที' % (i + 1, sc['kind'], t - start), flush=True)
    lst = os.path.join(W, 'audio.txt')
    io.open(lst, 'w').write(''.join("file '%s'\n" % p for p in parts))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'pcm_s16le',
                    os.path.join(W, 'narration.wav')], check=True)
    tpl = io.open(os.path.join(HERE, 'inst_template.html'), encoding='utf-8').read()
    page = tpl.replace('/*SCENES*/', ''.join(secs)).replace('/*DATA*/', json.dumps(dict(total=round(t, 3), scenes=data), ensure_ascii=False))
    io.open(os.path.join(W, 'inst.html'), 'w', encoding='utf-8').write(page)
    print('รวม %.1f นาที' % (t / 60))


if __name__ == '__main__':
    main()
