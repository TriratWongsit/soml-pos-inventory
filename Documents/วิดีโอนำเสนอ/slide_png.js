// เรนเดอร์สไลด์สอบแต่ละหน้าเป็น PNG ความละเอียด 2 เท่า และบันทึกตำแหน่งองค์ประกอบสำหรับให้กล้องซูม
const puppeteer = require('/Users/triratwongsit/project/app/node_modules/puppeteer');
const path = require('path'), fs = require('fs');
const W = path.resolve(__dirname, '_pres'); fs.mkdirSync(path.join(W, 'slides'), { recursive: true });
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await p.goto('file://' + path.resolve(__dirname, '../สไลด์สอบ/slides.html'), { waitUntil: 'networkidle0', timeout: 120000 });
  await p.evaluateHandle('document.fonts.ready');
  const rects = await p.evaluate(() => [...document.querySelectorAll('section')].map((s) => {
    const o = s.getBoundingClientRect(), R = (el) => { const r = el.getBoundingClientRect(); return [r.left - o.left, r.top - o.top, r.width, r.height].map(Math.round); };
    const q = (sel) => [...s.querySelectorAll(sel)].map(R);
    return { title: (s.querySelector('.ti') || s.querySelector('h1') || {}).textContent || '', box: q('.box'),
      li: [...s.querySelectorAll('.box')].map((bx) => [...bx.querySelectorAll('.li')].map(R)),
      row: q('tbody tr'), head: q('thead tr'), kpi: q('.kpi'), fig: q('.fig img'), note: q('.note'), ref: q('.ref'),
      flow: q('.flow span'), ep: q('.ep'), code: q('pre.code'), ag: q('.ag'), chips: q('.chips span'), body: q('.bd'),
      lv: q('.lv'), tcr: q('.tcr'), tcard: q('.tcard'), ub: q('.ub'), ubig: q('.ubig'), ur: q('.ur div'), uc: q('.uc') };
  }));
  fs.writeFileSync(path.join(W, 'rects.json'), JSON.stringify(rects));
  const secs = await p.$$('section');
  for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: path.join(W, 'slides', `s${String(i + 1).padStart(2, '0')}.png`) });
  console.log(secs.length, 'slides');
  await b.close();
})();
