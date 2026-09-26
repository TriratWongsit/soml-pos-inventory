// ---------------------------------------------------------------------
// ส่วนควบคุมข้อมูลสินค้า (Product Controller)     [ตารางที่ 3.13 โมดูล 2 · FR-02 · UC-02]
//
// รับผิดชอบเรื่องเดียว: ตาราง products และการเปลี่ยนสต็อกที่ "คนทำ" (ไม่ใช่การขาย)
//   GET   /api/products?q=&category=  ทุกบทบาท   ค้นหาสินค้าที่ยังขายอยู่ (หน้าขายใช้) พร้อมรายชื่อหมวด
//   GET   /api/products/:id           ทุกบทบาท
//   POST  /api/products               ผู้จัดการ  เพิ่มสินค้า
//   PUT   /api/products/:id           ผู้จัดการ  แก้ชื่อ หมวด หน่วย ราคา จุดสั่งซื้อเพิ่ม เปิด/ปิดขาย
//
// หมวดหมู่ (category) มาจากวิธีที่ร้านจัดสต็อกจริง — ไฟล์ EV-09 แบ่งเป็นชีตตามหมวด (อนุมัติเพิ่ม 18 ก.ย. 69)
// เป็นข้อความอิสระ ไม่มีตารางหมวดแยก เพราะร้านมี 16 หมวดคงที่และไม่มีข้อมูลอื่นผูกกับหมวด
//   PATCH /api/products/:id/stock     ผู้จัดการ  ปรับสต็อกด้วยมือพร้อมเหตุผล
//
// ไม่มีการลบ — ปิดขายด้วย is_active เพราะ order_items เก่ายังอ้างถึงสินค้า
// การตัดสต็อกจากการขายไม่อยู่ที่นี่ — เป็นของ modules/stock-deduction (FR-06)
// ---------------------------------------------------------------------
const { pool, withTransaction } = require('../../config/db');
const { clientIp } = require('../../middleware/auth');
const auditLog = require('../audit-log');
const alert = require('../alert');

const COLUMNS = 'product_id, sku, name, category, unit, price, stock_qty, reorder_point, is_active';

/** ตรวจและจัดรูปข้อมูลสินค้าจากคำขอ คืน { error } หรือ { data } */
function parseProduct(body, { partial = false } = {}) {
  const out = {};
  const b = body || {};
  const str = (k, max) => {
    if (b[k] === undefined) return partial ? undefined : '';
    return String(b[k]).trim().slice(0, max);
  };
  out.sku = str('sku', 30);
  out.name = str('name', 150);
  out.category = str('category', 50);
  out.unit = str('unit', 20);
  if (!partial || b.price !== undefined) {
    out.price = Number(b.price);
    if (!Number.isFinite(out.price) || out.price < 0) return { error: 'ราคาต้องเป็นตัวเลขไม่ติดลบ' };
  }
  if (!partial || b.reorderPoint !== undefined) {
    out.reorder_point = Number(b.reorderPoint ?? 0);
    if (!Number.isInteger(out.reorder_point) || out.reorder_point < 0) return { error: 'จุดสั่งซื้อเพิ่มต้องเป็นจำนวนเต็มไม่ติดลบ' };
  }
  if (b.isActive !== undefined) out.is_active = Boolean(b.isActive);
  for (const k of ['sku', 'name', 'category', 'unit']) {
    if (out[k] === undefined) delete out[k];
    else if (!out[k]) return { error: `ต้องระบุ${{ sku: 'รหัสสินค้า', name: 'ชื่อสินค้า', category: 'หมวดหมู่', unit: 'หน่วยนับ' }[k]}` };
  }
  return { data: out };
}

