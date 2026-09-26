// แดชบอร์ดปฏิบัติการ                        [ตารางที่ 3.15 หน้าจอ 5 · ตารางที่ 3.21 · UC-08 · BR-04]
// บนสุดคือกล่องต้องดูแลวันนี้ (UC-08 ข้อ 3) รวมสามเรื่องจากข้อมูลที่มีอยู่แล้ว: คิวที่รอเกินเกณฑ์ ·
// สินค้าที่ต่ำกว่าจุดสั่งซื้อเพิ่ม · การแจ้งเตือนที่ยังไม่อ่าน แล้วตามด้วยตัวเลขใหญ่ (3.9.1 ข้อสอง)
// ดึงใหม่เมื่อมีเหตุการณ์จากหลังบ้าน เพราะทุกตัวเลขคำนวณสด ไม่มีค่าสรุปค้าง
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Icon from '../../components/Icon.jsx';
import { baht, int } from '../../components/Money.jsx';
import { api } from '../../services/api.js';
import { subscribe } from '../../services/events.js';
import { useSession } from '../../services/session.jsx';
import { useUnreadCount } from '../../services/unread.js';

// หนึ่งเรื่องในกล่องต้องดูแล — มีลิงก์เมื่อผู้ใช้มีสิทธิ์เปิดหน้าที่ใช้จัดการ (UC-08 A1)
function Item({ tone, icon, title, detail, to, linkLabel }) {
  const body = (
    <>
      <span className="att-icon"><Icon name={icon} /></span>
      <span className="att-body">
        <span className="att-title">{title}</span>
        <span className="att-detail">{detail}</span>
        {to && <span className="att-link">{linkLabel} →</span>}
      </span>
    </>
  );
  return to ? <Link to={to} className={`att ${tone}`}>{body}</Link> : <div className={`att ${tone}`}>{body}</div>;
}

export default function DashboardOps() {
  const { user } = useSession();
  const unread = useUnreadCount(true);
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.get('/dashboard/ops').then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); const stop = subscribe(() => load()); const t = setInterval(load, 60_000); return () => { stop(); clearInterval(t); }; }, [load]);

  const items = [];
  if (d?.queue.delayed.length) {
    const first = d.queue.delayed[0];
    items.push(<Item key="q" tone="warn" icon="clock" to="/queue" linkLabel="ไปที่คิวรอจ่ายสินค้า"
      title={`คิวรอนานเกิน ${int(d.queue.threshold_minutes)} นาที · ${int(d.queue.delayed.length)} ใบ`}
      detail={`${first.order_no} รอมาแล้ว ${int(first.wait_minutes)} นาที${d.queue.delayed.length > 1 ? ` และอีก ${d.queue.delayed.length - 1} ใบ` : ''}`} />);
  }
  if (d?.lowStock.length) {
    const first = d.lowStock[0];
    items.push(<Item key="s" tone="warn" icon="box" to={user.role === 'manager' ? '/products' : null} linkLabel="ไปที่สินค้า"
      title={`ต่ำกว่าจุดสั่งซื้อเพิ่ม · ${int(d.lowStock.length)} รายการ`}
      detail={`${first.name} คงเหลือ ${int(first.stock_qty)} ${first.unit}${d.lowStock.length > 1 ? ` และอีก ${d.lowStock.length - 1} รายการ` : ''}`} />);
  }
  if (unread > 0) {
    items.push(<Item key="n" tone="" icon="bell" to="/notifications" linkLabel="ไปที่การแจ้งเตือน"
      title={`แจ้งเตือนที่ยังไม่อ่าน · ${int(unread)} รายการ`} detail="สินค้าใกล้หมดหรือคิวค้างที่ยังไม่มีใครรับทราบ" />);
  }

  return (
    <Layout title="แดชบอร์ดปฏิบัติการ" actions={d && <span className="live">คำนวณสดเมื่อ {new Date(d.generatedAt).toLocaleTimeString('th-TH')}</span>}>
      {error && <div className="alert crit">{error}</div>}
      {d && (
        <>
          <section className="card">
            <div className="attention-head"><h2>ต้องดูแลวันนี้</h2><span className="badge">{items.length}</span></div>
            {items.length ? <div className="attention">{items}</div> : <div className="all-clear">ไม่มีเรื่องต้องดูแล</div>}
          </section>
          <div className="stats">
            <div className="card stat"><small>ยอดขายวันนี้</small><b>{baht(d.today.revenue)} ฿</b><span className="muted">{int(d.today.orders)} คำสั่งซื้อ</span></div>
            <div className={`card stat ${d.queue.longest_wait_minutes >= d.queue.threshold_minutes ? 'bad' : ''}`}><small>คิวรอจ่ายสินค้า</small><b>{int(d.queue.waiting)}</b><span className="muted">รอนานสุด {int(d.queue.longest_wait_minutes)} นาที</span></div>
            <div className={`card stat ${d.lowStock.length ? 'bad' : ''}`}><small>ต่ำกว่าจุดสั่งซื้อเพิ่ม</small><b>{int(d.lowStock.length)}</b><span className="muted">รายการ</span></div>
          </div>
          <div className="card">
            <h2>สินค้าที่ต่ำกว่าจุดสั่งซื้อเพิ่ม</h2>
            {d.lowStock.length === 0 ? <div className="muted">ไม่มี — หรือยังไม่ได้ตั้งจุดสั่งซื้อเพิ่มในหน้า <Link to="/products">สินค้า</Link></div> : (
              <table>
                <thead><tr><th>สินค้า</th><th className="num">คงเหลือ</th><th className="num">จุดสั่งซื้อเพิ่ม</th><th className="num">ขาด</th></tr></thead>
                <tbody>{d.lowStock.map((p) => <tr key={p.product_id}><td>{p.name}<br /><small className="muted">{p.sku}</small></td><td className="num">{int(p.stock_qty)} {p.unit}</td><td className="num">{int(p.reorder_point)}</td><td className="num crit">{int(p.reorder_point - p.stock_qty)}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
