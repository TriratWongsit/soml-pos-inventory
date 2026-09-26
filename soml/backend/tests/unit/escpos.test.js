// ประกอบใบเสร็จ ESC/POS สำหรับ Epson TM-T82                      [FR-03 · ตารางที่ 3.22 ระดับ 1]
const { buildReceipt, tis620, decodePreview, displayWidth, twoColumns, fit } = require('../../../print-service/lib/escpos');

const RECEIPT = {
  orderNo: 'ORD-20260916-0007',
  paidAt: '2026-09-16T10:30:00+07:00',
  cashierName: 'ศริพรรณ ศิริกันทา',
  items: [
    { name: 'ปูนเสือ (เขียว,ก่อ)', qty: 10, unit: 'ถุง', unitPrice: 165, lineTotal: 1650 },
    { name: 'เหล็ก 4 หุนข้ออ้อย (12 มิล) ยาวมาก ๆ จนต้องตัดชื่อให้พอดีบรรทัด', qty: 3, unit: 'เส้น', unitPrice: 220, lineTotal: 660 },
  ],
  totalAmount: 2310,
};

describe('tis620 — แปลงอักษรไทยให้เครื่องพิมพ์', () => {
  test('ก = 0xA1 และ ๛ = 0xFB (หัวท้ายช่วง)', () => {
    expect([...tis620('ก')]).toEqual([0xa1]);
    expect([...tis620('๛')]).toEqual([0xfb]);
  });
  test('ASCII คงเดิม · อักขระนอกช่วง (จุดกลาง, อีโมจิ) เป็นช่องว่าง', () => {
    expect([...tis620('A1')]).toEqual([0x41, 0x31]);
    expect([...tis620('·😀')]).toEqual([0x20, 0x20]);
  });
  test('แปลงแล้วถอดกลับได้เหมือนเดิม', () => {
    const text = 'ปูนเสือ 10 ถุง x 165.00';
    expect(decodePreview(Buffer.concat([tis620(text), Buffer.from([0x0a])]))).toBe(text + '\n');
  });
});

describe('displayWidth — ความกว้างบนกระดาษ', () => {
  test('สระบนล่างและวรรณยุกต์ไม่กินช่อง: "ปู่" กว้าง 1, "ที่" กว้าง 1, "กำ" กว้าง 2', () => {
    expect(displayWidth('ปู่')).toBe(1);
    expect(displayWidth('ที่')).toBe(1);
    expect(displayWidth('กำ')).toBe(2);
  });
  test('อังกฤษและตัวเลขนับตัวละหนึ่ง', () => {
    expect(displayWidth('ORD-2026')).toBe(8);
  });
});

describe('twoColumns / fit', () => {
  test('ความยาวรวมเท่ากับความกว้างกระดาษพอดี', () => {
    const line = twoColumns('ยอดรวมทั้งสิ้น', '2,310.00 บาท', 48);
    expect(displayWidth(line)).toBe(48);
  });
  test('ซ้ายยาวเกินถูกตัดโดยเหลือช่องว่างอย่างน้อยหนึ่งช่องก่อนขวา', () => {
    const line = twoColumns('ก'.repeat(60), '9.99', 48);
    expect(displayWidth(line)).toBe(48);
    expect(line.endsWith(' 9.99')).toBe(true);
  });
  test('fit ไม่ตัดกลางสระลอย', () => {
    expect(fit('ที่ที่ที่', 2)).toBe('ที่ที่');
  });
});

describe('buildReceipt — ใบเสร็จทั้งใบ', () => {
  const payload = buildReceipt(RECEIPT);
  const text = decodePreview(payload);

  test('เริ่มด้วย ESC @ แล้วเลือกตารางรหัสไทย 21', () => {
    expect([...payload.subarray(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 21]);
  });
  test('จบด้วยเลื่อนกระดาษและตัด (GS V B 0)', () => {
    expect([...payload.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });
  test('มีชื่อร้าน เลขที่ พนักงาน รายการ ยอดรวม และท้ายใบเสร็จ', () => {
    for (const s of ['ร้านอำพรคอนกรีต', 'ใบเสร็จรับเงิน', 'ORD-20260916-0007', 'ศริพรรณ ศิริกันทา', 'ปูนเสือ (เขียว,ก่อ)', '10 ถุง x 165.00', '1,650.00', '2,310.00 บาท', 'ชำระด้วยพร้อมเพย์', 'กรุณารับสินค้าที่คลังสินค้า']) {
      expect(text).toContain(s);
    }
  });
  test('ทุกบรรทัดไม่เกิน 48 ช่องของ TM-T82', () => {
    for (const line of text.split('\n')) expect(displayWidth(line)).toBeLessThanOrEqual(48);
  });
  test('ไม่มีไบต์นอกช่วงที่เครื่องพิมพ์รู้จัก (ควบคุมที่ใช้ / ASCII / TIS-620)', () => {
    for (const b of payload) expect((b >= 0x20 && b < 0x80) || (b >= 0xa1 && b <= 0xfb) || [0x0a, 0x1b, 0x1d, 0x00, 0x01, 0x02, 0x03, 0x11, 0x15, 0x40, 0x42].includes(b)).toBe(true);
  });
  test('ความกว้าง 32 สำหรับกระดาษ 58 มม. ก็ยังไม่ล้นบรรทัด', () => {
    const narrow = decodePreview(buildReceipt(RECEIPT, { width: 32 }));
    for (const line of narrow.split('\n')) expect(displayWidth(line)).toBeLessThanOrEqual(32);
  });
});
