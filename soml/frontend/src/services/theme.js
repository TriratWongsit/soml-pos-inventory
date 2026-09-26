// ---------------------------------------------------------------------
// โหมดแสดงผล สว่าง / มืด                                              [3.9.1]
//
// รับผิดชอบเรื่องเดียว: เลือกชุดสีของหน้าจอ แล้วจำไว้ในเบราว์เซอร์ของเครื่องนั้น
// เปลี่ยนเฉพาะสี (ตัวแปร CSS ใต้ html[data-theme]) ไม่แตะข้อมูลหรือสิทธิ์ใด ๆ
// ครั้งแรกที่ยังไม่เคยเลือก ใช้ตามการตั้งค่าของเครื่อง
// ---------------------------------------------------------------------
import { useState } from 'react';

const KEY = 'soml.theme';

function saved() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* เบราว์เซอร์ปิดการเก็บข้อมูล — ใช้ค่าตามเครื่องแทน */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
}

/** เรียกครั้งเดียวก่อนวาดหน้าจอ เพื่อไม่ให้หน้าจอกะพริบจากสีหนึ่งไปอีกสีหนึ่ง */
export function initTheme() { apply(saved()); }

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || saved());
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch { /* จำไม่ได้ก็ยังสลับได้ในหน้านี้ */ }
    setTheme(next);
  };
  return { theme, toggle };
}
