// ---------------------------------------------------------------------
// สร้างชุดคำสั่ง ESC/POS สำหรับพิมพ์ใบเสร็จ   [FR-03 · SRS §3.1.2 · §2.2.8]
//
// เครื่องพิมพ์ใบเสร็จความร้อนรับข้อมูลเป็นสายไบต์ที่ผสมคำสั่งควบคุมกับ
// ตัวอักษรที่จะพิมพ์ ตัวอักษรไทยต้องแปลงเป็นรหัส TIS-620 ก่อน เพราะ
// เครื่องพิมพ์ไม่เข้าใจ UTF-8 และต้องสั่งเลือกตารางรหัสอักขระไทยก่อนพิมพ์
// ---------------------------------------------------------------------

const ESC = 0x1b;
const GS = 0x1d;

/** คำสั่งควบคุมที่ใช้ในใบเสร็จ */
const CMD = {
  init: Buffer.from([ESC, 0x40]),                       // ESC @  เริ่มต้นการทำงานใหม่
  alignLeft: Buffer.from([ESC, 0x61, 0]),               // ESC a 0
  alignCenter: Buffer.from([ESC, 0x61, 1]),             // ESC a 1
  alignRight: Buffer.from([ESC, 0x61, 2]),              // ESC a 2
  boldOn: Buffer.from([ESC, 0x45, 1]),                  // ESC E 1
  boldOff: Buffer.from([ESC, 0x45, 0]),                 // ESC E 0
  doubleHeightOn: Buffer.from([GS, 0x21, 0x01]),        // GS ! n  ขยายความสูงสองเท่า
  doubleHeightOff: Buffer.from([GS, 0x21, 0x00]),
  feed: (n) => Buffer.from([ESC, 0x64, n]),             // ESC d n  เลื่อนกระดาษ n บรรทัด
  cut: Buffer.from([GS, 0x56, 0x42, 0x00]),             // GS V B 0  ตัดกระดาษแบบเว้นติ่ง
  // ESC t n  เลือกตารางรหัสอักขระ ค่า 21 คือ TIS-620 ของเครื่องพิมพ์ตระกูล Epson
  codepage: (n) => Buffer.from([ESC, 0x74, n]),
};

/**
 * แปลงข้อความเป็นไบต์ตามรหัส TIS-620
 *
 * อักษรไทยในยูนิโคดอยู่ช่วง U+0E01 ถึง U+0E5B ซึ่งเรียงตรงกับไบต์ 0xA1
 * ถึง 0xFB ใน TIS-620 พอดี จึงแปลงได้ด้วยการลบส่วนต่างคงที่
 * อักขระ ASCII ใช้รหัสเดิมได้ทันที ส่วนอักขระนอกสองช่วงนี้แทนด้วยช่องว่าง
 * เพื่อไม่ให้เครื่องพิมพ์ตีความไบต์แปลกปลอมเป็นคำสั่งควบคุม
 */
function tis620(text) {
  const bytes = [];
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code >= 0x0e01 && code <= 0x0e5b) {
      bytes.push(code - 0x0e00 + 0xa0);
    } else {
      bytes.push(0x20);
    }
  }
  return Buffer.from(bytes);
}

/** ความกว้างที่ข้อความกินบนกระดาษ นับอักษรไทยที่ลอยบนล่างเป็นศูนย์ */
function displayWidth(text) {
  let width = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    // สระบน สระล่าง และวรรณยุกต์ พิมพ์ซ้อนกับพยัญชนะตัวหน้า ไม่กินความกว้าง
    //   U+0E31            ไม้หันอากาศ
    //   U+0E34 ถึง U+0E3A สระอิ อี อึ อื อุ อู และพินทุ
    //   U+0E47 ถึง U+0E4E ไม้ไต่คู้ วรรณยุกต์ ทัณฑฆาต และนิคหิต
    // สระอา (U+0E32) และสระอำ (U+0E33) ไม่อยู่ในกลุ่มนี้ เพราะพิมพ์เป็น
    // ตัวอักษรเต็มตัวถัดจากพยัญชนะ จึงกินความกว้างตามปกติ
    const isCombining =
      code === 0x0e31 ||
      (code >= 0x0e34 && code <= 0x0e3a) ||
      (code >= 0x0e47 && code <= 0x0e4e);
    if (!isCombining) width += 1;
  }
  return width;
}

/** จัดข้อความชิดซ้ายและชิดขวาบนบรรทัดเดียวกัน */
function twoColumns(left, right, width) {
  const gap = Math.max(1, width - displayWidth(left) - displayWidth(right));
  return `${left}${' '.repeat(gap)}${right}`;
}

