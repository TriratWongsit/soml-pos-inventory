// การแจ้งเตือน                                [ตารางที่ 3.15 หน้าจอ 8 · UC-11 · FR-08]
// งานเดียว: เห็นการแจ้งเตือนที่ยังไม่อ่านก่อน · ผู้จัดการทำเครื่องหมายอ่านแล้ว (พนักงานคลังอ่านอย่างเดียว)
import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import { api } from '../../services/api.js';
import { subscribe } from '../../services/events.js';
import { notifyUnreadChanged } from '../../services/unread.js';
import { useSession } from '../../services/session.jsx';

const TYPE = { low_stock: 'สินค้าใกล้หมด', queue_delay: 'คิวค้าง' };

export default function Notifications() {
  const { user } = useSession();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.get('/notifications').then((r) => setRows(r.notifications)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); const stop = subscribe((ev) => { if (ev === 'notification.created') load(); }); return stop; }, [load]);

  const markRead = async (id) => { try { await api.patch(`/notifications/${id}/read`); load(); notifyUnreadChanged(); } catch (e) { setError(e.message); } };
  const unread = rows.filter((n) => !n.is_read);

  return (
    <Layout title={`การแจ้งเตือน${unread.length ? ` (${unread.length} ยังไม่อ่าน)` : ''}`}>
      {error && <div className="alert crit">{error}</div>}
      {rows.length === 0 && <div className="card center muted">ยังไม่มีการแจ้งเตือน</div>}
      <div className="notif-list">
        {rows.map((n) => (
          <div key={n.notification_id} className={`card notif ${n.type} ${n.is_read ? 'read' : ''}`}>
            <div>
              <span className={`badge ${n.type}`}>{TYPE[n.type]}</span>
              <div className="notif-msg">{n.message}</div>
              <small className="muted">{new Date(n.created_at).toLocaleString('th-TH')}</small>
            </div>
            {!n.is_read && user.role === 'manager' && <button className="btn small ghost" onClick={() => markRead(n.notification_id)}>อ่านแล้ว</button>}
          </div>
        ))}
      </div>
    </Layout>
  );
}
