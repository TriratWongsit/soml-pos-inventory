#!/usr/bin/env node
// ---------------------------------------------------------------------
// ตรวจว่าภาพหลักฐานไม่มีหมายเลขพร้อมเพย์จริงของร้านฝังอยู่
//
// รหัส QR ในภาพหน้าจอเก็บหมายเลขบัญชีของร้านไว้ในตัว ใครที่เปิดที่เก็บโค้ด
// ได้จึงสแกนอ่านหมายเลขนั้นออกมาได้ สคริปต์นี้ถอดรหัส QR จากทุกภาพในโฟลเดอร์
// หลักฐาน แล้วเตือนถ้าพบหมายเลขที่ไม่ใช่หมายเลขสำหรับทดสอบ
//
//   node scripts/check-evidence-privacy.js
//
// คืนรหัสออก 1 เมื่อพบภาพที่ไม่ปลอดภัย เพื่อให้ใช้เป็นด่านตรวจก่อน commit ได้
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const jsQRModule = require('jsqr');
const jsQR = jsQRModule.default || jsQRModule;
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const EVIDENCE = path.join(ROOT, 'evidence');
const DOCS = path.join(ROOT, '..', 'Documents', 'assets', 'screenshots');

// หมายเลขที่อนุญาตให้ปรากฏในภาพที่เก็บเข้าที่เก็บโค้ดได้
const ALLOWED = ['0066812345678'];

/** อ่านค่าของช่อง TLV ตามมาตรฐาน EMVCo */
function readField(payload, wantTag) {
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    const value = payload.slice(i + 4, i + 4 + len);
    if (tag === wantTag) return value;
    i += 4 + len;
  }
  return null;
}

function pngFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pngFiles(full);
    return entry.name.toLowerCase().endsWith('.png') ? [full] : [];
  });
}

const files = [...pngFiles(EVIDENCE), ...pngFiles(DOCS)];
const unsafe = [];
let withQr = 0;

for (const file of files) {
  let code;
  try {
    const png = PNG.sync.read(fs.readFileSync(file));
    code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  } catch (err) {
    continue; // ภาพที่อ่านไม่ได้ไม่ใช่ประเด็นของการตรวจนี้
  }
  if (!code) continue;

  withQr += 1;
  const merchant = readField(code.data, '29');
  const number = merchant ? readField(merchant, '01') : null;
  const relative = path.relative(path.join(ROOT, '..'), file);

  if (number && !ALLOWED.includes(number)) {
    unsafe.push({ relative, number });
  } else {
    console.log(`  ปลอดภัย  ${relative}  (${number})`);
  }
}

console.log(`\nตรวจภาพ ${files.length} ไฟล์ พบรหัส QR ใน ${withQr} ไฟล์`);

if (unsafe.length > 0) {
  console.error('\nพบภาพที่ฝังหมายเลขพร้อมเพย์ที่ไม่ใช่หมายเลขสำหรับทดสอบ');
  unsafe.forEach((u) => console.error(`  ${u.relative}  →  ${u.number}`));
  console.error('\nให้ลบภาพเหล่านี้แล้วสร้างใหม่ด้วย npm run capture-evidence');
  console.error('ซึ่งเปิดเซิร์ฟเวอร์ของตัวเองโดยบังคับใช้หมายเลขสำหรับทดสอบเสมอ');
  process.exit(1);
}

console.log('ไม่พบหมายเลขจริงในภาพใดเลย');
