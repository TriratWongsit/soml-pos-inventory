// ---------------------------------------------------------------------
// ช่องทางส่งสายไบต์ไปยังเครื่องพิมพ์                        [3.5.2 · หน่วยติดตั้งที่ 3]
//
// รับผิดชอบเรื่องเดียว: "ไบต์นี้ไปเครื่องพิมพ์ทางไหน" เลือกด้วย PRINTER_INTERFACE ใน .env
//   printer:SOML-Receipt     คิวพิมพ์ของระบบปฏิบัติการ — ใช้กับ USB (TM-T82 ของร้านต่อแบบนี้)
//                            Mac/Linux ส่งผ่าน lp · Windows ต้องแชร์เครื่องพิมพ์ด้วยชื่อแชร์ SOML-Receipt
//                            แล้วระบบคัดลอกไบต์ดิบไปที่ \\localhost\SOML-Receipt
//   tcp://192.168.1.87:9100  เครื่องพิมพ์บนเครือข่าย พอร์ตมาตรฐาน 9100
//   file://./printer-output  โหมดจำลอง เขียนลงไฟล์ ใช้พัฒนาและทดสอบโดยไม่มีเครื่อง
// ---------------------------------------------------------------------
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { decodePreview } = require('./escpos');

/**
 * คำสั่งที่ใช้ส่งไฟล์ไบต์ดิบเข้าคิวพิมพ์ แยกตามระบบปฏิบัติการ (ทดสอบได้โดยไม่ต้องมีเครื่องพิมพ์)
 *   Mac/Linux  lp -d <คิว> -o raw <ไฟล์>        -o raw ไม่ให้ระบบแปลงเป็นภาษาหน้ากระดาษอื่น
 *   Windows    copy /b <ไฟล์> \\localhost\<ชื่อแชร์>   /b คัดลอกแบบไบนารี ไบต์ ESC/POS ถึงเครื่องพิมพ์ตรง ๆ
 */
function printQueueCommand(queueName, file, platform = process.platform) {
  if (platform === 'win32') {
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', `"copy /b "${file}" "\\\\localhost\\${queueName}""`], verbatim: true };
  }
  return { cmd: 'lp', args: ['-d', queueName, '-o', 'raw', file], verbatim: false };
}

/** USB ผ่านคิวพิมพ์ของระบบปฏิบัติการ: เขียนไบต์ลงไฟล์ชั่วคราว แล้วสั่งคิวพิมพ์ส่งไฟล์นั้น */
function sendPrintQueue(queueName, payload, timeoutMs, platform = process.platform) {
  return new Promise((resolve, reject) => {
    const file = path.join(os.tmpdir(), `soml-receipt-${process.pid}-${Date.now()}.bin`);
    fs.writeFileSync(file, payload);
    const cleanup = () => fs.rmSync(file, { force: true });
    const { cmd, args, verbatim } = printQueueCommand(queueName, file, platform);
    const child = spawn(cmd, args, { windowsVerbatimArguments: verbatim });
    let output = '';
    const timer = setTimeout(() => { child.kill(); cleanup(); reject(new Error(`คิวพิมพ์ ${queueName} ไม่รับงานภายใน ${timeoutMs} มิลลิวินาที`)); }, timeoutMs);
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('error', (err) => { clearTimeout(timer); cleanup(); reject(new Error(`เรียกคำสั่ง ${cmd} ไม่ได้: ${err.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      if (code === 0) resolve({ target: `printer:${queueName}` });
      else reject(new Error(`คิวพิมพ์ ${queueName} ปฏิเสธงาน: ${output.trim() || `รหัส ${code}`}`));
    });
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

module.exports = { send, sendPrintQueue, printQueueCommand, sendTcp, sendFile };
