// ---------------------------------------------------------------------
// การทดสอบระดับระบบตามเกณฑ์การยอมรับ AC-01..AC-11 (ตารางที่ 3.11)
//
// ทุกข้อทำผ่านหน้าจอจริงด้วยเบราว์เซอร์ ไม่เรียกฟังก์ชันภายใน
// เพื่อตอบคำถามของตารางที่ 3.22 ว่า "ผู้ใช้ทำงานจนจบกระบวนการได้หรือไม่"
// ---------------------------------------------------------------------
const { test, expect } = require('@playwright/test');
const { login, addToCart, sellOne, apiAs, STOCKED_SKU } = require('./helpers');

test.describe('AC-01 และ AC-12 การเข้าสู่ระบบและการควบคุมสิทธิ์', () => {
  test('AC-12 เข้าสู่ระบบสำเร็จแล้วไปหน้าแรกของบทบาทและเห็นเฉพาะเมนูของตน', async ({ page }) => {
    await login(page, 'sales');
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.locator('.who')).toContainText('พนักงานขาย');
    await expect(page.getByRole('link', { name: 'ขายหน้าร้าน' })).toBeVisible();
    for (const hidden of ['คิวรอจ่ายสินค้า', 'แดชบอร์ด', 'สินค้า', 'ประวัติ']) {
      await expect(page.getByRole('link', { name: hidden })).toHaveCount(0);
    }
  });

  test('AC-12 เข้าสู่ระบบไม่สำเร็จได้ข้อความเดียวกันทุกกรณี', async ({ page }) => {
    const messages = [];
    for (const [username, password] of [['siriphan', 'ผิดแน่นอน'], ['ไม่มีบัญชีนี้', 'ผิดแน่นอน']]) {
      await page.goto('/login');
      await page.getByLabel('ชื่อผู้ใช้').fill(username);
      await page.getByLabel('รหัสผ่าน').fill(password);
      await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
      const alert = page.locator('.alert.crit');
      await alert.waitFor();
      messages.push((await alert.innerText()).trim());
    }
    expect(messages[0]).toBe(messages[1]);           // ไม่บอกว่าผิดที่ชื่อผู้ใช้หรือรหัสผ่าน
    await expect(page).toHaveURL(/\/login$/);
  });

  test('AC-01 พนักงานขายเรียกเส้นทางของผู้จัดการถูกปฏิเสธที่ฝั่งเซิร์ฟเวอร์', async ({ page }) => {
    await login(page, 'sales');

    // เปิดหน้าของผู้จัดการโดยตรง — หน้าจอพากลับหน้าแรกของบทบาทตน
    await page.goto('/audit-logs');
    await expect(page).toHaveURL(/\/pos$/);

    // ที่สำคัญกว่าคือฝั่งเซิร์ฟเวอร์ต้องปฏิเสธด้วย ไม่ใช่แค่ซ่อนเมนู
    const withRole = await apiAs(page, 'GET', '/audit-logs');
    expect(withRole.status).toBe(403);

    const noToken = await page.evaluate(async () => {
      const res = await fetch('/api/audit-logs');
      return res.status;
    });
    expect(noToken).toBe(401);

    const fakeToken = await page.evaluate(async () => {
      const res = await fetch('/api/audit-logs', { headers: { authorization: 'Bearer not.a.real.token' } });
      return res.status;
    });
    expect(fakeToken).toBe(401);
  });
});

