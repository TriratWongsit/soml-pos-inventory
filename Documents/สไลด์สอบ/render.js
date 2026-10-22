const puppeteer = require('/Users/triratwongsit/project/app/node_modules/puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  await p.goto('file://' + path.resolve(__dirname, 'slides.html'), { waitUntil: 'networkidle0', timeout: 120000 });
  await p.evaluateHandle('document.fonts.ready');
  // ตรวจเนื้อหาล้นกรอบ
  const over = await p.evaluate(() => [...document.querySelectorAll('section')].map((s, i) => {
    const bd = s.querySelector('.bd'); if (!bd) return null;
    const r = bd.getBoundingClientRect(); let worst = 0;
    bd.querySelectorAll('*').forEach(el => { const q = el.getBoundingClientRect(); worst = Math.max(worst, q.bottom - r.bottom, q.right - r.right); });
    return worst > 2 ? (i + 1) + ':' + Math.round(worst) : null; }).filter(Boolean));
  console.log('overflow', JSON.stringify(over));
  console.log('font', await p.evaluate(() => document.fonts.check('30px "Noto Sans Thai"')));
  await p.pdf({ path: path.resolve(__dirname, 'อำพรOMS_สไลด์สอบ.pdf'), width: '1920px', height: '1080px', printBackground: true });
  await b.close();
})();
