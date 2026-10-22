// ---------------------------------------------------------------------
// Product Controller — จัดการข้อมูลสินค้าและจุดสั่งซื้อเพิ่ม  [FR-02 · UC-02]
//
// การอ่านรายการสินค้าเปิดให้ทุกบทบาท เพราะหน้าจอขายหน้าร้านต้องแสดงชื่อ
// ราคา และจำนวนคงเหลือ ส่วนการเพิ่ม แก้ไข และตั้งจุดสั่งซื้อเพิ่มจำกัดไว้
// ที่ผู้จัดการเท่านั้น ตามที่อธิบายไว้ในหัวข้อ 3.6.1 ว่าการแก้ราคาและจุด
// สั่งซื้อเพิ่มส่งผลโดยตรงต่อยอดขายและการวางแผนสั่งซื้อสินค้า
// ---------------------------------------------------------------------
const { pool, withTransaction } = require('../config/db');
const auditLog = require('./auditLogService');
const alertEngine = require('./alertEngine');
const { clientIp } = require('../middleware/auth');

/** ตรวจและแปลงข้อมูลสินค้าที่ส่งเข้ามา */
function parseProduct(body, { partial = false } = {}) {
  const out = {};
  const required = ['sku', 'name', 'unit', 'price'];

  for (const key of ['sku', 'name', 'unit']) {
    if (body[key] !== undefined) {
      const value = String(body[key]).trim();
      if (!value) return { error: `ต้องระบุ ${key}` };
      out[key] = value;
    } else if (!partial && required.includes(key)) {
      return { error: `ต้องระบุ ${key}` };
    }
  }

  for (const [key, label] of [['price', 'ราคา'], ['stock_qty', 'จำนวนคงเหลือ'], ['reorder_point', 'จุดสั่งซื้อเพิ่ม']]) {
    const raw = body[key] ?? body[key.replace(/_(\w)/g, (m, c) => c.toUpperCase())];
    if (raw !== undefined) {
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return { error: `${label}ต้องเป็นตัวเลขไม่ติดลบ` };
      if (key !== 'price' && !Number.isInteger(num)) return { error: `${label}ต้องเป็นจำนวนเต็ม` };
      out[key] = num;
    } else if (!partial && key === 'price') {
      return { error: 'ต้องระบุราคา' };
    }
  }

  if (body.isActive !== undefined) out.is_active = Boolean(body.isActive);
  return { product: out };
}

/** รายการสินค้าทั้งหมด พร้อมสถานะว่าต่ำกว่าจุดสั่งซื้อเพิ่มหรือไม่ */
async function list(req, res, next) {
  try {
    const search = String(req.query.q || '').trim();
    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
      `SELECT product_id, sku, name, unit, price, stock_qty, reorder_point, is_active, updated_at,
              (stock_qty <= reorder_point) AS below_reorder_point
         FROM products
         ${where}
        ORDER BY sku`,
      params
    );
    return res.json({ products: rows });
  } catch (err) {
    return next(err);
  }
}

