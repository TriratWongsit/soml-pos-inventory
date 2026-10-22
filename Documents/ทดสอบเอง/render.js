const path = require('path');
const puppeteer = require('/Users/triratwongsit/project/app/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'scenarios.html'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, 'กรณีทดสอบแบบเหตุการณ์_อำพรOMS.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#777">อำพร OMS · กรณีทดสอบแบบเหตุการณ์ · หน้า <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
  await b.close();
})();
