// ต้องตั้งก่อนโมดูลใดถูกโหลด เพราะ config/db.js เลือกฐานข้อมูลตามค่านี้ตอน require ครั้งแรก
process.env.NODE_ENV = 'test';
