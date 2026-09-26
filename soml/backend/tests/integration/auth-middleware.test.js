// ส่วนตรวจสิทธิ์คั่นหน้าเส้นทาง                              [ตารางที่ 3.14 แถว 1 · 2.1.7]
// ทดสอบผ่านเส้นทางจำลองที่ประกาศในชุดทดสอบเอง เพราะเส้นทางจริงยังไม่มี (ขั้น 7+)
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../app');
const { verifyToken, requireRole, clientIp, JWT_SECRET } = require('../../middleware/auth');

const app = createApp();
// เส้นทางจำลอง: เลียนแบบลำดับที่ app.js จะใช้จริง verifyToken → requireRole → handler
app.get('/test/any', verifyToken, (req, res) => res.json({ user: req.user, ip: clientIp(req) }));
app.get('/test/manager', verifyToken, requireRole('manager'), (req, res) => res.json({ ok: true }));

const tokenFor = (role, opts = {}) =>
  jwt.sign({ userId: 1, username: 'x', role, fullName: 'ทดสอบ' }, JWT_SECRET, { expiresIn: '1h', ...opts });

test('GET /api/health เปิดโดยไม่ต้องเข้าสู่ระบบ', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('ไม่มีโทเคน → 401', async () => {
  const res = await request(app).get('/test/any');
  expect(res.status).toBe(401);
});

test('โทเคนปลอม (ลงนามด้วยกุญแจอื่น) → 401', async () => {
  const fake = jwt.sign({ userId: 1, role: 'manager' }, 'wrong-secret');
  const res = await request(app).get('/test/any').set('Authorization', `Bearer ${fake}`);
  expect(res.status).toBe(401);
});

test('โทเคนหมดอายุ → 401 พร้อมข้อความให้เข้าสู่ระบบใหม่', async () => {
  const expired = tokenFor('sales', { expiresIn: -10 });
  const res = await request(app).get('/test/any').set('Authorization', `Bearer ${expired}`);
  expect(res.status).toBe(401);
  expect(res.body.error).toMatch(/หมดอายุ/);
});

test('โทเคนถูกต้อง → req.user ถูกแนบ และอ่านไอพีได้', async () => {
  const res = await request(app).get('/test/any').set('Authorization', `Bearer ${tokenFor('sales')}`);
  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({ userId: 1, role: 'sales' });
  expect(res.body.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$|^::1$/);
});

test('บทบาทไม่ตรง → 403 (รู้ว่าเป็นใคร แต่ไม่มีสิทธิ์)', async () => {
  const res = await request(app).get('/test/manager').set('Authorization', `Bearer ${tokenFor('warehouse')}`);
  expect(res.status).toBe(403);
});

test('บทบาทตรง → ผ่าน', async () => {
  const res = await request(app).get('/test/manager').set('Authorization', `Bearer ${tokenFor('manager')}`);
  expect(res.status).toBe(200);
});

test('เส้นทางใต้ /api ที่ไม่มี → 404 เป็น JSON', async () => {
  const res = await request(app).get('/api/nothing');
  expect(res.status).toBe(404);
  expect(res.body.error).toBeDefined();
});
