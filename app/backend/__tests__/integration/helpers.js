// ---------------------------------------------------------------------
// ตัวช่วยร่วมของชุดทดสอบการทำงานร่วมกัน
// ---------------------------------------------------------------------
const request = require('supertest');
const { createApp } = require('../../app');
const { pool } = require('../../config/db');

const app = createApp();
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';

/** เข้าสู่ระบบแล้วคืนโทเคนสำหรับใช้ในคำขอถัดไป */
async function tokenFor(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: PASSWORD });
  if (!res.body.token) throw new Error(`เข้าสู่ระบบ ${username} ไม่สำเร็จ: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

/** โทเคนของทั้งสามบทบาท ใช้ทดสอบการควบคุมสิทธิ์ */
async function allTokens() {
  const [sales, warehouse, manager] = await Promise.all([
    tokenFor('sales01'), tokenFor('wh01'), tokenFor('mgr01'),
  ]);
  return { sales, warehouse, manager };
}

/** สร้างคำสั่งซื้อที่ชำระเงินแล้วหนึ่งรายการ */
async function createOrder(token, items) {
  const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({ items });
  if (res.status !== 201) throw new Error(`สร้างคำสั่งซื้อไม่สำเร็จ: ${JSON.stringify(res.body)}`);
  return res.body.order;
}

const stockOf = async (productId) => {
  const [rows] = await pool.query('SELECT stock_qty, reorder_point FROM products WHERE product_id = ?', [productId]);
  return rows[0];
};

const auth = (token) => (req) => req.set('Authorization', `Bearer ${token}`);

module.exports = { app, request, pool, tokenFor, allTokens, createOrder, stockOf, auth, PASSWORD };
