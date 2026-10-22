// ---------------------------------------------------------------------
// สร้าง Payload ของรหัส QR พร้อมเพย์ตามมาตรฐาน EMVCo
// Merchant-Presented Mode (MPM)                    [FR-03 · UC-03 · §2.1.7]
//
// SRS §3.1.3 ระบุว่าโมดูลนี้ทำงานเป็นไลบรารีภายในกระบวนการของ Backend API
// ไม่เรียกบริการภายนอกและไม่เชื่อมต่อ Payment Gateway ตามขอบเขตใน §1.2.3
//
// โครงสร้างข้อมูลเป็นแบบ TLV (Tag-Length-Value) ทุกช่องประกอบด้วย
// รหัสช่อง 2 หลัก + ความยาว 2 หลัก + ค่าข้อมูล เรียงตามลำดับรหัสช่อง
// ---------------------------------------------------------------------

const AID_PROMPTPAY = 'A000000677010111'; // รหัสผู้ให้บริการพร้อมเพย์
const CURRENCY_THB = '764';               // รหัสสกุลเงินบาทตาม ISO 4217
const COUNTRY_TH = 'TH';

/** ประกอบหนึ่งช่องข้อมูลในรูปแบบ TLV */
function field(tag, value) {
  const len = String(value.length).padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * คำนวณค่าตรวจสอบความถูกต้อง CRC-16/CCITT-FALSE
 * (ตัวตั้งต้น 0xFFFF, พหุนาม 0x1021, ไม่กลับบิต) ตามที่ EMVCo กำหนดในช่อง 63
 */
function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * แปลงหมายเลขพร้อมเพย์ให้อยู่ในรูปแบบที่มาตรฐานกำหนด
 * คืนค่าเป็น { tag, value } เพื่อให้ผู้เรียกนำไปประกอบในช่อง 29
 *
 *  - เบอร์โทรศัพท์ 10 หลัก  -> ช่อง 01 รูปแบบ 0066 ตามด้วยเบอร์ที่ตัดเลขศูนย์นำหน้า
 *  - เลขประจำตัวประชาชน/ผู้เสียภาษี 13 หลัก -> ช่อง 02
 *  - หมายเลขกระเป๋าเงินอิเล็กทรอนิกส์ 15 หลัก -> ช่อง 03
 */
function normalizeTarget(id) {
  const digits = String(id || '').replace(/\D/g, '');

  if (digits.length === 10 && digits.startsWith('0')) {
    return { tag: '01', value: `0066${digits.slice(1)}` };
  }
  if (digits.length === 13) {
    return { tag: '02', value: digits };
  }
  if (digits.length === 15) {
    return { tag: '03', value: digits };
  }
  throw new Error(
    `หมายเลขพร้อมเพย์ไม่ถูกต้อง: ต้องเป็นเบอร์โทรศัพท์ 10 หลัก เลขประจำตัว 13 หลัก หรือหมายเลขกระเป๋าเงิน 15 หลัก (ได้รับ ${digits.length} หลัก)`
  );
}

/**
 * สร้างสตริง Payload สำหรับนำไปเข้ารหัสเป็นภาพ QR
 *
 * @param {string} promptpayId หมายเลขพร้อมเพย์ของร้าน
 * @param {number} [amount]   ยอดเงินที่ต้องชำระ ถ้าไม่ระบุจะได้ QR แบบไม่กำหนดยอด
 */
function buildPayload(promptpayId, amount) {
  const target = normalizeTarget(promptpayId);
  const hasAmount = amount !== undefined && amount !== null && Number(amount) > 0;

  const merchantAccount =
    field('00', AID_PROMPTPAY) + field(target.tag, target.value);

  let payload =
    field('00', '01') +
    // 11 = ใช้ซ้ำได้ (ไม่ระบุยอด) · 12 = ใช้ครั้งเดียว (ระบุยอด)
    field('01', hasAmount ? '12' : '11') +
    field('29', merchantAccount) +
    field('53', CURRENCY_THB) +
    (hasAmount ? field('54', Number(amount).toFixed(2)) : '') +
    field('58', COUNTRY_TH);

  // ช่อง 63 ต้องอยู่ท้ายสุดเสมอ และค่า CRC คำนวณจากสตริงทั้งหมด
  // รวมรหัสช่องและความยาวของช่อง 63 เองด้วย
  payload += '6304';
  return payload + crc16(payload);
}

module.exports = { buildPayload, crc16, normalizeTarget, field };
