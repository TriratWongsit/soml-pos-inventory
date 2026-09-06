// แดชบอร์ดระดับบริหาร   [FR-07 · UC-09]
import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api, baht, int } from '../api.js';

export default function Executive() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/dashboard/exec?days=${days}`).then(setData).catch((e) => setError(e.message));
  }, [days]);

  if (error) return <Layout title="แดชบอร์ดบริหาร"><div className="alert crit"><span>{error}</span></div></Layout>;
  if (!data) return <Layout title="แดชบอร์ดบริหาร"><div className="muted">กำลังโหลด…</div></Layout>;

  const maxSales = Math.max(1, ...data.salesByDay.map((d) => Number(d.total_sales)));

  return (
    <Layout
      title="แดชบอร์ดบริหาร"
      actions={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 150 }}>
          <option value={7}>7 วันล่าสุด</option>
          <option value={30}>30 วันล่าสุด</option>
          <option value={90}>90 วันล่าสุด</option>
        </select>
      }
    >
      <div className="kpi">
        <div className="card"><div className="lab">ยอดขายรวม</div><div className="val">{baht(data.summary.totalSales)}</div><div className="sub">{days} วันล่าสุด</div></div>
        <div className="card"><div className="lab">จำนวนคำสั่งซื้อ</div><div className="val">{int(data.summary.orderCount)}</div><div className="sub">ที่ส่งมอบสำเร็จ</div></div>
        <div className="card"><div className="lab">ยอดเฉลี่ยต่อคำสั่งซื้อ</div><div className="val">{baht(data.summary.averageOrderValue)}</div><div className="sub">บาท</div></div>
        <div className="card">
          <div className="lab">เวลาเฉลี่ยรับชำระถึงจ่ายของ</div>
          <div className="val">{Number(data.summary.averageLeadTimeMinutes).toFixed(1)}</div>
          <div className="sub">นาที · ตัวชี้วัดตามวัตถุประสงค์ข้อ 1.2.2</div>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <h2>ยอดขายรายวัน</h2>
          {data.salesByDay.length === 0 ? (
            <div className="muted">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
          ) : (
            <table>
              <thead><tr><th>วันที่</th><th className="num">คำสั่งซื้อ</th><th className="num">ยอดขาย</th><th style={{ width: 180 }} /></tr></thead>
              <tbody>
                {data.salesByDay.map((d) => (
                  <tr key={String(d.day)}>
                    <td>{new Date(d.day).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</td>
                    <td className="num">{int(d.order_count)}</td>
                    <td className="num">{baht(d.total_sales)}</td>
                    <td><div className="bar"><i style={{ width: `${(Number(d.total_sales) / maxSales) * 100}%` }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>สินค้าขายดี</h2>
          {data.topProducts.length === 0 ? (
            <div className="muted">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
          ) : (
            <table>
              <thead><tr><th>สินค้า</th><th className="num">จำนวน</th><th className="num">ยอดขาย</th></tr></thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.name}</td>
                    <td className="num">{int(p.total_qty)} {p.unit}</td>
                    <td className="num">{baht(p.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
