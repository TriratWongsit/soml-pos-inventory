// เส้นทางของหน้าจอทั้ง 9 หน้า (ตารางที่ 3.15) — หนึ่งหน้า = หนึ่งโฟลเดอร์ใน pages/
// บทบาทที่เข้าได้ของแต่ละหน้าประกาศที่นี่ที่เดียว คู่กับ app.js ของหลังบ้าน
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider, useSession, HOME_BY_ROLE } from './services/session.jsx';
import RequireRole from './components/RequireRole.jsx';
import Login from './pages/login/index.jsx';
import Pos from './pages/pos/index.jsx';
import Queue from './pages/queue/index.jsx';
import Dispatch from './pages/dispatch/index.jsx';
import DashboardOps from './pages/dashboard-ops/index.jsx';
import DashboardExec from './pages/dashboard-exec/index.jsx';
import Products from './pages/products/index.jsx';
import Notifications from './pages/notifications/index.jsx';
import AuditLogs from './pages/audit-logs/index.jsx';

function Home() {
  const { user } = useSession();
  if (user === undefined) return null;
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />;
}

const guarded = (roles, el) => <RequireRole roles={roles}>{el}</RequireRole>;

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pos" element={guarded(['sales', 'manager'], <Pos />)} />
          <Route path="/queue" element={guarded(['warehouse', 'manager'], <Queue />)} />
          <Route path="/dispatch/:id" element={guarded(['warehouse', 'manager'], <Dispatch />)} />
          <Route path="/dashboard" element={guarded(['warehouse', 'manager'], <DashboardOps />)} />
          <Route path="/executive" element={guarded(['manager'], <DashboardExec />)} />
          <Route path="/products" element={guarded(['manager'], <Products />)} />
          <Route path="/notifications" element={guarded(['warehouse', 'manager'], <Notifications />)} />
          <Route path="/audit-logs" element={guarded(['manager'], <AuditLogs />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
