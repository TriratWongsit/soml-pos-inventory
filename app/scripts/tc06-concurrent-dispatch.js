#!/usr/bin/env node
// ---------------------------------------------------------------------
// TC-06 — เปิดหน้าจอคลังสินค้าหลายเครื่องแล้วกดยืนยันจ่ายคำสั่งซื้อเดียวกัน
//         พร้อมกัน   [FR-05 · FR-06 · NFR-04 · วัตถุประสงค์ข้อ 1.2.3]
//
// เกณฑ์ผ่าน: เครื่องแรกสำเร็จเพียงเครื่องเดียว เครื่องที่เหลือได้รับข้อความว่า
//           คำสั่งซื้อถูกจ่ายไปแล้ว และสต็อกถูกหักเพียงครั้งเดียว
//
//   node scripts/tc06-concurrent-dispatch.js [จำนวนรอบ] [จำนวนเครื่องพร้อมกัน]
// ---------------------------------------------------------------------
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = `https://localhost:${process.env.PORT || 4000}`;
const ROUNDS = Number(process.argv[2] || 30);
const CONCURRENCY = Number(process.argv[3] || 10);
const PRODUCT_ID = 1;
const QTY = 2;

const login = async (username) => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: process.env.SEED_PASSWORD || 'Soml@2569' }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`เข้าสู่ระบบ ${username} ไม่สำเร็จ: ${JSON.stringify(body)}`);
  return body.token;
};

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'soml',
  });

  const salesToken = await login('sales01');
  const whToken = await login('wh01');

  const stockOf = async () => {
    const [r] = await db.query('SELECT stock_qty FROM products WHERE product_id = ?', [PRODUCT_ID]);
    return r[0].stock_qty;
  };
  const movementsOf = async (orderId) => {
    const [r] = await db.query('SELECT COUNT(*) AS n FROM stock_movements WHERE order_id = ?', [orderId]);
    return r[0].n;
  };

  const rounds = [];
  console.log(`TC-06 · ${ROUNDS} รอบ · ยิงพร้อมกันรอบละ ${CONCURRENCY} เครื่อง\n`);

  for (let round = 1; round <= ROUNDS; round++) {
    const created = await (await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({ items: [{ productId: PRODUCT_ID, qty: QTY }] }),
    })).json();
    const orderId = created.order.orderId;

    const before = await stockOf();

    // ยิงพร้อมกันจากหลายเครื่อง
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        fetch(`${BASE}/api/orders/${orderId}/dispatch`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${whToken}` },
        }).then(async (r) => ({ status: r.status, body: await r.json() }))
      )
    );

    const after = await stockOf();
    const ok = results.filter((r) => r.status === 200);
    const rejected = results.filter((r) => r.status === 409);
    const other = results.filter((r) => r.status !== 200 && r.status !== 409);

    const record = {
      round,
      orderNo: created.order.orderNo,
      concurrency: CONCURRENCY,
      succeeded: ok.length,
      rejected: rejected.length,
      unexpected: other.length,
      stockBefore: before,
      stockAfter: after,
      stockDeducted: before - after,
      expectedDeduction: QTY,
      movementRows: await movementsOf(orderId),
      rejectMessage: rejected[0]?.body?.error || null,
      pass:
        ok.length === 1 &&
        rejected.length === CONCURRENCY - 1 &&
        other.length === 0 &&
        before - after === QTY &&
        (await movementsOf(orderId)) === 1,
    };
    rounds.push(record);

    if (round === 1 || !record.pass || round === ROUNDS) {
      console.log(
        `  รอบ ${String(round).padStart(2)} ${record.orderNo}  สำเร็จ ${record.succeeded} · ปฏิเสธ ${record.rejected} · ` +
        `สต็อก ${record.stockBefore}→${record.stockAfter} (หัก ${record.stockDeducted}) · ` +
        `บันทึกเคลื่อนไหว ${record.movementRows} แถว · ${record.pass ? 'ผ่าน' : 'ไม่ผ่าน'}`
      );
    }
  }

  const passed = rounds.filter((r) => r.pass).length;
  const summary = {
    testCase: 'TC-06',
    requirement: 'FR-05, FR-06, NFR-04',
    objective: 'กลไกป้องกันการยืนยันจ่ายสินค้าซ้ำ (วัตถุประสงค์ข้อ 1.2.3)',
    executedAt: new Date().toISOString(),
    rounds: ROUNDS,
    concurrencyPerRound: CONCURRENCY,
    totalRequests: ROUNDS * CONCURRENCY,
    roundsPassed: passed,
    roundsFailed: ROUNDS - passed,
    verdict: passed === ROUNDS ? 'ผ่าน' : 'ไม่ผ่าน',
    rejectMessageSample: rounds[0]?.rejectMessage,
    detail: rounds,
  };

  const out = path.join(__dirname, '..', 'evidence', 'tc06-concurrent.json');
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`\n  รวม ${summary.totalRequests} คำขอ · ผ่าน ${passed}/${ROUNDS} รอบ · ผลรวม: ${summary.verdict}`);
  console.log(`  ข้อความที่เครื่องอื่นได้รับ: "${summary.rejectMessageSample}"`);
  console.log(`  บันทึกหลักฐานที่ evidence/tc06-concurrent.json`);

  await db.end();
  process.exit(passed === ROUNDS ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
