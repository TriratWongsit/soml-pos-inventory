-- =====================================================================
-- โครงสร้างฐานข้อมูลระบบอำพร OMS
--
-- ที่มา: บทที่ 3 หัวข้อ 3.4.1 — ตารางที่ 3.22 (7 ตาราง) และการตัดสินใจ 4 ข้อใน 3.4.1.3
-- ทุกตารางใช้ InnoDB เพื่อให้ได้ ACID และล็อกระดับแถว (2.1.2, 2.1.3)
--
-- วิธีใช้
--   mysql -u root -p < db/schema/schema.sql          สร้างฐานข้อมูลใช้งาน (soml_new)
--   ฐานทดสอบ (soml_new_test) ถูกสร้างโดยสคริปต์ทดสอบ ซึ่งตัดสองบรรทัดแรกออกแล้วเลือกฐานเอง
--
-- คอลัมน์ที่เล่มไม่ได้พูดถึงแต่เก็บไว้โดยตั้งใจ มีคอมเมนต์ขึ้นต้นว่า "เทคนิค:" พร้อมเหตุผล
-- =====================================================================

CREATE DATABASE IF NOT EXISTS soml_new
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE soml_new;

-- ---------------------------------------------------------------------
-- 1) users — ผู้ใช้งานระบบ                                   [FR-01 · 3.3.1]
-- ---------------------------------------------------------------------
CREATE TABLE users (
  user_id       INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสผู้ใช้ ระบบสร้างให้',
  username      VARCHAR(50)   NOT NULL COMMENT 'ชื่อผู้ใช้สำหรับเข้าสู่ระบบ ซ้ำไม่ได้',
  password_hash VARCHAR(255)  NOT NULL COMMENT 'รหัสผ่านที่ผ่าน bcrypt แล้ว ไม่เก็บรหัสผ่านจริง (2.1.7)',
  full_name     VARCHAR(100)  NOT NULL COMMENT 'เทคนิค: ชื่อ-นามสกุลสำหรับแสดงในประวัติและใบเสร็จ อ่านง่ายกว่า username',
  role          ENUM('sales','warehouse','manager') NOT NULL COMMENT 'บทบาท 3 แบบตาม 3.3.1 ใช้ตัดสินสิทธิ์ทุกเส้นทาง',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE COMMENT 'เทคนิค: ปิดบัญชีแทนการลบ เพราะ audit_logs ยังอ้างถึงผู้ใช้คนนี้ (FR-09)',
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2) products — สินค้า                                        [FR-02 · FR-06 · FR-08]
-- ---------------------------------------------------------------------
CREATE TABLE products (
  product_id    INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสสินค้าภายในระบบ',
  sku           VARCHAR(30)   NOT NULL COMMENT 'รหัสสินค้าที่ร้านใช้เรียกจริง ซ้ำไม่ได้',
  name          VARCHAR(150)  NOT NULL COMMENT 'ชื่อสินค้า',
  category      VARCHAR(50)   NOT NULL COMMENT 'หมวดหมู่ตามที่ร้านจัดสต็อกจริง (ชีตในไฟล์ EV-09) เช่น ปูน เหล็ก สี ประปา — ใช้กรองบนหน้าขาย',
  unit          VARCHAR(20)   NOT NULL COMMENT 'หน่วยนับ เช่น ถุง เส้น ก้อน คิว',
  price         DECIMAL(10,2) NOT NULL COMMENT 'ราคาขายต่อหน่วย ณ ปัจจุบัน — ไม่ใช่ราคาในใบเสร็จเก่า (3.4.1.3 ข้อ 1)',
  stock_qty     INT           NOT NULL DEFAULT 0 COMMENT 'ยอดคงเหลือปัจจุบัน',
  reorder_point INT           NOT NULL DEFAULT 0 COMMENT 'จุดสั่งซื้อเพิ่ม เมื่อ stock_qty ต่ำกว่านี้จะเกิดการแจ้งเตือน (FR-08)',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE COMMENT 'เทคนิค: เลิกขายแทนการลบ เพราะ order_items เก่ายังอ้างถึงสินค้านี้',
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_products_sku (sku),
  -- หน้าขายกรองด้วยหมวดก่อนแล้วค่อยพิมพ์ค้น (ตาราง 3.24)
  KEY idx_products_category (category),
  -- 3.4.1.3 ข้อ 4: แนวป้องกันชั้นสุดท้าย ถ้าตรรกะในโปรแกรมพลาด ฐานข้อมูลปฏิเสธและธุรกรรมทั้งก้อนถูกยกเลิก
  CONSTRAINT chk_products_stock_nonneg CHECK (stock_qty >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2.1) customers — ลูกค้าขายเชื่อ (บิลเซ็น)                    [FR-10 · คอมเมนต์กรรมการ K-6]
-- ลูกค้าหน้าร้านทั่วไปจ่ายด้วย QR ไม่ต้องมีแถวในตารางนี้ เก็บเฉพาะลูกค้าที่ร้านให้ซื้อเชื่อ
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  customer_id   INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสลูกค้า',
  name          VARCHAR(150)  NOT NULL COMMENT 'ชื่อลูกค้าหรือชื่อร้าน/ผู้รับเหมา',
  phone         VARCHAR(20)   NULL COMMENT 'เบอร์โทรติดต่อทวงถาม',
  note          VARCHAR(255)  NULL COMMENT 'หมายเหตุ เช่น ที่อยู่หน้างาน',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE COMMENT 'ยังให้ซื้อเชื่อได้หรือไม่',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  KEY idx_customers_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3) orders — คำสั่งซื้อ                                      [FR-03 · FR-05 · 3.4.2.4]
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  order_id      INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสคำสั่งซื้อภายในระบบ',
  order_no      VARCHAR(20)   NOT NULL COMMENT 'เลขที่ที่พิมพ์บนใบเสร็จ เช่น ORD-20260916-0001 ซ้ำไม่ได้ (UC-04)',
  total_amount  DECIMAL(12,2) NOT NULL COMMENT 'ยอดรวมที่ต้องชำระ ใช้สร้างรหัส QR',
  -- สถานะตามแผนภาพสถานะ 3.4.2.4 — ไม่มีสถานะตะกร้า/รอชำระ (3.4.1.3 ข้อ 3)
  status        ENUM('awaiting_dispatch','picking','delivered','cancelled')
                              NOT NULL DEFAULT 'awaiting_dispatch'
                              COMMENT 'รอจ่ายสินค้า / กำลังจัดของ / ส่งมอบสำเร็จ / ยกเลิก',
  created_by    INT UNSIGNED  NOT NULL COMMENT 'พนักงานขายผู้สร้างคำสั่งซื้อ',
  -- 3.4.1.3 ข้อ 3: NOT NULL แปลว่าคำสั่งซื้อทุกแถวชำระเงินแล้ว จึงไม่ต้องมี created_at แยก
  paid_at       DATETIME      NOT NULL COMMENT 'วันเวลายืนยันรับชำระ = วันเวลาที่แถวนี้เกิด',
  dispatched_by INT UNSIGNED  NULL COMMENT 'พนักงานคลังผู้ยืนยันจ่าย ว่างจนกว่าจะจ่ายของ',
  dispatched_at DATETIME      NULL COMMENT 'วันเวลาจ่ายของ ใช้วัดเวลาคิวค้าง (FR-08)',
  -- K-6 ขายเชื่อ: ใบขายเชื่อเข้าคิวได้ทันทีเหมือนใบที่จ่ายแล้ว paid_at จึงหมายถึงเวลายืนยันการขาย
  payment_method ENUM('promptpay','credit','cash') NOT NULL DEFAULT 'promptpay' COMMENT 'จ่ายด้วย QR ขายเชื่อ (บิลเซ็น) หรือเงินสด (เพิ่มหลังสอบ)',
  cash_received DECIMAL(12,2) NULL COMMENT 'เงินสดที่รับมา ใช้คิดเงินทอนบนใบเสร็จ ว่างถ้าไม่ใช่เงินสด',
  customer_id   INT UNSIGNED  NULL COMMENT 'ลูกค้าขายเชื่อ ว่างถ้าจ่ายด้วย QR',
  settled_at    DATETIME      NULL COMMENT 'วันที่ใบขายเชื่อชำระครบ ว่างถ้ายังค้างหรือจ่าย QR แล้ว',
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_orders_order_no (order_no),
  -- หน้าคิว (ตาราง 3.18 หน้าจอ 3) ค้นด้วยสถานะแล้วเรียงตามเวลาชำระ
  KEY idx_orders_queue (status, paid_at),
  CONSTRAINT fk_orders_created_by    FOREIGN KEY (created_by)    REFERENCES users(user_id),
  CONSTRAINT fk_orders_dispatched_by FOREIGN KEY (dispatched_by) REFERENCES users(user_id),
  CONSTRAINT fk_orders_customer      FOREIGN KEY (customer_id)   REFERENCES customers(customer_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4) order_items — รายการย่อยของคำสั่งซื้อ                    [FR-03 · 3.4.1.3 ข้อ 1]
