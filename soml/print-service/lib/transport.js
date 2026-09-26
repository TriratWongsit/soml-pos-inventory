// ---------------------------------------------------------------------
// ช่องทางส่งสายไบต์ไปยังเครื่องพิมพ์                        [3.5.2 · หน่วยติดตั้งที่ 3]
//
// รับผิดชอบเรื่องเดียว: "ไบต์นี้ไปเครื่องพิมพ์ทางไหน" เลือกด้วย PRINTER_INTERFACE ใน .env
//   printer:SOML-Receipt     คิวพิมพ์ของระบบปฏิบัติการ — ใช้กับ USB (TM-T82 ของร้านต่อแบบนี้)
//   tcp://192.168.1.87:9100  เครื่องพิมพ์บนเครือข่าย พอร์ตมาตรฐาน 9100
//   file://./printer-output  โหมดจำลอง เขียนลงไฟล์ ใช้พัฒนาและทดสอบโดยไม่มีเครื่อง
// ---------------------------------------------------------------------
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { decodePreview } = require('./escpos');

/** USB ผ่านคิวพิมพ์: `lp -o raw` ส่งไบต์ตรง ๆ ไม่ให้ระบบแปลงเป็นภาษาหน้ากระดาษอื่น */
function sendPrintQueue(queueName, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('lp', ['-d', queueName, '-o', 'raw']);
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`คิวพิมพ์ ${queueName} ไม่รับงานภายใน ${timeoutMs} มิลลิวินาที`)); }, timeoutMs);
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); reject(new Error(`เรียกคำสั่ง lp ไม่ได้: ${err.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ target: `printer:${queueName}` });
      else reject(new Error(`คิวพิมพ์ ${queueName} ปฏิเสธงาน: ${stderr.trim() || `รหัส ${code}`}`));
    });
    child.stdin.end(payload);
  });
}

function sendTcp(host, port, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) });
    const fail = (err) => { socket.destroy(); reject(err); };
    socket.setTimeout(timeoutMs, () => fail(new Error(`เครื่องพิมพ์ ${host}:${port} ไม่ตอบภายใน ${timeoutMs} มิลลิวินาที`)));
    socket.on('error', fail);
    socket.on('connect', () => socket.end(payload));
    socket.on('close', () => resolve({ target: `tcp://${host}:${port}` }));
  });
}

/** โหมดจำลอง: .bin = ไบต์ที่ส่งจริง (ตรวจคำสั่ง) · .txt = ข้อความถอดกลับ (ตรวจเนื้อหา) */
function sendFile(dir, payload, meta) {
  const base = path.isAbsolute(dir) ? dir : path.resolve(__dirname, '..', '..', dir);
  fs.mkdirSync(base, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}_${String(meta.orderNo || 'receipt').replace(/[^\w-]/g, '')}`;
  fs.writeFileSync(path.join(base, `${name}.bin`), payload);
  fs.writeFileSync(path.join(base, `${name}.txt`), decodePreview(payload), 'utf8');
  return { target: `file://${base}`, files: [`${name}.bin`, `${name}.txt`] };
}

async function send(payload, meta = {}) {
  const target = process.env.PRINTER_INTERFACE || '';
  const timeoutMs = Number(process.env.PRINT_TIMEOUT_MS || 5000);
  if (target.startsWith('printer:')) return sendPrintQueue(target.slice(8), payload, timeoutMs);
  if (target.startsWith('tcp://')) { const [host, port] = target.slice(6).split(':'); return sendTcp(host, port || 9100, payload, timeoutMs); }
  if (target.startsWith('file://')) return sendFile(target.slice(7), payload, meta);
  throw new Error(`PRINTER_INTERFACE ไม่ถูกต้อง: "${target}" — ต้องขึ้นต้นด้วย printer: tcp:// หรือ file://`);
}

module.exports = { send, sendPrintQueue, sendTcp, sendFile };
