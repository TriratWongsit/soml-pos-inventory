#!/usr/bin/env bash
# ---------------------------------------------------------------------
# แปลงเอกสาร Markdown ของโครงงานเป็นไฟล์ .docx สำหรับส่งอาจารย์
#
#   bash Documents/md-to-docx.sh UseCase_SRS_SOML_ENGSE206_v1.0_TH.md
#   bash Documents/md-to-docx.sh รูปเล่ม/บทที่4.md
#
# สคริปต์สร้างไฟล์ต้นแบบรูปแบบเอกสาร (reference.docx) ขึ้นเองจากค่าเริ่มต้น
# ของ pandoc แล้วเปลี่ยนฟอนต์เป็น TH Sarabun New ขนาด 16 พอยต์ตามรูปแบบ
# เอกสารวิชาการไทย จึงไม่ต้องเก็บไฟล์ไบนารีต้นแบบไว้ในที่เก็บโค้ด
#
# ต้องติดตั้ง pandoc ก่อน:  brew install pandoc
# ---------------------------------------------------------------------
set -euo pipefail

FONT='TH Sarabun New'
SIZE=32   # หน่วยเป็นครึ่งพอยต์ 32 = 16 พอยต์

if [ $# -lt 1 ]; then
  echo "ใช้: bash Documents/md-to-docx.sh <ไฟล์.md> [ไฟล์.md ...]" >&2
  exit 1
fi

command -v pandoc >/dev/null || { echo "ไม่พบ pandoc — ติดตั้งด้วย brew install pandoc" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ---- สร้างไฟล์ต้นแบบรูปแบบเอกสารที่ใช้ฟอนต์ไทย ----
pandoc --print-default-data-file reference.docx > "$WORK/ref.docx"
mkdir -p "$WORK/ref" && (cd "$WORK/ref" && unzip -q ../ref.docx)

FONT="$FONT" SIZE="$SIZE" python3 - "$WORK/ref" <<'PY'
# coding: utf-8
import io, os, re, sys
root, font, size = sys.argv[1], os.environ['FONT'], os.environ['SIZE']

p = os.path.join(root, 'word', 'styles.xml')
s = io.open(p, encoding='utf-8').read()
s = s.replace(
    '<w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi" />',
    '<w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:cs="{f}" w:eastAsia="{f}" />'.format(f=font))
s = s.replace('<w:sz w:val="24" />\n        <w:szCs w:val="24" />',
              '<w:sz w:val="{0}" />\n        <w:szCs w:val="{0}" />'.format(size))
# อักษรไทยนับเป็น complex script ต้องกำหนด szCs คู่กับ sz ทุกแห่ง ไม่เช่นนั้น
# ขนาดตัวอักษรไทยจะไม่เปลี่ยนตามที่ตั้งไว้
s = re.sub(r'<w:szCs w:val="\d+"\s*/>', '', s)
s = re.sub(r'<w:sz w:val="(\d+)"\s*/>',
           lambda m: '<w:sz w:val="%s" /><w:szCs w:val="%s" />' % (m.group(1), m.group(1)), s)
io.open(p, 'w', encoding='utf-8').write(s)

tp = os.path.join(root, 'word', 'theme', 'theme1.xml')
t = io.open(tp, encoding='utf-8').read()
t = re.sub(r'(<a:(?:majorFont|minorFont)>\s*<a:latin typeface=")[^"]*"', r'\g<1>%s"' % font, t)
io.open(tp, 'w', encoding='utf-8').write(t)
PY

(cd "$WORK/ref" && zip -q -r ../reference-th.docx .)

# ---- แปลงทีละไฟล์ ----
for SRC in "$@"; do
  [ -f "$SRC" ] || SRC="$HERE/$SRC"
  OUT="${SRC%.md}.docx"
  pandoc "$SRC" \
    -f markdown+pipe_tables+backtick_code_blocks \
    --reference-doc="$WORK/reference-th.docx" \
    --resource-path="$(dirname "$SRC")" \
    -o "$OUT"
  echo "  ✓ $(basename "$OUT")"
done
