// แดชบอร์ดระดับบริหาร                        [ตารางที่ 3.15 หน้าจอ 6 · ตารางที่ 3.21 · UC-09 · BR-04]
// งานเดียว: แนวโน้มยอดขายย้อนหลัง และสินค้าขายดี — แท่งกราฟวาดด้วย CSS ไม่ต้องไลบรารี
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import { baht, int } from '../../components/Money.jsx';
import { api } from '../../services/api.js';

export default function DashboardExec() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get(`/dashboard/exec?days=${days}`).then(setD).catch((e) => setError(e.message)); }, [days]);
  const max = d ? Math.max(1, ...d.trend.map((t) => Number(t.revenue))) : 1;

  return (
    <Layout title="แดชบอร์ดระดับบริหาร">
      <div className="toolbar">
        {[7, 30, 90].map((n) => <button key={n} className={`btn small ${days === n ? '' : 'ghost'}`} onClick={() => setDays(n)}>{n} วัน</button>)}
      </div>
      {error && <div className="alert crit">{error}</div>}
      {d && (
        <>
          <div className="stats">
            <div className="card stat"><small>ยอดขาย {days} วัน</small><b>{baht(d.total.revenue)} ฿</b><span className="muted">{int(d.total.orders)} คำสั่งซื้อ</span></div>
            <div className="card stat"><small>เฉลี่ยต่อคำสั่งซื้อ</small><b>{baht(d.total.orders ? d.total.revenue / d.total.orders : 0)} ฿</b></div>
          </div>
          <div className="card">
            <h2>แนวโน้มยอดขายรายวัน</h2>
            {d.trend.length === 0 ? <div className="muted">ยังไม่มียอดขายในช่วงนี้</div> : (
              <div className="bars">
                {d.trend.map((t) => (
                  <div key={t.day} className="bar" title={`${new Date(t.day).toLocaleDateString('th-TH')} — ${baht(t.revenue)} ฿ (${t.orders} ใบ)`}>
                    <div className="fill" style={{ height: `${(Number(t.revenue) / max) * 100}%` }} />
                    <small>{new Date(t.day).getDate()}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2>สินค้าขายดี {days} วัน</h2>
            <table>
              <thead><tr><th>#</th><th>สินค้า</th><th className="num">จำนวน</th><th className="num">ยอดขาย</th></tr></thead>
              <tbody>{d.topProducts.map((p, i) => <tr key={p.product_id}><td>{i + 1}</td><td>{p.name}</td><td className="num">{int(p.qty_sold)} {p.unit}</td><td className="num">{baht(p.revenue)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}
