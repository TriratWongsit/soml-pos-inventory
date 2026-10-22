// หน้าเข้าสู่ระบบ   [FR-01 · UC-01]
import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      // แสดงข้อความตามที่เซิร์ฟเวอร์ส่งมา ซึ่งจงใจไม่ระบุว่าผิดที่ชื่อผู้ใช้
      // หรือรหัสผ่าน ตามแนวปฏิบัติในหัวข้อ 2.1.6
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>SOML</h1>
        <div className="sub">ระบบจัดการคำสั่งซื้อและตรวจสอบคลังสินค้า · ร้านวัสดุก่อสร้างอำพรคอนกรีต</div>

        {error && <div className="alert crit" role="alert"><span>{error}</span></div>}

        <div className="field">
          <label htmlFor="username">ชื่อผู้ใช้</label>
          <input id="username" type="text" value={username} autoComplete="username"
                 onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">รหัสผ่าน</label>
          <input id="password" type="password" value={password} autoComplete="current-password"
                 onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button className="btn big" type="submit" disabled={busy}>
          {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
