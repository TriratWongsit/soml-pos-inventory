# -*- coding: utf-8 -*-
"""เดโมไกด์: ตั้งเครื่อง เตรียมข้อมูล ลำดับการกด บทพูด และแผนสำรอง สำหรับวันสอบ (Windows เป็นเครื่องร้าน + Mac)"""
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))

CSS = '''@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
@page{size:A4;margin:13mm 13mm}*{box-sizing:border-box}
body{font-family:Sarabun,sans-serif;font-size:14px;line-height:1.5;color:#1b2430;margin:0}
h1{font-size:25px;color:#0F4C81;margin:0 0 4px}h2{font-size:18px;color:#fff;background:#0F4C81;padding:4px 10px;border-radius:6px;margin:14px 0 6px;page-break-after:avoid}
h3{font-size:15.5px;color:#0F4C81;margin:10px 0 3px;page-break-after:avoid}
table{width:100%;border-collapse:collapse;margin:4px 0 8px;page-break-inside:avoid}td,th{border:1px solid #c9ced6;padding:4px 8px;vertical-align:top;text-align:left}
th{background:#E8EEF6;color:#0F4C81}code{font-family:Menlo,monospace;font-size:12px;background:#f1f3f6;padding:0 4px;border-radius:3px}
ol,ul{margin:2px 0 6px 20px;padding:0}li{margin:1px 0}
.say{background:#FFF6EC;border-left:4px solid #F28C28;padding:4px 10px;margin:4px 0}
.warn{background:#FDECEC;border-left:4px solid #D9483B;padding:5px 10px;margin:6px 0}
.ok{background:#EEF6EF;border-left:4px solid #2E9E6B;padding:5px 10px;margin:6px 0}
.step{border:1.5px solid #0F4C81;border-radius:8px;padding:6px 10px;margin:0 0 9px;page-break-inside:avoid}
.step b.t{font-size:16px;color:#0F4C81}.step .m{float:right;font-size:12px;color:#5b6876}
.box{display:inline-block;width:12px;height:12px;border:1.5px solid #333;margin-right:6px;vertical-align:-2px}
'''


def step(code, title, mins, who, do, see, say):
    return ('<div class="step"><span class="m">%s · ผู้กด/อธิบาย: %s</span><b class="t">%s %s</b>'
            '<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px"><div><b>กด</b><ol>%s</ol></div><div><b>ต้องเห็น</b><ul>%s</ul></div></div>'
            '<div class="say"><b>พูด:</b> %s</div></div>') % (mins, who, code, title, ''.join('<li>%s</li>' % x for x in do),
                                                              ''.join('<li>%s</li>' % x for x in see), say)


