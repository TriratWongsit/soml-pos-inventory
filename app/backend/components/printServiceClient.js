// ---------------------------------------------------------------------
// Print Service Client — ส่งคำสั่งพิมพ์ใบเสร็จ   [FR-03 · NFR-05]
//
// SRS §3.1.2 กำหนดว่าหากเครื่องพิมพ์ไม่พร้อมหรือกระดาษหมด ระบบต้องแจ้ง
// พนักงานขายบนหน้าจอ แต่ "ต้องไม่ทำให้การบันทึกคำสั่งซื้อหรือการส่งคิว
// คลังล้มเหลวตามไปด้วย" ฟังก์ชันนี้จึงไม่โยนข้อผิดพลาดออกไป แต่คืนผลลัพธ์
// ให้ผู้เรียกตัดสินใจว่าจะแสดงข้อความเตือนอย่างไร
// ---------------------------------------------------------------------
const PRINT_SERVICE_URL = () => process.env.PRINT_SERVICE_URL || 'http://localhost:4100';
const TIMEOUT_MS = () => Number(process.env.PRINT_TIMEOUT_MS || 5000);

/**
 * สั่งพิมพ์ใบเสร็จหนึ่งใบ
 * @returns {Promise<{ok: boolean, elapsedMs: number, error?: string}>}
 */
async function printReceipt(receipt) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS());

  try {
    const res = await fetch(`${PRINT_SERVICE_URL()}/print/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receipt),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, elapsedMs: Date.now() - startedAt, error: `เครื่องพิมพ์ตอบกลับสถานะ ${res.status} ${body}`.trim() };
    }
    return { ok: true, elapsedMs: Date.now() - startedAt };
  } catch (err) {
    const reason =
      err.name === 'AbortError'
        ? `พิมพ์ใบเสร็จไม่สำเร็จภายใน ${TIMEOUT_MS()} มิลลิวินาที`
        : `ติดต่อบริการพิมพ์ใบเสร็จไม่ได้: ${err.message}`;
    return { ok: false, elapsedMs: Date.now() - startedAt, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { printReceipt };
