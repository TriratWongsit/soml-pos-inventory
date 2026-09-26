#!/usr/bin/env bash
# ---------------------------------------------------------------------
# รีเซ็ตฐานข้อมูลกลับสู่สภาพตั้งต้น = schema + สินค้า + ผู้ใช้
#
#   npm run db:reset          ฐานใช้งาน  (DB_NAME       ปริยาย soml_new)
#   npm run db:reset:test     ฐานทดสอบ   (DB_NAME_TEST  ปริยาย soml_new_test)
#
# ไฟล์ schema/seed มี CREATE DATABASE/USE soml_new อยู่ในตัว จึงต้องตัดออก
# แล้วให้ไคลเอนต์เลือกฐานเป้าหมายแทน มิฉะนั้นการรีเซ็ตฐานทดสอบจะทับฐานใช้งาน
# ---------------------------------------------------------------------
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] && { set -a; source .env; set +a; }

TARGET="${DB_NAME:-soml_new}"
[[ "${1:-}" == "test" ]] && TARGET="${DB_NAME_TEST:-soml_new_test}"

run() { mysql -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "${DB_USER:-root}" ${DB_PASSWORD:+-p"$DB_PASSWORD"} "$@"; }
strip_db() { grep -viE '^\s*(CREATE DATABASE|DEFAULT CHARACTER SET|DEFAULT COLLATE|USE )' "$1"; }

echo "รีเซ็ตฐานข้อมูล $TARGET"
run -e "DROP DATABASE IF EXISTS \`$TARGET\`; CREATE DATABASE \`$TARGET\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;"
strip_db db/schema/schema.sql  | run "$TARGET"
strip_db db/seed/products.sql  | run "$TARGET"
DB_NAME="$TARGET" node db/seed/seed-users.js > /dev/null

echo "  ตาราง : $(run -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TARGET'")"
echo "  สินค้า: $(run -N "$TARGET" -e 'SELECT COUNT(*) FROM products') รายการ"
echo "  ผู้ใช้ : $(run -N "$TARGET" -e 'SELECT COUNT(*) FROM users') บัญชี"
