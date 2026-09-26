// ---------------------------------------------------------------------
// จุดเริ่มโปรแกรมของระบบหลังบ้าน — เปิดพอร์ต                  [หน่วยติดตั้งที่ 2]
//
// แยกจาก app.js เพื่อให้ชุดทดสอบใช้ app โดยไม่เปิดพอร์ต
// HTTPS จะเพิ่มเป็นขั้นแยกก่อนต่อ frontend (3.5.1)
// ---------------------------------------------------------------------
const http = require('http');
const { createApp } = require('./app');
const queue = require('./modules/queue');
const alert = require('./modules/alert');

const PORT = Number(process.env.PORT || 4000);
const app = createApp();
const server = http.createServer(app);
queue.attach(server); // ช่องทางค้างสองทาง (WebSocket) ที่ /ws
alert.start();        // ตรวจคิวค้างทุก 60 วินาที (BR-05 เชิงรุก)

server.listen(PORT, () => {
  console.log(`SOML backend พร้อมใช้งานที่ http://localhost:${PORT}`);
});
