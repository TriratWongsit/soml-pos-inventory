// ต้องตั้งค่านี้ก่อนโมดูลใด ๆ ถูกโหลด เพราะ config/db.js เลือกฐานข้อมูล
// ตามค่า NODE_ENV ตั้งแต่ตอนถูก require ครั้งแรก
process.env.NODE_ENV = 'test';
