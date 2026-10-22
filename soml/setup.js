// ---------------------------------------------------------------------
// ติดตั้งระบบอำพร OMS บนเครื่องใหม่                          [NFR-09 · ตารางที่ 3.15]
//
// เรียกจาก install.bat หลัง npm install แล้ว (ต้องใช้ mysql2 bcryptjs dotenv)
//   1. ถ้ายังไม่มี .env ถามค่าที่ต่างกันในแต่ละร้าน แล้วสร้าง .env จาก .env.example
//   2. สร้างฐานข้อมูล: schema + สินค้า + ผู้ใช้ — ทำงานเหมือน db/reset-db.sh
//      แต่ไม่ต้องมี bash และไม่ต้องเพิ่ม mysql เข้า PATH เพราะเชื่อมต่อผ่าน mysql2 โดยตรง
//
// ถ้ามี MySQL แนบมาใน runtime/mysql (ชุดติดตั้งสำหรับเครื่องร้าน) จะใช้ตัวนั้นที่พอร์ต 3307
// ตั้งรหัสผ่าน root แบบสุ่มให้เอง ผู้ติดตั้งจึงไม่ต้องรู้หรือกรอกรหัส MySQL (ดู runtime.js)
//
// รันซ้ำได้: ถ้าฐานข้อมูลมีคำสั่งซื้ออยู่แล้ว จะถามยืนยันก่อนลบทิ้ง
//
// ข้อความบนหน้าต่างเป็นภาษาอังกฤษ เพราะหน้าต่าง cmd ของเครื่องร้านแสดงภาษาไทยเป็นสี่เหลี่ยม (ฟอนต์ไม่มีอักษรไทย)
// พนักงานต้องอ่านคำถามตอนติดตั้งออก (พบตอนติดตั้งที่ร้าน 19 ต.ค. 2569) หน้าเว็บยังเป็นภาษาไทยเหมือนเดิม
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execFileSync } = require('child_process');
const db = require('./runtime');

const ROOT = __dirname;
const ENV = path.join(ROOT, '.env');
const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();   // เก็บบรรทัดที่พิมพ์ไว้เป็นคิว ไม่ตกหล่นแม้พิมพ์ล่วงหน้า

async function ask(q, { required = true, def = '' } = {}) {
  for (;;) {
    process.stdout.write(q + (def ? ` [${def}]` : '') + ' : ');
    const { value = '' } = await lines.next();
    const a = value.trim() || def;
    if (a || !required) return a;
    console.log('  This field is required.');
  }
}

// รหัสผ่านอาจมี # หรือช่องว่าง ซึ่ง dotenv จะตัดทิ้งถ้าไม่ครอบด้วยเครื่องหมายคำพูด
const quote = (v) => (v.includes("'") ? JSON.stringify(v) : `'${v}'`);

function setVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text) ? text.replace(re, `${key}=${value}`) : text + `\n${key}=${value}\n`;
}

async function writeEnv(bundledPass) {
  if (fs.existsSync(ENV)) {
    console.log('Found .env - using the existing settings. (To change them, delete .env and run install.bat again.)\n');
    return;
  }
  console.log('Shop settings - type each answer and press Enter\n');
  const dbPass = bundledPass ?? await ask('MySQL root password', { required: false });
  let promptpay;
  for (;;) {
    promptpay = (await ask('1) Shop PromptPay number (10-digit phone or 13-digit ID)')).replace(/[-\s]/g, '');
    if (/^(0\d{9}|\d{13})$/.test(promptpay)) break;
    console.log('  Wrong format. Use 10 digits starting with 0, or 13 digits.');
  }
  let seedPass;
  for (;;) {
    seedPass = await ask('2) Starting password for all staff (at least 8 characters)');
    if (seedPass.length >= 8) break;
    console.log('  Too short.');
  }
  // ชื่อแชร์ของ Windows เป็นอักษรอังกฤษ ตัวเลข และ - _ . เท่านั้น
  // เคยมีผู้ติดตั้งกรอกชื่อผู้ใช้ลงช่องนี้ ระบบจึงส่งใบเสร็จไปเครื่องพิมพ์ที่ไม่มีอยู่จริง
  let share;
  for (;;) {
    share = await ask('3) Printer share name (just press Enter if unsure)', { def: 'AmpornOMS-Receipt' });
    if (/^[A-Za-z0-9._-]+$/.test(share)) break;
    console.log('  English letters, digits and - _ . only. Press Enter to use AmpornOMS-Receipt.');
  }

  let t = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  t = setVar(t, 'DB_PASSWORD', quote(dbPass));
  if (bundledPass !== undefined) {
    t = setVar(t, 'DB_HOST', '127.0.0.1');
    t = setVar(t, 'DB_PORT', String(db.PORT));
  }
  t = setVar(t, 'PROMPTPAY_ID', promptpay);
  t = setVar(t, 'SEED_PASSWORD', quote(seedPass));
  t = setVar(t, 'PRINTER_INTERFACE', `printer:${share}`);
  t = setVar(t, 'JWT_SECRET', crypto.randomBytes(32).toString('hex'));
  fs.writeFileSync(ENV, t);
  console.log('\n  OK - settings saved (.env)\n');
}

