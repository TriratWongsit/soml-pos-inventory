// ช่องทางส่งข้อมูลไปยังเครื่องพิมพ์   [FR-03 · SRS §3.1.2]
const fs = require('fs');
const os = require('os');
const path = require('path');
const transport = require('../../../print-service/lib/transport');
const { buildReceipt } = require('../../../print-service/lib/escpos');

const RECEIPT = {
  orderNo: 'ORD-20260906-0042',
  totalAmount: 555,
  items: [{ name: 'ปูนซีเมนต์ปอร์ตแลนด์ ประเภท 1 ขนาด 50 กก.', qty: 3, unit: 'ถุง', unitPrice: 185, lineTotal: 555 }],
};

let tempDir;
beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soml-print-')); });
afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });
afterEach(() => { delete process.env.PRINTER_INTERFACE; });

describe('โหมดจำลอง — เขียนลงไฟล์แทนการส่งเครื่องพิมพ์', () => {
  test('เขียนทั้งไฟล์ไบต์ดิบและไฟล์ข้อความที่อ่านได้', () => {
    const payload = buildReceipt(RECEIPT);
    const result = transport.sendFile(tempDir, payload, RECEIPT);

    expect(result.files).toHaveLength(2);
    const files = fs.readdirSync(tempDir);
    expect(files.filter((f) => f.endsWith('.bin'))).toHaveLength(1);
    expect(files.filter((f) => f.endsWith('.txt'))).toHaveLength(1);

    // ไฟล์ไบต์ดิบต้องเหมือนสิ่งที่จะส่งเครื่องพิมพ์ทุกไบต์
    const raw = fs.readFileSync(path.join(tempDir, files.find((f) => f.endsWith('.bin'))));
    expect(raw.equals(payload)).toBe(true);
  });

  test('ไฟล์ข้อความอ่านได้และไม่มีไบต์คำสั่งปนมา', () => {
    transport.sendFile(tempDir, buildReceipt(RECEIPT), RECEIPT);
    const txtName = fs.readdirSync(tempDir).find((f) => f.endsWith('.txt'));
    const text = fs.readFileSync(path.join(tempDir, txtName), 'utf8');

    expect(text).toContain(RECEIPT.orderNo);
    expect(text).toContain('ยอดรวมทั้งสิ้น');
    // ไบต์พารามิเตอร์ของคำสั่งต้องไม่โผล่มาเป็นตัวอักษรต้นบรรทัด
    expect(text.split('\n').some((l) => /^[aEt@d]-{5,}/.test(l))).toBe(false);
  });

  test('ชื่อไฟล์อ้างอิงเลขที่คำสั่งซื้อ ทำให้ค้นหาใบเสร็จย้อนหลังได้', () => {
    transport.sendFile(tempDir, buildReceipt(RECEIPT), RECEIPT);
    expect(fs.readdirSync(tempDir).every((f) => f.includes('ORD-20260906-0042'))).toBe(true);
  });
});

describe('send — เลือกช่องทางตามค่าที่ตั้งไว้', () => {
  test('ค่า file:// ใช้โหมดจำลอง', async () => {
    process.env.PRINTER_INTERFACE = `file://${tempDir}`;
    const result = await transport.send(buildReceipt(RECEIPT), RECEIPT);
    expect(result.target).toBe(`file://${tempDir}`);
  });

  test('ค่าที่ไม่ถูกต้องถูกปฏิเสธพร้อมบอกรูปแบบที่รองรับ', async () => {
    process.env.PRINTER_INTERFACE = 'usb-หน้าร้าน';
    await expect(transport.send(Buffer.from('x'), RECEIPT)).rejects.toThrow(/tcp:\/\/ printer: หรือ file:\/\//);
  });

  test('ไม่ได้ตั้งค่าเลยก็ถูกปฏิเสธ ไม่เงียบหาย', async () => {
    await expect(transport.send(Buffer.from('x'), RECEIPT)).rejects.toThrow(/PRINTER_INTERFACE/);
  });
});

describe('sendTcp — เครื่องพิมพ์บนเครือข่าย', () => {
  test('ต่อเครื่องพิมพ์ไม่ได้แล้วโยนข้อผิดพลาด ไม่ค้างรอ', async () => {
    // พอร์ต 1 ไม่มีบริการใดฟังอยู่ จึงถูกปฏิเสธการเชื่อมต่อทันที
    await expect(transport.sendTcp('127.0.0.1', 1, Buffer.from('x'), 2000)).rejects.toThrow();
  });
});
