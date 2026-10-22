#!/usr/bin/env bash
# ---------------------------------------------------------------------
# เรนเดอร์แผนภาพ Mermaid ในบทที่ 3 จากไฟล์ .mmd เป็น .png
#
# ใช้ทุกครั้งที่แก้ไฟล์ .mmd เพื่อให้รูปในรูปเล่มตรงกับต้นฉบับเสมอ
#   bash scripts/render-diagrams.sh              เรนเดอร์ทุกรูป
#   bash scripts/render-diagrams.sh fig3-10      เรนเดอร์เฉพาะรูปที่ระบุ
# ---------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/Documents/assets/diagrams"
MMDC="$ROOT/app/node_modules/.bin/mmdc"
FILTER="${1:-}"

for src in "$DIR"/*.mmd; do
  name="$(basename "$src" .mmd)"
  if [[ -n "$FILTER" && "$name" != *"$FILTER"* ]]; then continue; fi
  echo "  เรนเดอร์ $name"
  "$MMDC" -i "$src" -o "$DIR/$name.png" -c "$DIR/mermaid-config.json" -b white -s 4 >/dev/null
done
echo "เสร็จแล้ว"
