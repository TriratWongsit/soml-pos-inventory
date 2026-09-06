#!/usr/bin/env node
// ---------------------------------------------------------------------
// เก็บภาพหน้าจอของระบบจริงสำหรับใช้เป็นรูปประกอบในบทที่ 4
//
// สคริปต์นี้เตรียมข้อมูลตัวอย่างผ่าน API แล้วขับเบราว์เซอร์จริงเดินตาม
// สถานการณ์ใช้งานของทั้งสามบทบาท ภาพที่ได้จึงเป็นหน้าจอของระบบที่ทำงาน
// อยู่จริง ไม่ใช่ภาพจำลอง และสร้างซ้ำได้เหมือนเดิมทุกครั้ง
//
//   node scripts/capture-evidence.js
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API = `https://localhost:${process.env.PORT || 4000}`;
// เก็บภาพจากเซิร์ฟเวอร์เดียวกับที่ใช้งานจริง เพื่อให้ภาพในบทที่ 4 ตรงกับ
// ระบบที่ส่งมอบ ไม่ใช่เซิร์ฟเวอร์พัฒนาของ Vite
const WEB = process.env.WEB_BASE || `https://localhost:${process.env.PORT || 4000}`;
const OUT = path.join(__dirname, '..', 'evidence', 'screenshots');
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const login = async (username) => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  return (await res.json()).token;
};

const call = (token, method, url, body) =>
  fetch(`${API}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json());

/**
 * เตรียมข้อมูลให้หน้าจอมีเนื้อหาสมจริง — คำสั่งซื้อที่ส่งมอบแล้วบางส่วน
 * และที่ยังค้างในคิวบางส่วน เพื่อให้แดชบอร์ดและหน้าคิวไม่ว่างเปล่า
 */
async function prepareData() {
  const sales = await login('sales01');
  const warehouse = await login('wh01');

  // เลือกสินค้าที่ยอดคงเหลือใกล้จุดสั่งซื้อเพิ่มมาใส่ในคำสั่งซื้อที่จะจ่ายออก
  // เพื่อให้ระบบสร้างการแจ้งเตือนสต็อกต่ำจริงระหว่างเก็บภาพ ไม่ใช่หน้าจอว่าง
  const { products } = await call(sales, 'GET', '/api/products');
  const nearReorder = products
    .filter((p) => p.is_active && p.stock_qty > p.reorder_point)
    .sort((a, b) => a.stock_qty / a.reorder_point - b.stock_qty / b.reorder_point)[0];
  const crossing = { productId: nearReorder.product_id, qty: nearReorder.stock_qty - nearReorder.reorder_point + 1 };

  const baskets = [
    [{ productId: 1, qty: 20 }, { productId: 7, qty: 4 }, crossing],
    [{ productId: 3, qty: 8 }, { productId: 12, qty: 30 }],
    [{ productId: 5, qty: 150 }],
    [{ productId: 2, qty: 15 }, { productId: 9, qty: 6 }, { productId: 15, qty: 2 }],
    [{ productId: 8, qty: 40 }],
    [{ productId: 4, qty: 12 }, { productId: 18, qty: 3 }],
  ];

  const created = [];
  for (const items of baskets) {
    created.push(await call(sales, 'POST', '/api/orders', { items }));
  }

  // สองรายการแรกจ่ายสินค้าเสร็จแล้ว รายการที่สามกำลังจัดของ
  await call(warehouse, 'POST', `/api/orders/${created[0].order.orderId}/dispatch`);
  await call(warehouse, 'POST', `/api/orders/${created[1].order.orderId}/dispatch`);
  await call(warehouse, 'PATCH', `/api/orders/${created[2].order.orderId}/status`, { status: 'picking' });

  return created.filter((c, i) => i >= 2).map((c) => c.order);
}

async function shot(page, name, note) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png  ${note}`);
}

/** เข้าสู่ระบบผ่านหน้าจอจริง ไม่ใช่การยัดโทเคนเข้าไปตรง ๆ */
async function signIn(page, username) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#username', username);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.side', { timeout: 15000 });
}

