<!-- author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket -->

# 📜 Changelog — LocketGold B1sTeam

## v6.1.0 — 1 module duy nhất (2026-11-12)

- **1 module duy nhất** (sinh bởi worker): LocketGold + 23 app + DNS DoH trong 1 file — xoá module từng app.
- **Không còn `FINAL,DIRECT`/`dns-server = system`** trong module — mọi host MITM đi PROXY + `#hostname` scoping.
- **DNS DoH gộp trong module** — không cần cài hồ sơ DNS riêng.
- Bỏ 25 script repo thứ ba — 100% viết lại bằng `b1s_unlock.js` (engine MITM).
- RC: **248 entries / 41 gates**.
- Filter paywall: ép đủ 15 cờ `can_use_filters`/`has_ai_access`/… + giữ nguyên body khi 402/403 (danh sách filter không bị xoá).
- `widget_frame_event` dùng asset của B1sTeam (không hotlink ảnh bên thứ ba).
- `locketgold.sgmodule` xoá (module sinh bởi worker tại b1s.id.vn).
- Static `ios/locketgold.conf` đồng bộ với module: PROXY rules + `#hostname` + DNS + `[Host]` chặn Firebase realtime RC.
- Toàn bộ link `b1s.id.vn/locketgold` → `b1s.id.vn/alfretro`.

## v6.0.0 — B1sTeam Edition (2026-11-09)

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

## v7.1.0 — LocketGold-only + Khung Crayon (2026-11-13)

- **LocketGold ONLY**: xóa 2 app premium scripts (YouTube, Spotify) — .conf chỉ còn 8 scripts LocketGold; [Rule]/[MITM]/[Script] sạch 100%, DNS tối thiểu (doh + system — giảm tải RAM tunnel iOS 50MB).
- **Khung Crayon (frame-14)**: khung tự vẽ (RGBA 1024², trong suốt giữa, viên đỏ–vàng dày sát viền, 4 bé Kawaii nguyên bản 4 góc) — widget_frame_event → frame-14, thêm speculative camera/photo frame keys, upload mặc định khung_crayon.
- **Chặn full RevenueCat**: [Url Rewrite] reject-200 toàn bộ revenuecat.com/rc-backup.com/rev.cat — MITM tự tổng hợp Gold 2099; app không gọi được RC thật.
- DNS v7.0.0 (giữ); worker /frame-raw có frame-14.

