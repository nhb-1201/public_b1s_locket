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

## v7.7.2 — Edge workers trên 4 tài khoản Cloudflare phụ + fix outage production (2026-11-14)

**Sự cố production (nghiêm trọng):** repo bị agent khác rewrite hoàn toàn sang kiến trúc NextDNS
("DNS thuần không Shadowrocket") và **xoá `ios/`** — toàn bộ module Shadowrocket:
- `raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/...` → **404** cho tất cả script
- Backend `/config/alfretro` → **502 Bay null** cho mọi user muốn activate .conf

**Khắc phục:** khôi phục `ios/` từ commit cuối trước rewrite (`74579b2`, v7.7.1 — last known good
277/277 tests), backend bump 3.3.1 → 3.3.2 (bust cache 404 sticky CF) → `/config/alfretro` trả 200
đủ 6 scripts + key nhúng. Frontend vẫn dùng `.conf` như cũ — không vỡ.

**Edge workers (user request — không chạy ở account chính):**
- `locket-filter-frame` deploy lên **4 tài khoản CF phụ** (ACC2/3/4/5):
  - `locket-filter-frame.b1s-locket02-b1steam.workers.dev` (ACC2)
  - `locket-filter-frame.b1steam-edge-03.workers.dev` (ACC3)
  - `locket-filter-frame.beslin.workers.dev` (ACC4)
  - `locket-filter-frame.b1steam-edge-05.workers.dev` (ACC5)
  - Auth chấp nhận cả server-side proxy key (`x-b1s-proxy-key`) lẫn license device-bound (`x-b1s-license` + `x-b1s-device`)
- `b1steam-edge` (RC relay `/rc`, vinh danh `/vip/list`, `/health`) — strict allowlist, zero-logging, TLS:
  - `b1steam-edge.b1s-locket02-b1steam.workers.dev` · `.b1steam-edge-03.workers.dev` · `.beslin.workers.dev` · `.b1steam-edge-05.workers.dev`
- MITM scripts dùng **phân bổ ngẫu nhiên** (xáo trộn Fisher-Yates mỗi request) + **failover lần lượt** qua 4 edge
  (`upload-frame`) hoặc chọn ngẫu nhiên (`locketgold_locket` forward, `locketgold_filters` forward).

**Không đụng**: root `version.json` (thuộc hệ DNS của tác giả khác) — module dùng `ios/version.json` riêng.
**Docs**: log Z62 (outage) + Z63 (edge workers) sau khi ổn định.

