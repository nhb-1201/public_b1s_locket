# Changelog — Locket Gold Hub (public_b1s_locket)

## [2.0.0] — 2026-11-14

**VIẾT LẠI HOÀN TOÀN — DNS thuần. Bỏ Shadowrocket / Quantumult X / .conf / .sgmodule.**

### Thay đổi lớn

- **NextDNS theo TÀI KHOẢN**: mỗi vòng xoay = 1 tài khoản NextDNS mới (trước đây đổi profile
  trong cùng tài khoản — không reset được hạn mức 300k/tháng).
- **Tự tạo sẵn tài khoản kế tiếp** khi chạm ngưỡng cảnh báo (cron) → nút “Cập nhật DNS”
  có link mới ngay lập tức.
- **Bắt buộc cập nhật** khi chạm 80%: DoH REFUSED + thông báo in-app + email + banner
  yêu cầu cài lại `.mobileconfig`. `user_update_required` tự tắt khi tải hồ sơ mới.
- `proxy/`: `generateFilteredImage` giờ chuyển đúng sang `/apply-frame` (fix 404),
  gửi `x-b1s-proxy-key`, forge leaf chỉ cho hostname Locket (allowlist).
- `dns/`: Worker v1.2.0 — REFUSED wire format, `X-Update-Required:1`, `no-store`,
  cache key theo origin (không hardcode).
- `frame-worker/`: shared-secret auth (bỏ license gate của thế hệ cũ), `/assets/*` → 301 sang raw base.
- Cấu trúc repo rút gọn: chỉ còn `dns/ proxy/ frame-worker/ assets/ ca/ docs/ scanner/`.

### Bỏ (không còn được hỗ trợ)

- Shadowrocket / Quantumult X / Surge / Loon / `.sgmodule` / `.conf` / ký Root CA riêng của Shadowrocket
- `ios/` (scripts nguồn), `android/` (Private DNS từ thế hệ cũ)
- `tools/` (generate `.conf` / `.sgmodule`)
- Worker license thế hệ cũ (`locket.b1s.id.vn` — đã lưu trữ thành zip backup ngoài repo)

### Trước đây

- `1.x`: hệ thế hệ Shadowrocket/MITM/module All-in-One (đã gỡ sạch từng bước qua các bản `v6.x`/`v7.x`).
