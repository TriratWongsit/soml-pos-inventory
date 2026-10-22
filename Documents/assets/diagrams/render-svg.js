// แปลงไฟล์ SVG เป็น PNG ความละเอียดสูง: node render-svg.js in.svg out.png [scale]
const puppeteer = require('/Users/triratwongsit/project/app/node_modules/puppeteer');
const fs = require('fs');
(async () => {
  const [inp, outp, sc] = process.argv.slice(2);
  const svg = fs.readFileSync(inp, 'utf8');
  const w = +svg.match(/width="(\d+)"/)[1], h = +svg.match(/height="(\d+)"/)[1];
  const b = await puppeteer.launch();
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: +(sc || 3) });
  await p.setContent('<html><body style="margin:0">' + svg + '</body></html>');
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: outp, clip: { x: 0, y: 0, width: w, height: h } });
  await b.close();
})();
