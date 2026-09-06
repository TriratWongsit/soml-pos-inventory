#!/usr/bin/env bash
# ---------------------------------------------------------------------
# สร้างใบรับรองแบบลงนามด้วยตนเอง (self-signed) สำหรับสภาพแวดล้อมพัฒนา
# และทดสอบ เพื่อให้ระบบให้บริการผ่าน HTTPS ได้ตามที่ NFR-01 กำหนด
#
# ใบรับรองชุดนี้ใช้กับ localhost เท่านั้น เมื่อนำระบบไปติดตั้งใช้งานจริง
# ที่ร้าน ให้เปลี่ยนไปใช้ใบรับรองที่ออกโดยผู้ให้บริการที่เชื่อถือได้
# ---------------------------------------------------------------------
set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certs"
mkdir -p "$CERT_DIR"

if [[ -f "$CERT_DIR/cert.pem" && -f "$CERT_DIR/key.pem" ]]; then
  echo "มีใบรับรองอยู่แล้วที่ $CERT_DIR — ข้ามขั้นตอนนี้"
  echo "ถ้าต้องการสร้างใหม่ ให้ลบไฟล์ในโฟลเดอร์นั้นก่อน"
  exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -subj "/C=TH/O=SOML/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$CERT_DIR/key.pem"
echo "สร้างใบรับรองสำเร็จที่ $CERT_DIR"
echo "เบราว์เซอร์จะเตือนว่าใบรับรองไม่น่าเชื่อถือในครั้งแรก ให้กดยอมรับเพื่อใช้งานต่อ"