/** GET /api/products?q=&category=&all=1 — กรองหมวดแล้วค้นด้วยรหัสหรือชื่อ ปกติเห็นเฉพาะที่ยังขายอยู่ */
async function list(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const includeInactive = req.query.all === '1' && req.user.role === 'manager';
    const where = includeInactive ? [] : ['is_active = TRUE'];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    if (q) { where.push('(sku LIKE ? OR name LIKE ?)'); params.push(`${q}%`, `%${q}%`); }
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY sku LIMIT 200`,
      params
    );
    // รายชื่อหมวดส่งไปพร้อมกัน ให้หน้าจอวาดปุ่มกรองได้โดยไม่ต้องมีเส้นทางเพิ่ม (ตาราง 3.18 คงเดิม)
    const [cats] = await pool.query(
      `SELECT category, COUNT(*) AS n FROM products ${includeInactive ? '' : 'WHERE is_active = TRUE'} GROUP BY category ORDER BY n DESC`
    );
    return res.json({ products: rows, categories: cats.map((c) => c.category) });
  } catch (err) { return next(err); }
}

/** GET /api/products/:id */
async function getById(req, res, next) {
  try {
    const [[row]] = await pool.query(`SELECT ${COLUMNS} FROM products WHERE product_id = ?`, [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    return res.json({ product: row });
  } catch (err) { return next(err); }
}

/** POST /api/products  { sku, name, unit, price, reorderPoint } */
async function create(req, res, next) {
  try {
    const parsed = parseProduct(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const d = parsed.data;
    const productId = await withTransaction(async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO products (sku, name, category, unit, price, reorder_point) VALUES (?, ?, ?, ?, ?, ?)',
        [d.sku, d.name, d.category, d.unit, d.price, d.reorder_point]
      );
      await auditLog.record(conn, { userId: req.user.userId, action: 'CREATE_PRODUCT', entityType: 'product', entityId: result.insertId, ip: clientIp(req) });
      return result.insertId;
    });
    const [[row]] = await pool.query(`SELECT ${COLUMNS} FROM products WHERE product_id = ?`, [productId]);
    return res.status(201).json({ product: row });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'รหัสสินค้านี้มีอยู่แล้ว' });
    return next(err);
  }
}

/** PUT /api/products/:id — แก้ได้ทุกช่องยกเว้น stock_qty (ต้องผ่าน adjustStock เพื่อให้มีประวัติ) */
async function update(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const parsed = parseProduct(req.body, { partial: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const d = parsed.data;
    const keys = Object.keys(d);
    if (keys.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' });

    const updated = await withTransaction(async (conn) => {
      const [result] = await conn.query(
        `UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE product_id = ?`,
        [...keys.map((k) => d[k]), productId]
      );
      if (result.affectedRows === 0) return false;
      await auditLog.record(conn, { userId: req.user.userId, action: 'UPDATE_PRODUCT', entityType: 'product', entityId: productId, ip: clientIp(req) });
      return true;
    });
    if (!updated) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    const [[row]] = await pool.query(`SELECT ${COLUMNS} FROM products WHERE product_id = ?`, [productId]);
    return res.json({ product: row });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'รหัสสินค้านี้มีอยู่แล้ว' });
    return next(err);
  }
}

/**
 * PATCH /api/products/:id/stock  { change, reason, note }
 * change  จำนวนที่เปลี่ยน บวก = เพิ่ม ลบ = ลด (ห้ามศูนย์)
 * reason  'receive' รับสินค้าเข้า | 'manual_adjust' ปรับตามการนับจริง (ต้องมี note)
 *
 * ทั้ง UPDATE products และ INSERT stock_movements อยู่ในธุรกรรมเดียว (BR-02)
 * ยอดใหม่ต้องไม่ติดลบ — ตรวจในโปรแกรมก่อน และฐานข้อมูลมี CHECK เป็นชั้นสุดท้าย (3.7.2 ข้อ 4)
 *
 * หลัง commit เรียก alert ตรวจจุดสั่งซื้อเพิ่ม — BR-05: "ตรวจเองหลังทุกครั้งที่สต็อกเปลี่ยน"
 */
async function adjustStock(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const change = Number(req.body?.change);
    const reason = req.body?.reason;
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 255) : null;
    if (!Number.isInteger(change) || change === 0) return res.status(400).json({ error: 'จำนวนที่เปลี่ยนต้องเป็นจำนวนเต็มที่ไม่ใช่ศูนย์' });
    if (!['receive', 'manual_adjust'].includes(reason)) return res.status(400).json({ error: 'เหตุผลต้องเป็น receive หรือ manual_adjust' });
    if (reason === 'manual_adjust' && !note) return res.status(400).json({ error: 'การปรับสต็อกด้วยมือต้องระบุเหตุผล' });

    const result = await withTransaction(async (conn) => {
      // ล็อกแถวสินค้าไว้จนจบธุรกรรม ไม่ให้การจ่ายสินค้าที่เกิดพร้อมกันอ่านยอดเก่า (2.1.3)
      const [[row]] = await conn.query('SELECT stock_qty FROM products WHERE product_id = ? FOR UPDATE', [productId]);
      if (!row) return { notFound: true };
      const balanceAfter = row.stock_qty + change;
      if (balanceAfter < 0) return { error: `ยอดคงเหลือจะติดลบ (มี ${row.stock_qty} ปรับ ${change})` };

      await conn.query('UPDATE products SET stock_qty = ? WHERE product_id = ?', [balanceAfter, productId]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, order_id, change_qty, balance_after, reason, note, created_by)
         VALUES (?, NULL, ?, ?, ?, ?, ?)`,
        [productId, change, balanceAfter, reason, note, req.user.userId]
      );
      await auditLog.record(conn, { userId: req.user.userId, action: 'ADJUST_STOCK', entityType: 'product', entityId: productId, ip: clientIp(req) });
      return { balanceAfter };
    });
    if (result.notFound) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    if (result.error) return res.status(409).json({ error: result.error });
    await alert.checkStock([productId]); // นอกธุรกรรม (BR-05)
    return res.json({ productId, stockQty: result.balanceAfter });
  } catch (err) { return next(err); }
}

module.exports = { list, getById, create, update, adjustStock };