/** ตัดข้อความยาวให้พอดีความกว้างกระดาษ โดยไม่ตัดกลางสระ */
function wrap(text, width) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (displayWidth(candidate) <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      // คำเดียวที่ยาวเกินความกว้างต้องหั่นเป็นท่อน
      while (displayWidth(current) > width) {
        let cut = 0;
        let w = 0;
        for (const ch of current) {
          const next = w + displayWidth(ch);
          if (next > width) break;
          w = next;
          cut += ch.length;
        }
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

const money = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ประกอบใบเสร็จทั้งใบเป็นสายไบต์พร้อมส่งเครื่องพิมพ์
 *
 * เนื้อหาครบตามที่ SRS §3.1.2 กำหนด คือเลขที่คำสั่งซื้อ รายการสินค้า
 * จำนวน ราคาต่อหน่วย ยอดรวม และวันที่เวลา
 */
function buildReceipt(receipt, options = {}) {
  const width = Number(options.width || 48);
  const codepage = Number(options.codepage ?? 21);
  const shopName = options.shopName || 'ร้านวัสดุก่อสร้างอำพรคอนกรีต';

  const parts = [CMD.init, CMD.codepage(codepage)];
  const emit = (s) => parts.push(tis620(`${s}\n`));

  /** พิมพ์ข้อความโดยตัดบรรทัดให้พอดีความกว้างกระดาษเสมอ */
  const text = (s) => wrap(s, width).forEach(emit);

  /**
   * พิมพ์สองคอลัมน์บนบรรทัดเดียว แต่ถ้ารวมกันแล้วยาวเกินกระดาษ
   * ให้ขึ้นบรรทัดใหม่แล้ววางคอลัมน์ขวาชิดขวา เพื่อไม่ให้ข้อความล้น
   */
  const columns = (left, right) => {
    if (displayWidth(left) + displayWidth(right) + 1 <= width) emit(twoColumns(left, right, width));
    else {
      text(left);
      emit(twoColumns('', right, width));
    }
  };

  parts.push(CMD.alignCenter, CMD.boldOn, CMD.doubleHeightOn);
  text(shopName);
  parts.push(CMD.doubleHeightOff, CMD.boldOff);
  text('ใบเสร็จรับเงิน');
  parts.push(CMD.alignLeft);
  text('-'.repeat(width));

  columns('เลขที่', receipt.orderNo || '-');
  const paidAt = receipt.paidAt ? new Date(receipt.paidAt) : new Date();
  columns('วันที่', paidAt.toLocaleString('th-TH'));
  if (receipt.cashierName) columns('พนักงานขาย', receipt.cashierName);
  text('-'.repeat(width));

  for (const item of receipt.items || []) {
    // ชื่อสินค้ายาวจึงขึ้นบรรทัดของตัวเอง แล้วค่อยตามด้วยบรรทัดจำนวนและราคา
    text(item.name);
    const qtyText = `  ${item.qty} ${item.unit || ''} x ${money(item.unitPrice)}`;
    columns(qtyText, money(item.lineTotal));
  }

  text('-'.repeat(width));
  parts.push(CMD.boldOn);
  columns('ยอดรวมทั้งสิ้น', `${money(receipt.totalAmount)} บาท`);
  parts.push(CMD.boldOff);
  text('-'.repeat(width));

  parts.push(CMD.alignCenter);
  // หลีกเลี่ยงอักขระนอกชุด TIS-620 เช่นจุดกลาง เพราะจะกลายเป็นช่องว่างบนใบเสร็จ
  text('ชำระด้วยพร้อมเพย์');
  text('กรุณารับสินค้าที่คลังสินค้า');
  text('ขอบคุณที่ใช้บริการ');

  parts.push(CMD.feed(3), CMD.cut);
  return Buffer.concat(parts);
}

/**
 * ถอดสายไบต์กลับเป็นข้อความที่คนอ่านได้ ใช้ตรวจสอบเนื้อหาใบเสร็จ
 *
 * ต้องข้ามคำสั่งควบคุมตามความยาวของแต่ละคำสั่ง ไม่ใช่กรองเฉพาะไบต์ที่
 * อยู่นอกช่วงอักขระพิมพ์ได้ เพราะพารามิเตอร์ของคำสั่งหลายตัวบังเอิญตรงกับ
 * รหัสตัวอักษร เช่น ESC a 0 มีไบต์ 0x61 ซึ่งคือตัวอักษร "a"
 */
function decodePreview(buffer) {
  // ความยาวรวมของแต่ละคำสั่ง นับรวมไบต์นำและพารามิเตอร์
  const LENGTHS = {
    0x40: 2,  // ESC @
    0x61: 3,  // ESC a n
    0x45: 3,  // ESC E n
    0x74: 3,  // ESC t n
    0x64: 3,  // ESC d n
  };

  let out = '';
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];

    if (byte === ESC) {
      i += LENGTHS[buffer[i + 1]] ?? 2;
      continue;
    }
    if (byte === GS) {
      // GS ! n มีสามไบต์ ส่วน GS V m n มีสี่ไบต์
      i += buffer[i + 1] === 0x56 ? 4 : 3;
      continue;
    }

    if (byte >= 0xa1 && byte <= 0xfb) out += String.fromCodePoint(byte - 0xa0 + 0x0e00);
    else if (byte === 0x0a) out += '\n';
    else if (byte >= 0x20 && byte < 0x7f) out += String.fromCharCode(byte);
    i += 1;
  }
  return out;
}

module.exports = { buildReceipt, tis620, decodePreview, displayWidth, twoColumns, wrap, CMD };