-- ---------------------------------------------------------------------
CREATE TABLE order_items (
  order_item_id INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสรายการ',
  order_id      INT UNSIGNED  NOT NULL COMMENT 'คำสั่งซื้อที่รายการนี้สังกัด',
  product_id    INT UNSIGNED  NOT NULL COMMENT 'สินค้าที่ถูกสั่ง',
  qty           INT           NOT NULL COMMENT 'จำนวนที่สั่ง',
  -- 3.4.1.3 ข้อ 1: คัดลอกราคาจาก products.price ตอนสร้างคำสั่งซื้อ ราคาเปลี่ยนแล้วใบเสร็จเก่าต้องไม่เปลี่ยนตาม
  unit_price    DECIMAL(10,2) NOT NULL COMMENT 'ราคาต่อหน่วย ณ เวลาขาย',
  PRIMARY KEY (order_item_id),
  KEY idx_items_order (order_id),
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(order_id),
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT chk_items_qty_positive CHECK (qty > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4.1) credit_payments — การรับชำระหนี้ของใบขายเชื่อ           [FR-11 · คอมเมนต์กรรมการ K-6]
-- จ่ายทีละส่วนได้ ยอดค้าง = orders.total_amount - SUM(amount)
-- ---------------------------------------------------------------------
CREATE TABLE credit_payments (
  payment_id    INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสการรับชำระ',
  order_id      INT UNSIGNED  NOT NULL COMMENT 'ใบขายเชื่อที่รับชำระ',
  amount        DECIMAL(12,2) NOT NULL COMMENT 'จำนวนเงินที่รับ',
  method        ENUM('cash','promptpay','transfer') NOT NULL COMMENT 'รับเป็นเงินสด QR หรือโอน',
  received_by   INT UNSIGNED  NOT NULL COMMENT 'ผู้รับเงิน (ผู้จัดการ)',
  received_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note          VARCHAR(255)  NULL,
  PRIMARY KEY (payment_id),
  KEY idx_payments_order (order_id),
  KEY idx_payments_day (received_at),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id)    REFERENCES orders(order_id),
  CONSTRAINT fk_payments_user  FOREIGN KEY (received_by) REFERENCES users(user_id),
  CONSTRAINT chk_payments_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5) stock_movements — การเคลื่อนไหวของสต็อก                  [FR-06 · 3.4.1.3 ข้อ 2 · 2.1.5]
