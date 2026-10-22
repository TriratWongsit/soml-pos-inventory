// หน้าลูกหนี้ขายเชื่อ (ผู้จัดการ)                              [คอมเมนต์กรรมการ K-6 · UC-13 · FR-11]
//
// งานเดียว: ดูว่าใครค้างเท่าไร ใบไหน แล้วรับชำระ (จ่ายทีละส่วนได้)
// โหลดใหม่เองเมื่อมีการขายเชื่อใหม่หรือรับชำระจากอีกเครื่อง
import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import { baht } from '../../components/Money.jsx';
import { api } from '../../services/api.js';
import { subscribe } from '../../services/events.js';

const METHOD = { cash: 'เงินสด', promptpay: 'QR พร้อมเพย์', transfer: 'โอนเงิน' };
const day = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

export default function Credit() {
  const [data, setData] = useState(null);
  const [paying, setPaying] = useState(null);   // { order, amount, method }
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api.get('/credit').then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); return subscribe((ev) => { if (ev === 'order.payment' || ev === 'order.created' || ev === 'order.status' || ev === 'connected') load(); }); }, [load]);

  const submit = async () => {
    try {
      const r = await api.post(`/orders/${paying.order.order_id}/payments`, { amount: Number(paying.amount), method: paying.method });
      setMsg(r.settled ? `${r.orderNo} ชำระครบแล้ว` : `รับชำระ ${baht(r.received)} บาท · ${r.orderNo} ค้างอีก ${baht(r.outstanding)} บาท`);
      setPaying(null); setError(null); load();
    } catch (e) { setError(e.message); }
  };

  return (
    <Layout title="ลูกหนี้ขายเชื่อ">
      {msg && <div className="alert ok" style={{ marginBottom: 10 }}>{msg}</div>}
      {error && <div className="alert crit" style={{ marginBottom: 10 }}>{error}</div>}
      {data && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="report-sum">
            <div><small>ยอดค้างรวม</small><b>{baht(data.totalOutstanding)} ฿</b></div>
            <div><small>ลูกค้าที่ค้าง</small><b>{data.customers.length} ราย</b></div>
          </div>
        </div>
      )}
      {data && data.customers.length === 0 && <div className="card center muted">ไม่มีลูกหนี้ค้างชำระ</div>}
      {data && data.customers.map((c) => (
        <div className="card" key={c.customer_id} style={{ marginBottom: 12 }}>
          <div className="qhead"><b className="qno">{c.name}</b>{c.phone && <small className="muted">{c.phone}</small>}<span className="badge pay-credit">ค้าง {baht(c.outstanding)} ฿</span></div>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>เลขที่</th><th>วันที่ขาย</th><th className="num">ยอดขาย</th><th className="num">ชำระแล้ว</th><th className="num">ค้าง</th><th></th></tr></thead>
            <tbody>
              {c.orders.map((o) => (
                <tr key={o.order_id}>
                  <td>{o.order_no}</td><td>{day(o.paid_at)}</td>
                  <td className="num">{baht(o.total_amount)}</td><td className="num">{baht(o.paid_amount)}</td><td className="num"><b>{baht(o.outstanding)}</b></td>
                  <td className="num"><button className="btn small" onClick={() => setPaying({ order: o, amount: o.outstanding, method: 'cash' })}>รับชำระ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {paying && c.orders.some((o) => o.order_id === paying.order.order_id) && (
            <div className="confirm-box" style={{ marginTop: 10 }}>
              <div><b>รับชำระ {paying.order.order_no}</b> (ค้าง {baht(paying.order.outstanding)} บาท)</div>
              <div className="new-cust">
                <input type="number" min="0.01" step="0.01" value={paying.amount} onChange={(e) => setPaying({ ...paying, amount: e.target.value })} aria-label="จำนวนเงิน" />
                <select value={paying.method} onChange={(e) => setPaying({ ...paying, method: e.target.value })} aria-label="วิธีรับเงิน">
                  {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <button className="btn big green" onClick={submit} disabled={!(Number(paying.amount) > 0)}>ยืนยันรับเงิน</button>
              <button className="btn ghost" style={{ width: '100%' }} onClick={() => setPaying(null)}>ยกเลิก</button>
            </div>
          )}
        </div>
      ))}
    </Layout>
  );
}
