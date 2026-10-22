import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Pos from './pages/Pos.jsx';
import Queue from './pages/Queue.jsx';
import Dispatch from './pages/Dispatch.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Executive from './pages/Executive.jsx';
import Products from './pages/Products.jsx';
import Notifications from './pages/Notifications.jsx';
import AuditLogs from './pages/AuditLogs.jsx';

/** หน้าแรกของแต่ละบทบาทหลังเข้าสู่ระบบสำเร็จ */
const HOME = { sales: '/pos', warehouse: '/queue', manager: '/dashboard' };

/** ปิดกั้นเส้นทางที่บทบาทของผู้ใช้ไม่มีสิทธิ์เข้าถึง */
function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40 }} className="muted">กำลังตรวจสอบสิทธิ์…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={HOME[user.role]} replace />} />
      <Route path="/pos" element={<Guard roles={['sales', 'manager']}><Pos /></Guard>} />
      <Route path="/queue" element={<Guard roles={['warehouse', 'manager']}><Queue /></Guard>} />
      <Route path="/queue/:orderId" element={<Guard roles={['warehouse', 'manager']}><Dispatch /></Guard>} />
      <Route path="/dashboard" element={<Guard roles={['manager', 'warehouse']}><Dashboard /></Guard>} />
      <Route path="/executive" element={<Guard roles={['manager']}><Executive /></Guard>} />
      <Route path="/products" element={<Guard roles={['manager']}><Products /></Guard>} />
      <Route path="/notifications" element={<Guard roles={['manager', 'warehouse']}><Notifications /></Guard>} />
      <Route path="/audit-logs" element={<Guard roles={['manager']}><AuditLogs /></Guard>} />
      <Route path="*" element={<Navigate to={HOME[user.role]} replace />} />
    </Routes>
  );
}
