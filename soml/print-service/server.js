// ---------------------------------------------------------------------
// บริการพิมพ์ใบเสร็จ (Receipt Print Service)         [หน่วยติดตั้งที่ 3 · ตารางที่ 3.17 · FR-03]
//
// แยกเป็นกระบวนการต่างหากเพราะต้องรันบนเครื่องที่ต่อสาย USB กับ TM-T82 เสมอ (3.5.2)
// หลังบ้านย้ายไปเครื่องไหนก็ได้ แต่บริการนี้ต้องอยู่หน้าร้าน
//   GET  /health          ตรวจว่ารันอยู่และชี้เครื่องพิมพ์ทางไหน
//   POST /print/receipt   รับใบเสร็จเป็น JSON → ESC/POS → ส่งเครื่องพิมพ์
// ---------------------------------------------------------------------
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const { buildReceipt } = require('./lib/escpos');
const transport = require('./lib/transport');

const PORT = Number(process.env.PRINT_SERVICE_PORT || 4100);
const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', printerInterface: process.env.PRINTER_INTERFACE || null }));

app.post('/print/receipt', async (req, res) => {
  const started = Date.now();
  const receipt = req.body || {};
  if (!receipt.orderNo || !Array.isArray(receipt.items) || receipt.items.length === 0) {
    return res.status(400).json({ ok: false, error: 'ใบเสร็จต้องมีเลขที่และรายการสินค้า' });
  }
  try {
    const payload = buildReceipt(receipt, {
      width: Number(process.env.PRINTER_WIDTH_CHARS || 48),
      codepage: Number(process.env.PRINTER_CODEPAGE ?? 21),
      shopName: process.env.SHOP_NAME || undefined,
    });
    const result = await transport.send(payload, receipt);
    const elapsedMs = Date.now() - started;
    console.log(`พิมพ์ ${receipt.orderNo} สำเร็จใน ${elapsedMs} ms → ${result.target}`);
    return res.json({ ok: true, orderNo: receipt.orderNo, bytes: payload.length, elapsedMs, ...result });
  } catch (err) {
    console.error(`พิมพ์ ${receipt.orderNo} ไม่สำเร็จ: ${err.message}`);
    return res.status(503).json({ ok: false, error: err.message }); // ความขัดข้องของอุปกรณ์ ไม่ใช่ความผิดของผู้เรียก
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`บริการพิมพ์ใบเสร็จพร้อมใช้งานที่ http://localhost:${PORT}`);
    console.log(`เครื่องพิมพ์: ${process.env.PRINTER_INTERFACE || '(ยังไม่ได้ตั้ง PRINTER_INTERFACE)'}`);
  });
}

module.exports = { app };
