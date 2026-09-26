// ---------------------------------------------------------------------
// ช่องทางคำขอ-คำตอบ (api client)                                 [3.5.2 ช่องทางแรก]
//
// รับผิดชอบเรื่องเดียว: หน้าจอเรียก api.get/post/... แล้วได้ JSON กลับ
// แนบโทเคนในหัวข้อคำขอทุกครั้ง · แปลงคำตอบที่ไม่สำเร็จเป็น Error ที่มีข้อความจากหลังบ้าน
// หน้าจอไม่ต้องรู้ว่าหลังบ้านอยู่ที่ไหน (vite proxy ตอนพัฒนา / ต้นทางเดียวกันตอนใช้จริง)
// ---------------------------------------------------------------------
const TOKEN_KEY = 'soml.token';

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function call(method, path, body) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const t = token.get();
  if (t) headers.authorization = `Bearer ${t}`;

  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    if (res.status === 401) token.clear(); // เซสชันหมดอายุหรือโทเคนใช้ไม่ได้ — ให้หน้าจอพาไปล็อกอินใหม่
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => call('GET', path),
  post: (path, body) => call('POST', path, body ?? {}),
  put: (path, body) => call('PUT', path, body),
  patch: (path, body) => call('PATCH', path, body ?? {}),
};