(async () => {
  console.log('เตรียมข้อมูลตัวอย่าง…');
  const queued = await prepareData();
  console.log(`  สร้างคำสั่งซื้อ ${queued.length + 3} รายการ · ส่งมอบแล้ว 2 · อยู่ในคิว ${queued.length}\n`);

  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: DESKTOP, ignoreHTTPSErrors: true, locale: 'th-TH' });
  const page = await desktop.newPage();

  console.log('เก็บภาพหน้าจอ (เดสก์ท็อป 1440×900)');

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await shot(page, 'fig4-01_login', 'หน้าเข้าสู่ระบบ');

  // ---- พนักงานขาย ----
  await signIn(page, 'sales01');
  await page.waitForSelector('.plist .row');
  // คลิกทีละรายการแล้วรอให้ตะกร้าอัปเดตก่อน มิฉะนั้นการเรนเดอร์ใหม่จะกลืนคลิกถัดไป
  for (const [index, expected] of [[0, 1], [2, 2], [4, 3]]) {
    await page.click(`.plist .row >> nth=${index}`);
    await page.waitForFunction((n) => document.querySelectorAll('.card table tbody tr').length >= n, expected);
  }
  await page.waitForSelector('.total b');
  await shot(page, 'fig4-02_pos', 'หน้าจอขายหน้าร้าน (POS)');

  await page.click('button:has-text("สร้าง QR พร้อมเพย์")');
  await page.waitForSelector('.qrbox img', { timeout: 15000 });
  await shot(page, 'fig4-03_qr', 'หน้าจอรับชำระเงินด้วย QR พร้อมเพย์');

  // ---- พนักงานคลังสินค้า ----
  await page.click('.side .logout button');
  await signIn(page, 'wh01');
  await page.waitForSelector('.qtable tbody tr');
  await shot(page, 'fig4-04_queue', 'หน้าจอคิวรอจ่ายสินค้า');

  await page.click('.qtable tbody tr:first-child button:has-text("เปิดรายการ")');
  await page.waitForSelector('input[type="checkbox"]');
  for (const box of await page.locator('input[type="checkbox"]').all()) await box.check();
  await shot(page, 'fig4-05_dispatch', 'หน้าจอยืนยันการจ่ายสินค้า (ติ๊กตรวจนับครบแล้ว)');

  // ---- ผู้จัดการ ----
  await page.click('.side .logout button');
  await signIn(page, 'mgr01');
  await page.waitForSelector('.kpi .val');
  await shot(page, 'fig4-06_dashboard', 'แดชบอร์ดปฏิบัติการ');

  await page.click('.side a:has-text("แดชบอร์ดบริหาร")');
  await page.waitForSelector('.kpi .val');
  await shot(page, 'fig4-07_executive', 'แดชบอร์ดบริหาร');

  await page.click('.side a:has-text("จัดการข้อมูลสินค้า")');
  await page.waitForSelector('table tbody tr');
  await shot(page, 'fig4-08_products', 'หน้าจัดการข้อมูลสินค้า');

  await page.click('.side a:has-text("การแจ้งเตือน")');
  await page.waitForSelector('.card');
  await shot(page, 'fig4-09_notifications', 'หน้าการแจ้งเตือน');

  await page.click('.side a:has-text("ประวัติการทำรายการ")');
  await page.waitForSelector('table tbody tr');
  await shot(page, 'fig4-10_audit_logs', 'หน้าประวัติการทำรายการ');

  // ---- อุปกรณ์เคลื่อนที่ (NFR-03) ----
  console.log('\nเก็บภาพหน้าจอ (สมาร์ตโฟน 390×844)');
  const mobile = await browser.newContext({
    viewport: MOBILE, ignoreHTTPSErrors: true, locale: 'th-TH', isMobile: true, hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mpage = await mobile.newPage();
  await signIn(mpage, 'wh01');
  await mpage.waitForSelector('.qcards .item');
  await shot(mpage, 'fig4-11_queue_mobile', 'หน้าจอคิวรอจ่ายสินค้าบนสมาร์ตโฟน');

  await mpage.click('.qcards .item:first-child button:has-text("เปิดรายการ")');
  await mpage.waitForSelector('input[type="checkbox"]');
  await shot(mpage, 'fig4-12_dispatch_mobile', 'หน้าจอยืนยันจ่ายสินค้าบนสมาร์ตโฟน');

  await browser.close();
  console.log(`\nเก็บภาพครบแล้วที่ ${path.relative(process.cwd(), OUT)}`);
})().catch((e) => { console.error(e); process.exit(1); });
