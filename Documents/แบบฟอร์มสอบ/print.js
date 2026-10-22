// พิมพ์ไฟล์ HTML ของแบบฟอร์มเป็น PDF ขนาด A4 ด้วย Chromium
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'soml', 'node_modules', 'playwright'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const name of ['P03', 'P07-1', 'P07-2']) {
    await page.goto('file://' + path.join(__dirname, name + '.html'));
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(__dirname, name + '.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  }
  await browser.close();
  console.log('printed');
})();