// ไฟล์ schema/seed มี CREATE DATABASE/USE soml_new อยู่ในตัว ตัดออกแล้วเลือกฐานเป้าหมายจากการเชื่อมต่อแทน
function sqlOf(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(CREATE DATABASE|DEFAULT CHARACTER SET|DEFAULT COLLATE|USE )/i.test(l))
    .join('\n');
}

async function resetDb() {
  require('dotenv').config({ path: ENV, override: true });
  const mysql = require('mysql2/promise');
  const name = process.env.DB_NAME || 'soml_new';
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    multipleStatements: true,
  };

  let conn;
  try {
    conn = await mysql.createConnection(cfg);
  } catch (e) {
    throw new Error(`Cannot connect to MySQL: ${e.message}\n  Check that MySQL is running. If the password is wrong, delete .env and run install.bat again.`);
  }

  const [[{ n }]] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [name, 'orders']);
  if (n) {
    const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${name}\`.orders`);
    if (c > 0) {
      console.log(`\n!!! WARNING: the database already has ${c} sales. Installing again will ERASE ALL SALES DATA. !!!`);
      console.log('To update the program, do NOT run install.bat - just run start.bat.');
      const ok = await ask('Type DELETE to erase everything, or press Enter to cancel', { required: false });
      if (ok !== 'DELETE') {
        console.log('Cancelled. Nothing was changed.');
        await conn.end();
        return false;
      }
    }
  }

  console.log(`Creating database ${name} ...`);
  await conn.query(`DROP DATABASE IF EXISTS \`${name}\`;
    CREATE DATABASE \`${name}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;`);
  await conn.changeUser({ database: name });
  await conn.query(sqlOf('db/schema/schema.sql'));
  await conn.query(sqlOf('db/seed/products.sql'));
  execFileSync(process.execPath, [path.join(ROOT, 'db', 'seed', 'seed-users.js')], { stdio: 'ignore', env: process.env });

  const [[t]] = await conn.query('SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ?', [name]);
  const [[p]] = await conn.query('SELECT COUNT(*) AS c FROM products');
  const [[u]] = await conn.query('SELECT COUNT(*) AS c FROM users');
  console.log(`  OK - ${t.c} tables, ${p.c} products, ${u.c} user accounts`);
  await conn.end();
  return true;
}

// MySQL ที่แนบมา: สร้างโฟลเดอร์ข้อมูลครั้งแรก เปิดชั่วคราว และตั้งรหัส root แบบสุ่ม
// รหัสเก็บไว้ใน data/db-password.txt ด้วย ถ้าลบ .env เพื่อตั้งค่าใหม่ จะยังเข้าฐานข้อมูลเดิมได้
const PASS_FILE = path.join(ROOT, 'data', 'db-password.txt');

// ห้ามแนะนำ taskkill /IM mysqld.exe: เครื่องร้านมีโปรแกรม Conmat5 ที่ใช้ MySQL ของตัวเอง (พอร์ต 3309)
// คำสั่งนั้นปิด MySQL ทุกตัวรวมของ Conmat5 ด้วย (เกิดจริง 19 ต.ค. 2569) จึงปิดเฉพาะ mysqld ที่อยู่ในโฟลเดอร์ AmpornOMS
const OTHER_DB = 'Another AmpornOMS database is already running on port 3307 (probably from an old copy of the program).\n'
  + '  1) Close every AmpornOMS window\n  2) Restart the computer (or run in cmd:\n'
  + '     powershell -Command "Get-Process mysqld | Where-Object Path -like *AmpornOMS* | Stop-Process -Force" )\n'
  + '     Do NOT use "taskkill /IM mysqld.exe" - it also stops other programs\' databases (e.g. Conmat5).\n'
  + '  3) Delete the "data" folder and the ".env" file in this folder\n  4) Run install.bat again';

async function prepareBundled() {
  const fresh = !db.initialised();
  // ฐานข้อมูลของสำเนาอื่นเปิดค้างที่พอร์ตเดียวกัน ถ้าต่อไปจะได้ "Access denied" ที่อ่านแล้วงง (พบที่ร้าน 19 ต.ค. 2569)
  if (await db.portOpen() && (fresh || !fs.existsSync(PASS_FILE))) throw new Error(OTHER_DB);
  if (fresh) {
    console.log('Creating the database folder (first time only, please wait) ...');
    db.initialise();
  }
  await db.start();
  if (fresh || !fs.existsSync(PASS_FILE)) {
    const mysql = require('mysql2/promise');
    const pass = crypto.randomBytes(18).toString('base64url');
    const c = await mysql.createConnection({ host: '127.0.0.1', port: db.PORT, user: 'root', password: '' });
    await c.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [pass]);
    await c.end();
    fs.writeFileSync(PASS_FILE, pass);
  }
  return fs.readFileSync(PASS_FILE, 'utf8').trim();
}

(async () => {
  let pass;
  try {
    if (db.bundled()) pass = await prepareBundled();
    await writeEnv(pass);
    const done = await resetDb();
    if (done) console.log('\nINSTALL COMPLETE. Now double-click start.bat to open the system.');
  } finally {
    rl.close();
    if (pass !== undefined) await db.stop(pass);
  }
})().catch((e) => {
  console.error('INSTALL FAILED:', e.message);
  process.exit(1);
});
