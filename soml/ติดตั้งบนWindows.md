# ติดตั้งและรัน SOML บน Windows (ฉบับละเอียด)

คู่มือนี้สำหรับเครื่อง PC Windows 10/11 ที่ต่อเครื่องพิมพ์ใบเสร็จ Epson TM-T82 ผ่าน USB ทำทีละขั้นตามลำดับ ทุกขั้นมีวิธีตรวจว่าผ่านแล้ว ถ้าตรวจไม่ผ่าน ให้ดูหัวข้อ 9 "ปัญหาที่พบบ่อย" ก่อนไปขั้นถัดไป

ถ้าเป็น Claude บนเครื่องนี้อ่านอยู่: ทำตามลำดับ ตรวจผลทุกขั้นด้วยคำสั่ง "ตรวจ" ที่ให้ไว้ อย่าข้ามขั้น อย่าแก้โค้ดถ้ายังไม่ได้หาสาเหตุ และอย่าใส่รหัสผ่านแทนผู้ใช้ ให้ผู้ใช้พิมพ์เอง

## 1. ตรวจว่ามีโปรแกรมอะไรแล้วบ้าง

เปิด PowerShell (กด Start พิมพ์ PowerShell) แล้วรันทีละบรรทัด

```
git --version
node -v
npm -v
mysql --version
```

| ผลที่ได้ | ความหมาย |
|---|---|
| ขึ้นเลขเวอร์ชัน | มีแล้ว ข้ามขั้นติดตั้งของโปรแกรมนั้นได้ (Node ต้องเป็น v20 ขึ้นไป) |
| ขึ้นว่า not recognized | ยังไม่มี หรือมีแต่ไม่อยู่ใน PATH ให้ทำขั้นติดตั้งของโปรแกรมนั้น |

## 2. ติดตั้ง Git for Windows

1. ดาวน์โหลดจาก https://git-scm.com/download/win (64-bit Git for Windows Setup)
2. เปิดตัวติดตั้ง กด Next ตามค่าเริ่มต้นทั้งหมดได้
3. ติดตั้งแล้วจะได้โปรแกรม Git Bash ใช้แทน PowerShell ในขั้นถัดไปทั้งหมด

ตรวจ: ปิดแล้วเปิด PowerShell ใหม่ รัน `git --version` ต้องขึ้นเลขเวอร์ชัน และต้องมีไฟล์ `C:\Program Files\Git\bin\bash.exe`

## 3. ติดตั้ง Node.js

1. ดาวน์โหลดจาก https://nodejs.org เลือกรุ่น LTS (20 หรือใหม่กว่า) ไฟล์ Windows Installer (.msi)
2. ติดตั้งตามค่าเริ่มต้น ไม่ต้องติ๊กติดตั้ง Tools for Native Modules (โปรเจกต์นี้ไม่ต้องใช้)

ตรวจ: เปิดหน้าต่างใหม่ รัน `node -v` ต้องได้ v20 ขึ้นไป และ `npm -v` ต้องขึ้นเลข

## 4. ติดตั้ง MySQL Server 8

1. ดาวน์โหลด MySQL Installer for Windows จาก https://dev.mysql.com/downloads/installer/ (ไฟล์ใหญ่ที่ติดตั้งแบบไม่ต่อเน็ต) หน้าให้ล็อกอินกด "No thanks, just start my download" ได้
2. เปิดตัวติดตั้ง เลือก Setup Type เป็น "Server only" (หรือ Custom แล้วเลือก MySQL Server 8.0)
3. กด Execute ให้ติดตั้ง แล้ว Next ไปหน้าตั้งค่า
4. Type and Networking: Config Type = Development Computer · Port = 3306 · ติ๊ก Open Windows Firewall ports ไว้
5. Authentication Method: เลือก "Use Strong Password Encryption" (ระบบรองรับ)
6. Accounts and Roles: ตั้ง MySQL Root Password แล้วจดไว้ รหัสนี้คือ "รหัส SQL" ที่ต้องใส่ใน `.env` ขั้นที่ 7
7. Windows Service: ติ๊ก Configure MySQL Server as a Windows Service และ Start the MySQL Server at System Startup
8. กด Execute ให้ตั้งค่าจนเสร็จ แล้ว Finish

