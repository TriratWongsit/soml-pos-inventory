// หน้าจัดการข้อมูลสินค้าและจุดสั่งซื้อเพิ่ม   [FR-02 · UC-02 · TC-02]
import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api, baht, int } from '../api.js';

const EMPTY = { sku: '', name: '', unit: '', price: '', stock_qty: '', reorder_point: '' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);   // product_id ที่กำลังแก้ไข
  const [draft, setDraft] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const reload = () => api.get('/products').then((r) => setProducts(r.products)).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const startEdit = (p) => {
    setError(null); setMessage(null); setCreating(false); setEditing(p.product_id);
    setDraft({ sku: p.sku, name: p.name, unit: p.unit, price: p.price, stock_qty: p.stock_qty, reorder_point: p.reorder_point });
  };

  const save = async () => {
    setError(null);
    try {
      if (creating) {
        await api.post('/products', draft);
        setMessage(`เพิ่มสินค้า ${draft.name} เรียบร้อย`);
      } else {
        const res = await api.put(`/products/${editing}`, draft);
        const changed = Object.keys(res.changes || {});
        setMessage(changed.length ? `บันทึกการแก้ไข ${draft.name} เรียบร้อย (${changed.join(', ')})` : 'ไม่มีการเปลี่ยนแปลง');
      }
      setEditing(null); setCreating(false); setDraft(EMPTY);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const field = (key, label, type = 'text') => (
    <div className="field">
      <label htmlFor={`f-${key}`}>{label}</label>
      <input id={`f-${key}`} type={type} value={draft[key]}
             onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
    </div>
  );

  return (
    <Layout
      title="จัดการข้อมูลสินค้า"
      actions={
        <button className="btn small" onClick={() => { setCreating(true); setEditing(null); setDraft(EMPTY); setMessage(null); }}>
          เพิ่มสินค้าใหม่
        </button>
      }
    >
      {message && <div className="alert ok"><span>{message}</span></div>}
      {error && <div className="alert crit"><span>{error}</span></div>}

      {(creating || editing) && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h2>{creating ? 'เพิ่มสินค้าใหม่' : 'แก้ไขข้อมูลสินค้า'}</h2>
          {field('sku', 'รหัสสินค้า')}
          {field('name', 'ชื่อสินค้า')}
          {field('unit', 'หน่วยนับ')}
          {field('price', 'ราคาต่อหน่วย (บาท)', 'number')}
          {field('stock_qty', 'จำนวนคงเหลือ', 'number')}
          {field('reorder_point', 'จุดสั่งซื้อเพิ่ม', 'number')}
          <button className="btn" onClick={save}>บันทึก</button>
          <button className="btn ghost" style={{ marginLeft: 10 }}
                  onClick={() => { setEditing(null); setCreating(false); setDraft(EMPTY); }}>ยกเลิก</button>
        </div>
      )}

      <div className="card">
        <input className="search" type="text" placeholder="ค้นหาด้วยชื่อสินค้าหรือรหัสสินค้า"
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>รหัส</th><th>ชื่อสินค้า</th><th>หน่วย</th>
              <th className="num">ราคา</th><th className="num">คงเหลือ</th><th className="num">จุดสั่งซื้อเพิ่ม</th><th />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.product_id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.unit}</td>
                <td className="num">{baht(p.price)}</td>
                <td className="num">{int(p.stock_qty)}</td>
                <td className="num">
                  {int(p.reorder_point)}
                  {Number(p.below_reorder_point) === 1 && <span className="pill warn" style={{ marginLeft: 8 }}>ต่ำกว่าเกณฑ์</span>}
                </td>
                <td className="num"><button className="btn ghost small" onClick={() => startEdit(p)}>แก้ไข</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
