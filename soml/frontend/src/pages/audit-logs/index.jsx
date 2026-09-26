// ประวัติการทำรายการ                          [ตารางที่ 3.15 หน้าจอ 9 · ตารางที่ 3.21 · UC-10 · AC-11]
// งานเดียว: กรองตามช่วงเวลาและประเภทการกระทำ → เห็นผู้กระทำ เวลา และข้อมูลที่ถูกกระทำ
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import { api } from '../../services/api.js';

const ACTION_LABEL = {
  LOGIN: 'เข้าสู่ระบบ', CREATE_PRODUCT: 'เพิ่มสินค้า', UPDATE_PRODUCT: 'แก้ไขสินค้า', ADJUST_STOCK: 'ปรับสต็อก',
  CREATE_ORDER: 'สร้างคำสั่งซื้อ', UPDATE_STATUS: 'เปลี่ยนสถานะ', CONFIRM_DISPATCH: 'ยืนยันจ่ายสินค้า',
  CANCEL_ORDER: 'ยกเลิกคำสั่งซื้อ', CREATE_NOTIFICATION: 'ระบบสร้างการแจ้งเตือน', READ_NOTIFICATION: 'อ่านการแจ้งเตือน',
};
const ENTITY_LABEL = { order: 'คำสั่งซื้อ', product: 'สินค้า', notification: 'การแจ้งเตือน' };
// วันที่ตามเวลาเครื่องผู้ใช้ ไม่ใช่ UTC — toISOString() ให้วัน UTC ซึ่งช่วงเที่ยงคืนถึง 7 โมงเช้าไทยยังเป็น "เมื่อวาน"
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDate();

export default function AuditLogs() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [action, setAction] = useState('');
  const [data, setData] = useState({ logs: [], actions: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams({ from: `${from} 00:00:00`, to: `${to} 23:59:59`, limit: 300 });
    if (action) p.set('action', action);
    api.get(`/audit-logs?${p}`).then(setData).catch((e) => setError(e.message));
  }, [from, to, action]);

  return (
    <Layout title="ประวัติการทำรายการ">
      <div className="toolbar">
        <label>ตั้งแต่<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>ถึง<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>ประเภทการกระทำ
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {data.actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="alert crit">{error}</div>}
      <div className="card">
        <table>
          <thead><tr><th>เวลา</th><th>ผู้กระทำ</th><th>การกระทำ</th><th>ข้อมูลที่ถูกกระทำ</th><th>ไอพี</th></tr></thead>
          <tbody>
            {data.logs.map((l) => (
              <tr key={l.log_id}>
                <td className="nowrap">{new Date(l.created_at).toLocaleString('th-TH')}</td>
                <td>{l.full_name || <span className="muted">ระบบ</span>}</td>
                <td>{ACTION_LABEL[l.action] || l.action}</td>
                <td>{l.entity_type ? (<><small className="muted">{ENTITY_LABEL[l.entity_type] || l.entity_type}</small><br />{l.entity_label || `#${l.entity_id}`}</>) : '—'}</td>
                <td className="muted">{l.ip_address || '—'}</td>
              </tr>
            ))}
            {data.logs.length === 0 && <tr><td colSpan="5" className="muted">ไม่มีรายการในช่วงที่เลือก</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
