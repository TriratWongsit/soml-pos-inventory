// ---------------------------------------------------------------------
// ปรับโครงสร้างฐานข้อมูลที่ใช้งานอยู่แล้วให้ตรงกับ db/schema/schema.sql   [หลังสอบ 16 ต.ค. 2569]
//
// เครื่องร้านมีข้อมูลขายจริงอยู่แล้ว จึงสร้างฐานใหม่ทับไม่ได้ ไฟล์นี้เพิ่มเฉพาะส่วนที่ยังไม่มี
// รันทุกครั้งที่ระบบหลังบ้านเปิด (server.js) รันซ้ำได้โดยไม่เปลี่ยนอะไร ข้อมูลเดิมไม่หาย
//   K-6 ขายเชื่อ: ตาราง customers, credit_payments และคอลัมน์ payment_method, customer_id, settled_at ใน orders
//   เงินสด (เพิ่มหลังสอบ): payment_method มีค่า cash และคอลัมน์ cash_received
// ---------------------------------------------------------------------
const { pool, database } = require('./db');

async function tableExists(name) {
  const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [database, name]);
  return r.n > 0;
}

async function columnExists(table, column) {
  const [[r]] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
    [database, table, column]
  );
  return r.n > 0;
}

const STEPS = [
  {
    name: 'ตาราง customers',
    need: async () => !(await tableExists('customers')),
    sql: [`CREATE TABLE customers (
      customer_id INT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(150) NOT NULL, phone VARCHAR(20) NULL,
      note VARCHAR(255) NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id), KEY idx_customers_name (name)) ENGINE=InnoDB`],
  },
  {
    name: 'คอลัมน์ขายเชื่อใน orders',
    need: async () => !(await columnExists('orders', 'payment_method')),
    sql: [
      "ALTER TABLE orders ADD COLUMN payment_method ENUM('promptpay','credit') NOT NULL DEFAULT 'promptpay', ADD COLUMN customer_id INT UNSIGNED NULL, ADD COLUMN settled_at DATETIME NULL",
      'ALTER TABLE orders ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)',
    ],
  },
  {
    name: 'รับชำระด้วยเงินสดใน orders',
    need: async () => !(await columnExists('orders', 'cash_received')),
    sql: [
      "ALTER TABLE orders MODIFY payment_method ENUM('promptpay','credit','cash') NOT NULL DEFAULT 'promptpay'",
      'ALTER TABLE orders ADD COLUMN cash_received DECIMAL(12,2) NULL',
    ],
  },
  {
    name: 'ตาราง credit_payments',
    need: async () => !(await tableExists('credit_payments')),
    sql: [`CREATE TABLE credit_payments (
      payment_id INT UNSIGNED NOT NULL AUTO_INCREMENT, order_id INT UNSIGNED NOT NULL, amount DECIMAL(12,2) NOT NULL,
      method ENUM('cash','promptpay','transfer') NOT NULL, received_by INT UNSIGNED NOT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, note VARCHAR(255) NULL,
      PRIMARY KEY (payment_id), KEY idx_payments_order (order_id), KEY idx_payments_day (received_at),
      CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
      CONSTRAINT fk_payments_user FOREIGN KEY (received_by) REFERENCES users(user_id),
      CONSTRAINT chk_payments_amount_positive CHECK (amount > 0)) ENGINE=InnoDB`],
  },
];

/** คืนรายชื่อขั้นที่ทำในรอบนี้ (ว่างถ้าฐานข้อมูลเป็นรุ่นล่าสุดอยู่แล้ว) */
async function migrate() {
  const done = [];
  for (const step of STEPS) {
    if (await step.need()) {
      for (const sql of step.sql) await pool.query(sql);
      done.push(step.name);
    }
  }
  return done;
}

module.exports = { migrate };
