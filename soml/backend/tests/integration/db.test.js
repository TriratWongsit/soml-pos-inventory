// ส่วนตั้งค่าการเชื่อมต่อฐานข้อมูล                              [ตารางที่ 3.14 แถว 2]
const { pool, withTransaction, database } = require('../../config/db');

afterAll(() => pool.end());

test('เมื่อรันทดสอบ ต้องต่อฐานทดสอบ ไม่ใช่ฐานใช้งาน', async () => {
  expect(database).toBe('soml_new_test');
  const [[row]] = await pool.query('SELECT DATABASE() AS db');
  expect(row.db).toBe('soml_new_test');
});

test('DECIMAL กลับมาเป็นตัวเลข ไม่ใช่สตริง เพื่อให้คำนวณยอดได้', async () => {
  const [[row]] = await pool.query('SELECT price FROM products WHERE sku = ?', ['100001']);
  expect(typeof row.price).toBe('number');
  expect(row.price).toBe(130);
});

test('withTransaction: สำเร็จแล้ว commit จริง', async () => {
  const before = await countMovements();
  await withTransaction(async (conn) => {
    await conn.query(
      "INSERT INTO stock_movements (product_id, change_qty, balance_after, reason, created_by) VALUES (1, 1, 13, 'receive', 4)"
    );
  });
  expect(await countMovements()).toBe(before + 1);
});

test('withTransaction: โยนข้อผิดพลาดแล้ว rollback ทั้งก้อน ไม่มีแถวครึ่ง ๆ กลาง ๆ', async () => {
  const before = await countMovements();
  await expect(
    withTransaction(async (conn) => {
      await conn.query(
        "INSERT INTO stock_movements (product_id, change_qty, balance_after, reason, created_by) VALUES (1, 1, 14, 'receive', 4)"
      );
      throw new Error('จำลองความล้มเหลวกลางธุรกรรม');
    })
  ).rejects.toThrow('จำลอง');
  expect(await countMovements()).toBe(before);
});

async function countMovements() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM stock_movements');
  return row.n;
}
