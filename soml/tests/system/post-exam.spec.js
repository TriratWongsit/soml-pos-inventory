// ---------------------------------------------------------------------
// ทดสอบระดับระบบของงานแก้ตามคอมเมนต์กรรมการสอบ (16 ต.ค. 2569)
//   K-1  สองเครื่องจ่ายสินค้าตัวเดียวกันพร้อมกัน สต็อก 1 → สำเร็จใบเดียว อีกใบสต็อกไม่พอ หน้าจอเห็นตรงกัน
//   K-6  ขายเชื่อ: เลือกลูกค้า ยืนยัน → เข้าคิวพร้อมป้ายขายเชื่อ (K-9) → ผู้จัดการรับชำระ
//   K-10 รายงานการขายรายวัน: ยอดตรงกับหลังบ้าน และมีปุ่มพิมพ์
// ---------------------------------------------------------------------
const { test, expect } = require('@playwright/test');
const { login, addToCart, apiAs, STOCKED_SKU } = require('./helpers');

test.describe('งานแก้หลังสอบ', () => {
  test('K-1 สองเครื่องกดจ่ายสินค้าตัวเดียวกันพร้อมกัน สต็อก 1: สำเร็จใบเดียว สต็อกเหลือ 0', async ({ browser }) => {
    const open = async (role) => { const c = await browser.newContext(); const p = await c.newPage(); await login(p, role); return p; };
    const mgr = await open('manager');
    const sales = await open('sales');
    const w1 = await open('warehouse');
    const w2 = await open('manager');
    const prod = (await apiAs(mgr, 'GET', '/products?q=100003&all=1')).body.products[0];
    const original = prod.stock_qty;
    await apiAs(mgr, 'PATCH', `/products/${prod.product_id}/stock`, { change: 1 - original, reason: 'manual_adjust', note: 'ทดสอบ K-1' });
    const o1 = (await apiAs(sales, 'POST', '/orders', { items: [{ productId: prod.product_id, qty: 1 }] })).body.order;
    const o2 = (await apiAs(sales, 'POST', '/orders', { items: [{ productId: prod.product_id, qty: 1 }] })).body.order;
    try {
      await w1.goto(`/dispatch/${o1.orderId}`);
      await w2.goto(`/dispatch/${o2.orderId}`);
      for (const p of [w1, w2]) await p.getByRole('button', { name: 'ยืนยันจ่ายสินค้า' }).click();
      await Promise.all([w1, w2].map((p) => p.getByRole('button', { name: 'ยืนยัน จ่ายสินค้าเลย' }).click()));
      const texts = await Promise.all([w1, w2].map((p) => p.locator('.alert').first().innerText()));
      expect(texts.filter((t) => t.includes('ส่งมอบสำเร็จ'))).toHaveLength(1);
      expect(texts.filter((t) => t.includes('ไม่พอ'))).toHaveLength(1);
      const after = (await apiAs(mgr, 'GET', `/products/${prod.product_id}`)).body;
      expect(after.product?.stock_qty ?? after.stock_qty).toBe(0);
    } finally {
      const now = (await apiAs(mgr, 'GET', `/products/${prod.product_id}`)).body;
      const qty = now.product?.stock_qty ?? now.stock_qty;
      if (qty !== original) await apiAs(mgr, 'PATCH', `/products/${prod.product_id}/stock`, { change: original - qty, reason: 'manual_adjust', note: 'คืนยอดหลังทดสอบ K-1' });
    }
  });

  test('K-6 K-9 ขายเชื่อ: เพิ่มลูกค้า ยืนยัน → คิวคลังขึ้นป้ายขายเชื่อ → ผู้จัดการรับชำระครบ', async ({ browser }) => {
    const cs = await browser.newContext(); const page = await cs.newPage();
    const cw = await browser.newContext(); const queue = await cw.newPage();
    await login(queue, 'warehouse');
    await queue.goto('/queue');
    await login(page, 'sales');
    await page.goto('/pos');
    await addToCart(page, STOCKED_SKU);
    await page.getByRole('button', { name: 'ขายเชื่อ (บิลเซ็น)' }).click();
    const name = `ผู้รับเหมา ทดสอบระบบ ${Date.now() % 100000}`;
    await page.getByRole('button', { name: '+ เพิ่มลูกค้าใหม่' }).click();
    await page.getByPlaceholder('ชื่อลูกค้า / ร้าน / ผู้รับเหมา').fill(name);
    await page.getByRole('button', { name: 'บันทึกลูกค้า' }).click();
    await page.getByRole('button', { name: 'ขายเชื่อให้ลูกค้าคนนี้' }).click();
    await page.getByRole('button', { name: 'ยืนยันขายเชื่อ' }).click();
    await expect(page.locator('.alert.ok')).toContainText(/ORD-\d{8}-\d{4}/);
    await expect(page.locator('.alert.warn')).toContainText('พิมพ์ 2 ใบ');
    const orderNo = (await page.locator('.alert.ok').innerText()).match(/ORD-\d{8}-\d{4}/)[0];

    const card = queue.locator('.qcard', { hasText: orderNo });
    await expect(card.locator('.badge.pay-credit')).toContainText(name, { timeout: 3000 });   // ขึ้นเองไม่ต้องรีเฟรช

    await login(page, 'manager');
    await page.goto('/credit');
    const row = page.locator('tr', { hasText: orderNo });
    await row.getByRole('button', { name: 'รับชำระ' }).click();
    await page.getByRole('button', { name: 'ยืนยันรับเงิน' }).click();
    await expect(page.locator('.alert.ok')).toContainText('ชำระครบแล้ว');
  });

  test('เงินสด: รับเงินไม่พอกดยืนยันไม่ได้ · รับพอแล้วเห็นเงินทอน · คิวขึ้นป้ายจ่ายแล้ว (เงินสด)', async ({ page }) => {
    await login(page, 'sales');
    await page.goto('/pos');
    await addToCart(page, STOCKED_SKU);
    await page.getByRole('button', { name: 'เงินสด', exact: true }).click();
    const total = Number((await page.locator('.total b').innerText()).replace(/[^\d.]/g, ''));
    await page.getByLabel('รับเงินมา (บาท)').fill(String(Math.max(0, total - 1)));
    await expect(page.getByRole('button', { name: 'ยืนยันรับเงินสด' })).toBeDisabled();
    await page.getByLabel('รับเงินมา (บาท)').fill('1000');
    await expect(page.locator('.change-box')).toContainText((1000 - total).toLocaleString('th-TH', { minimumFractionDigits: 2 }));
    await page.getByRole('button', { name: 'ยืนยันรับเงินสด' }).click();
    const orderNo = (await page.locator('.alert.ok').innerText()).match(/ORD-\d{8}-\d{4}/)[0];
    await expect(page.locator('.change-box')).toContainText('ทอน');
    await login(page, 'warehouse');
    await page.goto('/queue');
    await expect(page.locator('.qcard', { hasText: orderNo }).locator('.badge.pay-qr')).toContainText('เงินสด');
  });

  test('K-10 รายงานการขายรายวัน: ยอดตรงกับหลังบ้าน มีปุ่มพิมพ์และ CSV', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/reports/daily');
    const api = await apiAs(page, 'GET', '/reports/daily');
    const revenue = Number(api.body.summary.revenue).toLocaleString('th-TH', { minimumFractionDigits: 2 });
    await expect(page.locator('.report-sum')).toContainText(revenue);
    await expect(page.getByRole('button', { name: 'พิมพ์รายงาน' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ดาวน์โหลด CSV' })).toBeVisible();
  });
});
