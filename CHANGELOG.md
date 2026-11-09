<!-- author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket -->

# 📜 Changelog — LocketGold B1sTeam

## v3.0.0 — B1sTeam Edition (2026-11-09)

- **Rewrite toàn bộ từ gốc**: thiết kế "Dark Luxe" cho static assets; brand đồng nhất B1sTeam.
- Toàn bộ link tải chuyển sang `raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/...` (không giới hạn băng thông, không chặn).
- DoH Worker (`dns/worker.js`) viết lại: Split DNS RFC 8484 (GET dns-json + POST dns-message), blocklist Locket → REFUSED (chống thu hồi), cache edge 300s. Fix lỗi self-forward loop.
- Scripts MITM hardening: fail-open, depth-limit recursion, bỏ header ETag đúng chuẩn.
- **Mới**: `ios/locketgold-webclip.mobileconfig` — Web Clip "B1sDev_" → https://b1s.id.vn/about (icon nhúng base64).
- **Mới**: mọi file cấu hình đều có header `author: B1sTeam | b1s.id.vn | @b1steam | public_b1s_locket`.
- Backup bản cũ trong repo cha: `_backup_locketgold_20261109/`.

## v2.0.0 (2026-11-09) — Bản khởi đầu

- Landing page, Module/Config Shadowrocket, DoH chống thu hồi, configs V2RayNG/Sing-Box.

## v1.0.0 — LocketGold (gốc)

- Phiên bản Shadowrocket module đầu tiên.
