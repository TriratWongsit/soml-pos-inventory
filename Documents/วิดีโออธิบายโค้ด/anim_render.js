// เปิด anim.html เลื่อนเวลาทีละเฟรม แล้วส่งภาพ JPEG เข้า ffmpeg พร้อมเสียงพากย์
// ใช้: node anim_render.js [fps] [--preview t1,t2,...]
const puppeteer = require('/Users/triratwongsit/project/app/node_modules/puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const W = path.resolve(__dirname, '_anim');
(async () => {
  const fps = Number(process.argv[2] || 30);
  const pv = process.argv.indexOf('--preview');
  const b = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  p.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  await p.goto('file://' + path.join(W, 'anim.html'), { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.ready === true', { timeout: 60000 });
  const total = await p.evaluate('D.total');
  if (pv > 0) {
    const ts = process.argv[pv + 1].split(',').map(Number);
    for (const t of ts) { await p.evaluate((t) => render(t), t); await p.screenshot({ path: path.join(W, `pv_${t}.png`) }); }
    console.log('preview', ts.length, 'total', total); await b.close(); return;
  }
  const out = path.resolve(__dirname, 'อำพรOMS_อธิบายโค้ด_แอนิเมชัน.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-i', path.join(W, 'narration.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-tune', 'animation', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.ceil(total * fps);
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    await p.evaluate((t) => render(t), f / fps);
    const buf = await p.screenshot({ type: 'jpeg', quality: 90, optimizeForSpeed: true });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % (fps * 30) === 0) console.log(`frame ${f}/${n} · ${((Date.now() - t0) / 60000).toFixed(1)} นาที`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  console.log('done', out);
})();
