// ---------------------------------------------------------------------
// ช่องทางค้าง (event channel)                                     [3.5.2 ช่องทางที่สอง · NFR-02]
//
// รับผิดชอบเรื่องเดียว: ให้หน้าจอ "สมัครรับ" เหตุการณ์ที่หลังบ้านผลักมา โดยไม่ต้องรู้ว่าใช้โพรโทคอลอะไร
//   หลัก   WebSocket ที่ /ws?token=…
//   สำรอง  SSE ที่ /api/events?token=… ถ้าเปิด WebSocket ไม่ได้ภายในเวลาที่กำหนด (อุปกรณ์เครือข่ายบางรุ่น)
// เชื่อมต่อใหม่เองเมื่อหลุด เพื่อให้หน้าจอคิวไม่กลายเป็นหน้าจอนิ่ง
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
    ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(t)}`);
    let opened = false;
    const fallback = setTimeout(() => { if (!opened) { ws.close(); openSSE(); } }, WS_OPEN_TIMEOUT_MS);
    ws.onopen = () => { opened = true; clearTimeout(fallback); };
    ws.onmessage = (m) => { const { event, data } = JSON.parse(m.data); onEvent(event, data); };
    ws.onclose = () => { clearTimeout(fallback); if (opened && !closed) timer = setTimeout(openWebSocket, RECONNECT_MS); };
    ws.onerror = () => {};
  };

  const openSSE = () => {
    const t = token.get();
    if (!t || closed) return;
    sse = new EventSource(`/api/events?token=${encodeURIComponent(t)}`);
    for (const name of ['order.created', 'order.status', 'order.dispatched', 'notification.created']) {
      sse.addEventListener(name, (e) => onEvent(name, JSON.parse(e.data)));
    }
    sse.onerror = () => { sse.close(); if (!closed) timer = setTimeout(openSSE, RECONNECT_MS); };
  };

  openWebSocket();
  return () => { closed = true; clearTimeout(timer); ws?.close(); sse?.close(); };
}
