// ---------------------------------------------------------------------
// TC-04 ความไม่ซ้ำของเลขที่คำสั่งซื้อ (FR-03 · AC-04)
//
//   node evidence/measure-tc04.js
//
// ทำตามวิธีทดสอบในตารางที่ 3.23 คือสร้างคำสั่งซื้อต่อเนื่อง 100 รายการ
// แล้วสร้างพร้อมกันอีก 20 รายการจากสองบัญชี จากนั้นตรวจว่าเลขที่ที่ได้ไม่ซ้ำกันเลย
// และตรวจซ้ำที่ฐานข้อมูลว่าจำนวนคำสั่งซื้อเท่ากับจำนวนเลขที่ที่ไม่ซ้ำกัน
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.EVIDENCE_API_URL || `http://localhost:${process.env.PORT || 4000}`;
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';
const SEQUENTIAL = 100;
const CONCURRENT = 20;

const api = async (method, p, token, body) => {
  const res = await fetch(`${BASE}/api${p}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${data.error || ''}`);
  return data;
};

(async () => {
  const a = await api('POST', '/auth/login', null, { username: 'siriphan', password: PASSWORD });
  const b = await api('POST', '/auth/login', null, { username: 'somporn', password: PASSWORD });
  const { products } = await api('GET', '/products?q=101017', a.token);
  const productId = products[0].product_id;
  const one = (token) => api('POST', '/orders', token, { items: [{ productId, qty: 1 }] });

  const startedAt = Date.now();
  const sequential = [];
  for (let i = 0; i < SEQUENTIAL; i++) sequential.push((await one(a.token)).order.orderNo);

  // สร้างพร้อมกันจากสองบัญชี เพื่อให้ธุรกรรมชนกันจริงที่ขั้นออกเลขที่
  const concurrent = (await Promise.all(
    Array.from({ length: CONCURRENT }, (_, i) => one(i % 2 === 0 ? a.token : b.token))
  )).map((r) => r.order.orderNo);

  const all = [...sequential, ...concurrent];
  const duplicates = all.filter((no, i) => all.indexOf(no) !== i);

  // ตรวจซ้ำอีกชั้นที่ฐานข้อมูล ว่าจำนวนแถวเท่ากับจำนวนเลขที่ที่ไม่ซ้ำกัน
  const { pool } = require('../backend/config/db');
  const [[db]] = await pool.query('SELECT COUNT(*) AS orders, COUNT(DISTINCT order_no) AS distinctNo FROM orders');
  await pool.end();

  const result = {
    testCase: 'TC-04',
    เรื่องที่วัด: 'เลขที่คำสั่งซื้อต้องไม่ซ้ำกัน แม้สร้างต่อเนื่องและสร้างพร้อมกันจากหลายบัญชี',
    เกณฑ์: 'ไม่มีเลขที่ซ้ำกันแม้แต่รายการเดียว',
    สร้างต่อเนื่อง: SEQUENTIAL,
    สร้างพร้อมกัน: CONCURRENT,
    เลขที่ที่ได้ทั้งหมด: all.length,
    เลขที่ที่ไม่ซ้ำกัน: new Set(all).size,
    เลขที่ซ้ำ: duplicates,
    คำสั่งซื้อทั้งหมดในฐานข้อมูล: db.orders,
    เลขที่ที่ไม่ซ้ำกันในฐานข้อมูล: db.distinctNo,
    เลขที่แรก: all[0],
    เลขที่สุดท้าย: all[all.length - 1],
    ใช้เวลาวินาที: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
    ผ่านเกณฑ์: duplicates.length === 0 && db.orders === db.distinctNo,
    วัดเมื่อ: new Date().toISOString(),
  };

  const out = path.join(__dirname, 'tc04.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(`TC-04 สร้าง ${all.length} รายการ (ต่อเนื่อง ${SEQUENTIAL} · พร้อมกัน ${CONCURRENT}) — เลขที่ไม่ซ้ำ ${result.เลขที่ที่ไม่ซ้ำกัน} รายการ ซ้ำ ${duplicates.length} รายการ`);
  console.log(`ฐานข้อมูล: คำสั่งซื้อ ${db.orders} รายการ เลขที่ไม่ซ้ำกัน ${db.distinctNo} รายการ → ${result.ผ่านเกณฑ์ ? 'ผ่าน' : 'ไม่ผ่าน'}`);
  console.log(`บันทึกหลักฐานไว้ที่ ${path.relative(process.cwd(), out)}`);
  process.exit(0);
})().catch((err) => { console.error('วัดไม่สำเร็จ:', err.message); process.exit(1); });
