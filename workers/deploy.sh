#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# B1sTeam — LocketGold (Free)
# Deploy sáu worker phục vụ khung ảnh: b1steam-frames-1 … b1steam-frames-6
#
# Cách dùng:
#   cd workers
#   bash deploy.sh              # deploy cả 6
#   bash deploy.sh 2 5          # chỉ deploy b1steam-frames-2 và -5
#
# Biến môi trường:
#   WRANGLER  lệnh wrangler (mặc định: npx wrangler)
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAME_DIR="${SCRIPT_DIR}/frames"
WRANGLER="${WRANGLER:-npx wrangler}"

cd "${FRAME_DIR}"

if [ "$#" -gt 0 ]; then
  TARGETS="$*"
else
  TARGETS="1 2 3 4 5 6"
fi

for index in ${TARGETS}; do
  echo "==> Deploying b1steam-frames-${index}"
  ${WRANGLER} deploy --env "f${index}"
  echo "==> b1steam-frames-${index} deployed"
done

echo "==> Done: ${TARGETS}"
