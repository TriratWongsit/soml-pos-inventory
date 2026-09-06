// ---------------------------------------------------------------------
// Receipt Print Service   [FR-03 · NFR-05]
//
// แยกเป็นกระบวนการต่างหากจาก Backend API ตามการออกแบบระดับคอนเทนเนอร์ใน
// ตารางที่ 3.2 เพื่อให้ความล่าช้าหรือความขัดข้องของเครื่องพิมพ์ไม่กระทบ
// การบันทึกคำสั่งซื้อและการผลักข้อมูลเข้าคิวคลังสินค้า
// ---------------------------------------------------------------------
const path = require('path');
const express = require('express');
const { buildReceipt } = require('./lib/escpos');
const transport = require('./lib/transport');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = Number(process.env.PRINT_SERVICE_PORT || 4100);

const app = express();
app.use(express.json({ limit: '512kb' }));

app.get('/health', (req, res) =>
  res.json({ status: 'ok', printerInterface: process.env.PRINTER_INTERFACE || null })
);

app.post('/print/receipt', async (req, res) => {
  const startedAt = Date.now();
  const receipt = req.body || {};

  if (!receipt.orderNo || !Array.isArray(receipt.items) || receipt.items.length === 0) {
    return res.status(400).json({ error: 'ข้อมูลใบเสร็จไม่ครบ ต้องมีเลขที่คำสั่งซื้อและรายการสินค้า' });
  }

  try {
    const payload = buildReceipt(receipt, {
      width: Number(process.env.PRINTER_WIDTH_CHARS || 48),
      codepage: Number(process.env.PRINTER_CODEPAGE ?? 21),
    });
    const result = await transport.send(payload, receipt);

    const elapsedMs = Date.now() - startedAt;
    console.log(`พิมพ์ ${receipt.orderNo} สำเร็จใน ${elapsedMs} ms → ${result.target}`);

    return res.json({ ok: true, orderNo: receipt.orderNo, bytes: payload.length, elapsedMs, ...result });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.error(`พิมพ์ ${receipt.orderNo} ไม่สำเร็จใน ${elapsedMs} ms: ${err.message}`);
    // ตอบ 503 เพราะเป็นความขัดข้องของอุปกรณ์ ไม่ใช่ความผิดของผู้เรียก
    return res.status(503).json({ ok: false, error: err.message, elapsedMs });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Receipt Print Service พร้อมใช้งานที่ http://localhost:${PORT}`);
    console.log(`ปลายทางเครื่องพิมพ์: ${process.env.PRINTER_INTERFACE || '(ยังไม่ได้ตั้งค่า)'}`);
  });
}

module.exports = { app };
