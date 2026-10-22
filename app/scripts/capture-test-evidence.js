#!/usr/bin/env node
// ---------------------------------------------------------------------
// เก็บภาพหน้าจอของ "การทดสอบ" สำหรับใช้เป็นรูปประกอบในบทที่ 4
//
// สคริปต์ capture-evidence.js เก็บภาพหน้าจอของตัวระบบ ส่วนสคริปต์นี้เก็บภาพ
// ผลการรันชุดทดสอบ คือสิ่งที่ปรากฏบนหน้าต่างคำสั่งจริงขณะทดสอบ และรายงาน
// ความครอบคลุมโค้ดแบบหน้าเว็บ เพื่อให้รูปในบทที่ 4 เป็นผลที่รันได้จริง
// ไม่ใช่ภาพที่จัดทำขึ้นเอง
//
// วิธีทำงาน: รันคำสั่งทดสอบแต่ละชุดจริง เก็บข้อความที่พิมพ์ออกมาทั้งหมด
// แปลงรหัสสีของหน้าต่างคำสั่ง (ANSI) เป็น HTML แล้วถ่ายภาพด้วยเบราว์เซอร์
// ภาพที่ได้จึงมีเนื้อความตรงกับที่รันทุกตัวอักษร และสร้างซ้ำได้
//
//   node scripts/capture-test-evidence.js            รันทุกชุด
//   node scripts/capture-test-evidence.js jest       รันเฉพาะชุดที่ระบุ
//   node scripts/capture-test-evidence.js --render   วาดภาพใหม่จากผลที่เก็บไว้
//                                                    โดยไม่รันชุดทดสอบซ้ำ
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const APP = path.join(__dirname, '..');
const EVIDENCE = path.join(APP, 'evidence');
const SHOTS = path.join(EVIDENCE, 'screenshots');
const RUNS = path.join(EVIDENCE, 'test-runs');

const PORT = Number(process.env.PORT || 4000);
const API = `https://localhost:${PORT}`;

// เช่นเดียวกับ capture-evidence.js — บังคับหมายเลขพร้อมเพย์สำหรับทดสอบเสมอ
// เมื่อสคริปต์นี้เป็นผู้เปิดเซิร์ฟเวอร์เอง เพื่อไม่ให้หมายเลขจริงของร้าน
// หลุดเข้าไปอยู่ในหลักฐานที่ commit ขึ้นที่เก็บโค้ด
const EVIDENCE_PROMPTPAY_ID = '0812345678';

// ---------------------------------------------------------------------
// แปลงข้อความจากหน้าต่างคำสั่งเป็น HTML
//
// เครื่องมือทดสอบพิมพ์สีด้วยรหัส ANSI (เช่น \x1b[32m คือสีเขียว) ถ้าตัดสี
// ทิ้งไปภาพจะอ่านยากและไม่เหมือนที่เห็นบนจอจริง จึงแปลงเฉพาะรหัสจัดรูปแบบ
// ตัวอักษร (SGR) เป็น <span> และตัดรหัสควบคุมเคอร์เซอร์อื่นทิ้ง
// ---------------------------------------------------------------------
const FG = {
  30: '#3b4048', 31: '#e06c75', 32: '#5aa469', 33: '#c18401', 34: '#4078f2',
  35: '#a626a4', 36: '#0184bc', 37: '#c8ccd4',
  90: '#8b949e', 91: '#ef596f', 92: '#89ca78', 93: '#e5c07b', 94: '#61afef',
  95: '#d55fde', 96: '#2bbac5', 97: '#ffffff',
};
const BG = {
  40: '#3b4048', 41: '#e06c75', 42: '#5aa469', 43: '#c18401', 44: '#4078f2',
  45: '#a626a4', 46: '#0184bc', 47: '#c8ccd4',
  100: '#4b5263', 101: '#ef596f', 102: '#89ca78', 103: '#e5c07b', 104: '#61afef',
  105: '#d55fde', 106: '#2bbac5', 107: '#ffffff',
};

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function ansiToHtml(raw) {
  // ตัดข้อความที่ถูกเขียนทับด้วย carriage return ออก เหลือเฉพาะบรรทัดสุดท้าย
  const text = raw
    .split('\n')
    .map((line) => line.split('\r').pop())
    .join('\n')
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')   // ชื่อหน้าต่าง
    .replace(/\x1b\[[0-9;]*[A-Za-fh-z]/g, (m) => (m.endsWith('m') ? m : ''));

  let out = '';
  let open = false;
  const state = { fg: null, bg: null, bold: false, dim: false };

  const span = () => {
    if (open) out += '</span>';
    const style = [
      state.fg ? `color:${state.fg}` : '',
      state.bg ? `background:${state.bg}` : '',
      state.bold ? 'font-weight:700' : '',
      state.dim ? 'opacity:.8' : '',
    ].filter(Boolean).join(';');
    if (style) { out += `<span style="${style}">`; open = true; } else { open = false; }
  };

  const parts = text.split(/(\x1b\[[0-9;]*m)/);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('\x1b[')) {
      for (const code of part.slice(2, -1).split(';').map((n) => Number(n || 0))) {
        if (code === 0) { state.fg = state.bg = null; state.bold = state.dim = false; }
        else if (code === 1) state.bold = true;
        else if (code === 2) state.dim = true;
        else if (code === 22) state.bold = state.dim = false;
        else if (code === 39) state.fg = null;
        else if (code === 49) state.bg = null;
        else if (FG[code]) state.fg = FG[code];
        else if (BG[code]) state.bg = BG[code];
      }
      span();
    } else {
      out += escapeHtml(part);
    }
  }
  return out + (open ? '</span>' : '');
}

