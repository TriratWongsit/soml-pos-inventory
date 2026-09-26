// ---------------------------------------------------------------------
// จำนวนการแจ้งเตือนที่ยังไม่อ่าน สำหรับตัวเลขบนเมนู                  [UC-11 · 3.9.2]
//
// ใช้เส้นทางเดิม GET /api/notifications?unread=1 ไม่มีเส้นทางใหม่
// นับใหม่เมื่อหลังบ้านผลัก notification.created และเมื่อหน้าการแจ้งเตือนกด "อ่านแล้ว"
// ---------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { subscribe } from './events.js';

const CHANGED = 'soml:notifications-changed';

/** หน้าการแจ้งเตือนเรียกหลังทำเครื่องหมายอ่านแล้ว ให้ตัวเลขบนเมนูลดลงทันที */
export const notifyUnreadChanged = () => window.dispatchEvent(new Event(CHANGED));

export function useUnreadCount(enabled) {
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    api.get('/notifications?unread=1').then((r) => setCount(r.notifications.length)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const stop = subscribe((event) => { if (event === 'notification.created') load(); });
    window.addEventListener(CHANGED, load);
    return () => { stop(); window.removeEventListener(CHANGED, load); };
  }, [enabled, load]);
  return count;
}
