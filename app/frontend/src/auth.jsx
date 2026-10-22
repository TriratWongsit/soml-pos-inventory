// ---------------------------------------------------------------------
// สถานะการเข้าสู่ระบบและบทบาทของผู้ใช้   [FR-01 · UC-01]
// ---------------------------------------------------------------------
import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** ชื่อภาษาไทยของแต่ละบทบาท ใช้แสดงบนแถบด้านบนของทุกหน้าจอ */
export const ROLE_LABEL = {
  sales: 'พนักงานขาย',
  warehouse: 'พนักงานคลังสินค้า',
  manager: 'ผู้จัดการ',
};
