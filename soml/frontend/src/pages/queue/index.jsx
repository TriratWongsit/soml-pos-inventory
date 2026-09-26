// หน้าคิวรอจ่ายสินค้า                       [ตารางที่ 3.15 หน้าจอ 3 · ตารางที่ 3.21 · UC-05, UC-06 · NFR-02, NFR-03]
//
// งานเดียว: เห็นว่ามีอะไรรอจ่าย เรียงตามเวลาชำระ พร้อมเวลารอ แล้วแตะเพื่อไปจัดของ
// โหลดครั้งแรกด้วยคำขอ จากนั้นรอเหตุการณ์ผลักจากหลังบ้าน (order.created/status/dispatched)
// เมื่อได้เหตุการณ์ → ดึงคิวใหม่ ไม่ต้องกดรีเฟรช (AC-06 ภายใน 3 วินาที)
// ใช้บนมือถือในโกดัง: การ์ดใหญ่ แตะได้ทั้งใบ (3.9.3)
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { baht, int } from '../../components/Money.jsx';
import { api } from '../../services/api.js';
import { subscribe } from '../../services/events.js';
import { useSession } from '../../services/session.jsx';

const STATUS_LABEL = { awaiting_dispatch: 'รอจ่ายสินค้า', picking: 'กำลังจัดของ' };
const minutes = (s) => Math.floor(s / 60);

export default function Queue() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now()); // ให้เวลารอเดินบนหน้าจอโดยไม่ต้องถามหลังบ้านทุกนาที

  const load = useCallback(() => api.get('/queue').then((r) => { setQueue(r.queue); setLoadedAt(Date.now()); setError(null); }).catch((e) => setError(e.message)), []);

  useEffect(() => {
    load();
    const stop = subscribe((event) => { setLive(true); if (event.startsWith('order.')) load(); });
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => { stop(); clearInterval(t); };
  }, [load]);

  const startPicking = async (o, e) => {
    e.stopPropagation();
    try { await api.patch(`/orders/${o.order_id}/status`, { status: 'picking' }); } catch (err) { setError(err.message); }
  };
  const undoPicking = async (o, e) => {
    e.stopPropagation();
    try { await api.patch(`/orders/${o.order_id}/status`, { status: 'awaiting_dispatch' }); } catch (err) { setError(err.message); }
  };
  const cancel = async (o, e) => {
    e.stopPropagation();
    if (!window.confirm(`ยกเลิกคำสั่งซื้อ ${o.order_no} ยอด ${baht(o.total_amount)} บาท?\nการยกเลิกย้อนกลับไม่ได้`)) return;
    try { await api.patch(`/orders/${o.order_id}/status`, { status: 'cancelled' }); } catch (err) { setError(err.message); }
  };

  return (
    <Layout title={`คิวรอจ่ายสินค้า (${queue.length})`}>
      <div className="muted" style={{ marginBottom: 10 }}>{live ? '● รับข้อมูลสดจากหน้าร้าน' : '○ กำลังเชื่อมต่อช่องทางสด…'}</div>
      {error && <div className="alert crit">{error}</div>}
      {queue.length === 0 && !error && <div className="card center muted">ไม่มีคำสั่งซื้อรอจ่าย</div>}
      <div className="queue">
        {queue.map((o) => {
          // now เดินทุก 30 วินาที ส่วน loadedAt เปลี่ยนทุกครั้งที่โหลดคิวใหม่ ช่วงที่ now ยังตามไม่ทัน
          // ผลต่างจะติดลบ ทำให้แสดง "รอ -1 นาที" จึงไม่ให้เวลาที่บวกเพิ่มต่ำกว่าศูนย์
          const sinceLoad = Math.max(0, Math.floor((now - loadedAt) / 1000));
          const waitedSeconds = Math.max(0, o.waited_seconds + sinceLoad);
          const waited = minutes(waitedSeconds);
          const late = waitedSeconds >= 30 * 60;
          return (
            <div key={o.order_id} className={`card qcard ${o.status} ${late ? 'late' : ''}`} onClick={() => navigate(`/dispatch/${o.order_id}`)}>
              <div className="qhead">
                <b className="qno">{o.order_no}</b>
                <span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                <span className={`wait ${late ? 'crit' : ''}`}>รอ {waited} นาที</span>
              </div>
              <div className="qitems">
                {o.items.map((i, k) => <div key={k}><span>{i.name}</span><b>{int(i.qty)} {i.unit}</b></div>)}
              </div>
              <div className="qfoot">
                <small className="muted">ขายโดย {o.created_by_name} · {baht(o.total_amount)} ฿</small>
                <div className="qactions">
                  {o.status === 'awaiting_dispatch' && <button className="btn small" onClick={(e) => startPicking(o, e)}>เริ่มจัดของ</button>}
                  {o.status === 'picking' && <button className="btn small ghost" onClick={(e) => undoPicking(o, e)}>ยกเลิกการจัด</button>}
                  {user.role === 'manager' && <button className="btn small ghost red-text" onClick={(e) => cancel(o, e)}>ยกเลิกคำสั่งซื้อ</button>}
                  <button className="btn small green" onClick={(e) => { e.stopPropagation(); navigate(`/dispatch/${o.order_id}`); }}>จ่ายสินค้า ›</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
