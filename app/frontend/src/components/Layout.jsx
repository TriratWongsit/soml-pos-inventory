// ---------------------------------------------------------------------
// โครงหน้าจอร่วม — แถบเมนูซ้ายและแถบหัวเรื่องด้านบน
//
// เมนูถูกกรองตามบทบาทของผู้ใช้ที่ลงชื่อเข้าใช้งาน ผู้ใช้จะไม่เห็นเมนูที่ตน
// ไม่มีสิทธิ์ ตามข้อกำหนดส่วนต่อประสานผู้ใช้ใน SRS §3.1.1 และ TC-01
// ---------------------------------------------------------------------
import { NavLink } from 'react-router-dom';
import { useAuth, ROLE_LABEL } from '../auth.jsx';

const MENU = [
  { group: 'ขายหน้าร้าน', items: [{ to: '/pos', label: 'ขายหน้าร้าน', roles: ['sales', 'manager'] }] },
  {
    group: 'คลังสินค้า',
    items: [{ to: '/queue', label: 'คิวรอจ่ายสินค้า', roles: ['warehouse', 'manager'] }],
  },
  {
    group: 'ติดตามและจัดการ',
    items: [
      { to: '/dashboard', label: 'แดชบอร์ดปฏิบัติการ', roles: ['manager', 'warehouse'] },
      { to: '/executive', label: 'แดชบอร์ดบริหาร', roles: ['manager'] },
      { to: '/products', label: 'จัดการข้อมูลสินค้า', roles: ['manager'] },
      { to: '/notifications', label: 'การแจ้งเตือน', roles: ['manager', 'warehouse'] },
      { to: '/audit-logs', label: 'ประวัติการทำรายการ', roles: ['manager'] },
    ],
  },
];

export default function Layout({ title, actions, children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <nav className="side">
        <div className="brand">
          <b>SOML</b>
          <span>อำพรคอนกรีต</span>
        </div>

        {MENU.map((section) => {
          const visible = section.items.filter((i) => i.roles.includes(user.role));
          if (visible.length === 0) return null;
          return (
            <div key={section.group}>
              <div className="grp">{section.group}</div>
              {visible.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'on' : '')}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}

        <div className="logout">
          <button type="button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </nav>

      <div className="main">
        <header className="top">
          <h1>{title}</h1>
          <div className="right">
            {actions}
            <div className="who">
              <div className="av">{user.fullName.trim().charAt(0)}</div>
              <div>
                {user.fullName}
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.2 }}>
                  {ROLE_LABEL[user.role]}
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="body">{children}</main>
      </div>
    </div>
  );
}
