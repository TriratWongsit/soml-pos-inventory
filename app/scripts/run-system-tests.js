#!/usr/bin/env node
// ---------------------------------------------------------------------
// ทดสอบระดับระบบกับเซิร์ฟเวอร์ที่ทำงานจริง แล้วบันทึกผลเป็นหลักฐาน
//
// ครอบคลุมกรณีที่ต้องวัดกับระบบที่รันจริง ไม่สามารถวัดในชุดทดสอบหน่วยได้
//   TC-05 / NFR-02  เวลาตั้งแต่ยืนยันรับชำระจนคำสั่งซื้อปรากฏบนหน้าจอคิว
//   TC-13 / NFR-05  เวลาตั้งแต่ยืนยันรับชำระจนพิมพ์ใบเสร็จเสร็จ
//   TC-14 / NFR-06  การใช้งานพร้อมกัน 10 เซสชัน
//   NFR-01          การบังคับใช้ HTTPS และการควบคุมสิทธิ์
//
// ต้องเปิด backend, print-service และฐานข้อมูลไว้ก่อน
//   node scripts/run-system-tests.js
// ---------------------------------------------------------------------
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT || 4000);
const HTTP_PORT = Number(process.env.HTTP_REDIRECT_PORT || PORT + 1);
const API = `https://localhost:${PORT}`;
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';
const EVIDENCE = path.join(__dirname, '..', 'evidence');

const login = async (username) => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`เข้าสู่ระบบ ${username} ไม่สำเร็จ`);
  return body.token;
};

const post = (token, url, body) =>
  fetch(`${API}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
  return {
    samples: sorted.length,
    minMs: sorted[0],
    medianMs: at(50),
    p95Ms: at(95),
    maxMs: sorted[sorted.length - 1],
    averageMs: Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(1)),
  };
};

/** TC-05 · NFR-02 — คำสั่งซื้อใหม่ต้องปรากฏบนหน้าจอคิวภายใน 3 วินาที */
async function tc05(rounds = 30) {
  const sales = await login('sales01');
  const warehouse = await login('wh01');

  const ws = new WebSocket(`wss://localhost:${PORT}/ws?token=${warehouse}`, { rejectUnauthorized: false });
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });

  const latencies = [];
  for (let i = 0; i < rounds; i++) {
    const arrived = new Promise((resolve) => {
      const onMessage = (raw) => {
        const evt = JSON.parse(raw);
        if (evt.type === 'order.created') { ws.off('message', onMessage); resolve(Date.now()); }
      };
      ws.on('message', onMessage);
    });

    const startedAt = Date.now();
    await post(sales, '/api/orders', { items: [{ productId: 1, qty: 1 }] });
    latencies.push((await arrived) - startedAt);
  }
  ws.close();

  const s = stats(latencies);
  return {
    testCase: 'TC-05',
    requirement: 'FR-04 · NFR-02',
    description: 'เวลาตั้งแต่ยืนยันรับชำระจนคำสั่งซื้อปรากฏบนหน้าจอคิว',
    thresholdMs: 3000,
    ...s,
    withinThreshold: latencies.filter((v) => v <= 3000).length,
    verdict: s.maxMs <= 3000 ? 'ผ่าน' : 'ไม่ผ่าน',
    latenciesMs: latencies,
  };
}

/** TC-13 · NFR-05 — ใบเสร็จต้องพิมพ์เสร็จภายใน 5 วินาทีหลังยืนยันรับชำระ */
async function tc13(rounds = 30) {
  const sales = await login('sales01');
  const durations = [];
  let failures = 0;

  for (let i = 0; i < rounds; i++) {
    const res = await (await post(sales, '/api/orders', { items: [{ productId: 2, qty: 1 }] })).json();
    if (!res.print.ok) failures += 1;
    durations.push(res.print.elapsedMs);
  }

  const s = stats(durations);
  return {
    testCase: 'TC-13',
    requirement: 'FR-03 · NFR-05',
    description: 'เวลาตั้งแต่ยืนยันรับชำระจนพิมพ์ใบเสร็จเสร็จ',
    note: 'วัดในโหมดจำลองของบริการพิมพ์ ต้องวัดซ้ำกับเครื่องพิมพ์ความร้อนจริงที่สถานประกอบการ',
    thresholdMs: 5000,
    ...s,
    printFailures: failures,
    verdict: failures === 0 && s.maxMs <= 5000 ? 'ผ่าน' : 'ไม่ผ่าน',
  };
}

