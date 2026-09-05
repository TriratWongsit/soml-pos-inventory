-- =====================================================================
-- ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า (SOML)
-- Order Management and Inventory Control System
-- กรณีศึกษา: ร้านวัสดุก่อสร้างอำพรคอนกรีต · โครงงาน SE02
--
-- MySQL 8.0 / InnoDB (รองรับ ACID Transaction ตาม NFR-04)
-- ครอบคลุม FR-01 ถึง FR-09 และ UC-01 ถึง UC-11
-- =====================================================================

CREATE DATABASE IF NOT EXISTS soml
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE soml;

-- ---------------------------------------------------------------------
-- 1) users — ผู้ใช้งานระบบและบทบาท   [FR-01 · UC-01]
-- ---------------------------------------------------------------------
CREATE TABLE users (
  user_id       INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสผู้ใช้งาน',
  username      VARCHAR(50)   NOT NULL                COMMENT 'ชื่อผู้ใช้สำหรับเข้าสู่ระบบ',
  password_hash VARCHAR(255)  NOT NULL                COMMENT 'รหัสผ่านที่ผ่านการเข้ารหัสแบบ bcrypt',
  full_name     VARCHAR(100)  NOT NULL                COMMENT 'ชื่อ-นามสกุลผู้ใช้งาน',
  role          ENUM('sales','warehouse','manager') NOT NULL
                                                     COMMENT 'บทบาท: พนักงานขาย / พนักงานคลังสินค้า / ผู้จัดการ',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE  COMMENT 'สถานะการใช้งานบัญชี',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันเวลาที่สร้างบัญชี',
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role)
) ENGINE=InnoDB COMMENT='ผู้ใช้งานระบบและการควบคุมสิทธิ์ตามบทบาท (RBAC)';

-- ---------------------------------------------------------------------
-- 2) products — ข้อมูลสินค้าหลัก      [FR-02 · UC-02 · RC14]
-- ---------------------------------------------------------------------
CREATE TABLE products (
  product_id    INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสสินค้า',
  sku           VARCHAR(30)   NOT NULL                COMMENT 'รหัสอ้างอิงสินค้าของร้าน',
  name          VARCHAR(150)  NOT NULL                COMMENT 'ชื่อสินค้า',
  unit          VARCHAR(20)   NOT NULL                COMMENT 'หน่วยนับ เช่น ถุง เส้น ก้อน คิว',
  price         DECIMAL(10,2) NOT NULL                COMMENT 'ราคาขายต่อหน่วย (บาท)',
  stock_qty     INT           NOT NULL DEFAULT 0      COMMENT 'จำนวนคงเหลือในคลัง',
  reorder_point INT           NOT NULL DEFAULT 0      COMMENT 'จุดสั่งซื้อเพิ่ม (Reorder Point)',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE   COMMENT 'สถานะการเปิดขาย',
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันเวลาที่แก้ไขล่าสุด',
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_reorder (stock_qty, reorder_point),
  CONSTRAINT chk_products_stock_nonneg CHECK (stock_qty >= 0)
) ENGINE=InnoDB COMMENT='ข้อมูลสินค้าหลักและระดับสต็อก';

-- ---------------------------------------------------------------------
-- 3) orders — คำสั่งซื้อ              [FR-03 · FR-05 · UC-03,04,07 · RC08, RC17]
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  order_id      INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสคำสั่งซื้อ',
  order_no      VARCHAR(20)   NOT NULL                COMMENT 'เลขที่คำสั่งซื้อไม่ซ้ำ เช่น ORD-20690902-0001',
  total_amount  DECIMAL(12,2) NOT NULL                COMMENT 'ยอดรวมที่ต้องชำระ (บาท)',
  status        ENUM('awaiting_dispatch','picking','delivered','cancelled')
                              NOT NULL DEFAULT 'awaiting_dispatch'
                                                     COMMENT 'สถานะ: รอจ่ายสินค้า / กำลังจัดของ / ส่งมอบสำเร็จ / ยกเลิก',
  created_by    INT UNSIGNED  NOT NULL                COMMENT 'พนักงานขายผู้สร้างคำสั่งซื้อ',
  paid_at       DATETIME      NOT NULL                COMMENT 'วันเวลาที่ยืนยันรับชำระเงิน',
  dispatched_by INT UNSIGNED  NULL                    COMMENT 'พนักงานคลังผู้ยืนยันจ่ายสินค้า',
  dispatched_at DATETIME      NULL                    COMMENT 'วันเวลาที่ยืนยันจ่ายสินค้า',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันเวลาที่บันทึกคำสั่งซื้อ',
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_orders_order_no (order_no),
  KEY idx_orders_queue (status, paid_at),
  CONSTRAINT fk_orders_created_by    FOREIGN KEY (created_by)    REFERENCES users(user_id),
  CONSTRAINT fk_orders_dispatched_by FOREIGN KEY (dispatched_by) REFERENCES users(user_id)
) ENGINE=InnoDB COMMENT='คำสั่งซื้อและสถานะวงจรชีวิตของคำสั่งซื้อ';

