// ---------------------------------------------------------------------
// MySQL ที่แนบมากับชุดติดตั้ง (runtime/mysql)                    [NFR-09]
//
// ชุดติดตั้งสำหรับเครื่องร้านแนบ MySQL Server มาในโฟลเดอร์ runtime/mysql
// จึงไม่ต้องติดตั้ง MySQL แยก และไม่ต้องใช้สิทธิ์ผู้ดูแลเครื่อง เพราะไม่ได้ลงทะเบียนเป็นบริการของ Windows
// start.js เปิด mysqld เป็นโปรแกรมลูกทุกครั้งที่เปิดระบบ และปิดให้เมื่อปิดระบบ
//
// ใช้พอร์ต 3307 และรับการเชื่อมต่อจากเครื่องนี้เท่านั้น ไม่ชนกับ MySQL ที่อาจติดตั้งไว้ก่อนแล้วที่พอร์ต 3306
// ข้อมูลอยู่ที่ data/mysql ในโฟลเดอร์เดียวกัน ย้ายทั้งโฟลเดอร์ไปเครื่องอื่นได้
// ---------------------------------------------------------------------
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = __dirname;
const BASE = path.join(ROOT, 'runtime', 'mysql');
const DATA = path.join(ROOT, 'data', 'mysql');
const PORT = 3307;
// ทดสอบบนเครื่องพัฒนาได้โดยชี้ AMPORN_MYSQLD ไปที่ mysqld ของเครื่องนั้น
const MYSQLD = process.env.AMPORN_MYSQLD
  || path.join(BASE, 'bin', process.platform === 'win32' ? 'mysqld.exe' : 'mysqld');

const bundled = () => fs.existsSync(MYSQLD);
const initialised = () => fs.existsSync(path.join(DATA, 'mysql.ibd'));

function args(extra = []) {
  const a = ['--no-defaults', `--datadir=${DATA}`, `--port=${PORT}`, '--bind-address=127.0.0.1',
    '--mysqlx=OFF', '--character-set-server=utf8mb4', '--collation-server=utf8mb4_unicode_ci',
    `--log-error=${path.join(ROOT, 'data', 'mysql.log')}`, ...extra];
  if (!process.env.AMPORN_MYSQLD) a.splice(1, 0, `--basedir=${BASE}`);
  return a;
}

function portOpen(port = PORT) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => { s.end(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}

async function waitPort(ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await portOpen()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// สร้างโฟลเดอร์ข้อมูลครั้งแรก — root@localhost ยังไม่มีรหัสผ่าน setup.js จะตั้งให้ทันที
function initialise() {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  try {
    execFileSync(MYSQLD, args(['--initialize-insecure']), { stdio: 'ignore' });
  } catch (e) {
    throw new Error(`Could not create the database. See data\\mysql.log\n${hint()}`);
  }
}

function hint() {
  return process.platform === 'win32'
    ? 'If data\\mysql.log is empty, install Microsoft Visual C++ Redistributable from https://aka.ms/vs/17/release/vc_redist.x64.exe and try again.'
    : '';
}

// เปิด mysqld ถ้ายังไม่เปิด คืนค่าโปรเซสที่เปิด (หรือ null ถ้าเปิดอยู่แล้ว)
async function start() {
  if (await portOpen()) return null;
  const child = spawn(MYSQLD, args(), { stdio: 'ignore', windowsHide: true });
  let exited = false;
  child.on('exit', () => { exited = true; });
  const up = await waitPort();
  if (!up || exited) throw new Error(`Could not start the database. See data\\mysql.log\n${hint()}`);
  return child;
}

// ปิดแบบปกติเพื่อให้ข้อมูลที่ค้างในหน่วยความจำถูกเขียนลงดิสก์ครบ
async function stop(password) {
  const mysql = require('mysql2/promise');
  try {
    const c = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password });
    await c.query('SHUTDOWN');
    await c.end();
  } catch { /* ปิดไปแล้ว */ }
  const end = Date.now() + 30000;
  while (Date.now() < end && await portOpen()) await new Promise((r) => setTimeout(r, 300));
}

module.exports = { bundled, initialised, initialise, start, stop, portOpen, PORT, DATA };
