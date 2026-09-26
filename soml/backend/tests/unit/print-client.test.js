// ส่วนเชื่อมต่อบริการพิมพ์                          [ตารางที่ 3.13 โมดูล 10 · UC-03 ทางที่ล้มเหลว]
// ใช้บริการพิมพ์จำลอง (http server เล็ก ๆ) แทนของจริง เพื่อบังคับให้เกิดทุกกรณีได้แน่นอน
const http = require('http');
const { printReceipt } = require('../../modules/print-client');

const RECEIPT = { orderNo: 'ORD-TEST-0001', totalAmount: 100, items: [{ name: 'ปูน', qty: 1, unit: 'ถุง', unitPrice: 100 }] };

/** เปิดบริการจำลองที่ตอบตาม handler แล้วชี้ PRINT_SERVICE_URL ไปหา */
function withFakeService(handler, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, async () => {
      process.env.PRINT_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
      try { resolve(await fn()); } catch (e) { reject(e); } finally { server.close(); }
    });
  });
}

afterEach(() => { delete process.env.PRINT_SERVICE_URL; delete process.env.PRINT_TIMEOUT_MS; });

test('ส่งใบเสร็จไปที่ POST /print/receipt เป็น JSON และได้ ok เมื่อบริการตอบ 200', async () => {
  let received;
  const result = await withFakeService((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { received = { method: req.method, url: req.url, body: JSON.parse(body) }; res.end('{}'); });
  }, () => printReceipt(RECEIPT));
  expect(result).toEqual({ ok: true });
  expect(received.method).toBe('POST');
  expect(received.url).toBe('/print/receipt');
  expect(received.body.orderNo).toBe('ORD-TEST-0001');
});

test('บริการตอบข้อผิดพลาด → ok:false พร้อมข้อความ ไม่โยน', async () => {
  const result = await withFakeService((req, res) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'เครื่องพิมพ์กระดาษหมด' }));
  }, () => printReceipt(RECEIPT));
  expect(result).toEqual({ ok: false, error: 'เครื่องพิมพ์กระดาษหมด' });
});

test('ไม่มีบริการพิมพ์อยู่เลย → ok:false ไม่โยน (พิมพ์ล้มแต่การขายต้องไม่ล้ม)', async () => {
  process.env.PRINT_SERVICE_URL = 'http://127.0.0.1:1'; // พอร์ตที่ไม่มีใครฟัง
  const result = await printReceipt(RECEIPT);
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/เชื่อมต่อ/);
});

test('บริการค้างเกินเวลา → ok:false ด้วยเหตุผลหมดเวลา ไม่รอไปเรื่อย ๆ', async () => {
  process.env.PRINT_TIMEOUT_MS = '200';
  const started = Date.now();
  const result = await withFakeService(() => { /* ไม่ตอบเลย */ }, () => printReceipt(RECEIPT));
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/ไม่ตอบภายใน/);
  expect(Date.now() - started).toBeLessThan(2000);
});