เพิ่ม `mysql` เข้า PATH (จำเป็น เพราะคำสั่งรีเซ็ตฐานข้อมูลเรียกโปรแกรม `mysql`)

1. กด Start พิมพ์ "environment" เลือก Edit the system environment variables
2. กด Environment Variables… › ในกล่อง System variables เลือก Path › Edit › New
3. ใส่ `C:\Program Files\MySQL\MySQL Server 8.0\bin` (ถ้าเป็น 8.4 ให้ใช้โฟลเดอร์ที่มีอยู่จริงใน `C:\Program Files\MySQL\`)
4. กด OK ทุกหน้าต่าง แล้วปิดหน้าต่าง terminal ทั้งหมดเปิดใหม่

ตรวจ: เปิด Git Bash ใหม่ รัน `mysql --version` ต้องขึ้นเลข แล้วรัน

```
mysql -u root -p -e "SELECT VERSION();"
```

พิมพ์รหัส root ที่ตั้งไว้ ต้องขึ้นเลขเวอร์ชันของ MySQL

## 5. ดาวน์โหลดโปรเจกต์ (เปิด Git Bash)

```
cd ~
git clone https://github.com/TriratWongsit/soml-pos-inventory.git
cd soml-pos-inventory/soml
```

ถ้าเคยโคลนไว้แล้ว ให้เข้าโฟลเดอร์เดิมแล้วดึงโค้ดล่าสุดแทน

```
cd ~/soml-pos-inventory
git pull
cd soml
```

ตรวจ: `ls` ต้องเห็นโฟลเดอร์ `backend` `frontend` `print-service` `db` และไฟล์ `.env.example`

## 6. ติดตั้งไลบรารีของโปรเจกต์

อยู่ในโฟลเดอร์ `soml` แล้วรัน

```
npm install
npm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"
```

บรรทัดที่สองจำเป็น เพราะคำสั่ง `npm run db:reset` เรียกสคริปต์ bash ถ้าไม่ตั้ง Windows จะหาคำสั่ง bash ไม่เจอ

ตรวจ: มีโฟลเดอร์ `node_modules` และ `npm config get script-shell` ต้องได้ `C:\Program Files\Git\bin\bash.exe`

## 7. ตั้งค่าไฟล์ .env

```
cp .env.example .env
notepad .env
```

แก้ค่าต่อไปนี้ในหน้าต่าง Notepad แล้วบันทึก

| ค่า | ใส่อะไร | ถ้าใส่ผิดจะเกิดอะไร |
|---|---|---|
| `DB_PASSWORD` | รหัส root ของ MySQL จากขั้นที่ 4 ข้อ 6 เช่น `DB_PASSWORD=รหัสของคุณ` | รีเซ็ตฐานข้อมูลและเปิดระบบไม่ได้ ขึ้น Access denied |
| `JWT_SECRET` | ข้อความสุ่มยาว ๆ สร้างได้ด้วยคำสั่ง `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` แล้วคัดลอกผลมาวาง | ระบบไม่ยอมเปิดถ้ายังเป็น `change-me` |
| `PROMPTPAY_ID` | เบอร์โทร 10 หลักขึ้นต้นด้วย 0 หรือเลขประจำตัว 13 หลัก ของร้าน | **ถ้าว่างหรือผิดรูปแบบ หน้าขายสร้าง QR ไม่ได้ และขายไม่ได้เลย** ถ้ายังไม่มีเลขของร้าน ใช้เบอร์โทรของตัวเองทดสอบไปก่อน |
| `PRINTER_INTERFACE` | ตอนนี้ปล่อยเป็น `file://./printer-output` ก่อน จะเปลี่ยนในขั้นที่ 10 | – |

ค่าอื่นปล่อยตามเดิม ห้ามอัปโหลดไฟล์ `.env` ขึ้น GitHub

## 8. สร้างฐานข้อมูลและเปิดระบบ

```
npm run db:reset
```

ตรวจ: ต้องขึ้นสามบรรทัดท้ายว่า ตาราง 7 · สินค้า 783 รายการ · ผู้ใช้ 4 บัญชี

```
npm run dev
```

ถ้า Windows ถามว่าจะให้ Node.js ผ่าน Firewall ไหม ให้กด Allow

ตรวจ: ต้องเห็นครบสามบรรทัด คือ `SOML backend พร้อมใช้งานที่ http://localhost:4000` · `บริการพิมพ์ใบเสร็จพร้อมใช้งานที่ http://localhost:4100` · `Local: http://localhost:5173/` หน้าต่างนี้ต้องเปิดค้างไว้ตลอดที่ใช้งาน ปิดระบบด้วย Ctrl+C

เปิดเบราว์เซอร์ไปที่ http://localhost:5173 แล้วเข้าสู่ระบบ

| ชื่อผู้ใช้ | บทบาท |
|---|---|
| `siriphan` | พนักงานขาย |
| `santi` | พนักงานคลังสินค้า |
| `ning` | ผู้จัดการ |

รหัสผ่านทุกบัญชีคือค่า `SEED_PASSWORD` ในไฟล์ `.env`

ตรวจการทำงานครบหนึ่งรอบ: `siriphan` ขายเหล็ก 2 หุนเต็ม (`101017`) หนึ่งเส้น → กดแสดง QR ต้องเห็นรหัส QR → กดยืนยันรับชำระเงิน ต้องได้เลขที่ ORD-… → `santi` เปิดคิวในอีกหน้าต่าง (แบบไม่ระบุตัวตน) ต้องเห็นใบนั้น → กดจ่ายสินค้าจนขึ้นส่งมอบสำเร็จ

## 9. ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| `mysql: command not found` | ยังไม่ได้เพิ่ม MySQL เข้า PATH หรือยังไม่ได้เปิด terminal ใหม่ | ทำขั้นที่ 4 ส่วน PATH แล้วเปิด Git Bash ใหม่ |
| `'bash' is not recognized` หรือ db:reset ไม่ทำงาน | ยังไม่ได้ตั้ง script-shell | รันบรรทัดที่สองของขั้นที่ 6 |
| `Access denied for user 'root'` | `DB_PASSWORD` ใน `.env` ไม่ตรงกับรหัส root | แก้ `.env` ให้ตรง แล้วรันใหม่ |
| `Data too long for column 'unit'` | โค้ดเก่าก่อนวันที่ 28/09/2569 | `git pull` แล้ว `npm run db:reset` ใหม่ |
| `ต้องตั้ง JWT_SECRET` | ยังเป็น `change-me` | ทำตามขั้นที่ 7 |
| หน้าขายขึ้นว่าหมายเลขพร้อมเพย์ไม่ถูกต้อง | `PROMPTPAY_ID` ว่างหรือผิดรูปแบบ | ใส่เบอร์ 10 หลักขึ้นต้นด้วย 0 แล้วปิด-เปิด `npm run dev` ใหม่ |
| `EADDRINUSE` | มีระบบตัวเก่าเปิดค้าง | ปิดหน้าต่าง terminal เก่าทั้งหมด แล้วรัน `npm run dev` ใหม่ |
| MySQL ไม่ทำงานหลังเปิดเครื่อง | service ไม่ได้ตั้งให้เริ่มเอง | กด Start พิมพ์ Services เปิดหา MySQL80 แล้วกด Start |

## 10. ตั้งเครื่องพิมพ์ใบเสร็จ USB

บน Windows ระบบส่งใบเสร็จไปยังเครื่องพิมพ์ที่แชร์ไว้บนเครื่องเดียวกัน ด้วยคำสั่ง `copy /b ไฟล์ \\localhost\SOML-Receipt` จึงต้องติดตั้งไดรเวอร์และแชร์เครื่องพิมพ์ก่อน

1. ดาวน์โหลดไดรเวอร์ TM-T82 จากเว็บ Epson ของประเทศไทย (ค้นว่า "TM-T82 driver" เลือก Advanced Printer Driver) แล้วติดตั้ง
2. ต่อสาย USB เปิดเครื่องพิมพ์ ใส่กระดาษ
3. ตรวจว่า Windows เห็นเครื่อง: Settings › Bluetooth & devices › Printers & scanners ต้องมี EPSON TM-T82 แล้วลองกด Print test page
4. เปิดการแชร์ไฟล์และเครื่องพิมพ์: Control Panel › Network and Sharing Center › Change advanced sharing settings › Turn on file and printer sharing
5. แชร์เครื่องพิมพ์: Printers & scanners › เลือก TM-T82 › Printer properties › แท็บ Sharing › ติ๊ก Share this printer › Share name ใส่ `SOML-Receipt` ตรงตัวพิมพ์ใหญ่เล็ก › OK
6. ทดสอบส่งไบต์ดิบ: เปิด Command Prompt (ไม่ใช่ Git Bash) แล้วรัน

```
cd %TEMP%
echo SOML test > test.txt
copy /b test.txt \\localhost\SOML-Receipt
```

ตรวจ: ต้องขึ้น `1 file(s) copied.` และกระดาษออกมามีคำว่า SOML test ถ้าขึ้น Access denied หรือ network path not found ให้กลับไปตรวจข้อ 4 และ 5

7. แก้ `.env` บรรทัด `PRINTER_INTERFACE=printer:SOML-Receipt` แล้วหยุดระบบ (Ctrl+C) และรัน `npm run dev` ใหม่
8. ตรวจว่าบริการพิมพ์ใช้ค่าใหม่: เปิด http://localhost:4100/health ต้องเห็น `"printerInterface":"printer:SOML-Receipt"`

## 11. ทดสอบการพิมพ์จริง (TC-13 · NFR-05 · AC-14)

1. เข้าระบบเป็น `siriphan` ขายเหล็ก 2 หุนเต็มหนึ่งเส้น
2. เตรียมจับเวลาด้วยนาฬิกาจับเวลาในมือถือ กดยืนยันรับชำระเงินพร้อมกดเริ่มจับ หยุดเมื่อกระดาษขาดออกมา
3. ทำซ้ำอย่างน้อย 5 ครั้ง จดเวลาทุกครั้ง
4. ถ่ายรูปใบเสร็จให้เห็นภาษาไทยชัด ๆ

เกณฑ์ผ่าน: ภาษาไทยถูกต้อง คอลัมน์ตรง และเสร็จภายใน 5 วินาทีทุกครั้ง ส่งเวลาที่จดและรูปใบเสร็จไปใส่บทที่ 4 บน Mac ถ้ายังไม่ผ่าน ให้จดอาการไว้ตามจริง ห้ามรายงานว่าผ่าน

ถ้าภาษาไทยเพี้ยนเป็นตัวอักษรแปลก ๆ: เครื่องพิมพ์ใช้ตารางอักษรไทยคนละชุดกับค่า `PRINTER_CODEPAGE=21` ใน `.env` ให้พิมพ์ใบทดสอบตัวเองของเครื่องพิมพ์ (กดปุ่ม Feed ค้างไว้ขณะเปิดเครื่อง) ดูเลข code page ของภาษาไทย แล้วแก้ค่านี้ให้ตรง

## 12. ทางเลือก: เครื่องพิมพ์มีช่อง LAN

ถ้าเครื่องพิมพ์เป็นรุ่นที่ต่อสาย LAN ได้ ไม่ต้องแชร์เครื่องพิมพ์ ตั้ง `PRINTER_INTERFACE=tcp://IP-ของเครื่องพิมพ์:9100` ได้เลย (ดู IP จากใบทดสอบตัวเองของเครื่องพิมพ์)

## 13. รันการทดสอบ (ไม่บังคับ)

```
npm run db:reset:test
npm test
npx playwright install chromium
npm run test:system
```

ตรวจ: `npm test` ต้องผ่าน 134 ข้อ · `npm run test:system` ต้องผ่าน 13 ข้อ (ต้องเปิด `npm run dev` ค้างไว้ในอีกหน้าต่าง)
