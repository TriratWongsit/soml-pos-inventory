const path=require('path');const puppeteer=require('/Users/triratwongsit/project/app/node_modules/puppeteer');
(async()=>{const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();
await p.goto('file://'+path.join(__dirname,'spine.html'),{waitUntil:'networkidle0'});await p.evaluate(()=>document.fonts.ready);
await p.pdf({path:path.join(__dirname,'สันปก.pdf'),landscape:true,format:'A4',printBackground:true,preferCSSPageSize:true});await b.close();})();
