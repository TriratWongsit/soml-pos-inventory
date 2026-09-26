// ---------------------------------------------------------------------
// ตัวช่วยของการทดสอบระดับระบบ — ทำงานผ่านหน้าจอจริงเหมือนผู้ใช้
//
// บัญชีที่ใช้เป็นบัญชีเดียวกับที่ db/seed/seed-users.js สร้างไว้
// รหัสผ่านอ่านจาก SEED_PASSWORD ใน .env เพื่อไม่ต้องเขียนรหัสผ่านลงในโค้ด
// ---------------------------------------------------------------------
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';

// สินค้าที่มีของในคลังจริงตามไฟล์สต็อกของร้าน ใช้กับการทดสอบที่ต้องจ่ายสินค้าออกไป
// (สินค้าหลายรายการในไฟล์ของร้านมียอดตั้งต้นเป็นศูนย์ เพราะร้านยังไม่ได้นับ จึงจ่ายไม่ได้)
const STOCKED_SKU = '101017';   // เหล็ก 2 หุนเต็ม (6 มิล) — คงเหลือตั้งต้น 1,200 เส้น

const USERS = {
  sales: { username: 'siriphan', fullName: 'ศริพรรณ ศิริกันทา', home: '/pos' },
  warehouse: { username: 'santi', fullName: 'สันติ ศิริกันทา', home: '/queue' },
  manager: { username: 'ning', fullName: 'นิ้ง', home: '/dashboard' },
};

/** เข้าสู่ระบบผ่านหน้าจอจริง แล้วรอจนถึงหน้าแรกของบทบาทนั้น (UC-01 · AC-12) */
async function login(page, role) {
  const u = USERS[role];
  await page.goto('/login');
  // ถ้ายังมีเซสชันเดิมค้างอยู่ หน้านี้จะแสดงการ์ด "เข้าสู่ระบบอยู่แล้ว" แทนฟอร์ม ต้องออกก่อน
  const switchUser = page.getByRole('button', { name: 'ออกจากระบบ เพื่อเข้าด้วยบัญชีอื่น' });
  if (await switchUser.count()) await switchUser.click();
  await page.getByLabel('ชื่อผู้ใช้').fill(u.username);
  await page.getByLabel('รหัสผ่าน').fill(PASSWORD);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await page.waitForURL(`**${u.home}`);
  return u;
}

/**
 * ค้นหาสินค้าแล้วแตะเพิ่มลงตะกร้าหนึ่งรายการ คืนชื่อสินค้าที่เพิ่ม
 * รอคำตอบของการค้นหาก่อนแตะ เพราะหน้าจอหน่วง 200 มิลลิวินาทีก่อนถาม
 * แถวที่กดได้ต้องมีสามช่อง (ชื่อ ราคา คงเหลือ) — แถว "ไม่พบสินค้า" มีช่องเดียว
 */
async function addToCart(page, search) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/products?q=${encodeURIComponent(search)}`) && r.ok()),
    page.getByPlaceholder(/ค้นหา/).fill(search),
  ]);
  const row = page.locator('table.picker tbody tr:has(td:nth-child(3))').first();
  await row.waitFor();
  const name = (await row.locator('td').first().innerText()).split('\n').pop().trim();
  await row.click();
  const cart = page.locator('.card', { has: page.getByRole('heading', { name: 'รายการที่เลือก' }) });
  await cart.getByText(name, { exact: false }).first().waitFor();
  return name;
}

/**
 * ขายสินค้าหนึ่งรายการจนจบที่หน้า "รับชำระเงินสำเร็จ" แล้วคืนเลขที่คำสั่งซื้อ
 * ต้องอยู่ในเซสชันของพนักงานขายหรือผู้จัดการแล้ว
 */
async function sellOne(page, { search, qty = 1 }) {
  await page.goto('/pos');
  await addToCart(page, search);
  if (qty > 1) await page.locator('td.qty input').first().fill(String(qty));
  await page.getByRole('button', { name: 'แสดงรหัส QR เพื่อรับชำระ' }).click();
  await page.locator('.qrbox img').waitFor();          // รหัส QR ถูกสร้างแล้ว
  await page.getByRole('button', { name: 'ยืนยันรับชำระเงิน' }).click();
  const banner = page.locator('.alert.ok');
  await banner.waitFor();
  const text = await banner.innerText();
  return text.match(/ORD-\d{8}-\d{4}/)[0];
}

/** เรียกเส้นทางบริการโดยตรงด้วยโทเคนของเซสชันปัจจุบัน ใช้ตรวจว่าตัวเลขบนหน้าจอตรงกับข้อมูลจริง */
async function apiAs(page, method, path, body) {
  return page.evaluate(
    async ([m, p, b]) => {
      const res = await fetch(`/api${p}`, {
        method: m,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('soml.token')}`,
        },
        body: b === null ? undefined : JSON.stringify(b),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    [method, path, body ?? null]
  );
}

module.exports = { USERS, PASSWORD, STOCKED_SKU, login, addToCart, sellOne, apiAs };
