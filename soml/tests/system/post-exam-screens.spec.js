// ---------------------------------------------------------------------
// ภาพหน้าจอของงานที่เพิ่มหลังสอบ (16 ต.ค. 2569) สำหรับภาคผนวก ซ ของรูปเล่ม
//
// รันกับฐานข้อมูลที่ล้างใหม่เท่านั้น ภาพจะได้มีเฉพาะรายการตัวอย่างที่ไฟล์นี้สร้าง:
//   SYSTEM_BASE_URL=http://localhost:8089 npx playwright test post-exam-screens
// ภาพเก็บที่ Documents/assets/screens-post/
// ---------------------------------------------------------------------
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, addToCart, sellOne, STOCKED_SKU } = require('./helpers');

const DIR = path.join(__dirname, '..', '..', '..', 'Documents', 'assets', 'screens-post');
const shot = (page, name) => page.screenshot({ path: path.join(DIR, `${name}.png`) });

test.describe.configure({ mode: 'serial' });

test.describe('ภาพหน้าจองานหลังสอบ', () => {
  test('ขายด้วยเงินสด: รับเงินแล้วเห็นเงินทอน', async ({ page }) => {
    await login(page, 'sales');
    await sellOne(page, { search: 'ปูน' });                       // ใบแรกจ่ายด้วย QR ให้คิวมีป้ายครบทุกแบบ
    await page.goto('/pos');
    await addToCart(page, STOCKED_SKU);
    await page.locator('td.qty input').first().fill('3');
    await page.getByRole('button', { name: 'เงินสด', exact: true }).click();
    await page.getByLabel('รับเงินมา (บาท)').fill('500');
    await expect(page.locator('.change-box')).toContainText('ทอน');
    await shot(page, 'h1-pos-cash');
    await page.getByRole('button', { name: 'ยืนยันรับเงินสด' }).click();
    await expect(page.locator('.alert.ok')).toContainText(/ORD-\d{8}-\d{4}/);
  });

  test('ขายเชื่อ: เลือกลูกค้าแล้วยืนยัน', async ({ page }) => {
    await login(page, 'sales');
    await page.goto('/pos');
    await addToCart(page, STOCKED_SKU);
    await page.locator('td.qty input').first().fill('10');
    await page.getByRole('button', { name: 'ขายเชื่อ (บิลเซ็น)' }).click();
    await page.getByRole('button', { name: '+ เพิ่มลูกค้าใหม่' }).click();
    await page.getByPlaceholder('ชื่อลูกค้า / ร้าน / ผู้รับเหมา').fill('ผู้รับเหมาตัวอย่าง ก');
    await page.getByRole('button', { name: 'บันทึกลูกค้า' }).click();
    await page.getByRole('button', { name: 'ขายเชื่อให้ลูกค้าคนนี้' }).click();
    await shot(page, 'h2-pos-credit');
    await page.getByRole('button', { name: 'ยืนยันขายเชื่อ' }).click();
    await expect(page.locator('.alert.warn')).toContainText('พิมพ์ 2 ใบ');
  });

  test('คิวคลังแสดงสถานะการชำระของแต่ละใบ', async ({ page }) => {
    await login(page, 'warehouse');
    await page.goto('/queue');
    await expect(page.locator('.badge.pay-credit')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await shot(page, 'h3-queue-badges');
  });

  test('ลูกหนี้ขายเชื่อ และรายงานการขายรายวัน', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/credit');
    await expect(page.locator('.card', { hasText: 'ผู้รับเหมาตัวอย่าง ก' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await shot(page, 'h4-credit');
    await page.goto('/reports/daily');
    await expect(page.locator('.report-sum')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await shot(page, 'h5-report-daily');
  });
});
