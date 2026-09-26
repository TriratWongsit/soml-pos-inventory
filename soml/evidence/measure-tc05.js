// ---------------------------------------------------------------------
// TC-05 ความหน่วงของคิวเรียลไทม์ (FR-04 · NFR-02 · AC-06)
//
//   node evidence/measure-tc05.js            วัดผ่าน WebSocket (ช่องทางหลัก)
//   node evidence/measure-tc05.js sse        วัดผ่าน Server-Sent Events (ช่องทางสำรอง)
//
// วิธีวัด: เปิดช่องทางค้างค้างไว้เหมือนหน้าจอคิว → สร้างคำสั่งซื้อผ่านเส้นทางบริการจริง
// → จับเวลาตั้งแต่วินาทีที่ส่งคำขอ จนวินาทีที่เหตุการณ์ order.created ของใบนั้นมาถึงผู้รับ
// เวลาที่ได้จึงรวมเวลาของธุรกรรม การพิมพ์ใบเสร็จ และการส่งข้ามเครือข่ายไว้ครบ
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.EVIDENCE_API_URL || `http://localhost:${process.env.PORT || 4000}`;
const ROUNDS = Number(process.env.EVIDENCE_ROUNDS || 20);
const CHANNEL = process.argv[2] === 'sse' ? 'sse' : 'ws';
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';

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

/** เปิดช่องทางค้างแล้วคืนฟังก์ชันที่รอเหตุการณ์ order.created ของเลขที่ที่ระบุ */
async function openChannel(token) {
  // เหตุการณ์อาจมาถึงก่อนที่ผู้เรียกจะทันสมัครรอ จึงจำเวลาที่มาถึงไว้ก่อนเสมอ
  const arrivals = new Map();
  const waiters = new Map();
  const deliver = (orderNo) => {
    const at = Date.now();
    arrivals.set(orderNo, at);
    const done = waiters.get(orderNo);
    if (done) { waiters.delete(orderNo); done(at); }
  };
  /** รอเหตุการณ์ order.created ของเลขที่ที่ระบุ คืนเวลาที่มาถึง หรือ null เมื่อหมดเวลา */
  const waitFor = (orderNo, timeoutMs) => new Promise((ok) => {
    if (arrivals.has(orderNo)) return ok(arrivals.get(orderNo));
    const timer = setTimeout(() => { waiters.delete(orderNo); ok(null); }, timeoutMs);
    waiters.set(orderNo, (at) => { clearTimeout(timer); ok(at); });
  });

  if (CHANNEL === 'ws') {
    const WebSocket = require('ws');
    const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws?token=${encodeURIComponent(token)}`);
    await new Promise((ok, fail) => { ws.once('open', ok); ws.once('error', fail); });
    ws.on('message', (raw) => {
      const { event, data } = JSON.parse(raw.toString());
      if (event === 'order.created') deliver(data.orderNo);
    });
    return { waitFor, close: () => ws.close() };
  }

  const res = await fetch(`${BASE}/api/events?token=${encodeURIComponent(token)}`, { headers: { accept: 'text/event-stream' } });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const block of buffer.split('\n\n').slice(0, -1)) {
        if (block.includes('event: order.created')) {
          const line = block.split('\n').find((l) => l.startsWith('data:'));
          if (line) deliver(JSON.parse(line.slice(5)).orderNo);
        }
      }
      buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2);
    }
  })().catch(() => {});
  return { waitFor, close: () => reader.cancel().catch(() => {}) };
}

(async () => {
  const sales = await api('POST', '/auth/login', null, { username: 'siriphan', password: PASSWORD });
  const warehouse = await api('POST', '/auth/login', null, { username: 'santi', password: PASSWORD });
  const { products } = await api('GET', '/products?q=ทราย', sales.token);
  const product = products.find((p) => p.stock_qty > ROUNDS) || products[0];

  const channel = await openChannel(warehouse.token);
  const samples = [];

  for (let i = 0; i < ROUNDS; i++) {
    const started = Date.now();
    const created = await api('POST', '/orders', sales.token, { items: [{ productId: product.product_id, qty: 1 }] });
    const at = await channel.waitFor(created.order.orderNo, 10_000);
    if (at === null) throw new Error(`รอบที่ ${i + 1}: ไม่ได้รับเหตุการณ์ภายใน 10 วินาที`);
    samples.push({ round: i + 1, orderNo: created.order.orderNo, ms: at - started });
  }
  channel.close();

  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const result = {
    testCase: 'TC-05',
    เรื่องที่วัด: 'เวลาตั้งแต่ยืนยันรับชำระเงินจนคำสั่งซื้อไปถึงหน้าจอคิว',
    ช่องทาง: CHANNEL === 'ws' ? 'WebSocket (ช่องทางหลัก)' : 'Server-Sent Events (ช่องทางสำรอง)',
    เกณฑ์: 'ไม่เกิน 3 วินาที (3000 มิลลิวินาที) ทุกครั้ง',
    จำนวนรอบ: samples.length,
    ต่ำสุดมิลลิวินาที: ms[0],
    มัธยฐานมิลลิวินาที: ms[Math.floor(ms.length / 2)],
    สูงสุดมิลลิวินาที: ms[ms.length - 1],
    เฉลี่ยมิลลิวินาที: Math.round(ms.reduce((a, b) => a + b, 0) / ms.length),
    ผ่านเกณฑ์: ms[ms.length - 1] <= 3000,
    วัดเมื่อ: new Date().toISOString(),
    รายรอบ: samples,
  };

  const out = path.join(__dirname, `tc05-${CHANNEL}.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(`TC-05 (${result.ช่องทาง}) ${samples.length} รอบ — ต่ำสุด ${result.ต่ำสุดมิลลิวินาที} ms · มัธยฐาน ${result.มัธยฐานมิลลิวินาที} ms · สูงสุด ${result.สูงสุดมิลลิวินาที} ms → ${result.ผ่านเกณฑ์ ? 'ผ่าน' : 'ไม่ผ่าน'}`);
  console.log(`บันทึกหลักฐานไว้ที่ ${path.relative(process.cwd(), out)}`);
  process.exit(0);
})().catch((err) => { console.error('วัดไม่สำเร็จ:', err.message); process.exit(1); });
