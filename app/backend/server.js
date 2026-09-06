// ---------------------------------------------------------------------
// จุดเริ่มทำงานของ Backend API
//
// NFR-01 กำหนดให้เข้าถึงระบบผ่าน HTTPS เท่านั้น เซิร์ฟเวอร์จึงเปิดพอร์ต
// HTTPS เป็นช่องทางหลัก และเปิดพอร์ต HTTP ไว้เพียงเพื่อ redirect ต่อไปยัง
// HTTPS ไม่ให้บริการข้อมูลใด ๆ
//
// ใบรับรองสำหรับสภาพแวดล้อมพัฒนาและทดสอบสร้างด้วย `npm run gen-cert`
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { createApp } = require('./app');
const queueManager = require('./components/queueManager');
const alertEngine = require('./components/alertEngine');

const PORT = Number(process.env.PORT || 4000);
const HTTP_REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT || PORT + 1);
const CERT_DIR = path.join(__dirname, '..', 'certs');

function loadCertificate() {
  const keyPath = path.join(CERT_DIR, 'key.pem');
  const certPath = path.join(CERT_DIR, 'cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error(
      'ไม่พบใบรับรอง HTTPS ใน app/certs/\n' +
      'ให้รัน `npm run gen-cert` ก่อนเริ่มเซิร์ฟเวอร์ (ดูขั้นตอนใน README.md)'
    );
    process.exit(1);
  }
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

function start() {
  const app = createApp();
  const server = https.createServer(loadCertificate(), app);

  // ผูกช่องทาง WebSocket เข้ากับเซิร์ฟเวอร์เดียวกัน จึงได้เป็น wss:// อัตโนมัติ
  queueManager.attach(server);

  server.listen(PORT, () => {
    console.log(`SOML Backend API พร้อมใช้งานที่ https://localhost:${PORT}`);
  });

  // ตรวจคิวที่ค้างนานผิดปกติเป็นระยะ แล้วสร้างการแจ้งเตือนให้ผู้จัดการ [FR-08 · TC-11]
  const alertTimer = setInterval(() => {
    alertEngine.checkQueueDelay().catch((err) => console.error('[alertEngine]', err.message));
  }, Number(process.env.QUEUE_CHECK_INTERVAL_MS || 60000));
  alertTimer.unref();

  // พอร์ต HTTP ทำหน้าที่เดียวคือส่งต่อไปยัง HTTPS — ใช้ทวนสอบ NFR-01
  http
    .createServer((req, res) => {
      const host = (req.headers.host || `localhost:${HTTP_REDIRECT_PORT}`).split(':')[0];
      res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
      res.end();
    })
    .listen(HTTP_REDIRECT_PORT, () => {
      console.log(`พอร์ต HTTP ${HTTP_REDIRECT_PORT} ส่งต่อไปยัง HTTPS ทั้งหมด`);
    });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start };