/** TC-14 · NFR-06 — รองรับผู้ใช้งานพร้อมกันอย่างน้อย 10 เซสชัน */
async function tc14(sessions = 10, requestsPerSession = 20) {
  const accounts = ['sales01', 'wh01', 'mgr01'];
  const tokens = await Promise.all(
    Array.from({ length: sessions }, (_, i) => login(accounts[i % accounts.length]))
  );

  const startedAt = Date.now();
  const results = await Promise.all(
    tokens.map(async (token, index) => {
      const role = accounts[index % accounts.length];
      const durations = [];
      let failed = 0;

      for (let i = 0; i < requestsPerSession; i++) {
        const t = Date.now();
        let res;
        if (role === 'sales01') res = await post(token, '/api/orders', { items: [{ productId: 3, qty: 1 }] });
        else if (role === 'wh01') res = await fetch(`${API}/api/queue`, { headers: { Authorization: `Bearer ${token}` } });
        else res = await fetch(`${API}/api/dashboard/ops`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) failed += 1;
        durations.push(Date.now() - t);
      }
      return { role, failed, durations };
    })
  );

  const all = results.flatMap((r) => r.durations);
  const failed = results.reduce((sum, r) => sum + r.failed, 0);

  return {
    testCase: 'TC-14',
    requirement: 'NFR-06',
    description: 'ใช้งานพร้อมกันหลายเซสชันในช่วงเวลาเดียวกัน',
    sessions,
    requestsPerSession,
    totalRequests: all.length,
    failedRequests: failed,
    wallClockMs: Date.now() - startedAt,
    responseTime: stats(all),
    verdict: failed === 0 ? 'ผ่าน' : 'ไม่ผ่าน',
  };
}

/** NFR-01 — บังคับใช้ HTTPS และควบคุมสิทธิ์ทุกคำขอ */
async function nfr01() {
  const checks = [];
  const record = (name, expected, actual) =>
    checks.push({ name, expected, actual, pass: String(expected) === String(actual) });

  // เรียกผ่าน http ต้องถูกส่งต่อไปยัง https ไม่ให้บริการข้อมูลใด ๆ
  const redirect = await fetch(`http://localhost:${HTTP_PORT}/api/health`, { redirect: 'manual' });
  record('เรียกผ่าน http แล้วถูกส่งต่อ', '301', String(redirect.status));
  record('ปลายทางที่ส่งต่อเป็น https', true, String(redirect.headers.get('location') || '').startsWith('https://'));

  // คำขอที่ไม่มีโทเคน
  record('เรียก API โดยไม่มีโทเคน', '401', String((await fetch(`${API}/api/auth/me`)).status));

  // โทเคนปลอม
  const forged = await fetch(`${API}/api/auth/me`, { headers: { Authorization: 'Bearer forged.token.value' } });
  record('โทเคนปลอมแปลง', '401', String(forged.status));

  // บทบาทไม่ตรง
  const sales = await login('sales01');
  const denied = await fetch(`${API}/api/dashboard/exec`, { headers: { Authorization: `Bearer ${sales}` } });
  record('พนักงานขายเข้าถึงแดชบอร์ดบริหาร', '403', String(denied.status));

  const warehouse = await login('wh01');
  const denied2 = await post(warehouse, '/api/orders/quote', { items: [{ productId: 1, qty: 1 }] });
  record('พนักงานคลังเข้าถึงหน้าจอขาย', '403', String(denied2.status));

  // ข้อความแจ้งเตือนต้องไม่บอกว่าผิดที่ชื่อผู้ใช้หรือรหัสผ่าน
  const wrongPassword = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'sales01', password: 'ผิด' }),
  })).json();
  const noSuchUser = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ไม่มีคนนี้', password: 'ผิด' }),
  })).json();
  record('ข้อความเมื่อเข้าระบบไม่สำเร็จเหมือนกันทุกกรณี', wrongPassword.error, noSuchUser.error);

  return {
    testCase: 'NFR-01',
    requirement: 'NFR-01',
    description: 'บังคับใช้ HTTPS และควบคุมสิทธิ์ตามบทบาทอย่างเข้มงวด',
    checks,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    verdict: checks.every((c) => c.pass) ? 'ผ่าน' : 'ไม่ผ่าน',
  };
}

(async () => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const results = {};

  for (const [key, fn] of [['nfr01', nfr01], ['tc05', tc05], ['tc13', tc13], ['tc14', tc14]]) {
    process.stdout.write(`กำลังทดสอบ ${key.toUpperCase()} … `);
    results[key] = await fn();
    console.log(results[key].verdict);
  }

  console.log('');
  console.log(`  TC-05 · หน่วงถึงหน้าจอคิว   เฉลี่ย ${results.tc05.averageMs} ms · สูงสุด ${results.tc05.maxMs} ms   (เกณฑ์ ≤ 3000 ms)`);
  console.log(`  TC-13 · เวลาพิมพ์ใบเสร็จ    เฉลี่ย ${results.tc13.averageMs} ms · สูงสุด ${results.tc13.maxMs} ms   (เกณฑ์ ≤ 5000 ms)`);
  console.log(`  TC-14 · ${results.tc14.sessions} เซสชันพร้อมกัน   ${results.tc14.totalRequests} คำขอ ล้มเหลว ${results.tc14.failedRequests} · ตอบเฉลี่ย ${results.tc14.responseTime.averageMs} ms`);
  console.log(`  NFR-01 · ความมั่นคงปลอดภัย  ผ่าน ${results.nfr01.passed}/${results.nfr01.total} ข้อ`);

  const out = path.join(EVIDENCE, 'system-tests.json');
  fs.writeFileSync(out, JSON.stringify({ executedAt: new Date().toISOString(), ...results }, null, 2), 'utf8');
  console.log(`\nบันทึกหลักฐานที่ ${path.relative(process.cwd(), out)}`);

  const failed = Object.values(results).filter((r) => r.verdict !== 'ผ่าน');
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
