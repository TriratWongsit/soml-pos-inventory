#!/usr/bin/env python3
# ---------------------------------------------------------------------
# แปลงไฟล์สต็อกจริงของร้าน (Excel 28 ก.ค. 69) เป็น products.sql
#
# ที่มา: หลักฐานหน้างาน EV-09 (บทที่ 3 หัวข้อ 3.2.1) — ร้านเก็บสินค้าใน Excel
# 18 ชีต แต่ละชีตหัวตารางไม่เหมือนกัน สคริปต์นี้ทำให้ทุกชีตเข้า products
# ซึ่งบังคับ sku, name, unit, price ต้องมีทุกแถว (schema.sql ตาราง 2)
#
# วิธีใช้
#   pip3 install openpyxl
#   python3 db/seed/build-products.py <ไฟล์.xlsx> > db/seed/products.sql
#
# กติกาแปลง (ตกลงไว้ 16 ก.ย. 69)
#   1. เอาเฉพาะแถวที่ "ข้อมูลครบ": มีรหัสเป็นตัวเลข มีชื่อ มีราคาเป็นตัวเลข
#      แถวที่ไม่ครบถูกข้ามและนับไว้ท้ายไฟล์ ไม่เดาค่าให้
#   2. ค่าที่เว้นว่างเพราะ "เหมือนแถวบน" (ประเภท แบรนด์ หน่วย และราคาในชีตสี)
#      ให้ใช้ค่าจากแถวบน — เป็นวิธีที่ร้านเขียนไฟล์จริง ไม่ใช่ข้อมูลหาย
#   3. ไม่มีจำนวนสต็อกในไฟล์ = 0 ให้ผู้จัดการรับเข้าผ่านระบบ (UC-02 reason=receive)
#      จำนวนที่เป็นข้อความเช่น "980+เศษ" ใช้ตัวเลขข้างหน้า (980) เศษไม่นับ
#   4. reorder_point = 0 ทั้งหมด ผู้จัดการตั้งเองตาม FR-02 (0 = ยังไม่แจ้งเตือน)
#   5. ชีตที่ไม่มีคอลัมน์หน่วย ใช้หน่วยปริยายของชีตในตาราง SHEETS ข้างล่าง
#      (ดูจากวิธีที่ร้านนับสินค้าชนิดนั้น — แก้ได้ที่ตารางนี้ที่เดียว)
#   6. ไม่ส่งออกราคาซื้อ (ต้นทุน) เพราะระบบไม่ใช้ และเป็นข้อมูลภายในของร้าน
#   7. หมวดหมู่ = ชื่อชีต (18 ก.ย. 69 อาจารย์อนุมัติให้เพิ่ม) — ร้านจัดสต็อกเป็นชีตตามหมวดอยู่แล้ว
#      หมวดย่อยในคอลัมน์แรก (เช่น สีภายนอก/สีภายใน) ถูกรวมอยู่ในชื่อสินค้าแล้ว จึงไม่แยกคอลัมน์
# ---------------------------------------------------------------------
import sys
import re
import openpyxl

# ชีต → (คอลัมน์ชื่อสินค้าตามลำดับที่จะต่อกัน, หน่วยปริยาย, คอลัมน์ที่ส่งค่าลงมาจากแถวบน)
# ชื่อสินค้าประกอบจากหลายคอลัมน์ต่อกันด้วยช่องว่าง เพื่อให้ค้นบนหน้าขายเจอทั้งประเภทและขนาด
SHEETS = {
    'สี':              (['ประเภทสินค้า', 'แบรนด์', 'หน่วย', 'รหัสสี'], None,     ['ประเภทสินค้า', 'แบรนด์', 'หน่วย', 'ราคาขาย']),
    'เหล็ก':           (['รายการสินค้า', 'ขนาด'],                     'เส้น',   ['รายการสินค้า']),
    'หิน+ทราย':        (['ชื่อสินค้า'],                                'เที่ยว', ['ประเภท']),
    'เสา':             (['ประเภทสินค้า', 'สินค้า'],                    'ต้น',    []),
    'ท่ออัดใยหิน':     (['รายการ'],                                    'ท่อน',   []),
    'อิฐ-บล็อก':       (['สินค้า'],                                    'ก้อน',   []),
    'ท่อซีเมนต์':      (['สินค้า'],                                    'ท่อน',   []),
    'สังกะสี':         (['สินค้า'],                                    'แผ่น',   ['ประเภทสินค้า']),
    'กระเบื้องหลังคา': (['รายการ'],                                    'แผ่น',   ['ประเภทสินค้า']),
    'งานไม้':          (['รายการ'],                                    'แผ่น',   ['ประเภทสินค้า']),
    'ตะข่าย':          (['สินค้า'],                                    None,     []),
    'ห้องน้ำ':         (['สินค้า'],                                    'ชิ้น',   []),
    'ประปา':           (['สินค้า'],                                    'ชิ้น',   ['ประเภทสินค้า']),
    'ไฟฟ้า':           (['สินค้า'],                                    'ชิ้น',   []),
    'น็อต-สกรู-ตะปู':  (['สินค้า'],                                    None,     []),
    'กระดาษทราย':      (['สินค้า'],                                    'แผ่น',   []),
    # 'ปูน' และ 'อุปกรณ์ช่าง' ไม่มีคอลัมน์รหัสสินค้า จึงเข้าไม่ได้ตามกติกาข้อ 1
}