/** หน้าต่างคำสั่งจำลองที่มีเนื้อความตรงกับผลการรันจริงทุกตัวอักษร */
const terminalPage = (title, command, body, exitCode) => `<!doctype html>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #eceff4; font-family: -apple-system, 'Helvetica Neue', sans-serif; }
  .win { margin: 18px; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 22px rgba(20,25,40,.22); }
  .bar { display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: #d8dde6; border-bottom: 1px solid #c3cad6; }
  .dot { width: 11px; height: 11px; border-radius: 50%; }
  .bar .t { flex: 1; text-align: center; font-size: 12.5px; color: #4a5263; font-weight: 600;
            margin-right: 46px; letter-spacing: .2px; }
  .body { background: #22252c; color: #c8ccd4; padding: 14px 18px 18px;
          font-family: Menlo, 'DejaVu Sans Mono', 'Thonburi', monospace;
          font-size: 13px; line-height: 1.55; }
  .cmd { color: #89ca78; font-weight: 700; margin-bottom: 6px; }
  .cmd span { color: #61afef; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
  .exit { margin-top: 12px; padding-top: 9px; border-top: 1px solid #3b4048; color: #8b949e; font-size: 12px; }
  .exit b { color: ${exitCode === 0 ? '#89ca78' : '#ef596f'}; }
</style>
<div class="win">
  <div class="bar">
    <div class="dot" style="background:#ec6a5e"></div>
    <div class="dot" style="background:#f4bf4f"></div>
    <div class="dot" style="background:#61c454"></div>
    <div class="t">${escapeHtml(title)}</div>
  </div>
  <div class="body">
    <div class="cmd"><span>soml@app $</span> ${escapeHtml(command)}</div>
    <pre>${body}</pre>
    <div class="exit">รหัสสถานะเมื่อจบการทำงาน (exit code): <b>${exitCode}</b>${
      exitCode === 0 ? ' — ผ่านทุกกรณีทดสอบ' : ' — มีกรณีทดสอบไม่ผ่าน'
    }</div>
  </div>
</div>`;

/** รันคำสั่งจริง เก็บทั้งข้อความปกติและข้อความแจ้งข้อผิดพลาดตามลำดับเวลา */
const run = (command, args, extraEnv = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: APP,
      // NODE_NO_WARNINGS ปิดคำเตือนของ Node ที่ไม่เกี่ยวกับผลการทดสอบ
      // เพราะคำเตือนแทรกกลางบรรทัดทำให้ภาพอ่านยาก ส่วนผลการทดสอบยังครบเหมือนเดิม
      env: { ...process.env, FORCE_COLOR: '1', NODE_NO_WARNINGS: '1', ...extraEnv },
    });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('close', (code) => resolve({ output, code: code ?? 0 }));
  });

