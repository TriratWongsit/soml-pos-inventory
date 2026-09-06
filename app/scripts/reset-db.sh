#!/usr/bin/env bash
# ---------------------------------------------------------------------
# รีเซ็ตฐานข้อมูลกลับสู่สภาพตั้งต้น
#
# ใช้ก่อนเก็บผลทดสอบทุกครั้ง เพื่อให้ผลที่ได้ทำซ้ำได้และรหัสสินค้าตรงกัน
# ทุกรอบ ซึ่งจำเป็นต่อการอ้างอิงตัวเลขในบทที่ 4
#
#   bash scripts/reset-db.sh          รีเซ็ตฐานข้อมูลใช้งาน (soml)
#   bash scripts/reset-db.sh test     รีเซ็ตฐานข้อมูลทดสอบ (soml_test)
# ---------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# อ่านค่าการเชื่อมต่อจาก .env เพื่อไม่ให้ค่ากระจายอยู่หลายที่
set -a; source .env; set +a

MYSQL_BIN="$(command -v mysql || echo /opt/homebrew/opt/mysql@8.0/bin/mysql)"
TARGET="${DB_NAME:-soml}"
if [[ "${1:-}" == "test" ]]; then TARGET="${DB_NAME_TEST:-soml_test}"; fi

run() { "$MYSQL_BIN" -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "${DB_USER:-root}" ${DB_PASSWORD:+-p"$DB_PASSWORD"} "$@"; }

echo "รีเซ็ตฐานข้อมูล $TARGET"
run -e "DROP DATABASE IF EXISTS \`$TARGET\`;"
run -e "CREATE DATABASE \`$TARGET\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;"

# ทั้ง schema.sql และ seed.sql มีคำสั่งสร้างและเลือกฐานข้อมูลชื่อ soml อยู่ในตัว
# ต้องตัดออกก่อนแล้วให้ไคลเอนต์เป็นผู้เลือกฐานข้อมูลเป้าหมายแทน มิฉะนั้นการ
# รีเซ็ตฐานข้อมูลทดสอบจะไปเขียนทับฐานข้อมูลใช้งานจริง
strip_db_statements() {
  python3 - "$1" <<'PY'
import io, re, sys
sql = io.open(sys.argv[1], encoding='utf-8').read()
sql = re.sub(r'CREATE\s+DATABASE.*?;', '', sql, flags=re.S | re.I)
sql = re.sub(r'^\s*USE\s+[^;]+;\s*$', '', sql, flags=re.M | re.I)
upper = sql.upper()
assert 'CREATE DATABASE' not in upper and 'USE ' not in upper, 'ตัดคำสั่งเลือกฐานข้อมูลไม่สำเร็จ'
sys.stdout.write(sql)
PY
}

strip_db_statements db/schema.sql | run "$TARGET"
strip_db_statements db/seed.sql   | run "$TARGET"
DB_NAME="$TARGET" NODE_ENV=production node db/seed-users.js >/dev/null

echo "  ตาราง: $(run -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TARGET';")"
echo "  สินค้า: $(run -N "$TARGET" -e 'SELECT COUNT(*) FROM products;') รายการ (product_id 1-25)"
echo "  ผู้ใช้: $(run -N "$TARGET" -e 'SELECT COUNT(*) FROM users;') บัญชี"
