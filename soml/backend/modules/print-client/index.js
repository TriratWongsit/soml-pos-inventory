// ---------------------------------------------------------------------
// ส่วนเชื่อมต่อบริการพิมพ์ (Print Service Client)   [ตารางที่ 3.13 โมดูล 10 · FR-03 · UC-03]
//
// รับผิดชอบเรื่องเดียว: ส่งใบเสร็จไปให้บริการพิมพ์ (หน่วยติดตั้งที่ 3) ผ่านเครือข่าย
// ไม่รู้ว่าเครื่องพิมพ์ยี่ห้ออะไร ต่ออย่างไร — นั่นเป็นเรื่องของ print-service
// เปลี่ยนเครื่องพิมพ์จึงแก้ที่ print-service ที่เดียว หลังบ้านไม่ต้องแตะ (3.5.2)
//
// สัญญาสำคัญ: printReceipt ไม่โยนข้อผิดพลาดเด็ดขาด คืน { ok, error } เสมอ
// เพราะ UC-03 ทางที่ล้มเหลวกำหนดว่า "พิมพ์ไม่สำเร็จ คำสั่งซื้อยังต้องสำเร็จ"
// การพิมพ์เป็นงานผลพลอยได้นอกขอบเขตธุรกรรม (2.1.2) ผู้เรียกต้องเรียกหลัง commit
// ---------------------------------------------------------------------

// อ่านตอนเรียก ไม่ใช่ตอน require เพื่อให้ชุดทดสอบชี้ไปยังบริการจำลองได้
const serviceUrl = () => process.env.PRINT_SERVICE_URL || 'http://localhost:4100';
const timeoutMs = () => Number(process.env.PRINT_TIMEOUT_MS || 5000);

/**
 * @param receipt { orderNo, paidAt, cashierName, items: [{name, qty, unit, unitPrice}], totalAmount }
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
async function printReceipt(receipt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(`${serviceUrl()}/print/receipt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(receipt),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || `บริการพิมพ์ตอบ ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    // เชื่อมต่อไม่ได้ / หมดเวลา — เป็นความล้มเหลวที่คาดไว้ ไม่ใช่ข้อผิดพลาดของระบบ
    const reason = err.name === 'AbortError' ? `บริการพิมพ์ไม่ตอบภายใน ${timeoutMs()} มิลลิวินาที` : 'เชื่อมต่อบริการพิมพ์ไม่ได้';
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { printReceipt };
