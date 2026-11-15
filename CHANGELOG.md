# Changelog — LocketGold (Free) ✦ B1sTeam

Tất cả thay đổi đáng chú ý của `public_b1s_locket`.
Định dạng: dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) + [Semantic Versioning](https://semver.org/lang/vi/).

---

## [4.0.0] — 2026-11-15 — ✨ VIẾT LẠI TOÀN BỘ

### ✨ Tính năng mới

* **Viết lại toàn bộ repo** theo kiến trúc mới — `public_b1s_locket` trở thành
  *source-of-truth* của cả hệ thống (trước đây chỉ chứa module iOS).
* **`proxy/`** — MITM proxy Go (Fly.io) viết mới hoàn toàn:
  * Raw TCP `:443 → :8443`, forge leaf **ECDSA P-256** theo SNI.
  * **Allow-list SNI** — chỉ giải mã Locket / RevenueCat / Firebase; ngoài danh sách → từ chối.
  * Handler: `revenuecat` (entitlement Gold lifetime) · `firebase` (VIP flags + catalog khung) ·
    `locket_api` (bỏ paywall, unblur, badge Gold) · `photobooth` (mock `generateFilteredImage`) ·
    `frames` (pool worker luân phiên).
  * Rate-limit per-IP: MITM 100 burst / 60 mỗi phút · trang tĩnh 20 burst / 15 mỗi phút → `429`.
  * `/health`, `/version`, `/B1sTeam-LocketGold.mobileconfig` phục vụ tĩnh.
* **`ca/`** — `gen-ca.py` (Root CA ECDSA P-256, chỉ cần `cryptography`) và
  `gen-mobileconfig.py` (hồ sơ iOS đúng chuẩn MDM: `PayloadContent` + `PayloadEnabled` +
  `PayloadScope=System` + base64 wrap ≤ 76 ký tự/dòng).
* **`dns/`** — Cloudflare Worker DoH viết mới:
  * `/<token>/dns-query` → NextDNS riêng từng user.
  * `/fly/dns-query` → allow-list trả IP Fly `137.66.53.108`, còn lại về `1.1.1.1`
    (chống trở thành open-resolver).
  * `/health` + `/health/fly` (probe MITM proxy).
  * Rate-limit 60 truy vấn / 10 phút / IP.
* **`nextdns/`** — API client NextDNS (tạo account, thêm/xoá rewrite, đo lượng truy vấn) +
  engine **xoay vòng 80%** (`rotate.js`) — 80% NextDNS / 20% direct, có fallback `1.1.1.1`.
* **`workers/frames/`** — 6 Cloudflare Worker (`b1steam-frames-1..6`) phục vụ khung Kawaii:
  round-robin, cooldown 60 s khi lỗi, cache 24 h.
* **`shadowrocket/`** — bộ module viết lại:
  * 12 script MITM **tự chứa** (không `require`/`import`): RevenueCat, Firebase, Locket API,
    Photobooth, frame router, profile, header.
  * 5 định dạng module: `.sgmodule` · `.snippet` · `.plugin` · `.stoverride` · `.module`.
  * `build.mjs` — build deterministic + kiểm tra cú pháp + nhúng `__LICENSE_KEY__`.
* **`api/`** — handler Vercel: phát module / `.conf` / `.mobileconfig` theo key, tạo & đo
  NextDNS, health. Ký HMAC-SHA256, device-bound.
* **`admin/`** — bảng quản trị HTML tĩnh (không build, không CDN) + API HMAC-session,
  `crypto.timingSafeEqual`, token lưu trong `sessionStorage`.
* **`scanner/`** — quét IP/domain hardcode trong cây module (`--self-check`, `--dns`, `--json`).
* **`sql/migrations/`** — DDL SQLite/D1: `nextdns_accounts`, `license_keys`, `frame_catalog`.
* **`tests/`** — `node:test`: license, `.mobileconfig`, rotation 80%, scanner.

### 🔒 Bảo mật

* Allow-list SNI ở tầng proxy (chống dùng proxy như công cụ MITM bất kỳ).
* Rate-limit 3 tầng: proxy MITM · trang tĩnh Fly · worker DoH.
* Root CA / private key **không** nằm trong repo; biến môi trường `ROOT_CA_CRT` / `ROOT_CA_KEY`.
* Admin panel: so sánh chữ ký constant-time, không render giá trị không tin cậy bằng `innerHTML`.
* `vercel.json` + header `Cache-Control: no-store` cho mọi response chứa license key.

### 🎨 Giao diện

* `index.html` viết lại: hero "cute" (matcha + vàng), trạng thái live, gallery 14 khung,
  sơ đồ kiến trúc, bảng so sánh 2 đường, FAQ, CTA — **không phụ thuộc CDN ngoài**.
* `/locketvip` trên `b1s.id.vn` viết lại: hero + live status + kiến trúc + bảo mật +
  24 đặc quyền + gallery + wizard 10 bước (tick từng bước, nhớ tiến trình) + FAQ.

### 🔧 Sửa lỗi

* `.mobileconfig`: payload Root CA dùng `PayloadContent` (DER) + `PayloadEnabled=true` +
  `PayloadScope=System`; base64 wrap ≤ 76 ký tự/dòng — iOS không còn báo thiếu trường.
* Deep-link module dùng `shadowrocket://install?module=<RAW_URL>`
  (`shadowrocket://import?module=` không hoạt động trên iOS).
* `ios/alfretro-allinone.conf` — rule `PROXY` đổi sang `DIRECT` (tránh đen hố khi chưa có proxy),
  `dns-server = doh://doh.b1s.id.vn/fly/dns-query,system`.
* D1: thêm bảng catalog khung, pool worker, allow-list SNI, license key, audit log
  (`0023_locketgold_v4_catalog.sql`).

---

## [3.7.0] — 2026-11-15

* Thêm `PayloadContent` cho payload Root CA trong `.mobileconfig` (iOS yêu cầu DER, không phải `PayloadCertificate`).

## [3.6.0] — 2026-11-15

* `ios/module-install.html` — nhận `?key=` và nhúng deep-link `shadowrocket://install?module=`.
* `ios/conf.html` — dùng `shadowrocket://config/add/<RAW_URL>`.

## [3.5.0] — 2026-11-14

* Worker DoH: route `/fly/dns-query` + rate-limit per-IP.

## [3.4.0] — 2026-11-13

* `.conf` hợp nhất `alfretro-allinone.conf`; bỏ file `locketgold.conf` cũ.
* Bỏ script `locketgold_revenuecat.js` — dùng engine chung `b1s_unlock.js`.

## [3.0.0] — 2026-11-10

* B1sTeam Edge Gateway (`/rc`, `/vip/list`, `/health`) — strict allowlist, không open proxy.
* Backend license key device-bound + rate-limit 120/10 phút.

## [2.0.0] — 2026-11-05

* Module Shadowrocket đầu tiên: 6 script MITM, 163 caption, 14 khung Kawaii.

## [1.0.0] — 2026-10-28

* Phát hành đầu tiên — trang `/locket` + module cơ bản.