/** เพิ่มสินค้าใหม่ */
async function create(req, res, next) {
  try {
    const parsed = parseProduct(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const p = { stock_qty: 0, reorder_point: 0, ...parsed.product };
    const [result] = await pool.query(
      `INSERT INTO products (sku, name, unit, price, stock_qty, reorder_point) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.sku, p.name, p.unit, p.price, p.stock_qty, p.reorder_point]
    );

    await auditLog.record(null, {
      userId: req.user.userId,
      action: 'CREATE_PRODUCT',
      entityType: 'product',
      entityId: result.insertId,
      detail: p,
      ip: clientIp(req),
    });

    return res.status(201).json({ productId: result.insertId, ...p });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'มีรหัสสินค้านี้อยู่แล้ว' });
    }
    return next(err);
  }
}

/**
 * แก้ไขข้อมูลสินค้า รวมถึงจุดสั่งซื้อเพิ่ม   [TC-02]
 *
 * บันทึกทั้งค่าเดิมและค่าใหม่ลงประวัติการทำรายการ เพื่อให้ตรวจสอบย้อนหลังได้ว่า
 * ใครเปลี่ยนราคาหรือจุดสั่งซื้อเพิ่มเมื่อใด ตามประโยชน์ที่ระบุไว้ในหัวข้อ 1.5.3
 */
async function update(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const parsed = parseProduct(req.body || {}, { partial: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const fields = Object.keys(parsed.product);
    if (fields.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' });

    const [before] = await pool.query('SELECT * FROM products WHERE product_id = ?', [productId]);
    if (before.length === 0) return res.status(404).json({ error: 'ไม่พบสินค้าที่ระบุ' });

    await pool.query(
      `UPDATE products SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE product_id = ?`,
      [...fields.map((f) => parsed.product[f]), productId]
    );

    const changes = {};
    for (const f of fields) {
      if (String(before[0][f]) !== String(parsed.product[f])) {
        changes[f] = { from: before[0][f], to: parsed.product[f] };
      }
    }

    await auditLog.record(null, {
      userId: req.user.userId,
      action: 'UPDATE_PRODUCT',
      entityType: 'product',
      entityId: productId,
      detail: { sku: before[0].sku, changes },
      ip: clientIp(req),
    });

    const [after] = await pool.query('SELECT * FROM products WHERE product_id = ?', [productId]);

    // จุดสั่งซื้อเพิ่มที่ตั้งใหม่อาจทำให้สินค้าที่มีอยู่กลายเป็นต่ำกว่าเกณฑ์ทันที
    const alerts = await alertEngine.checkLowStock([productId]);

    return res.json({ product: after[0], changes, alerts });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'มีรหัสสินค้านี้อยู่แล้ว' });
    }
    return next(err);
  }
}

/**
 * ปรับปรุงจำนวนคงเหลือด้วยมือ เช่น รับสินค้าเข้าหรือแก้ยอดหลังตรวจนับ
 *
 * ต้องเขียนลง stock_movements ทุกครั้งเช่นเดียวกับการตัดสต็อกจากการขาย
 * มิฉะนั้นประวัติการเคลื่อนไหวจะไม่ครบและตรวจสอบย้อนหลังไม่ได้
 */
async function adjustStock(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const changeQty = Number(req.body?.changeQty);
    const reason = req.body?.reason === 'receive' ? 'receive' : 'manual_adjust';
    const note = req.body?.note ? String(req.body.note).slice(0, 255) : null;

    if (!Number.isInteger(changeQty) || changeQty === 0) {
      return res.status(400).json({ error: 'จำนวนที่ปรับต้องเป็นจำนวนเต็มที่ไม่ใช่ศูนย์' });
    }

    const result = await withTransaction(async (conn) => {
      const [rows] = await conn.query(
        'SELECT product_id, name, stock_qty FROM products WHERE product_id = ? FOR UPDATE',
        [productId]
      );
      if (rows.length === 0) {
        const err = new Error('ไม่พบสินค้าที่ระบุ');
        err.status = 404; err.publicMessage = err.message;
        throw err;
      }

      const balanceAfter = rows[0].stock_qty + changeQty;
      if (balanceAfter < 0) {
        const err = new Error(`ปรับแล้วยอดคงเหลือจะติดลบ (คงเหลือ ${rows[0].stock_qty} ปรับ ${changeQty})`);
        err.status = 409; err.publicMessage = err.message;
        throw err;
      }

      await conn.query('UPDATE products SET stock_qty = ? WHERE product_id = ?', [balanceAfter, productId]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, order_id, change_qty, balance_after, reason, note, created_by)
         VALUES (?, NULL, ?, ?, ?, ?, ?)`,
        [productId, changeQty, balanceAfter, reason, note, req.user.userId]
      );
      await auditLog.record(conn, {
        userId: req.user.userId,
        action: 'ADJUST_STOCK',
        entityType: 'product',
        entityId: productId,
        detail: { name: rows[0].name, from: rows[0].stock_qty, to: balanceAfter, changeQty, reason, note },
        ip: clientIp(req),
      });

      return { productId, name: rows[0].name, stockBefore: rows[0].stock_qty, stockAfter: balanceAfter };
    });

    const alerts = await alertEngine.checkLowStock([productId]);
    return res.json({ ...result, alerts });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, create, update, adjustStock, parseProduct };
