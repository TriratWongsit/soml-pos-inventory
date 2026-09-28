-- ---------------------------------------------------------------------
-- คำสั่งดูข้อมูลในฐานข้อมูลระหว่างเดโม ทีละ Use Case
-- ใช้ตอบคำถาม "UC นี้ใช้ข้อมูลอะไร อยู่ตารางไหนใน ERD" (บทที่ 3 รูปที่ 3.9 ตารางที่ 3.19)
--
-- เปิด:  mysql --default-character-set=utf8mb4 -u root -p soml_new   แล้วคัดลอกทีละคำสั่งไปวาง
--        (ต้องมี --default-character-set=utf8mb4 ไม่งั้นภาษาไทยขึ้นเป็น ???)
-- อ่านอย่างเดียวทั้งไฟล์ ไม่มีคำสั่งใดแก้ข้อมูล
-- ---------------------------------------------------------------------

-- UC-01 เข้าสู่ระบบ: รหัสผ่านเก็บแบบเข้ารหัส ไม่มีใครอ่านรหัสจริงได้ (NFR-01) และทุกการเข้าระบบถูกบันทึก
SELECT user_id, username, full_name, role, is_active, LEFT(password_hash, 20) AS `password_hash_ตัดมาบางส่วน` FROM users;
SELECT l.log_id, u.username, l.action, l.ip_address, l.created_at
  FROM audit_logs l LEFT JOIN users u ON u.user_id = l.user_id
 WHERE l.action = 'LOGIN' ORDER BY l.log_id DESC LIMIT 5;

-- UC-02 จัดการสินค้า: จุดสั่งซื้อเพิ่มที่เพิ่งแก้ตรงกับที่กรอก (AC-02)
SELECT product_id, sku, name, unit, price, stock_qty, reorder_point FROM products WHERE sku = '101017';

-- UC-03 และ UC-04 สร้างคำสั่งซื้อ: ใบเกิดพร้อมเลขที่ไม่ซ้ำ สถานะรอจ่าย และรายการสินค้าพร้อมราคา ณ ตอนขาย
SELECT order_id, order_no, total_amount, status, created_by, paid_at FROM orders ORDER BY order_id DESC LIMIT 3;
SELECT i.order_id, p.sku, p.name, i.qty, i.unit_price, p.price AS `ราคาปัจจุบัน`
  FROM order_items i JOIN products p ON p.product_id = i.product_id
 WHERE i.order_id = (SELECT MAX(order_id) FROM orders);

-- UC-06 ปรับสถานะการจัดของ: สถานะเปลี่ยน และมีประวัติ
SELECT order_no, status FROM orders ORDER BY order_id DESC LIMIT 3;

-- UC-07 ยืนยันจ่ายสินค้า: สถานะเป็น delivered มีผู้จ่ายและเวลา สต็อกลด และมีการเคลื่อนไหวสต็อกหนึ่งแถวต่อสินค้า (AC-07)
SELECT order_no, status, dispatched_by, dispatched_at FROM orders ORDER BY order_id DESC LIMIT 3;
SELECT sku, name, stock_qty, reorder_point FROM products WHERE sku = '101017';
SELECT m.movement_id, p.sku, m.order_id, m.change_qty, m.balance_after, m.reason, m.created_at
  FROM stock_movements m JOIN products p ON p.product_id = m.product_id
 ORDER BY m.movement_id DESC LIMIT 5;

-- UC-11 การแจ้งเตือน: ระบบสร้างเอง ผูกกับสินค้าหรือคำสั่งซื้อ และมีสถานะอ่านแล้ว
SELECT notification_id, type, ref_product_id, ref_order_id, message, is_read, created_at
  FROM notifications ORDER BY notification_id DESC LIMIT 5;

-- UC-08 แดชบอร์ดปฏิบัติการ: ผลรวมจากฐานข้อมูลโดยตรง ต้องตรงกับตัวเลขบนหน้าจอ (AC-09)
SELECT COUNT(*) AS `คำสั่งซื้อวันนี้`, COALESCE(SUM(total_amount), 0) AS `ยอดขายวันนี้`
  FROM orders WHERE status <> 'cancelled' AND DATE(paid_at) = CURDATE();
SELECT COUNT(*) AS `คิวรอจ่าย` FROM orders WHERE status IN ('awaiting_dispatch', 'picking');

-- UC-09 แดชบอร์ดระดับบริหาร: สินค้าขายดี 30 วัน
SELECT p.name, SUM(i.qty) AS `จำนวน`, SUM(i.qty * i.unit_price) AS `ยอดขาย`
  FROM order_items i JOIN orders o ON o.order_id = i.order_id JOIN products p ON p.product_id = i.product_id
 WHERE o.status <> 'cancelled' AND o.paid_at >= CURDATE() - INTERVAL 30 DAY
 GROUP BY p.product_id ORDER BY `ยอดขาย` DESC LIMIT 10;

-- UC-10 ประวัติการทำรายการ: ทุกเหตุการณ์ที่เพิ่งทำ ผู้กระทำ NULL คือระบบทำเอง
SELECT l.log_id, COALESCE(u.username, 'ระบบ') AS `ผู้กระทำ`, l.action, l.entity_type, l.entity_id, l.ip_address, l.created_at
  FROM audit_logs l LEFT JOIN users u ON u.user_id = l.user_id
 ORDER BY l.log_id DESC LIMIT 15;
