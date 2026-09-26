// หน้าเข้าสู่ระบบ                                   [ตารางที่ 3.15 หน้าจอ 1 · UC-01]
// งานเดียว: ชื่อผู้ใช้ + รหัสผ่าน → เข้าสู่ระบบ → ไปหน้าแรกของบทบาท (3.9.2)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import { useSession, HOME_BY_ROLE } from '../../services/session.jsx';

export default function Login() {
  const { user, login, logout } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // ล็อกอินอยู่แล้วเปิดหน้านี้ — ไม่เด้งหนี ให้เลือกว่าจะไปทำงานต่อหรือออกเพื่อเข้าบัญชีอื่น
  if (user) {
    return (
      <div className="login-wrap">
        <div className="login-top"><ThemeToggle /></div>
        <div className="login-mid"><div className="card login">
          <div className="brand big"><span className="brand-mark">SO</span><span className="brand-text"><b>SOML</b><small>ร้านอำพรคอนกรีต</small></span></div>
          <div className="alert ok">คุณเข้าสู่ระบบเป็น <b>{user.fullName}</b> อยู่แล้ว</div>
          <button className="btn big" onClick={() => navigate(HOME_BY_ROLE[user.role])}>ไปหน้าทำงาน</button>
          <button className="btn ghost" onClick={logout}>ออกจากระบบ เพื่อเข้าด้วยบัญชีอื่น</button>
        </div></div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const u = await login(username.trim(), password);
      navigate(HOME_BY_ROLE[u.role], { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-top"><ThemeToggle /></div>
      <div className="login-mid"><form className="card login" onSubmit={submit}>
        <div className="brand big"><span className="brand-mark">SO</span><span className="brand-text"><b>SOML</b><small>ร้านอำพรคอนกรีต</small></span></div>
        <div className="muted center-text">ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า</div>
        <label>ชื่อผู้ใช้<input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" /></label>
        <label>รหัสผ่าน<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="alert crit">{error}</div>}
        <button className="btn big" disabled={busy || !username || !password}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
      </form></div>
    </div>
  );
}