-- ---------------------------------------------------------------------
-- 4) order_items — รายการสินค้าในคำสั่งซื้อ   [FR-03 · UC-03]
-- ---------------------------------------------------------------------
CREATE TABLE order_items (
  order_item_id INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสรายการสินค้า',
  order_id      INT UNSIGNED  NOT NULL                COMMENT 'คำสั่งซื้อที่รายการนี้สังกัด',
  product_id    INT UNSIGNED  NOT NULL                COMMENT 'สินค้าที่ถูกสั่งซื้อ',
  qty           INT           NOT NULL                COMMENT 'จำนวนที่สั่งซื้อ',
  unit_price    DECIMAL(10,2) NOT NULL                COMMENT 'ราคาต่อหน่วย ณ เวลาที่ขาย',
  line_total    DECIMAL(12,2) NOT NULL                COMMENT 'ยอดรวมของรายการ',
  PRIMARY KEY (order_item_id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT chk_items_qty_positive CHECK (qty > 0)
) ENGINE=InnoDB COMMENT='รายการสินค้าย่อยของแต่ละคำสั่งซื้อ';

-- ---------------------------------------------------------------------
-- 5) stock_movements — ประวัติการเคลื่อนไหวสต็อก   [FR-06 · ประโยชน์ 1.5.3 Traceability]
-- ---------------------------------------------------------------------
CREATE TABLE stock_movements (
  movement_id   INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT 'รหัสรายการเคลื่อนไหว',
  product_id    INT UNSIGNED  NOT NULL                COMMENT 'สินค้าที่มีการเคลื่อนไหว',
  order_id      INT UNSIGNED  NULL                    COMMENT 'คำสั่งซื้อที่ทำให้เกิดการตัดสต็อก (ถ้ามี)',
  change_qty    INT           NOT NULL                COMMENT 'จำนวนที่เปลี่ยนแปลง (ค่าลบคือตัดออก)',
  balance_after INT           NOT NULL                COMMENT 'ยอดคงเหลือหลังการเคลื่อนไหว',
  reason        ENUM('sale_dispatch','manual_adjust','receive') NOT NULL
                                                     COMMENT 'สาเหตุ: จ่ายสินค้าตามคำสั่งซื้อ / ปรับปรุงด้วยมือ / รับสินค้าเข้า',
  note          VARCHAR(255)  NULL                    COMMENT 'หมายเหตุประกอบการปรับปรุง',
  created_by    INT UNSIGNED  NOT NULL                COMMENT 'ผู้ทำรายการ',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันเวลาที่เกิดรายการ',
  PRIMARY KEY (movement_id),
  KEY idx_movements_product (product_id, created_at),
  CONSTRAINT fk_mov_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT fk_mov_order   FOREIGN KEY (order_id)   REFERENCES orders(order_id),
  CONSTRAINT fk_mov_user    FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB COMMENT='ประวัติการเคลื่อนไหวของสต็อกสินค้าทุกรายการ';

-- ---------------------------------------------------------------------
-- 6) notifications — การแจ้งเตือนภายในแอปพลิเคชัน   [FR-08 · UC-11]
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  notification_id INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'รหัสการแจ้งเตือน',
  type            ENUM('low_stock','queue_delay') NOT NULL
                                                      COMMENT 'ประเภท: สต็อกต่ำกว่าจุดสั่งซื้อ / คิวงานค้างนานผิดปกติ',
  ref_product_id  INT UNSIGNED NULL                   COMMENT 'สินค้าที่เกี่ยวข้อง (กรณีสต็อกต่ำ)',
  ref_order_id    INT UNSIGNED NULL                   COMMENT 'คำสั่งซื้อที่เกี่ยวข้อง (กรณีคิวค้าง)',
  message         VARCHAR(255) NOT NULL               COMMENT 'ข้อความแจ้งเตือนที่แสดงต่อผู้จัดการ',
  is_read         BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'สถานะการอ่าน',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันเวลาที่แจ้งเตือน',
  PRIMARY KEY (notification_id),
  KEY idx_notif_unread (is_read, created_at),
  CONSTRAINT fk_notif_product FOREIGN KEY (ref_product_id) REFERENCES products(product_id),
  CONSTRAINT fk_notif_order   FOREIGN KEY (ref_order_id)   REFERENCES orders(order_id)
) ENGINE=InnoDB COMMENT='การแจ้งเตือนภายในแอปพลิเคชันสำหรับผู้จัดการ';

