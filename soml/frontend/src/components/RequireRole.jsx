// ป้องกันเส้นทางฝั่งหน้าจอ — ยังไม่ล็อกอินไปหน้าล็อกอิน · บทบาทไม่ตรงไปหน้าแรกของบทบาทนั้น
// (หลังบ้านตอบ 403 อยู่แล้ว ตรงนี้แค่ไม่ให้ผู้ใช้เห็นหน้าที่ใช้ไม่ได้)
import { Navigate } from 'react-router-dom';
import { useSession, HOME_BY_ROLE } from '../services/session.jsx';

export default function RequireRole({ roles, children }) {
  const { user } = useSession();
  if (user === undefined) return <div className="center muted">กำลังตรวจสอบเซสชัน…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}
