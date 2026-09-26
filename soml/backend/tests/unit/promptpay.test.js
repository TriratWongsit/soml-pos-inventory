// ไลบรารีสร้างรหัส QR พร้อมเพย์                              [ตารางที่ 3.14 แถว 3 · ตารางที่ 3.22 ระดับ 1]
const { buildPayload, crc16, normalizeTarget, field } = require('../../lib/promptpay');

/** อ่านค่าของช่อง TLV ระดับบนสุดออกจาก payload เพื่อตรวจทีละช่อง */
function readField(payload, wantTag) {
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    const value = payload.slice(i + 4, i + 4 + len);
    if (tag === wantTag) return value;
    i += 4 + len;
  }
  return undefined;
}

describe('field — ช่อง TLV', () => {
  test('รหัส 2 หลัก + ความยาว 2 หลัก + ค่า', () => {
    expect(field('53', '764')).toBe('5303764');
    expect(field('54', '1250.50')).toBe('54071250.50');
  });
});

describe('crc16 — CRC-16/CCITT-FALSE', () => {
  test('ตรงกับค่าอ้างอิงสากลของ "123456789"', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
  test('เป็นเลขฐานสิบหก 4 หลักตัวพิมพ์ใหญ่เสมอ', () => {
    expect(crc16('')).toBe('FFFF');
    expect(crc16('A')).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe('normalizeTarget — หมายเลขร้าน', () => {
  test('เบอร์โทร 10 หลัก → 0066 + ตัดศูนย์หน้า ในช่อง 01', () => {
    expect(normalizeTarget('0899999999')).toEqual({ tag: '01', value: '0066899999999' });
  });
  test('ตัดขีดและช่องว่างออกก่อน', () => {
    expect(normalizeTarget('081-234 5678')).toEqual({ tag: '01', value: '0066812345678' });
  });
  test('เลขบัตร 13 หลัก → ช่อง 02', () => {
    expect(normalizeTarget('1234567890123')).toEqual({ tag: '02', value: '1234567890123' });
  });
  test('จำนวนหลักผิดต้องปฏิเสธ ไม่สร้าง QR ที่โอนไม่เข้า', () => {
    expect(() => normalizeTarget('12345')).toThrow(/ไม่ถูกต้อง/);
  });
});

describe('buildPayload — payload ทั้งเส้น', () => {
  const payload = buildPayload('0899999999', 1250.5);

  test('มีช่องบังคับครบและค่าถูกตามมาตรฐาน', () => {
    expect(readField(payload, '00')).toBe('01');
    expect(readField(payload, '01')).toBe('12');
    expect(readField(payload, '53')).toBe('764');
    expect(readField(payload, '54')).toBe('1250.50');
    expect(readField(payload, '58')).toBe('TH');
  });

  test('ช่อง 29 ซ้อนรหัสพร้อมเพย์และหมายเลขร้าน', () => {
    const merchant = readField(payload, '29');
    expect(readField(merchant, '00')).toBe('A000000677010111');
    expect(readField(merchant, '01')).toBe('0066899999999');
  });

  test('ช่อง 63 อยู่ท้ายสุดและ CRC ตรงกับที่คำนวณจากทุกอย่างก่อนหน้า', () => {
    expect(payload.slice(-8, -4)).toBe('6304');
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  test('ยอดที่เปลี่ยนแม้สตางค์เดียวต้องได้ payload ต่างกัน (กันโอนผิดยอด)', () => {
    expect(buildPayload('0899999999', 1250.5)).not.toBe(buildPayload('0899999999', 1250.51));
  });

  test('ยอดศูนย์หรือติดลบต้องปฏิเสธ', () => {
    expect(() => buildPayload('0899999999', 0)).toThrow(/มากกว่าศูนย์/);
    expect(() => buildPayload('0899999999', -5)).toThrow(/มากกว่าศูนย์/);
  });
});
