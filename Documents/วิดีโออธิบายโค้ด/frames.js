const puppeteer = require('/Users/triratwongsit/project/app/node_modules/puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  await p.goto('file://' + path.resolve(__dirname, '_work/frames.html'), { waitUntil: 'networkidle0', timeout: 120000 });
  await p.evaluateHandle('document.fonts.ready');
  const n = await p.evaluate(() => document.querySelectorAll('section').length);
  const over = [];
  for (let i = 0; i < n; i++) {
    const el = await p.$('#f' + i);
    const o = await p.evaluate((i) => {
      const v = document.getElementById('f' + i).querySelector('.vis'); const c = v.firstElementChild;
      for (let z = 1; z > 0.55 && v.scrollHeight > v.clientHeight + 1; z -= 0.03) c.style.zoom = z.toFixed(2);
      return v.scrollHeight - v.clientHeight; }, i);
    if (o > 2) over.push(i + ':' + o);
    await el.screenshot({ path: path.resolve(__dirname, `_work/f${String(i).padStart(3, '0')}.png`) });
  }
  console.log('frames', n, 'overflow', JSON.stringify(over));
  await b.close();
})();