# ชื่อคอลัมน์ที่ต่างกันในแต่ละชีตแต่หมายถึงสิ่งเดียวกัน
PRICE_COLS = ['ราคาขาย', 'ราคา']
STOCK_COLS = ['จำนวนในสต็อค', 'จำนวน']
SKU_COL = 'รหัสสินค้า'
UNIT_COL = 'หน่วย'


def clean(text):
    """ตัดช่องว่าง แท็บ และช่องว่างซ้ำ ที่ติดมาจาก Excel"""
    return re.sub(r'\s+', ' ', str(text)).strip()


def leading_int(value):
    """'980+เศษ' → 980, 12 → 12, None/'เศษ' → 0 (กติกาข้อ 3)"""
    if isinstance(value, (int, float)):
        return int(value)
    m = re.match(r'\s*(\d+)', str(value or ''))
    return int(m.group(1)) if m else 0


def sql_str(text):
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'") + "'"


def read_sheet(ws, spec):
    name_cols, default_unit, ffill_cols = spec
    rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
    header = [clean(c) if c else '' for c in rows[0]]
    idx = {h: i for i, h in enumerate(header) if h}

    def col(names):
        for n in names:
            if n in idx:
                return idx[n]
        return None

    i_sku, i_price, i_stock, i_unit = col([SKU_COL]), col(PRICE_COLS), col(STOCK_COLS), col([UNIT_COL])
    carried = {}
    kept, skipped = [], 0
    for r in rows[1:]:
        row = {h: r[i] for h, i in idx.items()}
        # กติกาข้อ 2: ค่าที่ร้านเว้นว่างเพราะเหมือนแถวบน
        for c in ffill_cols:
            if row.get(c) not in (None, ''):
                carried[c] = row[c]
            else:
                row[c] = carried.get(c)
        sku = r[i_sku] if i_sku is not None else None
        price = row.get(header[i_price]) if i_price is not None else None
        name = ' '.join(clean(row[c]) for c in name_cols if row.get(c) not in (None, ''))
        # กติกาข้อ 1: ต้องมีรหัสตัวเลข ชื่อ และราคาตัวเลข
        if not isinstance(sku, (int, float)) or not name or not isinstance(price, (int, float)):
            skipped += 1
            continue
        unit = clean(row[UNIT_COL]) if i_unit is not None and row.get(UNIT_COL) else default_unit
        if not unit:
            skipped += 1
            continue
        stock = leading_int(r[i_stock]) if i_stock is not None else 0
        kept.append((str(int(sku)), name, clean(ws.title), unit, float(price), stock))
    return kept, skipped


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    out = ['-- สร้างโดย db/seed/build-products.py จากไฟล์สต็อกร้าน 28 ก.ค. 69 — อย่าแก้ไฟล์นี้ด้วยมือ',
           '-- กติกาแปลงอยู่หัวสคริปต์ · แถวที่ข้ามดูสรุปท้ายไฟล์',
           'USE soml_new;', '',
           'INSERT INTO products (sku, name, category, unit, price, stock_qty, reorder_point) VALUES']
    values, summary, seen = [], [], set()
    for ws in wb.worksheets:
        if ws.title not in SHEETS:
            summary.append(f'--   {ws.title}: ข้ามทั้งชีต (ไม่มีคอลัมน์รหัสสินค้า)')
            continue
        kept, skipped = read_sheet(ws, SHEETS[ws.title])
        summary.append(f'--   {ws.title}: เข้า {len(kept)} ข้าม {skipped}')
        for sku, name, category, unit, price, stock in kept:
            if sku in seen:
                raise SystemExit(f'รหัสสินค้าซ้ำ: {sku} ({name})')
            seen.add(sku)
            values.append(f'  ({sql_str(sku)}, {sql_str(name)}, {sql_str(category)}, {sql_str(unit)}, {price:.2f}, {stock}, 0)')
    out.append(',\n'.join(values) + ';')
    out += ['', f'-- รวม {len(values)} รายการ', '-- สรุปรายชีต:'] + summary
    print('\n'.join(out))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('ใช้: build-products.py <ไฟล์.xlsx>')
    main(sys.argv[1])
