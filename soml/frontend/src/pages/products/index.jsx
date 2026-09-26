// จัดการข้อมูลสินค้า                          [ตารางที่ 3.15 หน้าจอ 7 · ตารางที่ 3.21 · UC-02]
// งานเดียว: ตารางสินค้า · แก้ราคา/จุดสั่งซื้อเพิ่ม · ปรับสต็อกด้วยมือพร้อมเหตุผล
// ช่อง "คงเหลือ" แก้ตรง ๆ ไม่ได้ — ต้องผ่าน "ปรับสต็อก" เพื่อให้มีประวัติเสมอ (3.7.2 ข้อ 2)
import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import { baht, int } from '../../components/Money.jsx';
import { api } from '../../services/api.js';

const EMPTY = { sku: '', name: '', category: '', unit: '', price: '', reorderPoint: 0 };

export default function Products() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);   // แถวที่กำลังแก้ราคา/จุดสั่งซื้อเพิ่ม
  const [adjust, setAdjust] = useState(null);     // สินค้าที่กำลังปรับสต็อก
  const [creating, setCreating] = useState(null); // ฟอร์มเพิ่มสินค้า
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api.get(`/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&all=1`)
    .then((r) => { setRows(r.products); setCategories(r.categories); }).catch((e) => setError(e.message)), [q, category]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const flash = (m) => { setMsg(m); setError(null); setTimeout(() => setMsg(null), 3000); };
  const fail = (e) => { setError(e.message); setMsg(null); };

  const saveEdit = async () => {
    try {
      await api.put(`/products/${editing.product_id}`, { category: editing.category, price: Number(editing.price), reorderPoint: Number(editing.reorder_point), isActive: !!editing.is_active });
      flash(`บันทึก ${editing.name} แล้ว`); setEditing(null); load();
    } catch (e) { fail(e); }
  };
  const saveAdjust = async () => {
    try {
      const r = await api.patch(`/products/${adjust.product_id}/stock`, { change: Number(adjust.change), reason: adjust.reason, note: adjust.note });
      flash(`${adjust.name} คงเหลือใหม่ ${int(r.stockQty)}`); setAdjust(null); load();
    } catch (e) { fail(e); }
  };
  const saveCreate = async () => {
    try {
      await api.post('/products', { ...creating, price: Number(creating.price), reorderPoint: Number(creating.reorderPoint) });
      flash(`เพิ่ม ${creating.name} แล้ว`); setCreating(null); load();
    } catch (e) { fail(e); }
  };

  return (
    <Layout title="จัดการข้อมูลสินค้า">
      <div className="toolbar">
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: 17 }}>
          <option value="">ทุกหมวด</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="search" style={{ marginBottom: 0, flex: 1 }} placeholder="ค้นหาชื่อหรือรหัส" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => setCreating({ ...EMPTY })}>+ เพิ่มสินค้า</button>
      </div>
      {msg && <div className="alert ok">{msg}</div>}
      {error && <div className="alert crit">{error}</div>}

      {creating && (
        <div className="card form-row">
          <h2>เพิ่มสินค้า</h2>
          <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="grid5">
            <label>รหัส<input value={creating.sku} onChange={(e) => setCreating({ ...creating, sku: e.target.value })} /></label>
            <label>ชื่อ<input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} /></label>
            <label>หมวดหมู่<input list="cat-list" value={creating.category} onChange={(e) => setCreating({ ...creating, category: e.target.value })} placeholder="เช่น ปูน" /></label>
            <label>หน่วย<input value={creating.unit} onChange={(e) => setCreating({ ...creating, unit: e.target.value })} /></label>
            <label>ราคา<input type="number" step="0.01" value={creating.price} onChange={(e) => setCreating({ ...creating, price: e.target.value })} /></label>
            <label>จุดสั่งซื้อเพิ่ม<input type="number" value={creating.reorderPoint} onChange={(e) => setCreating({ ...creating, reorderPoint: e.target.value })} /></label>
          </div>
          <div className="qactions"><button className="btn green" onClick={saveCreate}>บันทึก</button><button className="btn ghost" onClick={() => setCreating(null)}>ยกเลิก</button></div>
          <small className="muted">สต็อกเริ่มที่ 0 — รับสินค้าเข้าด้วย "ปรับสต็อก" เพื่อให้มีประวัติการรับเข้า</small>
        </div>
      )}

      {adjust && (
        <div className="card form-row">
          <h2>ปรับสต็อก: {adjust.name} <small className="muted">คงเหลือ {int(adjust.stock_qty)} {adjust.unit}</small></h2>
          <div className="grid5">
            <label>เหตุผล
              <select value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}>
                <option value="receive">รับสินค้าเข้า</option>
                <option value="manual_adjust">ปรับตามการนับจริง</option>
              </select>
            </label>
            <label>จำนวน (+เพิ่ม / −ลด)<input type="number" value={adjust.change} onChange={(e) => setAdjust({ ...adjust, change: e.target.value })} autoFocus /></label>
            <label style={{ gridColumn: 'span 3' }}>หมายเหตุ{adjust.reason === 'manual_adjust' && ' (จำเป็น)'}<input value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} placeholder="เช่น นับจริงได้ 35 ถุง / ของเสียหาย 2 ถุง" /></label>
          </div>
          <div className="qactions"><button className="btn green" onClick={saveAdjust} disabled={!Number(adjust.change)}>บันทึกการปรับสต็อก</button><button className="btn ghost" onClick={() => setAdjust(null)}>ยกเลิก</button></div>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>รหัส</th><th>สินค้า</th><th>หมวด</th><th className="num">ราคา</th><th className="num">คงเหลือ</th><th className="num">จุดสั่งซื้อเพิ่ม</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => editing?.product_id === p.product_id ? (
              <tr key={p.product_id} className="editing">
                <td>{p.sku}</td>
                <td>{p.name}<br /><label className="inline"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> เปิดขาย</label></td>
                <td><input list="cat-list" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={{ width: 120 }} /></td>
                <td className="num"><input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} style={{ width: 110 }} /></td>
                <td className="num muted">{int(p.stock_qty)} {p.unit}</td>
                <td className="num"><input type="number" value={editing.reorder_point} onChange={(e) => setEditing({ ...editing, reorder_point: e.target.value })} style={{ width: 90 }} /></td>
                <td className="num qactions"><button className="btn small green" onClick={saveEdit}>บันทึก</button><button className="btn small ghost" onClick={() => setEditing(null)}>ยกเลิก</button></td>
              </tr>
            ) : (
              <tr key={p.product_id} className={p.is_active ? '' : 'inactive'}>
                <td>{p.sku}</td>
                <td>{p.name}{!p.is_active && <small className="muted"> (ปิดขาย)</small>}</td>
                <td><span className="chip static">{p.category}</span></td>
                <td className="num">{baht(p.price)}</td>
                <td className={`num ${p.reorder_point > 0 && p.stock_qty < p.reorder_point ? 'crit' : ''}`}>{int(p.stock_qty)} {p.unit}</td>
                <td className="num">{int(p.reorder_point)}</td>
                <td className="num qactions"><button className="btn small ghost" onClick={() => setEditing({ ...p })}>แก้ไข</button><button className="btn small" onClick={() => setAdjust({ ...p, change: '', reason: 'receive', note: '' })}>ปรับสต็อก</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length >= 200 && <div className="muted">แสดง 200 รายการแรก — พิมพ์ค้นหาเพื่อกรอง</div>}
      </div>
    </Layout>
  );
}