-- ---------------------------------------------------------------------
-- 7) audit_logs — บันทึกประวัติการทำรายการ   [FR-09 · UC-10]
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'รหัสบันทึกประวัติ',
  user_id     INT UNSIGNED    NULL                    COMMENT 'ผู้กระทำรายการ (NULL หากระบบทำเอง)',
  action      VARCHAR(50)     NOT NULL                COMMENT 'การกระทำ เช่น LOGIN, CREATE_ORDER, CONFIRM_DISPATCH',
  entity_type VARCHAR(30)     NULL                    COMMENT 'ชนิดข้อมูลที่ถูกกระทำ เช่น order, product',
  entity_id   INT UNSIGNED    NULL                    COMMENT 'รหัสของข้อมูลที่ถูกกระทำ',
  detail      JSON            NULL                    COMMENT 'รายละเอียดเพิ่มเติมในรูปแบบ JSON',
  ip_address  VARCHAR(45)     NULL                    COMMENT 'หมายเลขไอพีของผู้ใช้งาน',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันเวลาที่เกิดเหตุการณ์',
  PRIMARY KEY (log_id),
  KEY idx_audit_search (created_at, action),
  KEY idx_audit_user (user_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB COMMENT='บันทึกประวัติการทำรายการทุกเหตุการณ์สำคัญของระบบ';

-- =====================================================================
-- ธุรกรรมยืนยันจ่ายสินค้าและตัดสต็อกแบบอะตอมมิก  [UC-07 · FR-06 · RC08]
-- ---------------------------------------------------------------------
-- เงื่อนไข status = 'awaiting_dispatch' ในคำสั่ง UPDATE ทำหน้าที่เป็น
-- Optimistic Lock: ถ้ามีพนักงานคนอื่นยืนยันจ่ายไปก่อนแล้ว จำนวนแถวที่ถูก
-- แก้ไขจะเป็น 0 ระบบจะ ROLLBACK และปฏิเสธการจ่ายซ้ำทันที
-- =====================================================================
--
-- START TRANSACTION;
--
--   UPDATE orders
--      SET status = 'delivered', dispatched_by = :user_id, dispatched_at = NOW()
--    WHERE order_id = :order_id AND status = 'awaiting_dispatch';
--   -- ถ้า ROW_COUNT() = 0  ->  ROLLBACK; แจ้ง "คำสั่งซื้อนี้ถูกจ่ายสินค้าไปแล้ว"
--
--   SELECT product_id, qty FROM order_items WHERE order_id = :order_id FOR UPDATE;
--
--   -- ทำซ้ำทุกรายการสินค้า
--   UPDATE products
--      SET stock_qty = stock_qty - :qty
--    WHERE product_id = :product_id AND stock_qty >= :qty;
--   -- ถ้า ROW_COUNT() = 0  ->  ROLLBACK; แจ้ง "สต็อกไม่เพียงพอ"
--
--   INSERT INTO stock_movements
--     (product_id, order_id, change_qty, balance_after, reason, created_by)
--   VALUES (:product_id, :order_id, -:qty, :balance_after, 'sale_dispatch', :user_id);
--
--   INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail)
--   VALUES (:user_id, 'CONFIRM_DISPATCH', 'order', :order_id, :detail_json);
--
-- COMMIT;
--
-- หลัง COMMIT: Alert Engine ตรวจสอบ stock_qty <= reorder_point
--              แล้วบันทึกลง notifications (FR-08)
-- =====================================================================
