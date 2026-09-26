// ---------------------------------------------------------------------
// TC-14 การรองรับผู้ใช้พร้อมกัน (NFR-06 · AC-15)
//
//   node evidence/measure-tc14.js
//
// วิธีวัด: เข้าสู่ระบบ 10 เซสชันจากสามบทบาทพร้อมกัน แล้วให้ทุกเซสชันเรียกงานประจำของตน
// วนต่อเนื่องเป็นเวลาที่กำหนด พนักงานขายสร้างคำสั่งซื้อจริง พนักงานคลังอ่านคิวและจ่ายสินค้า
// ผู้จัดการเปิดแดชบอร์ดและประวัติ  เกณฑ์คือต้องไม่มีคำขอใดล้มเหลว
//
// ไม่นับ 409 ของการจ่ายสินค้าที่ชนกันเป็นความล้มเหลว เพราะเป็นคำตอบที่ถูกต้องตาม AC-07
// (คำสั่งซื้อหนึ่งใบต้องจ่ายได้ครั้งเดียว) แต่จะรายงานแยกไว้ให้เห็น
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.EVIDENCE_API_URL || `http://localhost:${process.env.PORT || 4000}`;
const SECONDS = Number(process.env.EVIDENCE_SECONDS || 20);
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';

// 10 เซสชันจากสามบทบาทตามจำนวนพนักงานจริงของร้าน
const SESSIONS = [
  ...Array(4).fill('siriphan'),
  ...Array(1).fill('somporn'),
  ...Array(3).fill('santi'),
  ...Array(2).fill('ning'),
];

const stats = { total: 0, ok: 0, failed: 0, rejectedByDesign: 0, durations: [], errors: [] };

async function call(method, p, token, body) {
  const started = Date.now();
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
  const ms = Date.now() - started;
  stats.total += 1;
  stats.durations.push(ms);
  if (res.ok) stats.ok += 1;
  else if (res.status === 409) stats.rejectedByDesign += 1;   // ชนกันแล้วระบบปฏิเสธอย่างถูกต้อง
  else {
    stats.failed += 1;
    if (stats.errors.length < 10) stats.errors.push(`${method} ${p} → ${res.status} ${data.error || ''}`);
  }
  return { status: res.status, body: data };
}

const login = async (username) => {
  const res = await call('POST', '/auth/login', null, { username, password: PASSWORD });
  if (res.status !== 200) throw new Error(`เข้าสู่ระบบ ${username} ไม่สำเร็จ`);
  return res.body;
};

async function salesLoop(session, until, productId) {
  while (Date.now() < until) {
    await call('POST', '/orders/quote', session.token, { items: [{ productId, qty: 1 }] });
    await call('POST', '/orders', session.token, { items: [{ productId, qty: 1 }] });
  }
}

async function warehouseLoop(session, until) {
  while (Date.now() < until) {
    const queue = await call('GET', '/queue', session.token);
    const first = queue.body.queue?.[0];
    if (first) {
      await call('PATCH', `/orders/${first.order_id}/status`, session.token, { status: 'picking' });
      await call('POST', `/orders/${first.order_id}/dispatch`, session.token);
    }
    await call('GET', '/dashboard/ops', session.token);
  }
}

async function managerLoop(session, until) {
  while (Date.now() < until) {
    await call('GET', '/dashboard/ops', session.token);
    await call('GET', '/dashboard/exec?days=30', session.token);
    await call('GET', '/audit-logs?limit=50', session.token);
    await call('GET', '/notifications', session.token);
  }
}

(async () => {
  const sessions = [];
  for (const username of SESSIONS) sessions.push(await login(username));

  const seed = await call('GET', '/products?q=ทราย', sessions[0].token);
  const product = seed.body.products[0];

  const until = Date.now() + SECONDS * 1000;
  const startedAt = Date.now();
  await Promise.all(sessions.map((s) => {
    if (s.user.role === 'sales') return salesLoop(s, until, product.product_id);
    if (s.user.role === 'warehouse') return warehouseLoop(s, until);
    return managerLoop(s, until);
  }));
  const elapsed = (Date.now() - startedAt) / 1000;

  const d = stats.durations.slice().sort((a, b) => a - b);
  const result = {
    testCase: 'TC-14',
    เรื่องที่วัด: 'ระบบรองรับ 10 เซสชันจากสามบทบาทใช้งานพร้อมกันอย่างต่อเนื่อง',
    เกณฑ์: 'ไม่มีคำขอใดล้มเหลว',
    จำนวนเซสชัน: sessions.length,
    บทบาท: {
      พนักงานขาย: sessions.filter((s) => s.user.role === 'sales').length,
      พนักงานคลังสินค้า: sessions.filter((s) => s.user.role === 'warehouse').length,
      ผู้จัดการ: sessions.filter((s) => s.user.role === 'manager').length,
    },
    ระยะเวลาวินาที: Number(elapsed.toFixed(1)),
    คำขอทั้งหมด: stats.total,
    สำเร็จ: stats.ok,
    ถูกปฏิเสธตามกติกา409: stats.rejectedByDesign,
    ล้มเหลว: stats.failed,
    คำขอต่อวินาที: Number((stats.total / elapsed).toFixed(1)),
    เวลาตอบสนองมัธยฐานมิลลิวินาที: d[Math.floor(d.length / 2)],
    เวลาตอบสนองเปอร์เซ็นไทล์ที่95มิลลิวินาที: d[Math.floor(d.length * 0.95)],
    เวลาตอบสนองสูงสุดมิลลิวินาที: d[d.length - 1],
    ผ่านเกณฑ์: stats.failed === 0,
    ตัวอย่างข้อผิดพลาด: stats.errors,
    วัดเมื่อ: new Date().toISOString(),
  };

  const out = path.join(__dirname, 'tc14.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(`TC-14 ${result.จำนวนเซสชัน} เซสชัน ${result.ระยะเวลาวินาที} วินาที — คำขอ ${result.คำขอทั้งหมด} สำเร็จ ${result.สำเร็จ} ปฏิเสธตามกติกา ${result.ถูกปฏิเสธตามกติกา409} ล้มเหลว ${result.ล้มเหลว}`);
  console.log(`เวลาตอบสนอง มัธยฐาน ${result.เวลาตอบสนองมัธยฐานมิลลิวินาที} ms · เปอร์เซ็นไทล์ที่ 95 ${result.เวลาตอบสนองเปอร์เซ็นไทล์ที่95มิลลิวินาที} ms · สูงสุด ${result.เวลาตอบสนองสูงสุดมิลลิวินาที} ms → ${result.ผ่านเกณฑ์ ? 'ผ่าน' : 'ไม่ผ่าน'}`);
  console.log(`บันทึกหลักฐานไว้ที่ ${path.relative(process.cwd(), out)}`);
  process.exit(0);
})().catch((err) => { console.error('วัดไม่สำเร็จ:', err.message); process.exit(1); });
