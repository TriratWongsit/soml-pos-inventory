// เครื่องมือพัฒนาหน้าจอ — ส่งต่อ /api และ /ws ไปยังระบบหลังบ้าน
// เพื่อให้หน้าจอกับหลังบ้านอยู่ต้นทางเดียวกัน ไม่ต้องตั้งค่า CORS และโทเคนในสตริงคำค้นของ /ws ผ่านได้
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/ws': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
});
