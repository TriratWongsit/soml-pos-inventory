// ---------------------------------------------------------------------
// รับเหตุการณ์แบบเรียลไทม์จากเซิร์ฟเวอร์   [FR-04 · NFR-02]
//
// ใช้ WebSocket เป็นช่องทางหลัก และสลับไปใช้ Server-Sent Events อัตโนมัติ
// เมื่อเชื่อม WebSocket ไม่สำเร็จ ตามที่ SRS §3.1.4 กำหนดให้มีช่องทางสำรอง
// ---------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import { getToken } from './api.js';

export function useRealtime(onEvent) {
  const [channel, setChannel] = useState(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    let ws;
    let sse;
    let closed = false;

    const dispatch = (raw) => {
      try {
        handler.current?.(JSON.parse(raw));
      } catch (err) {
        console.error('อ่านข้อความจากเซิร์ฟเวอร์ไม่ได้', err);
      }
    };

    const fallbackToSse = () => {
      if (closed || sse) return;
      // EventSource แนบหัวข้อคำขอเองไม่ได้ จึงส่งโทเคนผ่านสตริงคำค้นเช่นเดียวกับ WebSocket
      sse = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
      sse.onopen = () => setChannel('sse');
      sse.onmessage = (e) => dispatch(e.data);
      sse.onerror = () => setChannel(null);
    };

    try {
      ws = new WebSocket(`wss://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setChannel('websocket');
      ws.onmessage = (e) => dispatch(e.data);
      ws.onclose = () => {
        setChannel(null);
        fallbackToSse();
      };
      ws.onerror = () => ws.close();
    } catch (err) {
      fallbackToSse();
    }

    return () => {
      closed = true;
      ws?.close();
      sse?.close();
    };
  }, []);

  // ประกาศสถานะช่องทางไว้บนเอกสาร เพื่อให้ชุดทดสอบความเข้ากันได้ของเบราว์เซอร์
  // ตรวจสอบได้ว่าการรับข้อมูลเรียลไทม์ทำงานจริงบนเบราว์เซอร์นั้น
  useEffect(() => {
    document.body.dataset.realtime = channel || 'none';
  }, [channel]);

  return channel;
}
