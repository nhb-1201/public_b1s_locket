#!/bin/bash
# B1sTeam Root CA (ECC P-256, 10 năm) — sinh CA mới.
#
# CHỈ chạy khi thực sự muốn CA MỚI (vd. môi trường staging).
# CA hiện hành: ca/b1steam-root-ca.crt (committed, public) — CÔNG KHAI CHIA SẺ.
# Key được gen ngay trên máy của bạn: ca/b1steam-root-ca.key — KHÔNG BAO GIỜ commit.
#
# Cách dùng: bash ca/gen-ca.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CA_DIR="$SCRIPT_DIR"

if [[ -f "$CA_DIR/b1steam-root-ca.crt" ]]; then
  echo "!! CA đã tồn tại: $CA_DIR/b1steam-root-ca.crt"
  echo "   Muốn test CA khác: đổi tên file cũ trước (mv b1steam-root-ca.crt b1steam-root-ca.crt.bak)."
  exit 1
fi

echo "==> Generating ECC P-256 Root CA (B1sTeam)…"
openssl ecparam -name prime256v1 -genkey -noout -out "$CA_DIR/b1steam-root-ca.key"

openssl req -new -x509 \
  -key "$CA_DIR/b1steam-root-ca.key" \
  -out "$CA_DIR/b1steam-root-ca.crt" \
  -days 3650 \
  -subj "/C=VN/L=Ho Chi Minh City/O=B1sTeam/OU=B1sTeam Trust Services/CN=B1sTeam Root CA" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -addext "subjectKeyIdentifier=hash" \
  -addext "authorityKeyIdentifier=keyid:always"

echo "==> Root CA done:"
echo "    Public : $CA_DIR/b1steam-root-ca.crt   (commit được)"
echo "    Private: $CA_DIR/b1steam-root-ca.key   (KHÔNG BAO GIỜ commit — gitignore *.key)"
openssl x509 -in "$CA_DIR/b1steam-root-ca.crt" -noout -fingerprint -sha256 -subject -dates
