// ---------------------------------------------------------------------
// ตัวห่อหุ้มการเรียก REST API
//
// SRS §3.1.4 กำหนดว่าทุกคำขอต้องแนบโทเคนยืนยันตัวตน จึงรวมการแนบโทเคน
// ไว้ที่เดียว และหากเซิร์ฟเวอร์ตอบว่าโทเคนหมดอายุจะพากลับไปหน้าเข้าสู่ระบบ
// ---------------------------------------------------------------------
const TOKEN_KEY = 'soml.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, payload) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (payload !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    setToken(null);
    window.location.assign('/login');
    throw new ApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', body);
  }
  if (!res.ok) {
    throw new ApiError(res.status, body.error || `คำขอล้มเหลว (${res.status})`, body);
  }
  return body;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, payload) => request('POST', path, payload),
  put: (path, payload) => request('PUT', path, payload),
  patch: (path, payload) => request('PATCH', path, payload),
};

/** จัดรูปแบบจำนวนเงินเป็นสกุลบาทตามข้อกำหนดใน SRS §3.1.1 */
export const baht = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const int = (n) => Number(n || 0).toLocaleString('th-TH');

/** แปลงวินาทีที่รอเป็นข้อความและระดับความเร่งด่วน ตามการออกแบบในหัวข้อ 3.8.3 */
export function waitLevel(seconds) {
  const minutes = Math.floor(Number(seconds || 0) / 60);
  const text = minutes < 60 ? `${minutes} นาที` : `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`;
  if (minutes >= 30) return { text, level: 'bad' };
  if (minutes >= 15) return { text, level: 'mid' };
  return { text, level: 'ok' };
}
