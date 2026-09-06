// หน้าค้นหาและดูประวัติการทำรายการ   [FR-09 · UC-10 · TC-12]
import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { ROLE_LABEL } from '../auth.jsx';

const ACTION_LABEL = {
  LOGIN: 'เข้าสู่ระบบ',
  LOGIN_FAILED: 'เข้าสู่ระบบไม่สำเร็จ',
  CREATE_ORDER: 'สร้างคำสั่งซื้อ',
  CONFIRM_DISPATCH: 'ยืนยันจ่ายสินค้า',
  UPDATE_ORDER_STATUS: 'เปลี่ยนสถานะคำสั่งซื้อ',
  CREATE_PRODUCT: 'เพิ่มสินค้า',
  UPDATE_PRODUCT: 'แก้ไขข้อมูลสินค้า',
  ADJUST_STOCK: 'ปรับปรุงสต็อก',
};

export default function AuditLogs() {
  const [filter, setFilter] = useState({ from: '', to: '', role: '', action: '' });
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  const search = () => {
    const params = new URLSearchParams();
    if (filter.from) params.set('from', `${filter.from} 00:00:00`);
    if (filter.to) params.set('to', `${filter.to} 23:59:59`);
    if (filter.role) params.set('role', filter.role);
    if (filter.action) params.set('action', filter.action);
    api.get(`/audit-logs?${params}`).then((r) => setLogs(r.logs)).catch((e) => setError(e.message));
  };

  useEffect(() => { search(); }, []);

  const set = (key) => (e) => setFilter((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Layout title="ประวัติการทำรายการ">
      {error && <div className="alert crit"><span>{error}</span></div>}

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="from">ตั้งแต่วันที่</label>
            <input id="from" type="date" value={filter.from} onChange={set('from')} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="to">ถึงวันที่</label>
            <input id="to" type="date" value={filter.to} onChange={set('to')} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="role">บทบาทผู้กระทำ</label>
            <select id="role" value={filter.role} onChange={set('role')}>
              <option value="">ทุกบทบาท</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="action">ประเภทเหตุการณ์</label>
            <select id="action" value={filter.action} onChange={set('action')}>
              <option value="">ทุกเหตุการณ์</option>
              {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button className="btn" onClick={search}>ค้นหา</button>
        </div>
      </div>

      <div className="card">
        <h2>ผลการค้นหา {logs.length} รายการ</h2>
        <table>
          <thead><tr><th>เวลา</th><th>ผู้กระทำ</th><th>บทบาท</th><th>เหตุการณ์</th><th>ข้อมูลที่ถูกกระทำ</th><th>ไอพี</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.log_id}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('th-TH')}</td>
                <td>{l.full_name || <span className="muted">ระบบ</span>}</td>
                <td>{ROLE_LABEL[l.role] || '-'}</td>
                <td>{ACTION_LABEL[l.action] || l.action}</td>
                <td className="muted">
                  {l.entity_type ? `${l.entity_type} #${l.entity_id}` : '-'}
                  {l.detail && <div style={{ fontSize: 14 }}>{JSON.stringify(l.detail)}</div>}
                </td>
                <td className="muted">{l.ip_address || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="muted">ไม่พบรายการตามเงื่อนไขที่ค้นหา</div>}
      </div>
    </Layout>
  );
}