body = '''
<h1>เดโมไกด์ วันสอบ · อำพร OMS</h1>
<div>ใช้คู่กับ "ใบลำดับเดโม System Test" (มีเลขบรรทัดโค้ด) ไกด์นี้บอกวิธีตั้งเครื่อง เตรียมข้อมูล ลำดับการกด สิ่งที่ต้องพูด และแผนสำรอง เวลาเดโมประมาณ 10–12 นาที</div>

<h2>1. จัดเครื่อง</h2>
<table><tr><th>เครื่อง</th><th>หน้าที่</th><th>เปิดอะไร</th></tr>
<tr><td><b>Windows</b> (ต่อเครื่องพิมพ์ TM-T82)</td><td>เครื่องร้าน: รันระบบ + หน้าขาย + ผู้จัดการ</td><td><code>start.bat</code> · Chrome ธรรมดา = พนักงานขาย · Chrome ไม่ระบุตัวตน (Ctrl+Shift+N) = ผู้จัดการ</td></tr>
<tr><td><b>Mac</b></td><td>จอคลัง + เปิดโค้ด + รันเทส</td><td>Chrome ที่ <code>http://&lt;IP Windows&gt;:5173</code> = พนักงานคลัง · VS Code โฟลเดอร์ <code>soml</code></td></tr>
<tr><td>มือถือ (ถ้ามี)</td><td>จอคลังแทน Mac ให้เห็นว่าใช้ในโกดังได้</td><td>เบราว์เซอร์ที่ <code>http://&lt;IP Windows&gt;:5173</code></td></tr></table>
<div class="ok">ทุกเครื่องต้องอยู่ <b>Wi-Fi หรือ Hotspot วงเดียวกัน</b> ใช้ Hotspot มือถือชัวร์ที่สุด เพราะ Wi-Fi มหาวิทยาลัยบางวงไม่ให้เครื่องคุยกันเอง IP ของ Windows ดูได้จากหน้าต่าง <code>start.bat</code> บรรทัด "มือถือ : http://..."</div>
<div>บัญชี: พนักงานขาย <code>siriphan</code> · พนักงานคลัง <code>santi</code> · ผู้จัดการ <code>ning</code> · รหัสผ่านคือที่ตั้งตอน <code>install.bat</code> (ไม่เขียนไว้ในเอกสารนี้)</div>

<h2>2. เตรียมก่อนวันสอบ (ทำที่บ้าน)</h2>
<ol>
<li><b>Windows:</b> แตก <code>AmpornOMS.zip</code> ชุดล่าสุดทับ <code>C:\\AmpornOMS</code> แล้วเปิด <code>start.bat</code></li>
<li><b>ทดสอบเครื่องพิมพ์:</b> Command Prompt พิมพ์ <code>copy /b test.txt \\\\localhost\\AmpornOMS-Receipt</code> ต้องมีกระดาษออก</li>
<li><b>ทดสอบจอคลัง:</b> Mac เปิด <code>http://&lt;IP Windows&gt;:5173</code> ได้ ถ้าไม่ได้ ตอน Windows ถามเรื่อง Firewall ต้องกด Allow</li>
<li><b>ซ้อมเดโมครบ 8 ข้อ</b> อย่างน้อย 2 รอบ จับเวลา</li>
<li><b>Mac:</b> <code>node start.js</code> แล้วรัน <code>npx playwright test --headed tests/system/acceptance.spec.js</code> ต้องผ่าน 13 ข้อ</li>
<li><b>ชาร์จแบต</b> ทุกเครื่อง พกสาย USB เครื่องพิมพ์ กระดาษสำรอง และปลั๊กพ่วง</li>
</ol>

<h2>3. เช้าวันสอบ (ก่อนเข้าห้อง 15 นาที)</h2>
<ol>
<li><b>ล้างข้อมูลให้สะอาด (เฉพาะเครื่องที่ใช้เดโม):</b> ดับเบิลคลิก <code>install.bat</code> แล้วพิมพ์ <code>ลบ</code> เพื่อยืนยัน จะได้สินค้า 783 รายการ ผู้ใช้ 4 บัญชี คิวว่าง</li>
<li>เปิด <code>start.bat</code> จดเลข IP ในบรรทัด "มือถือ"</li>
<li><b>ตั้งสินค้าสองตัว</b> (เข้าเป็นผู้จัดการ หน้าสินค้า) แล้วจดชื่อไว้
  <ul><li><b>สินค้า A</b> (ใช้ D-6): ปรับสต็อกให้เหลือ <b>1</b></li>
  <li><b>สินค้า B</b> (ใช้ D-7): สต็อก <b>12</b> จุดสั่งซื้อเพิ่ม <b>10</b></li></ul></li>
<li>เปิดหน้าต่างตามข้อ 1 เข้าบัญชีให้ครบ Mac เปิดหน้าคิวค้างไว้</li>
<li>VS Code บน Mac เปิดไฟล์ <code>stock-deduction/index.js</code> รอไว้ (ไฟล์ที่อาจารย์น่าจะขอดูที่สุด)</li>
</ol>
<div class="warn"><b>ห้ามล้างข้อมูลบนเครื่องร้านจริงที่ขายของจริงอยู่</b> install.bat จะลบการขายทั้งหมด ถ้า Windows เป็นเครื่องร้านจริง ให้ข้ามข้อ 1 และใช้สินค้าที่เตรียมไว้แทน</div>

<h2>4. ลำดับเดโม (เล่าเป็นเรื่องเดียว ลูกค้ามาซื้อ → ผู้จัดการดูยอด)</h2>
<div class="say"><b>เปิดเดโม:</b> "ผมจะเดโมเป็นเรื่องเดียวต่อกันครับ ตั้งแต่ลูกค้ามาซื้อที่หน้าร้าน ไปจนถึงผู้จัดการดูยอด เครื่อง Windows คือเครื่องหน้าร้านที่ต่อเครื่องพิมพ์ ส่วน Mac คือจอในโกดังครับ"</div>
''' + step('D-1', 'เข้าระบบตามบทบาท', '1 นาที', 'พนาวุฒน์',
           ['Windows: เข้าเป็น <code>siriphan</code> ด้วยรหัสผิดหนึ่งครั้ง แล้วรหัสถูก', 'ชี้เมนูซ้าย', 'พิมพ์ <code>/products</code> ต่อท้ายที่อยู่'],
           ['รหัสผิดเข้าไม่ได้', 'เมนูมีแค่ขายหน้าร้าน', 'เด้งกลับหน้าขาย'],
           '"พนักงานขายเห็นแค่เมนูของตัวเอง ลองเข้าหน้าผู้จัดการตรงๆ ก็เด้งกลับ และหลังบ้านตรวจซ้ำทุกคำขอ ถ้ายิง API ตรงจะได้ 403 ครับ"') \
    + step('D-2', 'ลูกค้าซื้อของ คิดยอด QR พิมพ์ใบเสร็จ', '2 นาที', 'พนาวุฒน์ + ตรัยรัตน์',
           ['ค้นและเพิ่มสินค้า 3 รายการ เปลี่ยนจำนวนหนึ่งรายการ', 'กดแสดง QR', 'กดยืนยันรับชำระเงิน'],
           ['ยอดถูก ตรงกับ QR', 'ได้เลขที่คำสั่งซื้อ', '<b>ใบเสร็จออกจากเครื่องพิมพ์</b>'],
           '"ระบบคิดยอดจากราคาในฐานข้อมูล ไม่เชื่อราคาจากหน้าจอ ลูกค้าสแกน QR พนักงานดูแอปธนาคารว่าเงินเข้าแล้วกดยืนยัน ระบบออกเลขที่ไม่ซ้ำและพิมพ์ใบเสร็จครับ"') \
    + step('D-3', 'จอคลังเห็นเองไม่ต้องรีเฟรช ★', '1 นาที', 'พนาวุฒน์',
           ['ให้อาจารย์ดูจอ Mac (หน้าคิว) ตั้งแต่ก่อนกดยืนยันใน D-2', 'ชี้ใบที่เพิ่งขาย'],
           ['ใบขึ้นเองภายใน 3 วินาที โดยไม่ได้แตะ Mac'],
           '"นี่คือจุดเด่นครับ ไม่ใช่แค่ระบบขาย พอยืนยันรับเงิน คำสั่งซื้อขึ้นจอในโกดังทันทีผ่าน WebSocket คลังเริ่มจัดของได้ก่อนลูกค้าเดินไปถึง แก้ปัญหาลูกค้าถือบิลเดินไปโกดังครับ"') \
    + step('D-4', 'คลังเริ่มจัด และยืนยันจ่าย', '1 นาที 30 วินาที', 'พนาวุฒน์ + ตรัยรัตน์',
           ['Mac: กดเริ่มจัด', 'แตะใบ › ยืนยันจ่ายสินค้า › ยืนยันอีกครั้ง', 'Windows (ผู้จัดการ): เปิดหน้าสินค้าดูยอดของสินค้าในใบ'],
           ['ต้องกดสองครั้ง', 'ใบหายจากคิว', 'สต็อกลดเท่าที่จ่าย'],
           '"ตัดสต็อกตอนจ่ายของ ไม่ใช่ตอนขาย เพราะของออกจากคลังจริงตอนนี้ ทั้งเปลี่ยนสถานะ หักสต็อก และบันทึกประวัติอยู่ใน transaction เดียวครับ"') \
    + step('D-5', 'เอาใบเดิมมารับซ้ำ', '1 นาที', 'ตรัยรัตน์',
           ['Mac: เปิดหน้ายืนยันจ่ายของใบเดิมจาก D-4 (เปิดค้างไว้อีกแท็บก่อนกดจ่ายใน D-4)', 'กดยืนยันจ่ายอีกครั้ง'],
           ['ข้อความ "ถูกจ่ายหรือยกเลิกไปแล้ว"', 'สต็อกไม่ลดซ้ำ'],
           '"ใบเดียวจ่ายได้ครั้งเดียว แม้สองคนกดพร้อมกัน ระบบเปลี่ยนสถานะแบบมีเงื่อนไข ใครมาทีหลังได้ 409 ครับ ถ้าอาจารย์อยากดูกรณีกดพร้อมกันจริง ผมรันเทส dispatch.test.js ให้ดูได้ครับ"') \
    + step('D-6', 'ขายเกินของที่มี', '1 นาที', 'ตรัยรัตน์',
           ['Windows: ขาย<b>สินค้า A</b> 2 ชิ้น พร้อมสินค้าอื่นในใบเดียว', 'Mac: ยืนยันจ่ายใบนั้น'],
           ['ข้อความ "สต็อก ... ไม่พอ"', 'สต็อกทุกรายการในใบไม่เปลี่ยน ใบยังรอจ่าย'],
           '"หน้าร้านขายได้ แต่ตอนจ่าย ระบบหักสต็อกได้เฉพาะเมื่อของพอ ไม่พอก็ rollback ทั้งใบ สต็อกไม่ติดลบครับ"') \
    + step('D-7', 'ของใกล้หมด ผู้จัดการได้แจ้งเตือน', '1 นาที', 'ตรัยรัตน์',
           ['Windows: ขาย<b>สินค้า B</b> 5 ชิ้น', 'Mac: ยืนยันจ่าย (เหลือ 7)', 'Windows (ผู้จัดการ): ดูกระดิ่งและหน้าการแจ้งเตือน'],
           ['แจ้งเตือน "เหลือ 7 ต่ำกว่าจุดสั่งซื้อเพิ่ม (10)" ขึ้นทันที'],
           '"จุดสั่งซื้อเพิ่มคือเส้นเตือนที่ผู้จัดการตั้งเอง พอของต่ำกว่าเส้น ระบบเตือนทันทีและไม่เตือนซ้ำจนกว่าจะอ่าน แก้ปัญหาสั่งของจากความรู้สึกครับ"') \
    + step('D-8', 'ผู้จัดการดูยอด และค้นว่าใครจ่าย', '1 นาที', 'พนาวุฒน์ + ตรัยรัตน์',
           ['Windows (ผู้จัดการ): เปิดแดชบอร์ดปฏิบัติการ', 'เปิดประวัติการทำรายการ กรองวันนี้ ประเภทยืนยันจ่าย'],
           ['ยอดขายรวมของเดโม', 'แถวยืนยันจ่ายของ D-4 พร้อมชื่อพนักงานคลังและเวลา'],
           '"ผู้จัดการไม่ต้องรอสรุปยอดตอนปิดร้าน และถ้ายอดไม่ตรง ค้นได้ว่าใครทำอะไรเมื่อไรครับ"') + '''
<div class="say"><b>ปิดเดโม:</b> "ทั้งหมดนี้คือเส้นทางหลักของร้าน และแต่ละข้อมี system test อัตโนมัติรองรับ ผมรันให้ดูได้ครับ"</div>

<h2>5. ถ้าอาจารย์ขอดูโค้ดหรือขอให้รันเทส (ใช้ Mac)</h2>
<ul>
<li><b>เปิดโค้ด:</b> VS Code กด <code>Cmd+Shift+F</code> พิมพ์ <code>[D-5]</code> (เลขตามข้อที่ถาม) จะเห็นทุกบรรทัดของข้อนั้น หรือ <code>Cmd+P</code> พิมพ์ <code>ไฟล์:บรรทัด</code> จากใบลำดับเดโม</li>
<li><b>เทสหลังบ้านทั้งหมด:</b> <code>npm test</code> → 134 passed</li>
<li><b>เทสกันจ่ายซ้ำข้อเดียว:</b> <code>npx jest backend/tests/integration/dispatch.test.js</code></li>
<li><b>System test เห็นเบราว์เซอร์:</b> <code>npx playwright test --headed tests/system/acceptance.spec.js:132</code> (ต้องเปิด <code>node start.js</code> บน Mac ก่อน)</li>
<li><b>เดินทีละขั้น:</b> <code>npx playwright test --debug tests/system/acceptance.spec.js:132</code></li>
</ul>

<h2>6. ถ้ามีปัญหาระหว่างเดโม</h2>
<table><tr><th>อาการ</th><th>ทำทันที</th></tr>
<tr><td>ใบเสร็จไม่ออก</td><td>ดูหน้าต่าง start.bat บรรทัด [print] · ถ้า "network name cannot be found" แชร์เครื่องพิมพ์ชื่อ AmpornOMS-Receipt ใหม่ · พูดว่า "การขายยังสำเร็จแม้พิมพ์ไม่ได้ ตามที่ออกแบบให้บริการพิมพ์แยก" แล้วเปิดรูปใบเสร็จจริงรูปที่ 4.13 ในเล่ม</td></tr>
<tr><td>Mac เข้าหน้าคิวไม่ได้</td><td>เช็ค Wi-Fi วงเดียวกัน · ใช้ IP จาก start.bat · <b>แผนสำรอง:</b> เปิดหน้าคิวบน Windows อีกหน้าต่าง (ไม่ระบุตัวตนอีกบัญชี หรือ Edge) วางคู่กัน</td></tr>
<tr><td>คิวไม่อัปเดตเอง</td><td>รอ 3 วินาที (อาจถอยไปใช้ SSE) · ถ้ายังไม่ขึ้นค่อยรีเฟรชหนึ่งครั้ง แล้วอธิบายตามจริง</td></tr>
<tr><td>start.bat ขึ้น EADDRINUSE</td><td>มีหน้าต่างระบบเก่าเปิดค้าง ปิดทุกหน้าต่างแล้วเปิดใหม่</td></tr>
<tr><td>Mac รันเทสแล้วต่อ MySQL ไม่ได้ (mysql.sock)</td><td><code>brew services restart mysql@8.0</code></td></tr>
<tr><td>Mac รันเทสแล้ว Failed running server.js</td><td>มีระบบเปิดซ้ำ ปิดทุกแท็บด้วย Ctrl+C แล้วเปิด <code>node start.js</code> ตัวเดียว</td></tr>
</table>

<h2>7. คำถามที่ต้องตอบได้ระหว่างเดโม</h2>
<ul>
<li><b>ใครทำส่วนไหน:</b> ตรัยรัตน์ หลังบ้าน BE-01–10 ฐานข้อมูล บริการพิมพ์ เทสหลังบ้าน · พนาวุฒน์ หน้าจอ FE-01–09 และมือถือ (อาจารย์ประเมินรายคน)</li>
<li><b>UAT:</b> ยังไม่ได้ทำ ต้องใช้จริง 1 สัปดาห์ตาม scenario ขออนุญาตกรรมการขอเวลาทำ UAT</li>
<li><b>ทำไมไม่เชื่อมธนาคาร:</b> อยู่นอกขอบเขต พนักงานดูแอปธนาคารแล้วยืนยันเอง เสนอเป็นงานต่อยอด</li>
<li><b>เครื่องดับข้อมูลหายไหม:</b> ไม่หาย บันทึกลงดิสก์แล้ว แต่ถ้าฮาร์ดดิสก์เสียจะหาย เพราะยังไม่มี backup (ข้อจำกัด 5.3.7)</li>
</ul>

<h2>เช็คลิสต์ก่อนเริ่มเดโม</h2>
<div><span class="box"></span>start.bat เปิด ไม่มี error · <span class="box"></span>เครื่องพิมพ์มีกระดาษ · <span class="box"></span>Mac เปิดหน้าคิวของ Windows ได้ · <span class="box"></span>เข้าบัญชีครบ 3 บทบาท · <span class="box"></span>สินค้า A และ B ตั้งค่าแล้ว · <span class="box"></span>VS Code เปิดรอ · <span class="box"></span>Terminal บน Mac อยู่ในโฟลเดอร์ soml</div>
'''

io.open(os.path.join(HERE, 'guide.html'), 'w', encoding='utf-8').write(
    '<!doctype html><html><head><meta charset="utf-8"><title>เดโมไกด์</title><style>%s</style></head><body>%s</body></html>' % (CSS, body))
print('ok')
