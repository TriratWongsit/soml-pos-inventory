// ---------------------------------------------------------------------
// ไลบรารีสร้างรหัส QR พร้อมเพย์ (PromptPay Library)      [ตารางที่ 3.14 แถว 3 · FR-03]
//
// รับผิดชอบเรื่องเดียว: แปลง (หมายเลขร้าน, ยอดเงิน) → สตริง payload ตามมาตรฐาน
// EMVCo Merchant-Presented Mode ที่แอปธนาคารทุกแอปในไทยอ่านได้
// ทำงานในกระบวนการเดียวกับหลังบ้าน ไม่เรียกธนาคาร (ขอบเขต 1.3.6 · 3.5.1)
//
// โครงสตริงเป็น TLV: รหัสช่อง 2 หลัก + ความยาว 2 หลัก + ค่า ต่อกันไปตามลำดับรหัสช่อง
//   00 เวอร์ชัน · 01 ใช้ครั้งเดียว/ซ้ำได้ · 29 บัญชีผู้รับ · 53 สกุลเงิน
//   54 ยอดเงิน · 58 ประเทศ · 63 ค่าตรวจสอบ CRC (ต้องอยู่ท้ายสุด)
// ---------------------------------------------------------------------
const AID_PROMPTPAY = 'A000000677010111'; // รหัสผู้ให้บริการพร้อมเพย์ที่ EMVCo จดทะเบียนไว้
const CURRENCY_THB = '764';               // บาท ตาม ISO 4217
const COUNTRY_TH = 'TH';

/** ประกอบหนึ่งช่อง TLV เช่น field('53','764') → '5303764' */
function field(tag, value) {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

/**
 * CRC-16/CCITT-FALSE: ตัวตั้งต้น 0xFFFF พหุนาม 0x1021 ไม่กลับบิต
 * เป็นค่าตรวจสอบที่แอปธนาคารคำนวณซ้ำแล้วเทียบกับช่อง 63 ถ้าไม่ตรงจะสแกนไม่ขึ้น
 * ค่าอ้างอิงสากล: crc16('123456789') === '29B1'
 */
function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * แปลงหมายเลขพร้อมเพย์เป็นช่องย่อยของช่อง 29
 *   เบอร์โทร 10 หลัก        → ช่อง 01 ค่า 0066 + เบอร์ตัดศูนย์หน้า
 *   เลขบัตร/ผู้เสียภาษี 13 หลัก → ช่อง 02 ค่าตามเดิม
 *   กระเป๋าเงิน 15 หลัก      → ช่อง 03 ค่าตามเดิม
 */
function normalizeTarget(id) {
  const digits = String(id || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return { tag: '01', value: `0066${digits.slice(1)}` };
  if (digits.length === 13) return { tag: '02', value: digits };
  if (digits.length === 15) return { tag: '03', value: digits };
  throw new Error(`หมายเลขพร้อมเพย์ไม่ถูกต้อง: ต้องเป็นเบอร์โทร 10 หลัก เลขบัตร 13 หลัก หรือกระเป๋าเงิน 15 หลัก (ได้ ${digits.length} หลัก)`);
}

/**
 * สร้าง payload สำหรับนำไปวาดเป็นภาพ QR บนหน้าขาย
 * @param {string} promptpayId หมายเลขพร้อมเพย์ของร้าน (จาก .env PROMPTPAY_ID)
 * @param {number} amount      ยอดที่ต้องชำระเป็นบาท — ระบบนี้ระบุยอดเสมอ เพื่อให้ลูกค้าไม่ต้องพิมพ์เอง
 */
function buildPayload(promptpayId, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('ยอดเงินต้องเป็นตัวเลขมากกว่าศูนย์');
  const target = normalizeTarget(promptpayId);

  let payload =
    field('00', '01') +                                   // เวอร์ชันของรูปแบบ
    field('01', '12') +                                   // 12 = ใช้ครั้งเดียว เพราะผูกยอดไว้แล้ว
    field('29', field('00', AID_PROMPTPAY) + field(target.tag, target.value)) +
    field('53', CURRENCY_THB) +
    field('54', value.toFixed(2)) +                       // ทศนิยม 2 ตำแหน่งเสมอ
    field('58', COUNTRY_TH) +
    '6304';                                               // ช่อง 63 ยาว 4 — CRC คิดรวมส่วนหัวนี้ด้วย
  return payload + crc16(payload);
}

module.exports = { buildPayload, crc16, normalizeTarget, field };
