# -*- coding: utf-8 -*-
import io, json, os, subprocess
W = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_work')
say = json.load(io.open(os.path.join(W, 'say.json'), encoding='utf-8'))
segs = []
for k, t in enumerate(say):
    # เสียงพากย์ธรรมชาติด้วยเสียงนิวรอลภาษาไทย th-TH-NiwatNeural ผ่าน edge-tts (ต้องต่ออินเทอร์เน็ต)
    a = os.path.join(W, 'a%03d.mp3' % k)
    for _ in range(3):
        r = subprocess.run(['python3', '-m', 'edge_tts', '--voice', 'th-TH-NiwatNeural', '--rate=+5%', '--text', t, '--write-media', a])
        if r.returncode == 0 and os.path.getsize(a) > 1000:
            break
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a], capture_output=True, text=True).stdout)
    seg = os.path.join(W, 's%03d.mp4' % k)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', os.path.join(W, 'f%03d.png' % k), '-i', a,
                    '-af', 'apad=pad_dur=0.7', '-t', '%.2f' % (d + 0.7), '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p',
                    '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '1', seg], check=True)
    segs.append(seg)
lst = os.path.join(W, 'list.txt')
io.open(lst, 'w').write(''.join("file '%s'\n" % s for s in segs))
out = os.path.join(os.path.dirname(W), 'อำพรOMS_อธิบายโค้ด_แนวตั้ง.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', out], check=True)
print(out)
