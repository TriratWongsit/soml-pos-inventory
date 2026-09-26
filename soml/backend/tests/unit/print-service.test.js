// บริการพิมพ์ใบเสร็จผ่าน HTTP ในโหมดพิมพ์ลงไฟล์                     [หน่วยติดตั้งที่ 3 · NFR-05]
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

let app, dir;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soml-print-'));
  process.env.PRINTER_INTERFACE = `file://${dir}`;
  ({ app } = require('../../../print-service/server'));
});
afterAll(() => { delete process.env.PRINTER_INTERFACE; fs.rmSync(dir, { recursive: true, force: true }); });

const receipt = { orderNo: 'ORD-T-0001', items: [{ name: 'ปูน', qty: 1, unit: 'ถุง', unitPrice: 165 }], totalAmount: 165 };

test('GET /health บอกปลายทางเครื่องพิมพ์', async () => {
  const res = await request(app).get('/health');
  expect(res.body).toMatchObject({ status: 'ok', printerInterface: `file://${dir}` });
});

test('POST /print/receipt เขียน .bin และ .txt และตอบเวลาที่ใช้ (NFR-05 ≤ 5 วินาที)', async () => {
  const res = await request(app).post('/print/receipt').send(receipt);
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(res.body.elapsedMs).toBeLessThan(5000);
  const files = fs.readdirSync(dir);
  expect(files.some((f) => f.endsWith('_ORD-T-0001.bin'))).toBe(true);
  const txt = fs.readFileSync(path.join(dir, files.find((f) => f.endsWith('.txt'))), 'utf8');
  expect(txt).toContain('ORD-T-0001');
});

test('ใบเสร็จไม่ครบ → 400', async () => {
  expect((await request(app).post('/print/receipt').send({ orderNo: 'X' })).status).toBe(400);
});

test('ปลายทางไม่ถูกต้อง → 503 ไม่ล้มทั้งบริการ', async () => {
  process.env.PRINTER_INTERFACE = 'bogus';
  const res = await request(app).post('/print/receipt').send(receipt);
  expect(res.status).toBe(503);
  expect(res.body.ok).toBe(false);
  process.env.PRINTER_INTERFACE = `file://${dir}`;
});
