// ---------------------------------------------------------------------
// ประกอบใบเสร็จเป็นชุดคำสั่ง ESC/POS                    [FR-03 · 3.5.2 · เครื่อง Epson TM-T82]
//
// รับผิดชอบเรื่องเดียว: ใบเสร็จ (ข้อมูล) → สายไบต์ที่เครื่องพิมพ์ความร้อนเข้าใจ
// เครื่องพิมพ์ไม่รู้จัก UTF-8 ต้องส่งอักษรไทยเป็น TIS-620 และสั่งเลือกตารางรหัสไทยก่อน
// TM-T82: กระดาษ 80 มม. พิมพ์ได้ 48 ตัวอักษรต่อบรรทัด (ฟอนต์ A) มีมีดตัดในตัว
// ---------------------------------------------------------------------
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  init: Buffer.from([ESC, 0x40]),               // ESC @   รีเซ็ตเครื่องพิมพ์
  codepage: (n) => Buffer.from([ESC, 0x74, n]), // ESC t n เลือกตารางรหัสอักขระ (21 = Thai Character Code 11)
  alignLeft: Buffer.from([ESC, 0x61, 0]),
  alignCenter: Buffer.from([ESC, 0x61, 1]),
  boldOn: Buffer.from([ESC, 0x45, 1]),
  boldOff: Buffer.from([ESC, 0x45, 0]),
  doubleOn: Buffer.from([GS, 0x21, 0x11]),      // GS ! 0x11 กว้างและสูงสองเท่า (ชื่อร้าน)
  doubleOff: Buffer.from([GS, 0x21, 0x00]),
  feed: (n) => Buffer.from([ESC, 0x64, n]),     // ESC d n เลื่อนกระดาษ n บรรทัด
  cut: Buffer.from([GS, 0x56, 0x42, 0x00]),     // GS V B 0 ตัดกระดาษเว้นติ่ง
};

/**
 * ยูนิโคดไทย U+0E01–U+0E5B ตรงกับ TIS-620 0xA1–0xFB แบบเลื่อนคงที่ จึงแปลงด้วยการลบ
 * อักขระนอกสองช่วงนี้แทนด้วยช่องว่าง ไม่ให้เครื่องพิมพ์ตีความไบต์แปลกปลอมเป็นคำสั่ง
 */
function tis620(text) {
  const out = [];
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c >= 0x0e01 && c <= 0x0e5b) out.push(c - 0x0e00 + 0xa0);
    else out.push(0x20);
  }
  return Buffer.from(out);
}

/** ถอดสายไบต์กลับเป็นข้อความอ่านได้ (ทิ้งคำสั่งควบคุม) ใช้ในโหมดพิมพ์ลงไฟล์และชุดทดสอบ */
function decodePreview(payload) {
  let s = '';
  for (let i = 0; i < payload.length; i++) {
    const b = payload[i];
    if (b === ESC || b === GS) { i += b === ESC && payload[i + 1] === 0x40 ? 1 : 2; continue; }
    if (b === 0x0a) s += '\n';
    else if (b < 0x80) s += String.fromCharCode(b);
    else if (b >= 0xa1 && b <= 0xfb) s += String.fromCharCode(b - 0xa0 + 0x0e00);
  }
  return s;
}

/**
 * ความกว้างบนกระดาษ — สระบน/ล่างและวรรณยุกต์ไทยพิมพ์ซ้อนพยัญชนะ ไม่กินช่อง
 * (ไม้หันอากาศ U+0E31 · สระอิ–พินทุ U+0E34–0E3A · ไม้ไต่คู้–นิคหิต U+0E47–0E4E)
 */
function displayWidth(text) {
  let w = 0;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    const floating = c === 0x0e31 || (c >= 0x0e34 && c <= 0x0e3a) || (c >= 0x0e47 && c <= 0x0e4e);
    if (!floating) w++;
  }
  return w;
}

/** ตัดข้อความให้ไม่เกิน max ช่องพิมพ์ โดยไม่ตัดกลางสระลอย */
function fit(text, max) {
  let out = '';
  for (const ch of String(text)) {
    if (displayWidth(out + ch) > max) break;
    out += ch;
  }
  return out;
}

/** สองคอลัมน์: ซ้ายชิดซ้าย ขวาชิดขวา เว้นอย่างน้อยหนึ่งช่อง */
function twoColumns(left, right, width) {
  const r = String(right);
  const l = fit(left, width - displayWidth(r) - 1);
  return l + ' '.repeat(Math.max(1, width - displayWidth(l) - displayWidth(r))) + r;
}

const money = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * @param receipt { orderNo, paidAt, cashierName, items:[{name, qty, unit, unitPrice, lineTotal}], totalAmount }
 * @param opts    { width = 48, codepage = 21, shopName }
 */
function buildReceipt(receipt, { width = 48, codepage = 21, shopName = 'ร้านอำพรคอนกรีต' } = {}) {
  const parts = [CMD.init, CMD.codepage(codepage)];
  const line = (t = '') => parts.push(tis620(t), Buffer.from([0x0a]));
  const rule = () => line('-'.repeat(width));

  parts.push(CMD.alignCenter, CMD.boldOn, CMD.doubleOn);
  line(shopName);
  parts.push(CMD.doubleOff, CMD.boldOff);
  line('ใบเสร็จรับเงิน');
  parts.push(CMD.alignLeft);
  rule();

  line(twoColumns('เลขที่', receipt.orderNo || '-', width));
  const paidAt = receipt.paidAt ? new Date(receipt.paidAt) : new Date();
  line(twoColumns('วันที่', paidAt.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }), width));
  if (receipt.cashierName) line(twoColumns('พนักงานขาย', receipt.cashierName, width));
  rule();

  for (const it of receipt.items || []) {
    line(fit(it.name, width));                                     // ชื่อสินค้าบรรทัดของตัวเอง เพราะชื่อวัสดุยาว
    const lineTotal = it.lineTotal ?? it.qty * it.unitPrice;
    line(twoColumns(`  ${it.qty} ${it.unit || ''} x ${money(it.unitPrice)}`, money(lineTotal), width));
  }
  rule();
  parts.push(CMD.boldOn);
  line(twoColumns('ยอดรวมทั้งสิ้น', `${money(receipt.totalAmount)} บาท`, width));
  parts.push(CMD.boldOff);
  rule();

  parts.push(CMD.alignCenter);
  line('ชำระด้วยพร้อมเพย์');
  line('กรุณารับสินค้าที่คลังสินค้า');
  line('ขอบคุณที่ใช้บริการ');
  parts.push(CMD.feed(3), CMD.cut);
  return Buffer.concat(parts);
}

module.exports = { buildReceipt, tis620, decodePreview, displayWidth, twoColumns, fit, CMD };
