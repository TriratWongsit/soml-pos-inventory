#!/usr/bin/env node
// ---------------------------------------------------------------------
// สาธิตการทำงานของระบบแบบครบวงจร   ใช้ตอนนำเสนอโครงงาน
//
// ขับเบราว์เซอร์จริงสองหน้าต่างพร้อมกันเสมือนพนักงานขายและพนักงานคลังอยู่
// คนละเครื่อง เพื่อให้เห็นว่าคิวฝั่งคลังขึ้นเองโดยไม่ต้องกดรีเฟรช และเห็น
// กลไกป้องกันการจ่ายซ้ำทำงานจริง
//
// ต้องเปิด backend, print-service และฐานข้อมูลไว้ก่อน แล้วสั่ง
//   npm run demo
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const WEB = `https://localhost:${process.env.PORT || 4000}`;
const PW = process.env.SEED_PASSWORD || 'Soml@2569';
const OUT = path.join(ROOT, 'evidence', 'demo');
const step = (n, t) => console.log(`\n[${n}] ${t}`);

const signIn = async (page, user) => {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#username', user);
  await page.fill('#password', PW);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.side');
};
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'soml',
  });
  const stock = async (id) => (await db.query('SELECT name, stock_qty, reorder_point FROM products WHERE product_id=?', [id]))[0][0];

  const browser = await chromium.launch();
  const ctxSales = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, locale: 'th-TH' });
  const ctxWh = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, locale: 'th-TH' });
  const sales = await ctxSales.newPage();
  const wh = await ctxWh.newPage();

  step(1, 'พนักงานขายและพนักงานคลังเข้าสู่ระบบคนละเครื่อง');
  await signIn(sales, 'sales01');
  await signIn(wh, 'wh01');
  console.log('    พนักงานขาย เห็นเมนู:', (await sales.locator('.side a').allTextContents()).join(' · '));
  console.log('    พนักงานคลัง เห็นเมนู:', (await wh.locator('.side a').allTextContents()).join(' · '));

  step(2, 'พนักงานคลังเปิดหน้าคิวค้างไว้ ตอนนี้คิวยังว่าง');
  await wh.goto(`${WEB}/queue`, { waitUntil: 'networkidle' });
  await wh.waitForFunction(() => document.body.dataset.realtime === 'websocket', null, { timeout: 15000 });
  console.log('    ช่องทางเรียลไทม์:', await wh.evaluate(() => document.body.dataset.realtime));
  console.log('    จำนวนคิว:', (await wh.locator('.card h2').textContent()).trim());
  await shot(wh, '01_คิวว่าง');

  step(3, 'พนักงานขายเลือกสินค้า 3 รายการ');
  await sales.waitForSelector('.plist .row');
  for (const [i, n] of [[0, 1], [7, 2], [12, 3]]) {
    await sales.click(`.plist .row >> nth=${i}`);
    await sales.waitForFunction((c) => document.querySelectorAll('.card table tbody tr').length >= c, n);
  }
  // ปรับจำนวนให้สมจริง
  const qty = sales.locator('.card input[type="number"]');
  for (const [i, v] of [[0, 40], [1, 12], [2, 3]]) { await qty.nth(i).fill(String(v)); await sales.waitForTimeout(250); }
  await sales.waitForTimeout(600);
  const total = (await sales.locator('.total b').textContent()).trim();
  console.log('    ยอดรวมที่ระบบคำนวณ:', total);
  await shot(sales, '02_ขายหน้าร้าน');

  step(4, 'สร้าง QR พร้อมเพย์');
  await sales.click('button:has-text("สร้าง QR พร้อมเพย์")');
  await sales.waitForSelector('.qrbox img');
  await shot(sales, '03_qr');
  console.log('    แสดง QR ยอด', (await sales.locator('.qrbox div').last().textContent()).trim());

  step(5, 'กดยืนยันรับชำระ แล้วจับเวลาว่าคิวฝั่งคลังขึ้นเองกี่มิลลิวินาที');
  const t0 = Date.now();
  await sales.click('button:has-text("ยืนยันรับชำระเงิน")');
  await wh.waitForSelector('.qtable tbody tr', { timeout: 15000 });
  const latency = Date.now() - t0;
  await sales.waitForSelector('.alert.ok');
  const orderNo = (await sales.locator('.alert.ok .t').textContent()).match(/ORD-[\d-]+/)[0];
  console.log(`    คำสั่งซื้อ ${orderNo}`);
  console.log(`    คิวฝั่งคลังขึ้นเองภายใน ${latency} ms โดยไม่ได้กดรีเฟรช  (เกณฑ์ NFR-02 คือ 3000 ms)`);
  await shot(sales, '04_รับชำระสำเร็จ');
  await shot(wh, '05_คิวขึ้นเอง');

  step(6, 'ตรวจใบเสร็จที่บริการพิมพ์ส่งออก');
  const simDir = path.join(ROOT, 'evidence', 'printer-simulator');
  const rc = fs.readdirSync(simDir).find((f) => f.endsWith('.txt'));
  console.log(fs.readFileSync(path.join(simDir, rc), 'utf8').split('\n').map((l) => '    │ ' + l).join('\n'));

  step(7, 'พนักงานคลังเปิดรายการ ตรวจนับ แล้วยืนยันจ่าย');
  const before = await Promise.all([stock(1), stock(8), stock(13)]);
  before.forEach((p) => console.log(`    ก่อนจ่าย: ${p.name} = ${p.stock_qty}`));
  await wh.click('.qtable tbody tr:first-child button:has-text("เปิดรายการ")');
  await wh.waitForSelector('input[type="checkbox"]');
  await shot(wh, '06_ยืนยันจ่าย_ยังไม่ติ๊ก');
  console.log('    ปุ่มยืนยันก่อนติ๊กครบ:', await wh.locator('button:has-text("ยืนยันจ่ายสินค้าและตัดสต็อก")').isDisabled() ? 'กดไม่ได้' : 'กดได้');
  for (const c of await wh.locator('input[type="checkbox"]').all()) await c.check();
  console.log('    ปุ่มยืนยันหลังติ๊กครบ:', await wh.locator('button:has-text("ยืนยันจ่ายสินค้าและตัดสต็อก")').isDisabled() ? 'กดไม่ได้' : 'กดได้');
  await wh.click('button:has-text("ยืนยันจ่ายสินค้าและตัดสต็อก")');
  await wh.waitForSelector('button:has-text("ยืนยัน ตัดสต็อกเลย")');
  await shot(wh, '07_ถามยืนยันซ้ำ');
  await wh.click('button:has-text("ยืนยัน ตัดสต็อกเลย")');
  await wh.waitForSelector('.alert.ok');
  await shot(wh, '08_จ่ายสำเร็จ');
  const after = await Promise.all([stock(1), stock(8), stock(13)]);
  after.forEach((p, i) => console.log(`    หลังจ่าย: ${p.name} = ${p.stock_qty}  (ลดลง ${before[i].stock_qty - p.stock_qty})`));

  step(8, 'ลองกดยืนยันจ่ายซ้ำอีกครั้ง — หัวใจของวัตถุประสงค์ข้อ 1.2.3');
  const [[o]] = await db.query('SELECT order_id FROM orders WHERE order_no=?', [orderNo]);
  await wh.goto(`${WEB}/queue/${o.order_id}`, { waitUntil: 'networkidle' });
  await wh.waitForSelector('.alert.crit');
  console.log('    ระบบตอบ:', (await wh.locator('.alert.crit').first().textContent()).trim());
  await shot(wh, '09_จ่ายซ้ำไม่ได้');
  const [[mv]] = await db.query('SELECT COUNT(*) n FROM stock_movements WHERE order_id=?', [o.order_id]);
  console.log(`    บันทึกการเคลื่อนไหวสต็อกของคำสั่งซื้อนี้: ${mv.n} แถว`);

  step(9, 'ผู้จัดการเปิดแดชบอร์ดและประวัติการทำรายการ');
  const mgr = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, locale: 'th-TH' })).newPage();
  await signIn(mgr, 'mgr01');
  await mgr.waitForSelector('.kpi .val');
  const kpi = await mgr.locator('.kpi .card').allTextContents();
  kpi.forEach((k) => console.log('    ' + k.replace(/\s+/g, ' ').trim()));
  await shot(mgr, '10_แดชบอร์ด');
  await mgr.goto(`${WEB}/audit-logs`, { waitUntil: 'networkidle' });
  await mgr.waitForSelector('table tbody tr');
  console.log('    ประวัติการทำรายการ:', (await mgr.locator('.card h2').last().textContent()).trim());
  await shot(mgr, '11_ประวัติ');

  await browser.close();
  await db.end();
  console.log(`\nภาพประกอบการสาธิตอยู่ที่ ${path.relative(process.cwd(), OUT)}/`);
})().catch((e) => { console.error(e); process.exit(1); });
