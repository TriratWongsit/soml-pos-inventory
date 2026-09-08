#!/usr/bin/env bash
# ---------------------------------------------------------------------
# สร้างไฟล์ Word ของ Use Case SRS ให้มีรูปแบบเหมือนเอกสารต้นแบบของรายวิชา
#
#   bash Documents/build-casex-docx.sh
#
# วิธีทำงาน: ใช้ไฟล์ต้นแบบ ENGSE206_CaseX_SRS_v1.0_TH.docx เป็นไฟล์อ้างอิง
# รูปแบบโดยตรง จึงได้ฟอนต์ สี ขนาดตัวอักษร ธีม หัวกระดาษ และท้ายกระดาษ
# ชุดเดียวกับต้นแบบทั้งหมด แล้วเติมสิ่งที่ pandoc ต้องใช้เพิ่มสองอย่าง คือ
# สไตล์ย่อหน้าที่ต้นแบบไม่มี และสไตล์ตารางที่ทำหัวตารางให้เป็นพื้นสีน้ำเงินเข้ม
# ตัวอักษรขาว เหมือนตารางในต้นแบบ จากนั้นจัดหน้าปกให้ตรงกับต้นแบบ
# ---------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_CaseX_SRS_v1.0_TH.docx"
SRC="$HERE/UseCase_SRS_SOML_ENGSE206_v1.0_TH.md"
OUT="$HERE/UseCase_SRS_SOML_ENGSE206_v1.0_TH.docx"

command -v pandoc >/dev/null || { echo "ไม่พบ pandoc — ติดตั้งด้วย brew install pandoc" >&2; exit 1; }
[ -f "$TEMPLATE" ] || { echo "ไม่พบไฟล์ต้นแบบ: $TEMPLATE" >&2; exit 1; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/tpl" "$WORK/pan"
(cd "$WORK/tpl" && unzip -q "$TEMPLATE")
pandoc --print-default-data-file reference.docx > "$WORK/pandoc-ref.docx"
(cd "$WORK/pan" && unzip -q ../pandoc-ref.docx)

python3 - "$WORK" <<'PY'
# coding: utf-8
import io, os, re, sys, zipfile
work = sys.argv[1]
tplp = os.path.join(work, 'tpl', 'word', 'styles.xml')
tpl = io.open(tplp, encoding='utf-8').read()
pan = io.open(os.path.join(work, 'pan', 'word', 'styles.xml'), encoding='utf-8').read()

# เติมเฉพาะสไตล์ที่ต้นแบบไม่มี สไตล์ของต้นแบบมีสิทธิ์เหนือกว่าเสมอ
have = set(re.findall(r'w:styleId="([^"]+)"', tpl))
add = [m.group() for m in re.finditer(r'<w:style [^>]*?>.*?</w:style>', pan, re.S)
       if re.search(r'w:styleId="([^"]+)"', m.group()).group(1) not in have]

# สไตล์ตารางให้เหมือนตารางในต้นแบบ คือเส้นตารางทึบและหัวตารางพื้น 183B63 ตัวอักษรขาวหนา
add.append(
 '<w:style w:type="table" w:styleId="Table"><w:name w:val="Table"/>'
 '<w:basedOn w:val="TableNormal"/><w:uiPriority w:val="59"/>'
 '<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>'
 '<w:tblPr><w:tblBorders>'
 '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
 '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
 '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
 '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
 '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
 '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
 '</w:tblBorders><w:tblCellMar>'
 '<w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
 '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>'
 '<w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/></w:rPr>'
 '<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="183B63"/></w:tcPr></w:tblStylePr>'
 '</w:style>')
tpl = tpl.replace('</w:styles>', ''.join(add) + '</w:styles>')

# อักษรไทยนับเป็น complex script ถ้ากำหนดแต่ w:sz โดยไม่กำหนด w:szCs ข้อความไทย
# จะเล็กกว่าข้อความอังกฤษในย่อหน้าเดียวกัน จึงกำหนด szCs ให้เท่ากับ sz ทุกแห่ง
tpl = re.sub(r'<w:szCs w:val="\d+"\s*/>', '', tpl)
tpl = re.sub(r'<w:sz w:val="(\d+)"\s*/>',
             lambda m: '<w:sz w:val="%s"/><w:szCs w:val="%s"/>' % (m.group(1), m.group(1)), tpl)
io.open(tplp, 'w', encoding='utf-8').write(tpl)

# หัวกระดาษและท้ายกระดาษคงรูปแบบเดิม เปลี่ยนเฉพาะชื่อเอกสารและสถานะ
for name, old, new in (('header1.xml', 'Case X SRS', 'SOML Use Case SRS'),
                       ('footer1.xml', 'Review Candidate', 'Review Candidate')):
    p = os.path.join(work, 'tpl', 'word', name)
    io.open(p, 'w', encoding='utf-8').write(io.open(p, encoding='utf-8').read().replace(old, new))

out = os.path.join(work, 'reference.docx')
z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
root = os.path.join(work, 'tpl')
for base, _, files in os.walk(root):
    for fn in files:
        full = os.path.join(base, fn)
        z.write(full, os.path.relpath(full, root))
z.close()
PY

pandoc "$SRC" -f markdown+pipe_tables+backtick_code_blocks \
  --reference-doc="$WORK/reference.docx" --resource-path="$HERE" -o "$OUT"

python3 "$HERE/casex-postprocess.py" "$OUT" "$TEMPLATE"

echo "  ✓ $(basename "$OUT")"
