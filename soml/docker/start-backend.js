// ---------------------------------------------------------------------
// เริ่มระบบหลังบ้านใน Docker                                   [คอมเมนต์กรรมการ K-8]
// 1) รอจนฐานข้อมูลพร้อม  2) ครั้งแรกที่ยังไม่มีผู้ใช้ สร้างบัญชีตั้งต้น (db/seed/seed-users.js)
// 3) เปิด backend/server.js ซึ่งปรับโครงสร้างฐานข้อมูลให้เป็นรุ่นล่าสุดเองก่อนรับคำขอ
// ---------------------------------------------------------------------
const path = require('path');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');

const cfg = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'soml_new' };

(async () => {
  for (let i = 1; ; i++) {
    try {
      const conn = await mysql.createConnection(cfg);
      const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM users');
      await conn.end();
      if (n === 0) {
        console.log('ยังไม่มีผู้ใช้ สร้างบัญชีตั้งต้น 4 บัญชี');
        execFileSync(process.execPath, [path.join(__dirname, '..', 'db', 'seed', 'seed-users.js')], { stdio: 'inherit', env: process.env });
      }
      break;
    } catch (err) {
      if (i >= 60) { console.error('ต่อฐานข้อมูลไม่ได้:', err.message); process.exit(1); }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  require('../backend/server.js');
})();
