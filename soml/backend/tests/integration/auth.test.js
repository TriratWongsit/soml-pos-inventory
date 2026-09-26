// การเข้าสู่ระบบและควบคุมสิทธิ์ตามบทบาท        [ตารางที่ 3.13 โมดูล 1 · FR-01 · UC-01 · AC-01 · TC-01]
const jwt = require('jsonwebtoken');
const { app, request, pool, auth, PASSWORD } = require('./helpers');

afterAll(() => pool.end());

const login = (username, password = PASSWORD) => request(app).post('/api/auth/login').send({ username, password });

describe('POST /api/auth/login', () => {
  test('ผู้ใช้ทั้ง 3 บทบาทเข้าได้ และได้บทบาทตรงกับที่ seed', async () => {
    for (const [username, role] of [['siriphan', 'sales'], ['santi', 'warehouse'], ['ning', 'manager']]) {
      const res = await login(username);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ username, role });
      expect(res.body.user.fullName).toBeTruthy();
      expect(res.body.user.password_hash).toBeUndefined();
      expect(typeof res.body.token).toBe('string');
    }
  });

  test('รหัสผ่านผิด → 401', async () => {
    expect((await login('siriphan', 'ผิดแน่นอน')).status).toBe(401);
  });

  test('ชื่อผู้ใช้ไม่มี → 401 ด้วยข้อความเดียวกับรหัสผิด (ไม่บอกว่าชื่อไหนมีอยู่)', async () => {
    const noUser = await login('nobody');
    const badPass = await login('siriphan', 'ผิด');
    expect(noUser.status).toBe(401);
    expect(noUser.body.error).toBe(badPass.body.error);
  });

  test('บัญชีที่ถูกปิด (is_active = false) เข้าไม่ได้แม้รหัสถูก', async () => {
    await pool.query("UPDATE users SET is_active = FALSE WHERE username = 'somporn'");
    try {
      expect((await login('somporn')).status).toBe(401);
    } finally {
      await pool.query("UPDATE users SET is_active = TRUE WHERE username = 'somporn'");
    }
  });

  test('ไม่ส่งชื่อหรือรหัส → 400', async () => {
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });

  test('เข้าสู่ระบบสำเร็จถูกบันทึกเป็น LOGIN พร้อมผู้กระทำ (FR-09)', async () => {
    const [[{ n: before }]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'LOGIN' AND user_id = 4");
    await login('ning');
    const [[{ n: after }]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'LOGIN' AND user_id = 4");
    expect(after).toBe(before + 1);
  });

  test('เข้าไม่สำเร็จไม่ถูกบันทึกเป็น LOGIN', async () => {
    const [[{ n: before }]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'LOGIN'");
    await login('siriphan', 'ผิด');
    const [[{ n: after }]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'LOGIN'");
    expect(after).toBe(before);
  });
});

describe('GET /api/auth/me', () => {
  test('คืนข้อมูลผู้ใช้จากโทเคน', async () => {
    const { token, user } = (await login('santi')).body;
    const res = await auth(token)(request(app).get('/api/auth/me'));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject(user);
  });
});

describe('TC-01 การควบคุมสิทธิ์ตามบทบาท — พนักงานขายเรียกเส้นทางของผู้จัดการ', () => {
  const managerRoute = () => request(app).get('/api/audit-logs');

  test('ไม่แนบโทเคน → 401', async () => {
    expect((await managerRoute()).status).toBe(401);
  });

  test('แนบโทเคนปลอม → 401', async () => {
    const fake = jwt.sign({ userId: 4, role: 'manager' }, 'not-the-secret');
    expect((await auth(fake)(managerRoute())).status).toBe(401);
  });

  test('แนบโทเคนบทบาทพนักงานขาย → 403 [AC-01]', async () => {
    const { token } = (await login('siriphan')).body;
    expect((await auth(token)(managerRoute())).status).toBe(403);
  });

  test('แนบโทเคนผู้จัดการ → 200', async () => {
    const { token } = (await login('ning')).body;
    expect((await auth(token)(managerRoute())).status).toBe(200);
  });
});
