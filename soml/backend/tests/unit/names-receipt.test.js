// ชื่อย่อบนใบเสร็จ (K-2) และใบขายเชื่อ 2 ใบ (K-6)
const { shortName } = require('../../lib/names');
const { buildReceipt, decodePreview } = require('../../../print-service/lib/escpos');
const { validPromptpayId, maskPromptpay } = require('../../modules/order');

describe('shortName — ไม่พิมพ์ชื่อเต็มของพนักงาน', () => {
  test.each([
    ['ศริพรรณ ศิริกันทา', 'ศริพรรณ ศ.'],
    ['สันติ   ศิริกันทา', 'สันติ ศ.'],
    ['นิ้ง', 'นิ้ง'],
    ['', ''],
    ['John Smith', 'John S.'],
  ])('%s → %s', (full, short) => expect(shortName(full)).toBe(short));
});

describe('ใบขายเชื่อ', () => {
  const receipt = {
    orderNo: 'ORD-20261018-0001', paidAt: '2026-10-18T03:00:00Z', cashierName: 'ศริพรรณ ศ.',
    items: [{ name: 'ปูนเสือ', qty: 2, unit: 'ถุง', unitPrice: 165, lineTotal: 330 }], totalAmount: 330,
    paymentMethod: 'credit', customerName: 'ช่างสมชาย', copyLabel: 'สำเนาร้าน ลูกค้าเซ็นรับของ',
  };
  test('มีหัวขายเชื่อ ชื่อลูกค้า สถานะยังไม่ชำระ ช่องเซ็นชื่อ และไม่มีคำว่าชำระด้วยพร้อมเพย์', () => {
    const text = decodePreview(buildReceipt(receipt));
    for (const s of ['ใบส่งของ / ขายเชื่อ', 'สำเนาร้าน', 'ช่างสมชาย', 'ขายเชื่อ ยังไม่ชำระ', 'ลงชื่อผู้ซื้อ']) expect(text).toContain(s);
    expect(text).not.toContain('ชำระด้วยพร้อมเพย์');
  });
  test('ใบ QR ปกติยังเป็นใบเสร็จรับเงิน', () => {
    const text = decodePreview(buildReceipt({ ...receipt, paymentMethod: 'promptpay', copyLabel: undefined }));
    expect(text).toContain('ใบเสร็จรับเงิน');
    expect(text).not.toContain('ลงชื่อผู้ซื้อ');
  });
});

describe('ใบเสร็จเงินสด', () => {
  test('มีรับเงินสด เงินทอน และ "ชำระด้วยเงินสด"', () => {
    const text = decodePreview(buildReceipt({ orderNo: 'ORD-1', cashierName: 'สันติ ศ.', items: [{ name: 'ปูน', qty: 1, unit: 'ถุง', unitPrice: 165, lineTotal: 165 }],
      totalAmount: 165, paymentMethod: 'cash', cashReceived: 200 }));
    for (const s of ['ใบเสร็จรับเงิน', 'รับเงินสด', '200.00 บาท', 'เงินทอน', '35.00 บาท', 'ชำระด้วยเงินสด']) expect(text).toContain(s);
    expect(text).not.toContain('ชำระด้วยพร้อมเพย์');
  });
});

describe('เลขพร้อมเพย์ (K-3)', () => {
  test.each([['0812345678', true], ['081-234-5678', true], ['1234567890123', true], ['12345', false], ['1812345678', false], ['', false]])(
    '%s → %s', (id, ok) => expect(validPromptpayId(id)).toBe(ok));
  test('ปิดบางหลักก่อนแสดงบนหน้าจอ', () => {
    expect(maskPromptpay('0812345678')).toBe('xxx-xxx-5678');
    expect(maskPromptpay('1234567890123')).toBe('x-xxxx-xxxxx-12-3');
  });
});
