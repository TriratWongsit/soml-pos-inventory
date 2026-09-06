// การเข้าสู่ระบบและการควบคุมสิทธิ์ตามบทบาท   [FR-01 · UC-01 · TC-01 · NFR-01]
const { app, request, pool, tokenFor, allTokens } = require('./helpers');

afterAll(() => pool.end());

describe('POST /api/auth/login', () => {
  test('เข้าสู่ระบบสำเร็จครบทั้งสามบทบาท และได้โทเคนที่ระบุบทบาทถูกต้อง', async () => {
    for (const [username, role] of [['sales01', 'sales'], ['wh01', 'warehouse'], ['mgr01', 'manager']]) {
      const res = await request(app).post('/api/auth/login').send({ username, password: 'Soml@2569' });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe(role);
      expect(typeof res.body.token).toBe('string');
    }
  });

  test('รหัสผ่านผิดกับชื่อผู้ใช้ที่ไม่มีอยู่จริง ต้องได้ข้อความเดียวกันทุกประการ', async () => {
    // ป้องกันไม่ให้ผู้ไม่ประสงค์ดีใช้ข้อความแจ้งเตือนคาดเดาว่าบัญชีใดมีอยู่ (§2.1.6)
    const wrongPassword = await request(app).post('/api/auth/login').send({ username: 'sales01', password: 'ผิด' });
    const noSuchUser = await request(app).post('/api/auth/login').send({ username: 'ไม่มีคนนี้', password: 'ผิด' });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(noSuchUser.body.error);
  });

  test('บัญชีที่ถูกปิดใช้งานเข้าระบบไม่ได้ และได้คำแนะนำให้ติดต่อผู้จัดการ', async () => {
    await pool.query("UPDATE users SET is_active = FALSE WHERE username = 'sales01'");
    try {
      const res = await request(app).post('/api/auth/login').send({ username: 'sales01', password: 'Soml@2569' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/ติดต่อผู้จัดการ/);
    } finally {
      await pool.query("UPDATE users SET is_active = TRUE WHERE username = 'sales01'");
    }
  });

  test('กรอกข้อมูลไม่ครบได้รับรหัส 400', async () => {
    expect((await request(app).post('/api/auth/login').send({ username: 'sales01' })).status).toBe(400);
  });

  test('บันทึกทั้งการเข้าสู่ระบบสำเร็จและไม่สำเร็จลงประวัติการทำรายการ', async () => {
    const [[before]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'LOGIN_FAILED'");
    await request(app).post('/api/auth/login').send({ username: 'sales01', password: 'ผิด' });
    const [[after]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'LOGIN_FAILED'");
    expect(after.n).toBe(before.n + 1);
  });
});

describe('การควบคุมสิทธิ์ของทุกเส้นทาง   [TC-01]', () => {
  let tokens;
  beforeAll(async () => { tokens = await allTokens(); });

  test('คำขอที่ไม่แนบโทเคนถูกปฏิเสธด้วยรหัส 401 ทุกเส้นทาง', async () => {
    const routes = [
      ['get', '/api/auth/me'], ['get', '/api/products'], ['post', '/api/orders'],
      ['get', '/api/queue'], ['get', '/api/dashboard/ops'], ['get', '/api/audit-logs'],
      ['get', '/api/notifications'],
    ];
    for (const [method, path] of routes) {
      expect((await request(app)[method](path)).status).toBe(401);
    }
  });

  test('โทเคนที่ปลอมแปลงถูกปฏิเสธ', async () => {
    // หัวข้อคำขอ HTTP รับได้เฉพาะอักขระ latin-1 จึงใช้โทเคนปลอมเป็นอักษรอังกฤษ
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer forged.token.value');
    expect(res.status).toBe(401);
  });

  // ตารางนี้คือขอบเขตสิทธิ์ตามตารางที่ 3.11 แปลงเป็นข้อความที่ทดสอบได้
  const MATRIX = [
    ['post', '/api/products',        { sales: 403, warehouse: 403, manager: 400 }],
    ['get',  '/api/queue',           { sales: 403, warehouse: 200, manager: 200 }],
    ['get',  '/api/dashboard/ops',   { sales: 403, warehouse: 200, manager: 200 }],
    ['get',  '/api/dashboard/exec',  { sales: 403, warehouse: 403, manager: 200 }],
    ['get',  '/api/audit-logs',      { sales: 403, warehouse: 403, manager: 200 }],
    ['get',  '/api/notifications',   { sales: 403, warehouse: 200, manager: 200 }],
    ['post', '/api/orders/quote',    { sales: 400, warehouse: 403, manager: 400 }],
  ];

  test.each(MATRIX)('%s %s ให้ผลตรงตามสิทธิ์ของแต่ละบทบาท', async (method, path, expected) => {
    for (const [role, status] of Object.entries(expected)) {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${tokens[role]}`).send({});
      expect(`${role}=${res.status}`).toBe(`${role}=${status}`);
    }
  });
});
