// ช่องทางส่งไบต์ไปเครื่องพิมพ์ USB แยกตามระบบปฏิบัติการ            [หน่วยติดตั้งที่ 3 · TC-13]
// ตรวจคำสั่งที่จะใช้ได้โดยไม่ต้องมีเครื่องพิมพ์ การพิมพ์กับเครื่องจริงยังต้องทวนสอบที่ร้าน
const fs = require('fs');
const os = require('os');
const { printQueueCommand, sendPrintQueue } = require('../../../print-service/lib/transport');

test('Windows: คัดลอกไฟล์แบบไบนารีไปยังเครื่องพิมพ์ที่แชร์ไว้บนเครื่องนี้', () => {
  const c = printQueueCommand('SOML-Receipt', 'C:\\Temp\\r.bin', 'win32');
  expect(c.cmd).toBe('cmd.exe');
  expect(c.verbatim).toBe(true);
  expect(c.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
  // cmd /s ตัดเครื่องหมายคำพูดคู่นอกสุดออก เหลือคำสั่ง copy ที่ครอบชื่อไฟล์และปลายทางไว้ถูกต้อง
  expect(c.args[3]).toBe('"copy /b "C:\\Temp\\r.bin" "\\\\localhost\\SOML-Receipt""');
});

test('Mac และ Linux: ส่งไฟล์เข้าคิวด้วย lp แบบ raw', () => {
  expect(printQueueCommand('SOML-Receipt', '/tmp/r.bin', 'darwin'))
    .toEqual({ cmd: 'lp', args: ['-d', 'SOML-Receipt', '-o', 'raw', '/tmp/r.bin'], verbatim: false });
  expect(printQueueCommand('SOML-Receipt', '/tmp/r.bin', 'linux').cmd).toBe('lp');
});

test('คิวพิมพ์ที่ไม่มีอยู่ถูกรายงานเป็นข้อผิดพลาด และไฟล์ชั่วคราวถูกลบทิ้ง', async () => {
  const before = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('soml-receipt-')).length;
  await expect(sendPrintQueue('SOML-No-Such-Queue-For-Test', Buffer.from('x'), 3000))
    .rejects.toThrow(/คิวพิมพ์|เรียกคำสั่ง/);
  const after = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('soml-receipt-')).length;
  expect(after).toBe(before);
});
