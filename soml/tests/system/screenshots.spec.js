// ---------------------------------------------------------------------
// เก็บภาพหน้าจอจริงของทั้งเก้าหน้าจอ (ตารางที่ 3.15) สำหรับบทที่ 4
//
// ภาพถูกเก็บที่ Documents/assets/screens/ แล้วอ้างเป็นรูปที่ 4.x ในรูปเล่ม
// ไฟล์นี้สร้างข้อมูลที่จำเป็นเองก่อนถ่าย เพื่อให้ภาพไม่ใช่หน้าจอว่างเปล่า
// ---------------------------------------------------------------------
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, addToCart, sellOne, apiAs, STOCKED_SKU } = require('./helpers');

const DIR = path.join(__dirname, '..', '..', '..', 'Documents', 'assets', 'screens');
// ถ่ายเท่าที่เห็นบนจอจริง ไม่ใช่ทั้งหน้าที่เลื่อนยาว เพื่อให้ภาพลงในหน้ากระดาษได้พอดี
const shot = (page, name) => page.screenshot({ path: path.join(DIR, `${name}.png`) });

test.describe('ภาพหน้าจอประกอบบทที่ 4', () => {
  test('เตรียมข้อมูล: ขายหลายรายการค้างไว้ในคิว', async ({ page }) => {
    // ขายสินค้าต่างชนิดกัน เพื่อให้ภาพหน้าคิวใกล้เคียงการใช้งานจริงของร้าน
    await login(page, 'sales');
    await sellOne(page, { search: STOCKED_SKU, qty: 2 });
    await sellOne(page, { search: 'ปูน' });
    await sellOne(page, { search: 'ท่อ' });
    await sellOne(page, { search: 'สายไฟ' });
  });

  test('หน้าจอ 1 เข้าสู่ระบบ', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible();
    await shot(page, '01-login');
  });

  test('หน้าจอ 2 ขายหน้าร้าน และหน้าจอรับชำระด้วยรหัส QR', async ({ page }) => {
    await login(page, 'sales');
    await page.goto('/pos');
    await addToCart(page, STOCKED_SKU);
    await page.locator('td.qty input').first().fill('2');
    await addToCart(page, 'เหล็ก');
    await expect(page.locator('.total b')).not.toHaveText('0.00 ฿');
    await shot(page, '02-pos');

    await page.getByRole('button', { name: 'แสดงรหัส QR เพื่อรับชำระ' }).click();
    await page.locator('.qrbox img').waitFor();
    await shot(page, '03-pos-qr');
  });

  test('หน้าจอ 3 คิวรอจ่ายสินค้า (รับข้อมูลสดขณะถ่าย)', async ({ browser }) => {
    // เปิดหน้าคิวค้างไว้ แล้วขายจากอีกเครื่องหนึ่ง เพื่อให้ภาพแสดงสถานะ "รับข้อมูลสดจากหน้าร้าน" จริง
    const warehouse = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const sales = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const queuePage = await warehouse.newPage();
    const posPage = await sales.newPage();

    await login(queuePage, 'warehouse');
    await queuePage.goto('/queue');
    await queuePage.locator('.qcard').first().waitFor();

    await login(posPage, 'sales');
    const orderNo = await sellOne(posPage, { search: 'ข้องอ' });
    await queuePage.getByText(orderNo).waitFor({ timeout: 5000 });
    await expect(queuePage.locator('main').locator('..').getByText('รับข้อมูลสดจากหน้าร้าน')).toBeVisible();

    await shot(queuePage, '04-queue');
    await warehouse.close();
    await sales.close();
  });

  test('หน้าจอ 4 ยืนยันจ่ายสินค้า', async ({ page }) => {
    // ขายใบใหม่ด้วยสินค้าที่มีของในคลัง เพื่อให้หน้าจ่ายแสดงปุ่มยืนยัน ไม่ใช่คำเตือนสต็อกไม่พอ
    await login(page, 'sales');
    const orderNo = await sellOne(page, { search: STOCKED_SKU });
    await login(page, 'warehouse');
    await page.goto('/queue');
    await page.getByText(orderNo).click();
    await expect(page.getByRole('button', { name: 'ยืนยันจ่ายสินค้า' })).toBeVisible();
    await shot(page, '05-dispatch');

    // ขั้นยืนยันซ้ำ — หลักฐานของหัวข้อ 3.9.1 ข้อสาม
    await page.getByRole('button', { name: 'ยืนยันจ่ายสินค้า' }).click();
    await expect(page.locator('.confirm-box')).toBeVisible();
    await shot(page, '06-dispatch-confirm');
  });

  test('หน้าจอ 5 และ 6 แดชบอร์ดปฏิบัติการและระดับบริหาร', async ({ page }) => {
    await login(page, 'manager');
    // ผู้จัดการตั้งจุดสั่งซื้อเพิ่มของสินค้าที่ขายไปให้สูงกว่ายอดคงเหลือ ผ่านเส้นทางเดียวกับหน้าจัดการสินค้า (UC-02)
    // ระบบจึงสร้างการแจ้งเตือนเอง (UC-11) และกล่องต้องดูแลวันนี้มีเรื่องจริงให้แสดง (UC-08 ข้อ 3)
    const list = await apiAs(page, 'GET', `/products?q=${STOCKED_SKU}&all=1`);
    const product = list.body.products[0];
    const set = await apiAs(page, 'PUT', `/products/${product.product_id}`, { reorderPoint: product.stock_qty + 50 });
    expect(set.status).toBe(200);
    // พนักงานคลังจ่ายคำสั่งซื้อที่มีสินค้านั้นหนึ่งใบ — สต็อกเปลี่ยน ระบบจึงสร้างการแจ้งเตือนเอง (UC-07 → UC-11)
    await login(page, 'warehouse');
    const q = await apiAs(page, 'GET', '/queue');
    const target = q.body.queue.find((o) => o.items.some((i) => i.name === product.name));
    expect((await apiAs(page, 'POST', `/orders/${target.order_id}/dispatch`)).status).toBe(200);
    await login(page, 'manager');
    await page.goto('/dashboard');
    await page.locator('.stats').waitFor();
    await page.locator('.att').nth(1).waitFor();
    await page.locator('.count').waitFor();
    await shot(page, '07-dashboard-ops');

    await page.goto('/executive');
    await page.locator('.card').first().waitFor();
    await page.waitForTimeout(500);
    await shot(page, '08-dashboard-exec');
  });

  test('หน้าจอ 7 จัดการข้อมูลสินค้า', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/products');
    await page.locator('tbody tr').first().waitFor();
    await shot(page, '09-products');
  });

  test('หน้าจอ 8 การแจ้งเตือน', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/notifications');
    await page.locator('main').waitFor();
    await page.waitForTimeout(300);
    await shot(page, '10-notifications');
  });

  test('หน้าจอ 9 ประวัติการทำรายการ', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/audit-logs');
    await page.locator('tbody tr').first().waitFor();
    await shot(page, '11-audit-logs');
  });

  test('หน้าจอคิวบนอุปกรณ์เคลื่อนที่ (กว้าง 390 พิกเซล)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await login(page, 'warehouse');
    await page.goto('/queue');
    await page.locator('.qcard').first().waitFor();
    await shot(page, '12-queue-mobile');

    // ไม่มีการเลื่อนแนวนอนของทั้งหน้า (NFR-03)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await context.close();
  });
});
