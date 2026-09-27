# ติดตั้งและรัน SOML บน Windows

คู่มือนี้สำหรับเครื่อง PC ที่ต่อเครื่องพิมพ์ใบเสร็จ Epson TM-T82 ผ่าน USB

## 1. โปรแกรมที่ต้องติดตั้ง

| # | โปรแกรม | หมายเหตุ |
|:-:|---|---|
| 1 | Git for Windows | ตอนติดตั้งเลือก "Use Git and optional Unix tools from the Command Prompt" เพื่อให้มีคำสั่ง bash |
| 2 | Node.js 20 LTS ขึ้นไป | ตรวจด้วย `node -v` |
| 3 | MySQL Server 8 | จำรหัสผ่าน root ไว้ใส่ใน `.env` แล้วเพิ่ม `C:\Program Files\MySQL\MySQL Server 8.x\bin` ลงใน PATH เพราะคำสั่ง `npm run db:reset` เรียกโปรแกรม `mysql` |
| 4 | Chrome หรือ Edge | ใช้เปิดระบบ |
| 5 | ไดรเวอร์ Epson TM-T82 (Advanced Printer Driver จากเว็บ Epson) | ดูข้อ 3 |
| 6 | ฟอนต์ Bai Jamjuree (Google Fonts) | ไม่บังคับ ถ้าเครื่องมีอินเทอร์เน็ต หน้าจอโหลดฟอนต์เองได้ ถ้าไม่มี ให้ติดตั้งทั้ง 4 น้ำหนัก (Regular, Medium, SemiBold, Bold) |

## 2. ติดตั้งระบบ (เปิด Git Bash)

```bash
git clone https://github.com/TriratWongsit/soml-pos-inventory.git
cd soml-pos-inventory/soml
npm install
npm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"
cp .env.example .env
```

แก้ `.env` อย่างน้อยค่าต่อไปนี้

| ค่า | ใส่อะไร |
|---|---|
| `DB_PASSWORD` | รหัสผ่าน root ของ MySQL |
| `JWT_SECRET` | ข้อความสุ่มยาว ๆ (ถ้าย้ายจากเครื่องเดิม ใช้ค่าเดิมได้) |
| `PROMPTPAY_ID` | เบอร์โทรหรือเลขประจำตัวผู้เสียภาษีของร้าน |
| `PRINTER_INTERFACE` | `printer:SOML-Receipt` เมื่อทำข้อ 3 เสร็จ ก่อนหน้านั้นใช้ `file://./printer-output` |

```bash
npm run db:reset
npm run dev
```

เปิด http://localhost:5173 ผู้ใช้ตั้งต้นคือ `siriphan` (ขาย) `santi` (คลัง) `ning` (ผู้จัดการ) รหัสผ่านตามค่า `SEED_PASSWORD` ใน `.env`

## 3. ตั้งเครื่องพิมพ์ USB ให้ระบบพิมพ์ได้

บน Windows บริการพิมพ์ส่งไบต์ดิบ (ESC/POS) ไปยังเครื่องพิมพ์ที่แชร์ไว้บนเครื่องเดียวกัน ด้วยคำสั่ง `copy /b ไฟล์ \\localhost\SOML-Receipt` จึงต้องแชร์เครื่องพิมพ์ก่อน

1. ต่อ TM-T82 ด้วย USB แล้วติดตั้งไดรเวอร์ให้ Windows เห็นเครื่องพิมพ์
2. Settings › Bluetooth & devices › Printers & scanners › เลือกเครื่อง TM-T82 › Printer properties
3. แท็บ Sharing › ติ๊ก Share this printer › ตั้งชื่อแชร์ `SOML-Receipt` (ต้องตรงกับค่าหลัง `printer:` ใน `.env`)
4. ทดสอบจาก Command Prompt: สร้างไฟล์ข้อความ `test.txt` แล้วสั่ง `copy /b test.txt \\localhost\SOML-Receipt` ถ้ากระดาษออก แสดงว่าพร้อม
5. ตั้ง `PRINTER_INTERFACE=printer:SOML-Receipt` ใน `.env` แล้วเริ่ม `npm run dev` ใหม่
6. ขายหนึ่งรายการจากหน้าขายหน้าร้าน ใบเสร็จภาษาไทยต้องออกภายใน 5 วินาที (TC-13 · NFR-05) จดเวลาที่วัดได้ไว้ใส่บทที่ 4

ถ้าภาษาไทยเพี้ยน ให้ตรวจว่าเครื่องพิมพ์ตั้ง code page ไทยตรงกับ `PRINTER_CODEPAGE=21` ใน `.env` (ดูได้จากใบทดสอบตัวเองของเครื่องพิมพ์)

## 4. ทางเลือกถ้าเครื่องพิมพ์มีช่อง LAN

ไม่ต้องแชร์เครื่องพิมพ์ ตั้ง `PRINTER_INTERFACE=tcp://IP-ของเครื่องพิมพ์:9100` ได้เลย

## 5. รันการทดสอบ (ไม่บังคับ)

```bash
npm run db:reset:test
npm test
npx playwright install chromium
npm run test:system
```

`npm run test:system` ต้องเปิด `npm run dev` ค้างไว้ในอีกหน้าต่าง
