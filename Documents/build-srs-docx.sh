#!/usr/bin/env bash
# ---------------------------------------------------------------------
# สร้างไฟล์ Word + PDF ของ SRS (ISO/IEC/IEEE 29148) ให้มีรูปแบบเหมือนเทมเพลตของหลักสูตร
#
#   bash Documents/build-srs-docx.sh          # SRS_SOML_v1.0_TH.md บนเทมเพลต ISO ของหลักสูตร
#   bash Documents/build-srs-docx.sh w07      # SRS_SOML_W07_v0.1_TH.md บนเทมเพลตนักศึกษาสัปดาห์ที่ 7
#   bash Documents/build-srs-docx.sh ucx      # UseCaseX_SOML_v2.0_TH.md (Use Case X แบบเรียบ ฟอนต์/ขอบกระดาษเดียวกับ w07)
#   bash Documents/build-srs-docx.sh be       # สรุประบบหลังบ้าน_SOML.md
#
# วิธีทำงาน: ใช้เทมเพลต_SRS_ตาม-ISO-IEC-IEEE-29148.docx เป็นไฟล์อ้างอิงรูปแบบของ pandoc
# (ฟอนต์ TH Sarabun New, หัวข้อสีน้ำเงิน, ขอบกระดาษ) เติมสไตล์ที่ pandoc ต้องใช้แต่เทมเพลตไม่มี
# แล้วปรับหน้าปกและตารางด้วย srs-postprocess.py ให้ตรงกับเทมเพลต จากนั้นแปลงเป็น PDF ด้วย LibreOffice
# ---------------------------------------------------------------------
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PROFILE="${1:-iso}"
if [ "$PROFILE" = "w07" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/SRS_SOML_W07_v0.1_TH.md"
elif [ "$PROFILE" = "ucx" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/UseCaseX_SOML_v2.0_TH.md"
elif [ "$PROFILE" = "testplan" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/แผนการทดสอบ_SOML.md"
elif [ "$PROFILE" = "testcase" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/กรณีทดสอบ_อำพรOMS.md"
elif [ "$PROFILE" = "status" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/สถานะโครงงาน_2026-09-23.md"
elif [ "$PROFILE" = "ucmap" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/สรุปกรณีการใช้งานกับความต้องการ.md"
elif [ "$PROFILE" = "study" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/อ่านเตรียมตอบอาจารย์.md"
elif [ "$PROFILE" = "stake" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/ผู้มีส่วนได้ส่วนเสีย.md"
elif [ "$PROFILE" = "script" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/สคริปต์นำเสนอ_demo.md"
elif [ "$PROFILE" = "talk" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/บทพูดนำเสนอ_อัปเดตอาจารย์.md"
elif [ "$PROFILE" = "changes" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/สรุปการแก้ไขเล่ม_ตามคู่มือ.md"
elif [ "$PROFILE" = "appdemo" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/สคริปต์เดโมแอป_ตามUseCase.md"
elif [ "$PROFILE" = "wininstall" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/../soml/ติดตั้งบนWindows.md"
elif [ "$PROFILE" = "survey" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/แบบประเมินความพึงพอใจ_SOML.md"
elif [ "$PROFILE" = "be" ]; then
  TEMPLATE="$HERE/เทมเพลต SRS/ENGSE206_Week07_Student_SRS_Template_TH.docx"
  SRC="$HERE/สรุประบบหลังบ้าน_SOML.md"
else
  TEMPLATE="$HERE/เทมเพลต SRS/เทมเพลต_SRS_ตาม-ISO-IEC-IEEE-29148.docx"
  SRC="$HERE/SRS_SOML_v1.0_TH.md"
fi
OUT="${SRC%.md}.docx"
command -v pandoc >/dev/null || { echo "ไม่พบ pandoc" >&2; exit 1; }
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/tpl" "$WORK/pan"
(cd "$WORK/tpl" && unzip -q "$TEMPLATE")
pandoc --print-default-data-file reference.docx > "$WORK/pandoc-ref.docx"
(cd "$WORK/pan" && unzip -q ../pandoc-ref.docx)
python3 - "$WORK" "$PROFILE" <<'PY'
# -*- coding: utf-8 -*-
import io, os, re, sys, zipfile
work, profile = sys.argv[1], sys.argv[2]
tplp = os.path.join(work, 'tpl', 'word', 'styles.xml')
tpl = io.open(tplp, encoding='utf-8').read()
pan = io.open(os.path.join(work, 'pan', 'word', 'styles.xml'), encoding='utf-8').read()
have = set(re.findall(r'w:styleId="([^"]+)"', tpl))
add = [m.group() for m in re.finditer(r'<w:style [^>]*?>.*?</w:style>', pan, re.S)
       if re.search(r'w:styleId="([^"]+)"', m.group()).group(1) not in have]
tpl = tpl.replace('</w:styles>', ''.join(add) + '</w:styles>')
# อักษรไทยเป็น complex script ต้องมี szCs เท่ากับ sz ไม่งั้นไทยเล็กกว่าอังกฤษ
tpl = re.sub(r'<w:szCs w:val="\d+"\s*/>', '', tpl)
tpl = re.sub(r'<w:sz w:val="(\d+)"\s*/>', lambda m: '<w:sz w:val="%s"/><w:szCs w:val="%s"/>' % (m.group(1), m.group(1)), tpl)
if profile in ('w07', 'ucx', 'be', 'survey', 'status', 'testplan', 'ucmap', 'study', 'stake', 'script', 'talk', 'changes', 'appdemo', 'wininstall', 'testcase'):
    # เทมเพลต W07 ใช้ 16 พอยต์ทุกระดับ ให้หัวข้อใหญ่ 20 / หัวข้อย่อย 18 เพื่อให้เห็นลำดับชั้น และตัวอักษรเนื้อความสีดำ
    for sid, sz in (('Heading1', 40), ('Heading2', 36), ('Heading3', 32)):
        tpl = re.sub(r'(<w:style [^>]*w:styleId="%s".*?)<w:sz w:val="\d+"/><w:szCs w:val="\d+"/>' % sid,
                     lambda m: m.group(1) + '<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (sz, sz), tpl, count=1, flags=re.S)
    tpl = tpl.replace('<w:color w:val="111827"/>', '<w:color w:val="000000"/>')
    # หัวกระดาษและท้ายกระดาษคงรูปแบบเดิม เปลี่ยนเฉพาะข้อความให้เป็นของเอกสารนี้
    hdr, ftr = {'ucx': ('Use Case SRS — อำพร OMS', 'ENGSE206 • อำพร OMS • Use Case SRS v2.0 • '),
                'be': (None, 'อำพร OMS • สรุประบบหลังบ้าน • '),
                'survey': (None, 'อำพร OMS • แบบประเมินความพึงพอใจ • '),
                'status': (None, 'อำพร OMS • สรุปสถานะโครงงาน • '),
                'wininstall': (None, 'อำพร OMS • ติดตั้งบน Windows • '),
                'appdemo': (None, 'อำพร OMS • สคริปต์เดโมแอปตาม Use Case • '),
                'script': (None, 'อำพร OMS • สคริปต์นำเสนอ • '),
                'talk': (None, 'อำพร OMS • บทพูดนำเสนอ • '),
                'changes': (None, 'อำพร OMS • สรุปการแก้ไขเล่ม • '),
                'stake': (None, 'อำพร OMS • ผู้มีส่วนได้ส่วนเสีย • '),
                'study': (None, 'อำพร OMS • อ่านเตรียมตอบอาจารย์ • '),
                'ucmap': (None, 'อำพร OMS • สรุปกรณีการใช้งานกับความต้องการ • '),
                'testplan': (None, 'อำพร OMS • แผนการทดสอบซอฟต์แวร์ • '),
                'testcase': (None, 'อำพร OMS • กรณีทดสอบ • '),   # None = แทนหัวกระดาษทั้งบรรทัด ไม่ขึ้นต้นด้วยรหัสวิชา
                }.get(profile, ('SRS — อำพร OMS', 'ENGSE206 • อำพร OMS • SRS v0.1-draft • '))
    head_by_profile = {'be': 'อำพร OMS  •  สรุประบบหลังบ้าน (Backend Summary)',
                       'survey': 'อำพร OMS  •  แบบประเมินความพึงพอใจของผู้ใช้งาน',
                       'status': 'อำพร OMS  •  สรุปสถานะโครงงาน',
                       'testplan': 'อำพร OMS  •  แผนการทดสอบซอฟต์แวร์',
                       'testcase': 'อำพร OMS  •  กรณีทดสอบ',
                       'ucmap': 'อำพร OMS  •  สรุปกรณีการใช้งานกับความต้องการ',
                       'study': 'อำพร OMS  •  อ่านเตรียมตอบอาจารย์',
                       'stake': 'อำพร OMS  •  ผู้มีส่วนได้ส่วนเสียและการใช้งานระบบ',
                       'script': 'อำพร OMS  •  สคริปต์นำเสนอและเดโมระบบ',
                       'talk': 'อำพร OMS  •  บทพูดนำเสนออัปเดตความคืบหน้า',
                       'changes': 'อำพร OMS  •  สรุปการแก้ไขเล่มปริญญานิพนธ์',
                       'appdemo': 'อำพร OMS  •  สคริปต์เดโมแอปตาม Use Case',
                       'wininstall': 'อำพร OMS  •  ติดตั้งและรันบน Windows'}
    head_new = head_by_profile[profile] if hdr is None else 'ENGSE206  •  ' + hdr
    for name, old, new in (('header1.xml', 'ENGSE206  •  WEEK 07  |  STUDENT SRS TEMPLATE', head_new),
                           ('footer1.xml', 'ENGSE206 • CRBS • WEEK 07 • ', ftr)):
        p = os.path.join(work, 'tpl', 'word', name)
        txt = io.open(p, encoding='utf-8').read().replace(old, new)   # อ่านให้เสร็จก่อนเปิดเขียน ไม่งั้นไฟล์ถูกล้างก่อนอ่าน
        io.open(p, 'w', encoding='utf-8').write(txt)
io.open(tplp, 'w', encoding='utf-8').write(tpl)
out = os.path.join(work, 'reference.docx')
z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
root = os.path.join(work, 'tpl')
for base, _, files in os.walk(root):
    for fn in files:
        full = os.path.join(base, fn); z.write(full, os.path.relpath(full, root))
z.close()
PY
pandoc "$SRC" -f markdown+pipe_tables-implicit_figures -t docx --reference-doc "$WORK/reference.docx" --resource-path "$HERE" -o "$OUT"
python3 "$HERE/srs-postprocess.py" "$OUT" "$PROFILE"
soffice --headless --convert-to pdf --outdir "$HERE" "$OUT" >/dev/null 2>&1 && echo "  ✓ $(basename "${OUT%.docx}").pdf"
echo "  ✓ $(basename "$OUT")"
