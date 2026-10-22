// ทดสอบหน่วยของโมดูลสร้างรหัส QR พร้อมเพย์   [FR-03 · TC-03]
const { buildPayload, crc16, normalizeTarget, field } = require('../../lib/promptpay');

/** อ่านค่าของช่อง TLV ที่ต้องการออกจาก payload */
function readField(payload, wantTag) {
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    const value = payload.slice(i + 4, i + 4 + len);
    if (tag === wantTag) return value;
    i += 4 + len;
  }
  return null;
}

describe('crc16 — ค่าตรวจสอบความถูกต้องตามมาตรฐาน CRC-16/CCITT-FALSE', () => {
  test('ให้ค่าตรงกับค่าตรวจสอบมาตรฐานของสตริง "123456789"', () => {
    // 0x29B1 เป็นค่าตรวจสอบที่มาตรฐานกำหนดไว้สำหรับอัลกอริทึมนี้
    expect(crc16('123456789')).toBe('29B1');
  });

  test('คืนค่าเป็นเลขฐานสิบหกสี่หลักเสมอ', () => {
    expect(crc16('A')).toMatch(/^[0-9A-F]{4}$/);
    expect(crc16('')).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe('normalizeTarget — แปลงหมายเลขพร้อมเพย์', () => {
  test('เบอร์โทรศัพท์ 10 หลักถูกแปลงเป็นรูปแบบ 0066 และใช้ช่อง 01', () => {
    expect(normalizeTarget('0899999999')).toEqual({ tag: '01', value: '0066899999999' });
  });

  test('ตัดอักขระที่ไม่ใช่ตัวเลขออกก่อนแปลง', () => {
    expect(normalizeTarget('081-234-5678')).toEqual({ tag: '01', value: '0066812345678' });
  });

  test('เลขประจำตัวผู้เสียภาษี 13 หลักใช้ช่อง 02', () => {
    expect(normalizeTarget('1234567890123')).toEqual({ tag: '02', value: '1234567890123' });
  });

  test('ปฏิเสธหมายเลขที่มีจำนวนหลักไม่ถูกต้อง', () => {
    expect(() => normalizeTarget('12345')).toThrow(/ไม่ถูกต้อง/);
  });
});

describe('buildPayload — ประกอบ payload ตามมาตรฐาน EMVCo', () => {
  const PROMPTPAY = '0899999999';

  test('ระบุยอดเงินแล้วได้ payload ที่มีช่องครบตามมาตรฐาน', () => {
    const payload = buildPayload(PROMPTPAY, 1250.5);

    expect(readField(payload, '00')).toBe('01');
    expect(readField(payload, '01')).toBe('12');          // ใช้ครั้งเดียวเพราะระบุยอด
    expect(readField(payload, '53')).toBe('764');         // สกุลเงินบาท
    expect(readField(payload, '54')).toBe('1250.50');     // ทศนิยมสองตำแหน่งเสมอ
    expect(readField(payload, '58')).toBe('TH');
  });

  test('ช่อง 29 บรรจุรหัสผู้ให้บริการพร้อมเพย์และหมายเลขร้าน', () => {
    const merchant = readField(buildPayload(PROMPTPAY, 100), '29');
    expect(readField(merchant, '00')).toBe('A000000677010111');
    expect(readField(merchant, '01')).toBe('0066899999999');
  });

  test('ไม่ระบุยอดเงินจะได้ QR แบบใช้ซ้ำได้และไม่มีช่อง 54', () => {
    const payload = buildPayload(PROMPTPAY);
    expect(readField(payload, '01')).toBe('11');
    expect(readField(payload, '54')).toBeNull();
  });

  test('ค่า CRC ท้าย payload ตรงกับที่คำนวณจากเนื้อหาข้างหน้า', () => {
    const payload = buildPayload(PROMPTPAY, 999.99);
    expect(payload.slice(-8, -4)).toBe('6304');
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  test('ยอดเงินต่างกันทำให้ payload ต่างกัน — QR ผูกกับยอดที่ต้องชำระจริง', () => {
    expect(buildPayload(PROMPTPAY, 100)).not.toBe(buildPayload(PROMPTPAY, 200));
  });
});

describe('field — ประกอบช่อง TLV', () => {
  test('เติมศูนย์นำหน้าความยาวให้ครบสองหลัก', () => {
    expect(field('00', '01')).toBe('000201');
    expect(field('29', 'x'.repeat(37))).toBe('2937' + 'x'.repeat(37));
  });
});
