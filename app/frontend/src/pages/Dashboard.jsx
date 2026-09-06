// แดชบอร์ดปฏิบัติการ   [FR-07 · UC-08 · รูปที่ 3.18]
import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api, baht, int } from '../api.js';
import { useRealtime } from '../realtime.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    api.get('/dashboard/ops').then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);
  const channel = useRealtime(() => reload());

  if (error) return <Layout title="แดชบอร์ดปฏิบัติการ"><div className="alert crit"><span>{error}</span></div></Layout>;
  if (!data) return <Layout title="แดชบอร์ดปฏิบัติการ"><div className="muted">กำลังโหลด…</div></Layout>;

  const { kpi, stock, alerts } = data;

  return (
    <Layout
      title="แดชบอร์ดปฏิบัติการ"
      actions={<span className={`pill ${channel ? '' : 'gray'}`}><i className="dot" />{channel ? 'ข้อมูลสด' : 'ไม่ได้เชื่อมต่อ'}</span>}
    >
      <div className="kpi">
        <div className="card">
          <div className="lab">ยอดขายวันนี้</div>
          <div className="val">{baht(kpi.salesToday)}</div>
          <div className="sub">{int(kpi.orderCountToday)} คำสั่งซื้อ</div>
        </div>
        <div className="card">
          <div className="lab">คิวคงค้าง</div>
          <div className="val">{int(kpi.queueWaiting)}</div>
          <div className="sub">รอนานสุด {int(kpi.longestWaitMinutes)} นาที</div>
        </div>
        <div className="card">
          <div className="lab">ส่งมอบสำเร็จวันนี้</div>
          <div className="val">{int(kpi.deliveredToday)}</div>
          <div className="sub">คำสั่งซื้อ</div>
        </div>
        <div className="card">
          <div className="lab">สินค้าต่ำกว่าจุดสั่งซื้อ</div>
          {/* ใช้สีแดงเมื่อมีค่ามากกว่าศูนย์ ตามการออกแบบในหัวข้อ 3.8.4 */}
          <div className={`val${kpi.belowReorderPoint > 0 ? ' alarm' : ''}`}>{int(kpi.belowReorderPoint)}</div>
          <div className="sub">รายการ</div>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <h2>ระดับสต็อกเทียบจุดสั่งซื้อเพิ่ม</h2>
          <table>
            <thead>
              <tr><th>สินค้า</th><th className="num">คงเหลือ</th><th className="num">จุดสั่งซื้อ</th><th style={{ width: 150 }}>ระดับ</th></tr>
            </thead>
            <tbody>
              {stock.map((s) => {
                // level_percent คือสัดส่วนของยอดคงเหลือเทียบจุดสั่งซื้อเพิ่ม อาจเกิน 100
                // ความยาวแถบตัดเพดานไว้ที่ 100 แต่การเลือกสีต้องใช้ค่าจริง
                const ratio = Number(s.level_percent ?? 999);
                const percent = Math.max(0, Math.min(100, ratio));
                const tone = s.stock_qty <= s.reorder_point ? 'crit' : ratio < 150 ? 'low' : '';
                return (
                  <tr key={s.product_id}>
                    <td>{s.name}<div className="muted">{s.sku}</div></td>
                    <td className="num">{int(s.stock_qty)} {s.unit}</td>
                    <td className="num">{int(s.reorder_point)}</td>
                    <td><div className="bar"><i className={tone} style={{ width: `${percent}%` }} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>การแจ้งเตือนล่าสุด</h2>
          {alerts.length === 0 ? (
            <div className="muted">ยังไม่มีการแจ้งเตือน</div>
          ) : (
            alerts.map((a) => (
              <div className={`alert ${a.type === 'low_stock' ? 'warn' : 'crit'}`} key={a.notification_id}>
                <span>
                  <span className="t">{a.type === 'low_stock' ? 'สต็อกต่ำ' : 'คิวค้างนาน'}</span>
                  <div>{a.message}</div>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
