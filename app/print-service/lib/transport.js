// ---------------------------------------------------------------------
// ช่องทางส่งข้อมูลไปยังเครื่องพิมพ์
//
// SRS §3.1.2 ระบุว่าเครื่องพิมพ์เชื่อมต่อผ่าน USB หรือเครือข่าย จึงรองรับ
// สองช่องทางนั้น และเพิ่มโหมดจำลองที่เขียนสายไบต์ลงไฟล์ไว้ด้วย เพื่อให้
// พัฒนาและวัดเวลาตามเกณฑ์ NFR-05 ได้ในสภาพแวดล้อมที่ยังไม่มีเครื่องพิมพ์จริง
//
// รูปแบบค่า PRINTER_INTERFACE ในไฟล์ .env
//   tcp://192.168.1.87:9100   เครื่องพิมพ์บนเครือข่าย
//   printer:SOML-Receipt      คิวพิมพ์ของระบบปฏิบัติการ (ใช้กับ USB)
//   file://./evidence/printer-simulator   โหมดจำลอง เขียนลงไฟล์
// ---------------------------------------------------------------------
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { decodePreview } = require('./escpos');

/** ส่งผ่าน TCP ตรงไปยังพอร์ตของเครื่องพิมพ์ (มาตรฐานคือพอร์ต 9100) */
function sendTcp(host, port, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) });
    const fail = (err) => { socket.destroy(); reject(err); };

    socket.setTimeout(timeoutMs, () => fail(new Error(`เครื่องพิมพ์ที่ ${host}:${port} ไม่ตอบสนองภายใน ${timeoutMs} มิลลิวินาที`)));
    socket.on('error', fail);
    socket.on('connect', () => socket.end(payload));
    socket.on('close', () => resolve({ target: `tcp://${host}:${port}` }));
  });
}

/** ส่งผ่านคิวพิมพ์ของระบบปฏิบัติการ ใช้กับเครื่องพิมพ์ที่ต่อสาย USB */
function sendPrintQueue(queueName, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    // -o raw บอกให้ระบบส่งไบต์ตรงไปยังเครื่องพิมพ์ ไม่แปลงเป็นภาษาหน้ากระดาษอื่น
    const child = spawn('lp', ['-d', queueName, '-o', 'raw']);
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`ส่งงานพิมพ์ไปยังคิว ${queueName} ไม่สำเร็จภายในเวลาที่กำหนด`)); }, timeoutMs);

    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); reject(new Error(`เรียกคำสั่ง lp ไม่ได้: ${err.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ target: `printer:${queueName}` });
      else reject(new Error(`คำสั่ง lp จบด้วยรหัส ${code} ${stderr.trim()}`));
    });

    child.stdin.end(payload);
  });
}

/**
 * โหมดจำลอง — เขียนสายไบต์ลงไฟล์แทนการส่งเครื่องพิมพ์
 *
 * เก็บไว้สองรูปแบบ ไฟล์ .bin คือไบต์ดิบที่ส่งจริง ใช้ตรวจสอบคำสั่ง ESC/POS
 * และไฟล์ .txt คือข้อความที่ถอดกลับมาอ่านได้ ใช้ตรวจความถูกต้องของเนื้อหา
 */
function sendFile(dir, payload, meta) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  // ตีความเส้นทางแบบสัมพัทธ์เทียบโฟลเดอร์ app เสมอ ไม่ขึ้นกับว่าสั่งรันจากที่ใด
  const base = path.isAbsolute(dir) ? dir : path.resolve(__dirname, '..', '..', dir);
  fs.mkdirSync(base, { recursive: true });

  const name = `${stamp}_${(meta.orderNo || 'receipt').replace(/[^\w-]/g, '')}`;
  fs.writeFileSync(path.join(base, `${name}.bin`), payload);

  fs.writeFileSync(path.join(base, `${name}.txt`), decodePreview(payload), 'utf8');

  return { target: `file://${base}`, files: [`${name}.bin`, `${name}.txt`] };
}

/** ส่งข้อมูลไปยังปลายทางตามที่ตั้งค่าไว้ */
async function send(payload, meta = {}) {
  const target = process.env.PRINTER_INTERFACE || '';
  const timeoutMs = Number(process.env.PRINT_TIMEOUT_MS || 5000);

  if (target.startsWith('tcp://')) {
    const [host, port] = target.slice(6).split(':');
    return sendTcp(host, port || 9100, payload, timeoutMs);
  }
  if (target.startsWith('printer:')) {
    return sendPrintQueue(target.slice(8), payload, timeoutMs);
  }
  if (target.startsWith('file://')) {
    return sendFile(target.slice(7), payload, meta);
  }
  throw new Error(
    `ค่า PRINTER_INTERFACE ไม่ถูกต้อง: "${target}" — ต้องขึ้นต้นด้วย tcp:// printer: หรือ file://`
  );
}

module.exports = { send, sendTcp, sendPrintQueue, sendFile };
