#!/bin/sh
# สร้างฐานข้อมูลครั้งแรกใน Docker: โครงสร้าง + สินค้าของร้าน
# ต้องระบุ utf8mb4 เอง ไม่งั้นไคลเอนต์อ่านภาษาไทยเป็น latin1 แล้วชื่อหน่วยยาวเกินคอลัมน์ (เหมือนที่ db/reset-db.sh ระวังไว้)
set -e
mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" < /seed/schema.sql
mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" < /seed/products.sql
echo "อำพร OMS: สร้างฐานข้อมูลและสินค้าแล้ว"
