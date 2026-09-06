import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ไฟล์นี้เป็นโมดูล ESM จึงไม่มี __dirname ให้ใช้โดยตรง
const here = path.dirname(fileURLToPath(import.meta.url));

// ใช้ใบรับรองชุดเดียวกับ Backend API เพื่อให้ทั้งระบบเข้าถึงผ่าน HTTPS
// เท่านั้นตามที่ NFR-01 กำหนด ไม่มีช่องทาง http ให้เรียกได้เลย
const certDir = path.resolve(here, '..', 'certs');
const httpsOptions = fs.existsSync(path.join(certDir, 'cert.pem'))
  ? { key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) }
  : undefined;

const API_TARGET = process.env.VITE_API_TARGET || 'https://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    https: httpsOptions,
    proxy: {
      // secure:false เพราะใบรับรองในสภาพแวดล้อมพัฒนาเป็นแบบลงนามด้วยตนเอง
      '/api': { target: API_TARGET, changeOrigin: true, secure: false },
      '/ws': { target: API_TARGET, changeOrigin: true, secure: false, ws: true },
    },
  },
});
