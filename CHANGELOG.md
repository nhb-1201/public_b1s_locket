# CHANGELOG — LocketGold (public_b1s_locket)

## [3.5.0] — 2026-11-15

**Module rà soát toàn bộ + sửa format, chuẩn Shadowrocket**

- `ios/locketgold.sgmodule` từ sinh tự động → **source-of-truth** (sửa tay; không sinh từ `.conf`).
- Sửa module: bỏ `[General]` (DNS/`bypass-system`/`tun-excluded-routes` — không thuộc module), bỏ `FINAL,DIRECT` (sẽ ép mọi traffic về DIRECT), bỏ các rule `,DIRECT` noop; `[Host] firebaseremoteconfigrealtime.googleapis.com = 0.0.0.0` → rule `REJECT-DROP` tương đương.
- `#!version = 7.8.1`, `#!updated = 2026-11-15`; giữ nguyên 6 MITM scripts (cần thiết).
- `[Url Rewrite]` giữ nguyên; `header-del` giữ cho từng cặp RC/Locket (Header Rewrite hợp lệ).
- `build.mjs`: bỏ `buildModule()`; `--check` chỉ còn scripts. Chạy lại 1 lần để đồng bộ `B1S_BUILD`.
- Docs: đồng bộ file list/thuật ngữ `.module`; frontend: "Cài Module tự động qua Shadowrocket" + nút phụ `.module`.
- Backend: `/api/v2/locketgold/module/all-in-one?key=` trả file `locketgold-<tail>.module` (đã verify 200).

## [3.4.0] — 2026-11-15

**Chuyển hướng cài đặt chính sang Module Shadowrocket (auto-import), bỏ .conf khỏi luồng người dùng**

- Web `/locketvip`: Bước 2 — nút chính **“Cài Module tự động qua Shadowrocket”** (deep link `shadowrocket://import?module=<url>` — app tự mở & hỏi “Add this module?”), nút phụ **“Tải file .sgmodule”** (thủ công). Key nhúng sẵn, khóa theo thiết bị.
- Wizard: thêm bước bật Module (“B1sTeam — LocketGold (Free)”) + HTTPS解密; FAQ/VersionCard/docs cập nhật theo module-first.
- Backend `locket.b1s.id.vn`: `/api/v2/locketgold/module/all-in-one?key=` trả `.sgmodule` đã nhúng license (đã verify 200).
- README/ios README: 10 bước — bước 2-3 = Module; alt text .conf đã gỡ hoàn toàn.

## [3.3.0] — 2026-11-15

**Thêm lại "Bước 10 — DNS DoH của tôi" (NextDNS riêng per user)**

- Web `/locketvip` (wizard): sau Bước 9 (Gold ✦) thêm **Bước 10 — DNS DOH CỦA TÔI**: nhúng `DnsDashboard` ngay trong bước — đăng nhập → **Cấp DNS** (NextDNS riêng 300.000 truy vấn / 30 ngày) → tải `B1sTeam-DNS-gN.mobileconfig` → Cài đặt. Shadowrocket vẫn là đường mở Gold; DoH bổ trợ.
- Xoá v3.2.0 note "DoH đã gỡ" — khôi phục `DnsDashboard` + `dns-client` từ git.
- 10 bước hoàn chỉnh, tiến trình (localStorage `b1steam-install-wizard-v2`) nhớ tới bước 10.
- Docs: 10 bước; DoH quay lại thành bước bổ trợ khuyến nghị (không bắt buộc).

## [3.2.0] — 2026-11-15

**Gỡ DNS riêng khỏi hướng dẫn người dùng; web thành wizard cài đặt nhớ tiến trình**

- Web `/locketvip`: bỏ hẳn section DNS/DoH (`DnsDashboard`, `x-b1s-license` DoH) khỏi trang người dùng; hướng dẫn 10 bước → **9 bước**, chuyển thành **wizard từng bước** (nút Quay lại / Tiếp tục + các chấm bước), **nhớ tiến trình trong localStorage** (`b1steam-install-wizard-v1`) — tắt máy/thoát web mở lại về đúng bước đã dừng; Bước 2 **kèm file tải .conf trực tiếp** (đăng nhập → tải ngay, license nhúng sẵn).
- Redirect `/dns` → `/locketvip` (bỏ `#dns`).
- Repo docs: 9 bước cài đặt; DoH/DNS riêng thiết lập "chỉ nội bộ/kỹ thuật", người dùng không cài `.mobileconfig`.
- Xoá components không dùng: `DnsDashboard`, `dns-client`, `DnsActivationSection`.

## [3.1.0] — 2026-11-14

**DoH v1.3.0 production + repo prune (chỉ Shadowrocket + DoH + MITM + JS)**

**DoH (doh.b1s.id.vn, worker `b1steam-dns` v1.3.0):**
- Blocklist O(#entries)×endsWith → **O(labels) Set walk** (CPU fix — không còn "rate limit" false-positive khi iOS bắn nhiều query).
- **Public DoH** `/dns-query` (không token) hoạt động trở lại — blocklist + stale-if-error + 1.1.1.1 fallback (Shadowrocket `.conf` dùng `dns-server = doh.b1s.id.vn/dns-query`).
- **Fallback 1.1.1.1** (RFC 8484) khi NextDNS bão hòa/lỗi — app vẫn resolve bình thường, không REFUSED giả.
- REFUSED chỉ áp dụng khi profile hết quota/đã bị revoke — giữ nguyên logic xoay vòng.
- Stale-if-error 24h; cache fresh 5 phút; D1 counter batch 10s.
- Deployed lên production (D1 `b1steam`): worker ID `ef49acfd-6bac-4ffd-a4e9-f582b6face93`.

**Repo prune (chỉ giữ 4 thành phần shipping):**
- Xóa `proxy/` (Python MITM + Go legacy + root CA + watchdog) — Shadowrocket MITM thay thế.
- Xóa `ca/` (Root CA — Shadowrocket dùng CA máy user), `scanner/`, `tools/`.
- Xóa `ios/locketgold.conf` (legacy, trùng all-in-one).

**task scheduler**: `B1sTeam-Proxy-Watchdog` đã gỡ (proxy LAN không còn); cổng 443/8443 FREE.

## [3.0.0 / module 7.8.0] — 2026-11-14

**Hoàn thiện triệt để — B1sTeam 100%**

- README viết lại; SECURITY.md; NOTICE; edge/ + frame-worker/ READMEs.
- `/alfretro` → `/locketvip` toàn repo; module v7.8.0.
- Backend v3.3.5 (moduleVersion 7.8.0); deploy thành công.

## [2.0.0] — 2026-11-14

- 4 edge frame workers deploy — round-robin + failover.

## [1.x] — trước đó

- Shadowrocket module v7.7.2 — 277/277 tests — post-outage restore từ `74579b2`.
