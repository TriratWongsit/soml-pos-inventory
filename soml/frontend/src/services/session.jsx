// ---------------------------------------------------------------------
// เซสชันผู้ใช้ — ใครล็อกอินอยู่ บทบาทอะไร                          [UC-01 · 3.9.2]
//
// รับผิดชอบเรื่องเดียว: เก็บ user ปัจจุบันให้ทุกหน้าถามได้ และพากลับหน้าล็อกอินเมื่อโทเคนใช้ไม่ได้
// ตอนเปิดหน้าใหม่/รีเฟรช ถาม /api/auth/me เพื่อยืนยันว่าโทเคนที่เก็บไว้ยังใช้ได้
// ---------------------------------------------------------------------
import { createContext, useContext, useEffect, useState } from 'react';
import { api, token } from './api.js';

const SessionContext = createContext(null);

// หน้าแรกของแต่ละบทบาท = งานที่ใช้บ่อยที่สุด (3.9.2)
export const HOME_BY_ROLE = { sales: '/pos', warehouse: '/queue', manager: '/dashboard' };

export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = ยังไม่รู้, null = ไม่ได้ล็อกอิน

  useEffect(() => {
    if (!token.get()) { setUser(null); return; }
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  const login = async (username, password) => {
    const r = await api.post('/auth/login', { username, password });
    token.set(r.token);
    setUser(r.user);
    return r.user;
  };
  const logout = () => { token.clear(); setUser(null); };

  return <SessionContext.Provider value={{ user, login, logout }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
