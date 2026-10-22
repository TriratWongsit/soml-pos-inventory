// หน้าการแจ้งเตือนภายในแอปพลิเคชัน   [FR-08 · UC-11]
import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { useRealtime } from '../realtime.js';

const TYPE_LABEL = { low_stock: 'สต็อกต่ำกว่าจุดสั่งซื้อ', queue_delay: 'คิวงานค้างนานผิดปกติ' };

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    api.get('/notifications').then((r) => setItems(r.notifications)).catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);
  useRealtime((evt) => { if (evt.type === 'notification.created') reload(); });

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const unread = items.filter((i) => !i.is_read).length;

  return (
    <Layout title="การแจ้งเตือน" actions={<span className={`pill ${unread ? 'warn' : 'gray'}`}>ยังไม่อ่าน {unread}</span>}>
      {error && <div className="alert crit"><span>{error}</span></div>}
      <div className="card">
        {items.length === 0 ? (
          <div className="muted">ยังไม่มีการแจ้งเตือน</div>
        ) : (
          <table>
            <thead><tr><th>เวลา</th><th>ประเภท</th><th>ข้อความ</th><th>สถานะ</th><th /></tr></thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.notification_id}>
                  <td className="muted">{new Date(n.created_at).toLocaleString('th-TH')}</td>
                  <td><span className={`pill ${n.type === 'low_stock' ? 'warn' : 'info'}`}>{TYPE_LABEL[n.type]}</span></td>
                  <td>{n.message}</td>
                  <td>{n.is_read ? <span className="muted">อ่านแล้ว</span> : <b>ยังไม่อ่าน</b>}</td>
                  <td className="num">
                    {/* การทำเครื่องหมายว่าอ่านแล้วเป็นสิทธิ์ของผู้จัดการ ตาม UC-11 */}
                    {!n.is_read && user.role === 'manager' && (
                      <button className="btn ghost small" onClick={() => markRead(n.notification_id)}>ทำเครื่องหมายว่าอ่านแล้ว</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
