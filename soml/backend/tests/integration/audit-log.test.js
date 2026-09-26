// บริการบันทึกประวัติ                                   [ตารางที่ 3.13 โมดูล 9 · FR-09 · UC-10 · AC-11]
const { app, request, pool, allTokens, auth } = require('./helpers');
const auditLog = require('../../modules/audit-log');
const { withTransaction } = require('../../config/db');

let tokens;
beforeAll(async () => { tokens = await allTokens(); });
afterAll(() => pool.end());

describe('record — ฝั่งเขียน', () => {
  test('บันทึกเหตุการณ์พร้อมผู้กระทำ ข้อมูลที่ถูกกระทำ และไอพี', async () => {
    await auditLog.record(pool, { userId: 4, action: 'LOGIN', ip: '10.0.0.5' });
    const [[row]] = await pool.query("SELECT * FROM audit_logs WHERE action = 'LOGIN' ORDER BY log_id DESC LIMIT 1");
    expect(row.user_id).toBe(4);
    expect(row.ip_address).toBe('10.0.0.5');
    expect(row.created_at).toBeInstanceOf(Date);
  });

  test('ชื่อเหตุการณ์ที่ไม่รู้จักถูกปฏิเสธ ไม่ให้สะกดหลุดลงฐาน', async () => {
    await expect(auditLog.record(pool, { action: 'LOGGED_IN' })).rejects.toThrow(/ไม่รู้จัก/);
  });

  test('อยู่ในธุรกรรมของผู้เรียก: งาน rollback แล้วประวัติต้องหายด้วย (3.7.3)', async () => {
    const [[{ n: before }]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'CREATE_ORDER'");
    await expect(
      withTransaction(async (conn) => {
        await auditLog.record(conn, { userId: 1, action: 'CREATE_ORDER', entityType: 'order', entityId: 999 });
        throw new Error('งานหลักล้มเหลวหลังบันทึกประวัติ');
      })
    ).rejects.toThrow();
    const [[{ n: after }]] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'CREATE_ORDER'");
    expect(after).toBe(before);
  });
});

describe('GET /api/audit-logs — ฝั่งอ่าน', () => {
  beforeAll(async () => {
    await auditLog.record(pool, { userId: 1, action: 'CREATE_PRODUCT', entityType: 'product', entityId: 7, ip: '10.0.0.1' });
    await auditLog.record(pool, { userId: 3, action: 'CONFIRM_DISPATCH', entityType: 'order', entityId: 8, ip: '10.0.0.3' });
  });

  test('เฉพาะผู้จัดการ — พนักงานขายและคลังได้ 403', async () => {
    expect((await auth(tokens.sales)(request(app).get('/api/audit-logs'))).status).toBe(403);
    expect((await auth(tokens.warehouse)(request(app).get('/api/audit-logs'))).status).toBe(403);
  });

  test('แสดงผู้กระทำ (ชื่อจริง) เวลา และข้อมูลที่ถูกกระทำ เรียงใหม่ไปเก่า [AC-11]', async () => {
    const res = await auth(tokens.manager)(request(app).get('/api/audit-logs'));
    expect(res.status).toBe(200);
    const top = res.body.logs[0];
    expect(top).toMatchObject({ action: 'CONFIRM_DISPATCH', entity_type: 'order', entity_id: 8, full_name: 'สันติ ศิริกันทา' });
    expect(new Date(res.body.logs[0].created_at) >= new Date(res.body.logs[1].created_at)).toBe(true);
  });

  test('ข้อมูลที่ถูกกระทำอ่านออก: สินค้าเป็นรหัส+ชื่อ ไม่ใช่แค่ตัวเลข [AC-11]', async () => {
    const res = await auth(tokens.manager)(request(app).get('/api/audit-logs').query({ action: 'CREATE_PRODUCT' }));
    const row = res.body.logs.find((l) => l.entity_id === 7);
    const [[p]] = await pool.query('SELECT sku, name FROM products WHERE product_id = 7');
    expect(row.entity_label).toBe(`${p.sku} ${p.name}`);
  });

  test('กรองตามประเภทการกระทำ [AC-11]', async () => {
    const res = await auth(tokens.manager)(request(app).get('/api/audit-logs').query({ action: 'CREATE_PRODUCT' }));
    expect(res.body.logs.length).toBeGreaterThan(0);
    expect(res.body.logs.every((l) => l.action === 'CREATE_PRODUCT')).toBe(true);
  });

  test('กรองตามช่วงเวลา: ช่วงในอนาคตต้องว่าง [AC-11]', async () => {
    const res = await auth(tokens.manager)(request(app).get('/api/audit-logs').query({ from: '2999-01-01' }));
    expect(res.body.logs).toEqual([]);
  });

  test('ประเภทการกระทำที่ไม่รู้จัก → 400', async () => {
    const res = await auth(tokens.manager)(request(app).get('/api/audit-logs').query({ action: 'HACK' }));
    expect(res.status).toBe(400);
  });
});