-- ---------------------------------------------------------------------
CREATE TABLE stock_movements (
  movement_id   INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสรายการเคลื่อนไหว เรียงตามลำดับที่เกิด',
  product_id    INT UNSIGNED  NOT NULL COMMENT 'สินค้าที่เคลื่อนไหว',
  order_id      INT UNSIGNED  NULL COMMENT 'คำสั่งซื้อที่ทำให้ตัดสต็อก NULL เมื่อปรับด้วยมือหรือรับของเข้า',
  change_qty    INT           NOT NULL COMMENT 'จำนวนที่เปลี่ยน ค่าลบ = ตัดออก ค่าบวก = รับเข้า',
  -- 3.4.1.3 ข้อ 2: เก็บยอดหลังเปลี่ยนซ้ำโดยตั้งใจ เพื่อไล่ย้อนได้ว่ายอดเริ่มเพี้ยนที่รายการไหน
  balance_after INT           NOT NULL COMMENT 'ยอดคงเหลือหลังรายการนี้',
  reason        ENUM('sale_dispatch','manual_adjust','receive') NOT NULL
                              COMMENT 'สาเหตุสามแบบ: จ่ายตามคำสั่งซื้อ / ปรับด้วยมือ / รับสินค้าเข้า',
  note          VARCHAR(255)  NULL COMMENT 'เหตุผลที่ผู้จัดการพิมพ์ตอนปรับสต็อกด้วยมือ (ตาราง 3.16 โมดูล 2)',
  created_by    INT UNSIGNED  NOT NULL COMMENT 'ผู้ทำรายการ',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่เกิดรายการ ใช้เรียงลำดับเมื่อไล่ย้อน',
  PRIMARY KEY (movement_id),
  KEY idx_movements_product (product_id, created_at),
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT fk_movements_order   FOREIGN KEY (order_id)   REFERENCES orders(order_id),
  CONSTRAINT fk_movements_user    FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6) notifications — การแจ้งเตือนภายในแอป                     [FR-08 · UC-11]
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  notification_id INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'รหัสการแจ้งเตือน',
  type            ENUM('low_stock','queue_delay') NOT NULL COMMENT 'ชนิด 2 แบบตาม FR-08',
  ref_product_id  INT UNSIGNED NULL COMMENT 'สินค้าที่เกี่ยวข้อง มีค่าเฉพาะ low_stock',
  ref_order_id    INT UNSIGNED NULL COMMENT 'คำสั่งซื้อที่เกี่ยวข้อง มีค่าเฉพาะ queue_delay',
  message         VARCHAR(255) NOT NULL COMMENT 'ข้อความที่แสดงบนหน้าจอแจ้งเตือน',
  is_read         BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'ผู้จัดการทำเครื่องหมายอ่านแล้ว (ตาราง 3.16 โมดูล 8)',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่แจ้งเตือน',
  PRIMARY KEY (notification_id),
  KEY idx_notifications_unread (is_read, created_at),
  CONSTRAINT fk_notifications_product FOREIGN KEY (ref_product_id) REFERENCES products(product_id),
  CONSTRAINT fk_notifications_order   FOREIGN KEY (ref_order_id)   REFERENCES orders(order_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7) audit_logs — ประวัติการทำรายการ                          [FR-09 · UC-10 · 2.1.5]
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'รหัสบันทึก ใช้ BIGINT เพราะตารางนี้โตเร็วที่สุด',
  user_id     INT UNSIGNED    NULL COMMENT 'ผู้กระทำ NULL เมื่อระบบทำเอง เช่น สร้างการแจ้งเตือน',
  action      VARCHAR(50)     NOT NULL COMMENT 'ชื่อเหตุการณ์ เช่น LOGIN, CREATE_ORDER, CONFIRM_DISPATCH',
  entity_type VARCHAR(30)     NULL COMMENT 'ชนิดข้อมูลที่ถูกกระทำ เช่น order, product',
  entity_id   INT UNSIGNED    NULL COMMENT 'รหัสของข้อมูลนั้น ไม่ใส่ FK เพราะชี้ได้หลายตาราง',
  ip_address  VARCHAR(45)     NULL COMMENT 'หมายเลขไอพีของผู้ใช้ (45 ตัวอักษรรองรับ IPv6)',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่เกิดเหตุการณ์',
  PRIMARY KEY (log_id),
  KEY idx_audit_time (created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;