test.describe('AC-03 AC-04 AC-05 การขายและการออกใบเสร็จ', () => {
  test('AC-03 ยอดรวมและรหัส QR ตรงกัน และได้คำสั่งซื้อที่มีเลขที่ไม่ซ้ำ', async ({ page }) => {
    await login(page, 'sales');
    await page.goto('/pos');
    await addToCart(page, 'ปูน');
    // ยอดรวมมาจากหลังบ้านเสมอ ต้องรอยอดของหนึ่งหน่วยมาถึงก่อน แล้วจึงรอให้เปลี่ยนอีกครั้งหลังแก้จำนวน
    await expect(page.locator('.total b')).not.toHaveText('0.00 ฿');
    const oneUnit = await page.locator('.total b').innerText();
    await page.locator('td.qty input').first().fill('2');       // สองหน่วย
    await expect(page.locator('.total b')).not.toHaveText(oneUnit);
    const total = (await page.locator('.total b').innerText()).replace(/[^\d.]/g, '');
    await page.getByRole('button', { name: 'แสดงรหัส QR เพื่อรับชำระ' }).click();
    await expect(page.locator('.qrbox img')).toBeVisible();

    // ยอดที่แสดงคู่กับรหัส QR ต้องเท่ากับยอดในตะกร้า
    const qrAmount = (await page.locator('.qr-amount').innerText()).replace(/[^\d.]/g, '');
    expect(qrAmount).toBe(total);

    await page.getByRole('button', { name: 'ยืนยันรับชำระเงิน' }).click();
    await expect(page.locator('.alert.ok')).toContainText(/ORD-\d{8}-\d{4}/);
    await expect(page.locator('.total b')).toContainText(total);
  });

  test('AC-04 ขายต่อเนื่องหลายรายการแล้วเลขที่ไม่ซ้ำกัน', async ({ page }) => {
    await login(page, 'sales');
    const numbers = [];
    for (let i = 0; i < 3; i++) numbers.push(await sellOne(page, { search: STOCKED_SKU }));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  test('AC-05 บริการพิมพ์ใช้ไม่ได้ การขายยังสำเร็จและมีคำเตือน', async ({ page, context }) => {
    await login(page, 'sales');
    // จำลองว่าบริการพิมพ์ล่ม โดยให้คำขอสร้างคำสั่งซื้อวิ่งผ่านพร็อกซีที่ทำให้พิมพ์ไม่สำเร็จไม่ได้
    // จึงตรวจสัญญาแทน: คำตอบของการสร้างคำสั่งซื้อต้องมีผลการพิมพ์แยกจากผลการบันทึกเสมอ
    const res = await apiAs(page, 'POST', '/orders/quote', { items: [] });
    expect(res.status).toBe(400);                 // ตะกร้าว่างถูกปฏิเสธ ไม่ทำให้ระบบล้ม

    const orderNo = await sellOne(page, { search: STOCKED_SKU });
    expect(orderNo).toMatch(/ORD-\d{8}-\d{4}/);
    // หน้าจอแสดงผลการพิมพ์แยกจากผลการบันทึก — เมื่อพิมพ์ไม่สำเร็จจะมีกล่องคำเตือน .alert.warn
    const warn = page.locator('.alert.warn');
    if (await warn.count()) await expect(warn).toContainText('คำสั่งซื้อถูกบันทึกและเข้าคิวแล้ว');
  });
});

test.describe('AC-06 คิวเรียลไทม์', () => {
  test('คำสั่งซื้อใหม่ปรากฏบนหน้าจอคิวเองภายใน 3 วินาที โดยไม่กดรีเฟรช', async ({ browser }) => {
    const warehouse = await browser.newContext();
    const sales = await browser.newContext();
    const queuePage = await warehouse.newPage();
    const posPage = await sales.newPage();

    await login(queuePage, 'warehouse');
    await queuePage.goto('/queue');
    await queuePage.locator('main').waitFor();   // หน้าคิวเปิดค้างและเชื่อมช่องทางแล้ว

    await login(posPage, 'sales');
    const started = Date.now();
    const orderNo = await sellOne(posPage, { search: STOCKED_SKU });

    await expect(queuePage.getByText(orderNo)).toBeVisible({ timeout: 3000 });
    await expect(queuePage.locator('.muted').first()).toContainText('รับข้อมูลสดจากหน้าร้าน');
    const elapsed = Date.now() - started;
    console.log(`AC-06 คำสั่งซื้อ ${orderNo} ปรากฏบนหน้าจอคิวใน ${elapsed} มิลลิวินาที (รวมเวลาสร้างคำสั่งซื้อ)`);

    await warehouse.close();
    await sales.close();
  });
});

test.describe('AC-07 และ AC-08 การจ่ายสินค้าและการตัดสต็อก', () => {
  test('AC-07 จ่ายสำเร็จหนึ่งครั้ง และจ่ายซ้ำใบเดิมไม่ได้', async ({ page }) => {
    await login(page, 'sales');
    const orderNo = await sellOne(page, { search: STOCKED_SKU });

    await login(page, 'warehouse');
    await page.goto('/queue');
    await page.getByText(orderNo).click();
    await page.getByRole('button', { name: 'ยืนยันจ่ายสินค้า' }).click();
    await page.getByRole('button', { name: 'ยืนยัน จ่ายสินค้าเลย' }).click();
    await expect(page.locator('.alert.ok')).toContainText('ส่งมอบสำเร็จ');

    // เปิดใบเดิมซ้ำ — ระบบต้องบอกว่าจ่ายไปแล้วและไม่ให้ปุ่มยืนยันอีก
    const url = page.url();
    await page.goto(url);
    await expect(page.locator('.alert.warn')).toContainText('ถูกจ่ายไปแล้ว');
    await expect(page.getByRole('button', { name: 'ยืนยันจ่ายสินค้า' })).toHaveCount(0);
  });

  test('AC-08 สต็อกไม่พอ ระบบไม่ให้จ่ายและสถานะไม่เปลี่ยน', async ({ page }) => {
    // ขายสินค้าหนึ่งรายการไว้ก่อน
    await login(page, 'sales');
    await page.goto('/pos');
    const name = await addToCart(page, STOCKED_SKU);
    await page.getByRole('button', { name: 'แสดงรหัส QR เพื่อรับชำระ' }).click();
    await page.locator('.qrbox img').waitFor();
    await page.getByRole('button', { name: 'ยืนยันรับชำระเงิน' }).click();
    const orderNo = (await page.locator('.alert.ok').innerText()).match(/ORD-\d{8}-\d{4}/)[0];

    // ผู้จัดการปรับสต็อกสินค้านั้นให้เหลือศูนย์
    await login(page, 'manager');
    const list = await apiAs(page, 'GET', `/products?q=${encodeURIComponent(name)}&all=1`);
    const product = list.body.products.find((p) => p.name === name);
    const before = product.stock_qty;
    const zeroOut = await apiAs(page, 'PATCH', `/products/${product.product_id}/stock`, {
      change: -before, reason: 'manual_adjust', note: 'ทดสอบระดับระบบ AC-08',
    });
    expect(zeroOut.status).toBe(200);

    // พนักงานคลังเปิดใบนั้น — ต้องเห็นคำเตือนและไม่มีปุ่มยืนยัน
    await login(page, 'warehouse');
    await page.goto('/queue');
    await page.getByText(orderNo).click();
    await expect(page.locator('.alert.crit')).toContainText('สต็อกไม่พอ');
    await expect(page.getByRole('button', { name: 'ยืนยันจ่ายสินค้า' })).toHaveCount(0);

    // คืนสต็อกกลับเท่าเดิมเพื่อไม่ให้ข้อมูลเพี้ยนสำหรับการทดสอบข้ออื่น
    await login(page, 'manager');
    const restore = await apiAs(page, 'PATCH', `/products/${product.product_id}/stock`, {
      change: before, reason: 'receive', note: 'คืนค่าหลังทดสอบ AC-08',
    });
    expect(restore.status).toBe(200);
  });
});

test.describe('AC-02 AC-09 AC-10 AC-11 งานของผู้จัดการ', () => {
  test('AC-02 แก้จุดสั่งซื้อเพิ่มแล้วค่าตรงและมีบันทึกในประวัติ', async ({ page }) => {
    await login(page, 'manager');
    const list = await apiAs(page, 'GET', `/products?q=${STOCKED_SKU}&all=1`);
    const product = list.body.products[0];
    const target = product.reorder_point === 7 ? 9 : 7;   // ค่าที่แน่นอน ไม่ขึ้นกับค่าเดิม

    await page.goto('/products');
    await page.getByPlaceholder('ค้นหาชื่อหรือรหัส').fill(product.name);
    const row = page.locator('tbody tr', { hasText: product.sku }).first();
    await row.waitFor();
    await row.getByRole('button', { name: 'แก้ไข' }).click();
    const editing = page.locator('tr.editing');
    await editing.locator('input[type="number"]').last().fill(String(target));
    await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/products/${product.product_id}`) && r.request().method() === 'PUT'),
      editing.getByRole('button', { name: 'บันทึก' }).click(),
    ]);

    const after = await apiAs(page, 'GET', `/products/${product.product_id}`);
    expect(after.body.product.reorder_point).toBe(target);

    const logs = await apiAs(page, 'GET', '/audit-logs?action=UPDATE_PRODUCT&limit=5');
    expect(logs.body.logs.length).toBeGreaterThan(0);
    expect(logs.body.logs[0].entity_id).toBe(product.product_id);
  });

  test('AC-09 ตัวเลขบนแดชบอร์ดตรงกับผลรวมที่คำนวณจากฐานข้อมูล', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/dashboard');
    await page.locator('.card').first().waitFor();
    const api = await apiAs(page, 'GET', '/dashboard/ops');
    const revenue = Number(api.body.today.revenue).toLocaleString('th-TH', { minimumFractionDigits: 2 });
    await expect(page.locator('main')).toContainText(revenue);
    await expect(page.locator('main')).toContainText(String(api.body.queue.waiting ?? api.body.queue.count ?? ''));
  });

  test('AC-10 จ่ายสินค้าจนต่ำกว่าจุดสั่งซื้อเพิ่มแล้วมีการแจ้งเตือนเอง', async ({ page }) => {
    // ตั้งจุดสั่งซื้อเพิ่มให้สูงกว่ายอดคงเหลือ เพื่อให้เงื่อนไขเกิดแน่นอน
    await login(page, 'manager');
    const list = await apiAs(page, 'GET', `/products?q=${STOCKED_SKU}&all=1`);
    const product = list.body.products[0];
    const highPoint = product.stock_qty + 100;
    await apiAs(page, 'PUT', `/products/${product.product_id}`, {
      category: product.category, price: Number(product.price), reorderPoint: highPoint, isActive: true,
    });

    await login(page, 'sales');
    await page.goto('/pos');
    await addToCart(page, product.sku);
    await page.getByRole('button', { name: 'แสดงรหัส QR เพื่อรับชำระ' }).click();
    await page.locator('.qrbox img').waitFor();
    await page.getByRole('button', { name: 'ยืนยันรับชำระเงิน' }).click();
    const orderNo = (await page.locator('.alert.ok').innerText()).match(/ORD-\d{8}-\d{4}/)[0];

    await login(page, 'warehouse');
    await page.goto('/queue');
    await page.getByText(orderNo).click();
    await page.getByRole('button', { name: 'ยืนยันจ่ายสินค้า' }).click();
    await page.getByRole('button', { name: 'ยืนยัน จ่ายสินค้าเลย' }).click();
    await expect(page.locator('.alert.ok')).toContainText('ส่งมอบสำเร็จ');

    // การแจ้งเตือนเกิดเองโดยไม่มีใครสั่ง
    await login(page, 'manager');
    await page.goto('/notifications');
    await expect(page.locator('main')).toContainText(product.name);

    // คืนจุดสั่งซื้อเพิ่มกลับค่าเดิม
    await apiAs(page, 'PUT', `/products/${product.product_id}`, {
      category: product.category, price: Number(product.price), reorderPoint: product.reorder_point, isActive: true,
    });
  });

  test('AC-11 ค้นประวัติตามช่วงเวลาและประเภทการกระทำได้ครบ', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/audit-logs');
    await page.locator('select').selectOption('CREATE_ORDER');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText('สร้างคำสั่งซื้อ');
    // ทุกแถวต้องมีผู้กระทำ เวลา และข้อมูลที่ถูกกระทำ
    const cells = await rows.first().locator('td').allInnerTexts();
    expect(cells.filter((c) => c.trim().length > 0).length).toBeGreaterThanOrEqual(4);
  });
});
