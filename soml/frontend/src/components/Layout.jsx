// ---------------------------------------------------------------------
// กรอบหน้าจอร่วม — เมนูด้านข้าง ชื่อผู้ใช้ หัวหน้าจอ และปุ่มสลับโหมด   [3.9.1 · 3.9.2 · ตารางที่ 3.15]
//
// ผู้ใช้เห็นเฉพาะเมนูของงานตน (เมนูหายไม่ใช่การป้องกัน — หลังบ้านตรวจสิทธิ์อีกชั้นเสมอ AC-01)
// เมนูการแจ้งเตือนมีตัวเลขจำนวนที่ยังไม่อ่าน (UC-11) · จอแคบกว่า 900px เมนูย้ายขึ้นด้านบน (NFR-03)
// ---------------------------------------------------------------------
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../services/session.jsx';
import { useUnreadCount } from '../services/unread.js';
import Icon from './Icon.jsx';
import ThemeToggle from './ThemeToggle.jsx';

// ตารางที่ 3.15 หน้าจอของระบบและบทบาทที่เข้าถึงได้
const MENU = [
  { to: '/pos', label: 'ขายหน้าร้าน', icon: 'pos', roles: ['sales', 'manager'] },
  { to: '/queue', label: 'คิวรอจ่ายสินค้า', icon: 'queue', roles: ['warehouse', 'manager'] },
  { to: '/dashboard', label: 'แดชบอร์ด', icon: 'dash', roles: ['warehouse', 'manager'] },
  { to: '/executive', label: 'ระดับบริหาร', icon: 'exec', roles: ['manager'] },
  { to: '/products', label: 'สินค้า', icon: 'box', roles: ['manager'] },
  { to: '/notifications', label: 'แจ้งเตือน', icon: 'bell', roles: ['warehouse', 'manager'] },
  { to: '/audit-logs', label: 'ประวัติ', icon: 'log', roles: ['manager'] },
];

const ROLE_LABEL = { sales: 'พนักงานขาย', warehouse: 'พนักงานคลังสินค้า', manager: 'ผู้จัดการ' };
const today = () => new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function Layout({ title, actions, children }) {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const menu = MENU.filter((m) => m.roles.includes(user.role));
  const unread = useUnreadCount(menu.some((m) => m.to === '/notifications'));
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SO</span>
          <span className="brand-text"><b>SOML</b><small>ร้านอำพรคอนกรีต</small></span>
        </div>
        <nav>
          {menu.map((m) => (
            <NavLink key={m.to} to={m.to}>
              <Icon name={m.icon} />
              <span className="nav-label">{m.label}</span>
              {m.to === '/notifications' && unread > 0 && <span className="count" aria-label={`ยังไม่อ่าน ${unread} รายการ`}>{unread > 99 ? '99+' : unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="who">
          <span className="who-text"><b>{user.fullName}</b><small>{ROLE_LABEL[user.role]}</small></span>
          <button type="button" className="icon-btn" aria-label="ออกจากระบบ" title="ออกจากระบบ" onClick={() => { logout(); navigate('/login'); }}>
            <Icon name="out" size={18} />
          </button>
        </div>
      </aside>
      <main>
        <header className="page-head">
          <div>
            <div className="page-date">{today()}</div>
            {title && <h1>{title}</h1>}
          </div>
          <div className="page-actions">{actions}<ThemeToggle /></div>
        </header>
        {children}
      </main>
    </div>
  );
}
