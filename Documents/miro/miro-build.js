#!/usr/bin/env node
// ---------------------------------------------------------------------
// สร้างบอร์ด Miro ของแผนที่สืบย้อนความต้องการ SOML ให้อัตโนมัติ
//
//   1) สร้างโทเคนที่ https://miro.com/app/settings/user-profile/apps
//      สร้าง app ใหม่ เลือกสิทธิ์ boards:read และ boards:write แล้วกด
//      "Install app and get OAuth token" จะได้โทเคนมาหนึ่งชุด
//   2) เปิดบอร์ดเปล่าใน Miro แล้วดูรหัสบอร์ดจาก URL
//      https://miro.com/app/board/<รหัสบอร์ด>/
//   3) รันคำสั่ง
//
//      export MIRO_TOKEN='โทเคนที่ได้'
//      export MIRO_BOARD='รหัสบอร์ด'
//      node Documents/miro/miro-build.js
//
// สคริปต์อ่านข้อมูลจาก soml-map.json ซึ่งดึงมาจากกระดานเดียวกับที่ใช้อธิบาย
// จึงได้สติกกี้และเส้นเชื่อมชุดเดียวกันทุกใบ ไม่ต้องพิมพ์ซ้ำ
//
// รันซ้ำได้ แต่ Miro จะสร้างของใหม่ทับลงไป ถ้าจะรันใหม่ให้ล้างบอร์ดก่อน
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.MIRO_TOKEN;
const BOARD = process.env.MIRO_BOARD;
if (!TOKEN || !BOARD) {
  console.error('ต้องตั้งค่า MIRO_TOKEN และ MIRO_BOARD ก่อน ดูวิธีที่หัวไฟล์');
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'soml-map.json'), 'utf8'));

// เลนทั้งหกเรียงจากซ้ายไปขวา ตามสายโซ่ของโครงงาน
const LANES = [
  { title: '1 · หลักฐานจากหน้างาน (EV)', color: 'orange' },
  { title: '2 · ความต้องการและกฎธุรกิจ (FR · NFR · BR)', color: 'blue' },
  { title: '3 · เรื่องเล่าของผู้ใช้ (US)', color: 'green' },
  { title: '4 · กรณีการใช้งาน (UC)', color: 'yellow' },
  { title: '5 · เกณฑ์การยอมรับ (AC)', color: 'violet' },
  { title: '6 · กรณีทดสอบ (TC)', color: 'red' },
];
// สีสติกกี้ให้ตรงกับสีบนกระดานที่ใช้อธิบาย
const COLOR = { ev: 'orange', req: 'blue', br: 'gray', us: 'green', uc: 'yellow', ac: 'violet', tc: 'red' };

const COL_W = 460;     // ระยะห่างระหว่างเลน
const ROW_H = 210;     // ระยะห่างระหว่างสติกกี้ในเลนเดียวกัน
const TOP = 0;

const api = async (method, url, body) => {
  const res = await fetch('https://api.miro.com/v2' + url, {
    method,
    headers: {
      authorization: 'Bearer ' + TOKEN,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
};

// Miro จำกัดจำนวนคำขอต่อวินาที จึงเว้นจังหวะเล็กน้อยระหว่างการสร้างแต่ละชิ้น
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('กำลังสร้างบอร์ด …');

  // ---------- หัวเลน ----------
  for (let i = 0; i < LANES.length; i++) {
    await api('POST', `/boards/${BOARD}/texts`, {
      data: { content: `<p><strong>${LANES[i].title}</strong></p>` },
      style: { color: '#1a1a1a', fontSize: '24' },
      position: { x: i * COL_W, y: TOP - 160 },
      geometry: { width: 380 },
    });
    await pause(120);
  }

  // ---------- สติกกี้ ----------
  const rows = [0, 0, 0, 0, 0, 0];
  const idOf = {};
  const entries = Object.entries(map.N);
  for (const [id, v] of entries) {
    const y = TOP + rows[v.lane]++ * ROW_H;
    const created = await api('POST', `/boards/${BOARD}/sticky_notes`, {
      data: { content: `<p><strong>${id}</strong><br>${v.t}</p>`, shape: 'square' },
      style: { fillColor: COLOR[v.cls] || 'light_yellow' },
      position: { x: v.lane * COL_W, y },
      geometry: { width: 320 },
    });
    idOf[id] = created.id;
    process.stdout.write(`\r  สติกกี้ ${Object.keys(idOf).length}/${entries.length}`);
    await pause(120);
  }
  console.log('');

  // ---------- เส้นเชื่อม ----------
  let n = 0;
  for (const [a, z] of map.E) {
    if (!idOf[a] || !idOf[z]) continue;
    await api('POST', `/boards/${BOARD}/connectors`, {
      startItem: { id: idOf[a] },
      endItem: { id: idOf[z] },
      shape: 'curved',
      style: { strokeColor: '#7f93a8', strokeWidth: '1.5', endStrokeCap: 'arrow' },
    });
    process.stdout.write(`\r  เส้นเชื่อม ${++n}/${map.E.length}`);
    await pause(150);
  }
  console.log('');

  // ---------- แผงสถาปัตยกรรม C2 และ C3 ----------
  const archY = TOP + Math.max(...rows) * ROW_H + 260;
  await api('POST', `/boards/${BOARD}/texts`, {
    data: { content: '<p><strong>สถาปัตยกรรม C2 และ C3</strong></p>' },
    style: { color: '#1a1a1a', fontSize: '28' },
    position: { x: COL_W, y: archY - 140 },
    geometry: { width: 700 },
  });
  for (let i = 0; i < map.CONTAINERS.length; i++) {
    const c = map.CONTAINERS[i];
    const comps = c.c.length ? '<br><br>' + c.c.map(([name, fr]) => `${name} — ${fr}`).join('<br>') : '';
    await api('POST', `/boards/${BOARD}/shapes`, {
      data: { content: `<p><strong>${c.n}</strong><br>${c.tech}<br><br>${c.p}${comps}</p>`, shape: 'round_rectangle' },
      style: { fillColor: '#d0f0f2', borderColor: '#4f9294', fontSize: '13', textAlign: 'left' },
      position: { x: i * COL_W, y: archY + (c.c.length ? 260 : 0) },
      geometry: { width: 400, height: c.c.length ? 700 : 260 },
    });
    await pause(150);
  }

  console.log(`เสร็จแล้ว เปิดดูที่ https://miro.com/app/board/${BOARD}/`);
})().catch((e) => {
  console.error('\nผิดพลาด:', e.message);
  process.exit(1);
});
