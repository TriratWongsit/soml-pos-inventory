// ---------------------------------------------------------------------
// ช่องทางค้าง (event channel)                                     [3.3.3 ช่องทางที่สอง · NFR-02]
//
// รับผิดชอบเรื่องเดียว: ให้หน้าจอ "สมัครรับ" เหตุการณ์ที่หลังบ้านผลักมา โดยไม่ต้องรู้ว่าใช้โพรโทคอลอะไร
//   หลัก   WebSocket ที่ /ws?token=…
//   สำรอง  SSE ที่ /api/events?token=… ถ้าเปิด WebSocket ไม่ได้ภายในเวลาที่กำหนด (อุปกรณ์เครือข่ายบางรุ่น)
// เชื่อมต่อใหม่เองเมื่อหลุด เพื่อให้หน้าจอคิวไม่กลายเป็นหน้าจอนิ่ง
//
// ทุกครั้งที่เชื่อมต่อสำเร็จ (ครั้งแรกและหลังหลุดแล้วต่อใหม่) จะส่งเหตุการณ์ 'connected'
// ให้หน้าจอดึงข้อมูลใหม่ทั้งหมด เพราะเหตุการณ์ที่เกิดระหว่างหลุดจะไม่ถูกส่งซ้ำ
//
// ใช้: const stop = subscribe((event, data) => {...}); … stop();
// ---------------------------------------------------------------------
import { token } from './api.js';

const WS_OPEN_TIMEOUT_MS = 3000;
const RECONNECT_MS = 2000;

export function subscribe(onEvent) {
  let closed = false;
  let ws = null;
  let sse = null;
  let timer = null;

  const openWebSocket = () => {
    const t = token.get();
    if (!t) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(t)}`);  // ◀ [D-3] เดโม: เปิด WebSocket (ต่อไม่ได้ใน 3 วินาทีใช้ SSE แทน)
    let opened = false;
    const fallback = setTimeout(() => { if (!opened) { ws.close(); } }, WS_OPEN_TIMEOUT_MS);  // ปิดแล้ว onclose เปิด SSE ให้
    ws.onopen = () => { opened = true; clearTimeout(fallback); onEvent('connected', null); };  // ◀ [D-3] เดโม: ต่อได้ → ส่ง connected ให้หน้าจอโหลดใหม่
    ws.onmessage = (m) => { const { event, data } = JSON.parse(m.data); onEvent(event, data); };
    ws.onclose = () => {
      clearTimeout(fallback);
      if (closed) return;
      if (opened) timer = setTimeout(openWebSocket, RECONNECT_MS);  // เคยต่อได้แล้วหลุด → ต่อใหม่ทุก 2 วินาที
      else openSSE();                                                // ถูกปฏิเสธก่อนเปิดได้ → ใช้ SSE ทันที ไม่ต้องรอครบ 3 วินาที
    };
    ws.onerror = () => {};
  };

  const openSSE = () => {
    const t = token.get();
    if (!t || closed) return;
    sse = new EventSource(`/api/events?token=${encodeURIComponent(t)}`);
    sse.onopen = () => onEvent('connected', null);
    for (const name of ['order.created', 'order.status', 'order.dispatched', 'order.payment', 'product.stock', 'notification.created']) {
      sse.addEventListener(name, (e) => onEvent(name, JSON.parse(e.data)));
    }
    sse.onerror = () => { sse.close(); if (!closed) timer = setTimeout(openSSE, RECONNECT_MS); };
  };

  openWebSocket();
  return () => { closed = true; clearTimeout(timer); ws?.close(); sse?.close(); };
}
