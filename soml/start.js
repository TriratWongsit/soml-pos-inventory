// ---------------------------------------------------------------------
// เปิดระบบอำพร OMS ทั้งสี่หน่วยบนเครื่องร้าน                        [ตารางที่ 3.15]
//
// เรียกจาก start.bat — เปิดฐานข้อมูล (ถ้าแนบมาใน runtime/mysql) แล้วเปิดระบบหลังบ้าน
// บริการพิมพ์ และหน้าเว็บ โดยเรียก node โดยตรง ไม่ผ่าน npm
// เพราะ node_modules ในชุดติดตั้งเตรียมมาจากเครื่องอื่น ทางลัดใน node_modules/.bin จึงใช้บน Windows ไม่ได้
// หน้าเว็บเปิดให้เครื่องอื่นในวง Wi-Fi เดียวกันเข้าได้ (--host) เพราะพนักงานใช้ผ่านมือถือ
// ปิดระบบ: กด Ctrl+C หรือปิดหน้าต่างนี้ — ระบบจะปิดฐานข้อมูลแบบปกติให้ก่อน
// ---------------------------------------------------------------------
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, exec } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./runtime');

const WEB_PORT = 5173;
const COLORS = { backend: 34, print: 35, frontend: 32 };
const SERVICES = [
  ['backend', 'backend', ['server.js']],
  ['print', 'print-service', ['server.js']],
  ['frontend', 'frontend', [path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'), '--host']],
];

const children = [];
let mysqld = null;
let stopping = false;

function run(name, dir, args) {
  const child = spawn(process.execPath, args, { cwd: path.join(__dirname, dir), env: process.env });
  const tag = `\x1b[${COLORS[name]}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) out.write(tag + l + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${tag}stopped (code ${code}) - shutting everything down`);
      shutdown(1);
    }
  });
  children.push(child);
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log('\nShutting down ...');
  for (const c of children) c.kill();
  if (mysqld) await db.stop(process.env.DB_PASSWORD);
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));   // Windows ส่งสัญญาณนี้เมื่อผู้ใช้ปิดหน้าต่าง

function announce() {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  console.log('\n==============================================');
  console.log(' AMPORN OMS IS READY - keep this window open (closing it stops the system)');
  console.log(`   This PC : http://localhost:${WEB_PORT}`);
  for (const ip of ips) console.log(`   Phone   : http://${ip}:${WEB_PORT}`);
  console.log('==============================================\n');
  const open = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${open} http://localhost:${WEB_PORT}`);
}

(async () => {
  if (db.bundled()) {
    if (!db.initialised()) {
      console.error('Not installed yet. Double-click install.bat first.');
      process.exit(1);
    }
    console.log('Starting the database ...');
    mysqld = await db.start();
    if (!mysqld) {
      console.log('NOTE: a database was already running on port 3307. If login fails, close every AmpornOMS window,');
      console.log('      restart the computer, then run start.bat again. (Do NOT use "taskkill /IM mysqld.exe" -');
      console.log('      it also stops other programs\' databases such as Conmat5.)');
    }
  }
  for (const s of SERVICES) run(...s);

  // รอจนหน้าเว็บพร้อม แล้วบอกที่อยู่และเปิดเบราว์เซอร์ให้
  const started = Date.now();
  (function wait() {
    http.get(`http://localhost:${WEB_PORT}/`, (res) => { res.resume(); announce(); })
      .on('error', () => { if (Date.now() - started < 120000) setTimeout(wait, 1000); });
  })();
})().catch((e) => {
  console.error('FAILED TO START:', e.message);
  process.exit(1);
});
