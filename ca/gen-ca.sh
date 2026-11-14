#!/bin/bash
# Generate Root CA for the B1sTeam TLS MITM proxy.
# Output: ca/root-ca.key (KEEP SECRET), ca/root-ca.crt (safe to distribute in .mobileconfig)
# Run once. Store root-ca.key in Fly secret: fly secrets set ROOT_CA_KEY="$(cat ca/root-ca.key)"
#
# ⚠ QUAN TRONG: file `ca/root-ca.crt` đã commit là CA đang chạy production.
#   KHÔNG chạy lại script này trên CA production — làm vậy sẽ làm hỏng mọi máy
#   đã cài hồ sơ .mobileconfig (thiết bị sẽ không còn tin Root CA mới).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CA_DIR="$SCRIPT_DIR"

if [[ -f "$CA_DIR/root-ca.crt" ]]; then
  echo "!! CA đã tồn tại: $CA_DIR/root-ca.crt"
  echo "   Nếu bạn thực sự muốn tạo CA MỚI (ví dụ cho môi trường thử nghiệm),"
  echo "   hãy đổi tên file cũ trước: mv ca/root-ca.crt ca/root-ca.crt.bak"
  exit 1
fi

echo "==> Generating 4096-bit RSA Root CA..."

openssl genrsa -out "$CA_DIR/root-ca.key" 4096

openssl req -new -x509 \
  -key "$CA_DIR/root-ca.key" \
  -out "$CA_DIR/root-ca.crt" \
  -days 3650 \
  -subj "/C=US/O=B1sTeam/CN=B1sTeam Root CA" \
  -extensions v3_ca \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"

echo "==> Root CA generated:"
echo "    Public:  $CA_DIR/root-ca.crt  (safe to distribute in .mobileconfig)"
echo "    Private: $CA_DIR/root-ca.key  (NEVER commit - store in Fly secrets)"
echo ""
echo "==> Next: fly secrets set ROOT_CA_KEY=\"\$(cat ca/root-ca.key)\" ROOT_CA_CRT=\"\$(cat ca/root-ca.crt)\""
