// ตัวช่วยที่ชุดทดสอบการรวมส่วนใช้ร่วมกัน
// tokenFor ล็อกอินผ่านเส้นทางจริง เพื่อให้ทุกชุดทดสอบใช้โทเคนแบบเดียวกับที่หน้าจอได้รับ
const request = require('supertest');
const { createApp } = require('../../app');
const { pool } = require('../../config/db');

const app = createApp();
const PASSWORD = process.env.SEED_PASSWORD || 'Soml@2569';

async function tokenFor(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: PASSWORD });
  if (res.status !== 200) throw new Error(`ล็อกอิน ${username} ไม่สำเร็จ: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

// ผู้ใช้จาก db/seed/seed-users.js: siriphan/somporn = sales, santi = warehouse, ning = manager
async function allTokens() {
  return { sales: await tokenFor('siriphan'), warehouse: await tokenFor('santi'), manager: await tokenFor('ning') };
}

const auth = (token) => (req) => req.set('Authorization', `Bearer ${token}`);

module.exports = { app, request, pool, tokenFor, allTokens, auth, PASSWORD };
