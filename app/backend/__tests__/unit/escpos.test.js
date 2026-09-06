// ทดสอบหน่วยของตัวสร้างชุดคำสั่ง ESC/POS   [FR-03 · NFR-05]
const { buildReceipt, tis620, decodePreview, displayWidth, twoColumns, wrap } = require('../../../print-service/lib/escpos');

const RECEIPT = {
  orderNo: 'ORD-20260906-0001',
  paidAt: '2026-09-06T10:15:00+07:00',
  cashierName: 'สมชาย ใจดี',
  totalAmount: 2880,
  items: [
    { name: 'ปูนซีเมนต์ปอร์ตแลนด์ ประเภท 1 ขนาด 50 กก.', qty: 10, unit: 'ถุง', unitPrice: 185, lineTotal: 1850 },
    { name: 'ปูนซีเมนต์ผสม ขนาด 50 กก.', qty: 5, unit: 'ถุง', unitPrice: 152, lineTotal: 760 },
    { name: 'ปูนฉาบสำเร็จรูป ขนาด 50 กก.', qty: 2, unit: 'ถุง', unitPrice: 135, lineTotal: 270 },
  ],
};

/** ถอดไบต์กลับเป็นข้อความที่พิมพ์ออกมาจริง โดยข้ามคำสั่งควบคุม */
const decode = decodePreview;

describe('tis620 — แปลงข้อความไทยเป็นรหัสที่เครื่องพิมพ์เข้าใจ', () => {
  test('อักษรไทยตัวแรกและตัวท้ายของช่วงแปลงถูกต้อง', () => {
    // ก (U+0E01) ต้องได้ 0xA1 และ ๛ (U+0E5B) ต้องได้ 0xFB
    expect(tis620('ก')[0]).toBe(0xa1);
    expect(tis620('๛')[0]).toBe(0xfb);
  });

  test('อักขระ ASCII คงรหัสเดิม', () => {
    expect([...tis620('ORD-01')]).toEqual([...Buffer.from('ORD-01', 'ascii')]);
  });

  test('อักขระนอกช่วงที่รองรับถูกแทนด้วยช่องว่าง ไม่ปล่อยไบต์แปลกปลอม', () => {
    // ไบต์แปลกปลอมอาจถูกเครื่องพิมพ์ตีความเป็นคำสั่งควบคุมจนใบเสร็จเสียหาย
    expect([...tis620('日')]).toEqual([0x20]);
  });

  test('แปลงข้อความไทยผสมตัวเลขแล้วถอดกลับได้เหมือนเดิม', () => {
    expect(decode(tis620('ปูนซีเมนต์ 50 กก.'))).toBe('ปูนซีเมนต์ 50 กก.');
  });
});

describe('displayWidth — ความกว้างที่ข้อความกินบนกระดาษ', () => {
  test('สระบนล่างและวรรณยุกต์ไม่กินความกว้าง เพราะพิมพ์ซ้อนพยัญชนะ', () => {
    // "กิ" มีสระอิลอยบน จึงกินความกว้างเท่ากับ "ก" ตัวเดียว
    expect(displayWidth('กิ')).toBe(1);
    expect(displayWidth('ก่')).toBe(1);
    expect(displayWidth('กา')).toBe(2);
  });

  test('อักษรอังกฤษและตัวเลขนับตัวละหนึ่ง', () => {
    expect(displayWidth('ORD-001')).toBe(7);
  });
});

describe('twoColumns — จัดข้อความชิดซ้ายและชิดขวา', () => {
  test('ความยาวรวมเท่ากับความกว้างกระดาษพอดี', () => {
    expect(displayWidth(twoColumns('ยอดรวม', '2,880.00', 48))).toBe(48);
  });

  test('เว้นช่องว่างอย่างน้อยหนึ่งช่องเมื่อข้อความยาวเกินกระดาษ', () => {
    expect(twoColumns('x'.repeat(30), 'y'.repeat(30), 48)).toContain('x y');
  });
});

describe('wrap — ตัดบรรทัดให้พอดีความกว้าง', () => {
  test('ทุกบรรทัดไม่เกินความกว้างที่กำหนด', () => {
    for (const line of wrap(RECEIPT.items[0].name, 24)) {
      expect(displayWidth(line)).toBeLessThanOrEqual(24);
    }
  });

  test('คำเดียวที่ยาวเกินกระดาษถูกหั่นเป็นท่อน ไม่ล้นบรรทัด', () => {
    const lines = wrap('ก'.repeat(60), 20);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l) => expect(displayWidth(l)).toBeLessThanOrEqual(20));
  });

  test('ต่อบรรทัดกลับแล้วได้เนื้อความเดิมครบ', () => {
    expect(wrap('ปูนซีเมนต์ ผสม ขนาด 50 กก.', 12).join(' ').replace(/\s+/g, ' ').trim())
      .toBe('ปูนซีเมนต์ ผสม ขนาด 50 กก.');
  });
});

describe('buildReceipt — ใบเสร็จทั้งใบ', () => {
  const payload = buildReceipt(RECEIPT);
  const printed = decode(payload);

  test('เริ่มต้นด้วยคำสั่งรีเซ็ตและเลือกตารางรหัสอักขระไทย', () => {
    expect([...payload.subarray(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 21]);
  });

  test('จบด้วยคำสั่งตัดกระดาษ', () => {
    expect([...payload.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  test('มีข้อมูลครบตามที่ SRS §3.1.2 กำหนด', () => {
    expect(printed).toContain(RECEIPT.orderNo);           // เลขที่คำสั่งซื้อ
    expect(printed).toContain('ปูนซีเมนต์ผสม');            // รายการสินค้า
    expect(printed).toContain('185.00');                  // ราคาต่อหน่วย
    expect(printed).toContain('2,880.00');                // ยอดรวม
    expect(printed).toContain('ยอดรวมทั้งสิ้น');
    expect(printed).toContain('2569');                    // วันที่ในรูปแบบไทย
    expect(printed).toContain(RECEIPT.cashierName);
  });

  test('พิมพ์รายการสินค้าครบทุกบรรทัด', () => {
    for (const item of RECEIPT.items) {
      expect(printed).toContain(item.name.split(' ')[0]);
      expect(printed).toContain(item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }));
    }
  });

  test('ทุกบรรทัดที่พิมพ์ไม่กว้างเกินกระดาษ', () => {
    for (const line of printed.split('\n')) {
      expect(displayWidth(line)).toBeLessThanOrEqual(48);
    }
  });

  test('ความกว้างกระดาษปรับได้สำหรับเครื่องพิมพ์ 58 มม.', () => {
    const narrow = decode(buildReceipt(RECEIPT, { width: 32 }));
    for (const line of narrow.split('\n')) {
      expect(displayWidth(line)).toBeLessThanOrEqual(32);
    }
  });
});
