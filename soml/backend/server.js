// ---------------------------------------------------------------------
// จุดเริ่มโปรแกรมของระบบหลังบ้าน — เปิดพอร์ต                  [หน่วยติดตั้งที่ 2]
//
// แยกจาก app.js เพื่อให้ชุดทดสอบใช้ app โดยไม่เปิดพอร์ต
// HTTPS จะเพิ่มเป็นขั้นแยกก่อนต่อ frontend (5.4.1.5)
// ---------------------------------------------------------------------
const http = require('http');
const { createApp } = require('./app');
const queue = require('./modules/queue');
const alert = require('./modules/alert');
const { migrate } = require('./config/migrate');

const PORT = Number(process.env.PORT || 4000);
const app = createApp();
const server = http.createServer(app);
queue.attach(server); // ช่องทางค้างสองทาง (WebSocket) ที่ /ws
alert.start();        // ตรวจคิวค้างทุก 60 วินาที (BR-05 เชิงรุก)

// ปรับฐานข้อมูลที่มีอยู่ให้เป็นรุ่นล่าสุดก่อนรับคำขอ (เช่น เพิ่มตารางขายเชื่อ) ข้อมูลเดิมไม่หาย
migrate()
  .then((done) => { if (done.length) console.log(`ปรับฐานข้อมูลแล้ว: ${done.join(', ')}`); })
  .catch((err) => { console.error('ปรับฐานข้อมูลไม่สำเร็จ:', err.message); process.exit(1); })
  .then(() => server.listen(PORT, () => {
    console.log(`อำพร OMS backend พร้อมใช้งานที่ http://localhost:${PORT}`);
  }));
