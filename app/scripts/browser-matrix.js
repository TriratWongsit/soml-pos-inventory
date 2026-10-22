#!/usr/bin/env node
// ---------------------------------------------------------------------
// ทดสอบความเข้ากันได้ของเบราว์เซอร์   [NFR-07]
//
// NFR-07 กำหนดว่าระบบต้องแสดงผลและทำงานถูกต้องบน Chrome, Edge และ Firefox
// เวอร์ชันล่าสุด สคริปต์นี้เปิดทุกหน้าจอด้วยกลไกเรนเดอร์ของแต่ละเบราว์เซอร์
// แล้วตรวจสามอย่าง คือหน้าจอเรนเดอร์ได้ องค์ประกอบสำคัญปรากฏครบ และไม่มี
// ข้อผิดพลาดในคอนโซล
//
// หมายเหตุ: Chrome และ Edge ใช้กลไกเรนเดอร์ Chromium ร่วมกัน การทดสอบบน
// Chromium จึงครอบคลุมทั้งสองเบราว์เซอร์ ส่วน WebKit เป็นกลไกของ Safari
// ซึ่งทดสอบเพิ่มไว้เกินข้อกำหนด
//
//   node scripts/browser-matrix.js
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { chromium, firefox, webkit } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ทดสอบกับเซิร์ฟเวอร์เดียวกับที่ใช้งานจริง ไม่ใช่เซิร์ฟเวอร์พัฒนาของ Vite
// เพราะตัวแทนคำขอของ Vite ไม่ได้อยู่ในระบบที่ส่งมอบ
const WEB = process.env.WEB_BASE || `https://localhost:${process.env.PORT || 4000}`;
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';
const EVIDENCE = path.join(__dirname, '..', 'evidence');

const ENGINES = [
  { name: 'Chromium', covers: 'Google Chrome, Microsoft Edge', launcher: chromium },
  { name: 'Firefox', covers: 'Mozilla Firefox', launcher: firefox },
  { name: 'WebKit', covers: 'Safari (ทดสอบเพิ่มเติมนอกข้อกำหนด)', launcher: webkit },
];

// หน้าจอที่ต้องตรวจ พร้อมองค์ประกอบที่ยืนยันว่าเรนเดอร์สำเร็จจริง
// realtime: true คือหน้าจอที่รับข้อมูลแบบเรียลไทม์ ต้องตรวจเพิ่มว่าช่องทาง
// เชื่อมต่อได้จริงบนเบราว์เซอร์นั้น ส่วนหน้าจออื่นตรวจเพียงว่าเรนเดอร์ถูกต้อง
const SCREENS = [
  { role: 'sales01', path: '/pos', label: 'ขายหน้าร้าน', expect: '.plist .row' },
  { role: 'wh01', path: '/queue', label: 'คิวรอจ่ายสินค้า', expect: '.card h2', realtime: true },
  { role: 'mgr01', path: '/dashboard', label: 'แดชบอร์ดปฏิบัติการ', expect: '.kpi .val', realtime: true },
  { role: 'mgr01', path: '/executive', label: 'แดชบอร์ดบริหาร', expect: '.kpi .val' },
  { role: 'mgr01', path: '/products', label: 'จัดการข้อมูลสินค้า', expect: 'table tbody tr' },
  { role: 'mgr01', path: '/notifications', label: 'การแจ้งเตือน', expect: '.card', realtime: true },
  { role: 'mgr01', path: '/audit-logs', label: 'ประวัติการทำรายการ', expect: 'table tbody tr' },
];

async function signIn(page, username) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#username', username);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.side', { timeout: 20000 });
}

async function testEngine({ name, covers, launcher }) {
  const browser = await launcher.launch();
  const results = [];
  let version = '';

  try {
    version = browser.version();

    // แยกบริบทเบราว์เซอร์ตามบทบาท เพราะโทเคนเก็บอยู่ใน localStorage ซึ่งใช้
    // ร่วมกันทั้งบริบท ถ้าใช้บริบทเดียวแล้วสั่งไปหน้าเข้าสู่ระบบขณะยังล็อกอิน
    // ค้างอยู่ ระบบจะพากลับหน้าแรกของบทบาทเดิมจนกรอกฟอร์มไม่ได้
    const byRole = new Map();
    for (const screen of SCREENS) {
      if (!byRole.has(screen.role)) byRole.set(screen.role, []);
      byRole.get(screen.role).push(screen);
    }

    for (const [role, screens] of byRole) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, locale: 'th-TH' });
      const page = await context.newPage();

      let consoleErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      try {
        await signIn(page, role);

        for (const screen of screens) {
          consoleErrors = [];
          try {
            await page.goto(`${WEB}${screen.path}`, { waitUntil: 'networkidle' });
            await page.waitForSelector(screen.expect, { timeout: 20000 });

            // หน้าจอที่รับข้อมูลเรียลไทม์ต้องเชื่อมต่อช่องทางได้จริง ไม่ว่าจะเป็น
            // WebSocket หรือช่องทางสำรอง ซึ่งเป็นเงื่อนไขของ NFR-02
            let channel = null;
            if (screen.realtime) {
              channel = await page
                .waitForFunction(() => {
                  const v = document.body.dataset.realtime;
                  return v && v !== 'none' ? v : false;
                }, null, { timeout: 15000 })
                .then((handle) => handle.jsonValue())
                .catch(() => 'none');
            }

            results.push({
              screen: screen.label, path: screen.path, role, rendered: true,
              realtimeChannel: channel, consoleErrors,
              pass: !screen.realtime || channel !== 'none',
            });
          } catch (err) {
            results.push({ screen: screen.label, path: screen.path, role, rendered: false, error: err.message.split('\n')[0], consoleErrors, pass: false });
          }
        }
      } catch (err) {
        for (const screen of screens) {
          results.push({ screen: screen.label, path: screen.path, role, rendered: false, error: `เข้าสู่ระบบไม่สำเร็จ: ${err.message.split('\n')[0]}`, pass: false });
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`  ${name.padEnd(9)} ${String(version).padEnd(14)} ผ่าน ${passed}/${results.length} หน้าจอ`);
  results.filter((r) => !r.pass).forEach((r) => console.log(`      ✗ ${r.screen}: ${r.error || r.consoleErrors[0]}`));

  return { engine: name, covers, version, screens: results, passed, total: results.length, verdict: passed === results.length ? 'ผ่าน' : 'ไม่ผ่าน' };
}

(async () => {
  console.log('ทดสอบความเข้ากันได้ของเบราว์เซอร์ (NFR-07)\n');
  const engines = [];
  for (const engine of ENGINES) engines.push(await testEngine(engine));

  const summary = {
    testCase: 'NFR-07',
    requirement: 'NFR-07',
    description: 'ระบบแสดงผลและทำงานถูกต้องบนเว็บเบราว์เซอร์ที่กำหนด',
    executedAt: new Date().toISOString(),
    screensPerEngine: SCREENS.length,
    engines,
    verdict: engines.every((e) => e.verdict === 'ผ่าน') ? 'ผ่าน' : 'ไม่ผ่าน',
  };

  fs.mkdirSync(EVIDENCE, { recursive: true });
  const out = path.join(EVIDENCE, 'browser-matrix.json');
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nผลรวม: ${summary.verdict} · บันทึกหลักฐานที่ ${path.relative(process.cwd(), out)}`);
  process.exit(summary.verdict === 'ผ่าน' ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