/** เปิด backend และบริการพิมพ์ใบเสร็จ ถ้ายังไม่ได้เปิดไว้ */
async function ensureServer() {
  try {
    if ((await fetch(`${API}/api/health`)).ok) {
      console.log(`  ใช้เซิร์ฟเวอร์ที่เปิดอยู่แล้วที่ ${API}\n`);
      return null;
    }
  } catch { /* ยังไม่ได้เปิด — เปิดเอง */ }

  console.log('  เปิดเซิร์ฟเวอร์สำหรับการทดสอบ …');
  const env = { ...process.env, PROMPTPAY_ID: EVIDENCE_PROMPTPAY_ID };
  const api = spawn('node', [path.join(APP, 'backend', 'server.js')], { env, stdio: 'ignore' });
  const print = spawn('node', [path.join(APP, 'print-service', 'server.js')], { env, stdio: 'ignore' });

  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${API}/api/health`)).ok) { console.log('  เซิร์ฟเวอร์พร้อมแล้ว\n'); return [api, print]; } }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  api.kill(); print.kill();
  throw new Error('เปิดเซิร์ฟเวอร์ไม่สำเร็จ');
}

// ---------------------------------------------------------------------
// รายการภาพที่ต้องเก็บ เรียงตามลำดับที่ปรากฏในบทที่ 4
// ---------------------------------------------------------------------
const STEPS = [
  {
    key: 'jest',
    file: 'fig4-13_test_run',
    title: 'ผลการรันชุดทดสอบอัตโนมัติทั้งหมดพร้อมความครอบคลุมโค้ด',
    command: 'npm test',
    argv: ['node_modules/.bin/jest', '--coverage', '--runInBand', '--detectOpenHandles', '--colors'],
    needsServer: false,
    width: 1180,
  },
  {
    key: 'dispatch',
    file: 'fig4-14_test_dispatch_verbose',
    title: 'รายชื่อกรณีทดสอบของการจ่ายสินค้าและการแจ้งเตือน',
    command: 'npx jest backend/__tests__/integration/dispatch.test.js --verbose',
    argv: ['node_modules/.bin/jest', 'backend/__tests__/integration/dispatch.test.js',
           '--selectProjects', 'integration', '--verbose', '--colors'],
    needsServer: false,
    width: 1180,
  },
  {
    key: 'tc06',
    file: 'fig4-16_test_tc06',
    title: 'ผลการทดสอบการยืนยันจ่ายสินค้าพร้อมกันจากหลายเครื่อง (TC-06)',
    command: 'npm run test:tc06',
    argv: ['scripts/tc06-concurrent-dispatch.js'],
    node: true,
    needsServer: true,
    width: 1180,
  },
  {
    key: 'system',
    file: 'fig4-17_test_system',
    title: 'ผลการทดสอบระดับระบบ TC-05, TC-13, TC-14 และ NFR-01',
    command: 'npm run test:system',
    argv: ['scripts/run-system-tests.js'],
    node: true,
    needsServer: true,
    width: 1060,
  },
  {
    key: 'browsers',
    file: 'fig4-18_test_browsers',
    title: 'ผลการทดสอบความเข้ากันได้ของเบราว์เซอร์ (NFR-07)',
    command: 'npm run test:browsers',
    argv: ['scripts/browser-matrix.js'],
    node: true,
    needsServer: true,
    width: 1060,
  },
];

/**
 * สมุดบันทึกการรัน — เก็บคำสั่ง เวลา และรหัสสถานะของทุกชุดที่รัน
 * ใช้ตรวจย้อนกลับว่าภาพแต่ละใบมาจากการรันครั้งใด
 */
const MANIFEST = path.join(RUNS, 'manifest.json');

function recordRun(step, code) {
  const book = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  book[step.key] = {
    command: step.command,
    figure: `${step.file}.png`,
    exitCode: code,
    executedAt: new Date().toISOString(),
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(book, null, 2), 'utf8');
}

/** วาดภาพใหม่จากผลที่เก็บไว้ ใช้เมื่อแก้รูปแบบการแสดงผลโดยไม่ต้องรันซ้ำ */
async function renderFromRecord(browser, step) {
  const book = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const record = book[step.key];
  const ansi = path.join(RUNS, `${step.key}.ansi`);
  const plain = path.join(RUNS, `${step.key}.txt`);
  const source = fs.existsSync(ansi) ? ansi : plain;
  if (!record || !fs.existsSync(source)) {
    console.log(`  ข้าม ${step.key} — ยังไม่มีผลการรันที่เก็บไว้`);
    return;
  }

  const html = terminalPage(step.title, step.command,
    ansiToHtml(fs.readFileSync(source, 'utf8').trimEnd()), record.exitCode);
  const page = await browser.newPage({ viewport: { width: step.width, height: 220 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(SHOTS, `${step.file}.png`), fullPage: true });
  await page.close();

  book[step.key].figure = `${step.file}.png`;
  fs.writeFileSync(MANIFEST, JSON.stringify(book, null, 2), 'utf8');
  console.log(`  ✓ ${step.file}.png   วาดใหม่จากผลที่รันเมื่อ ${record.executedAt}`);
}

/** ถ่ายภาพรายงานความครอบคลุมโค้ดแบบหน้าเว็บที่ jest สร้างไว้ */
async function captureCoverageReport(browser) {
  const report = path.join(EVIDENCE, 'coverage', 'lcov-report', 'index.html');
  if (!fs.existsSync(report)) throw new Error('ยังไม่มีรายงานความครอบคลุม ให้รันชุดทดสอบก่อน');

  // ความสูงน้อย ๆ แล้วให้ fullPage ขยายตามเนื้อหา ภาพจึงพอดีกับตารางที่รายงานแสดง
  const page = await browser.newPage({ viewport: { width: 1180, height: 300 }, deviceScaleFactor: 2 });
  await page.goto(`file://${report}`, { waitUntil: 'load' });
  const out = path.join(SHOTS, 'fig4-15_coverage_report.png');
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
  console.log(`  ✓ fig4-15_coverage_report.png   รายงานความครอบคลุมโค้ดแบบหน้าเว็บ`);
}

