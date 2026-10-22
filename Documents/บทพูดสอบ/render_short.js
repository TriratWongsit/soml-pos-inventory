const fs = require('fs'), path = require('path');
const puppeteer = require('/Users/triratwongsit/project/app/node_modules/puppeteer');
const md = fs.readFileSync(path.join(__dirname, 'บทพูดย่อ_อ่านเร็ว.md'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
let html = '', list = null;
for (const raw of md.split('\n')) {
  const l = raw.trimEnd();
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  if (/^# /.test(l)) { close(); html += `<h1>${inline(l.slice(2))}</h1>`; }
  else if (/^## /.test(l)) { close(); html += `<h2>${inline(l.slice(3))}</h2>`; }
  else if (/^---$/.test(l)) { close(); }
  else if (/^\d+\. /.test(l)) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`; }
  else if (/^- /.test(l)) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(l.slice(2))}</li>`; }
  else if (l === '') { close(); }
  else { close(); html += `<p>${inline(l)}</p>`; }
}
const css = `@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
@page{size:A4;margin:16mm 16mm 16mm 16mm} body{font-family:Sarabun,sans-serif;font-size:14px;line-height:1.5;color:#1b2430}
h1{font-size:24px;color:#0F4C81;margin:0 0 6px} h2{font-size:15px;color:#fff;background:#0F4C81;padding:4px 10px;border-radius:6px;margin:10px 0 4px;page-break-after:avoid}
p{margin:4px 0 8px} b{color:#B5531A} code{font-family:Menlo,monospace;font-size:13px;background:#f1f3f6;padding:1px 4px}`;
(async () => {
  const b = await puppeteer.launch({ headless: 'new' }); const p = await b.newPage();
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, 'บทพูดย่อ_อ่านเร็ว.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#777">บทพูดย่อ อำพร OMS · หน้า <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
  await b.close();
})();