(async () => {
  const argv = process.argv.slice(2);
  const renderOnly = argv.includes('--render');
  const only = argv.filter((a) => !a.startsWith('--'));
  const steps = only.length ? STEPS.filter((s) => only.includes(s.key)) : STEPS;

  fs.mkdirSync(SHOTS, { recursive: true });
  fs.mkdirSync(RUNS, { recursive: true });

  if (renderOnly) {
    const browser = await chromium.launch();
    for (const step of steps) await renderFromRecord(browser, step);
    if (!only.length || only.includes('coverage')) await captureCoverageReport(browser);
    await browser.close();
    return;
  }

  let servers = null;
  if (steps.some((s) => s.needsServer)) servers = await ensureServer();

  const browser = await chromium.launch();
  const failures = [];

  try {
    for (const step of steps) {
      process.stdout.write(`  กำลังรัน ${step.command} … `);
      const { output, code } = await run(
        step.node ? 'node' : step.argv[0],
        step.node ? step.argv : step.argv.slice(1)
      );
      console.log(code === 0 ? 'ผ่าน' : `จบด้วยรหัส ${code}`);
      if (code !== 0) failures.push(step.command);

      // เก็บข้อความดิบไว้ด้วย เพื่อให้ตรวจสอบย้อนกลับได้ว่าภาพตรงกับผลที่รัน
      // ไฟล์ .txt อ่านด้วยตาได้ ส่วนไฟล์ .ansi เก็บรหัสสีไว้ครบ ใช้วาดภาพใหม่
      // ได้โดยไม่ต้องรันชุดทดสอบซ้ำ
      fs.writeFileSync(path.join(RUNS, `${step.key}.txt`),
        output.replace(/\x1b\[[0-9;]*m/g, ''), 'utf8');
      fs.writeFileSync(path.join(RUNS, `${step.key}.ansi`), output, 'utf8');
      recordRun(step, code);

      const html = terminalPage(step.title, step.command, ansiToHtml(output.trimEnd()), code);
      // ตั้งความสูงไว้น้อย ๆ แล้วให้ fullPage ขยายตามเนื้อหา ภาพจึงไม่มีพื้นที่ว่างค้าง
      const page = await browser.newPage({ viewport: { width: step.width, height: 220 }, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'load' });
      await page.screenshot({ path: path.join(SHOTS, `${step.file}.png`), fullPage: true });
      await page.close();
      console.log(`  ✓ ${step.file}.png`);
    }

    if (!only.length || only.includes('coverage')) await captureCoverageReport(browser);
  } finally {
    await browser.close();
    if (servers) servers.forEach((s) => s.kill());
  }

  console.log('');
  if (failures.length) {
    console.log(`  มีชุดทดสอบที่ไม่ผ่าน: ${failures.join(', ')}`);
    console.log('  ภาพถูกเก็บไว้ตามผลจริง ต้องแก้ให้ผ่านก่อนนำไปใช้ในรูปเล่ม');
    process.exit(1);
  }
  console.log('  เก็บภาพผลการทดสอบครบทุกชุดแล้ว');
})().catch((e) => { console.error(e); process.exit(1); });
