# Changelog — LocketGold (Free) ✦ B1sTeam

Tất cả thay đổi đáng chú ý của `public_b1s_locket`.
Định dạng: dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) + [Semantic Versioning](https://semver.org/lang/vi/).

---

## [7.8.2] — 2026-11-16 — ⭐ PT2 cài bằng `.conf` — ngang hàng đầy đủ PT1 (DNS)

### Tính năng mới
* **PT2 (Shadowrocket) cài bằng `.conf`** thay vì Module: `shadowrocket://config/add/https://locket.b1s.id.vn/api/v2/locketgold/config/alfretro?key=…` — backend đọc `ios/alfretro-allinone.conf` v7.8.2, nhúng license key rồi phát hành (1 file: rule + script + MITM hostname).
* **PT2 full parity với PT1**: `camera_filter_config` từ stub 364-byte (`picker_filters:[]`) → **247KB FULL** (107 pickerFilters · 117 remoteFilters · 7 nhóm B1sKhung; Photobooth ẩn; 7 nhóm AI-sticker đã xóa). Thêm `b1s_frame_catalog` + `b1s_frame_urls` (124 mục), `camera_frame_config` (default Sakura Torii), `photo_frame_event`, `widget_frame_event`, `custom_widget_frames_config` (8 khung B1sTeam xoay theo ngày UTC).
* **Widget Gold**: 8 khung B1sTeam xoay vòng mỗi ngày (UTC day-of-year % 8) — cả PT1 (Fly MITM) lẫn PT2 (.conf).
* **Firebase Auth/Firestore vào MITM** (PT1 `fly.toml` + `DefaultSANS`, PT2 `.conf` + `.sgmodule`): `identitytoolkit` / `securetoken` / `firestore` / `firebase.googleapis.com` — chỉnh được hồ sơ (tên, email, avatar, ngày sinh, mật khẩu).

### Sửa
* **PT2 không hiện popup branding / Gold badge / mic / captions / filter / khung / 60s**: nguyên nhân gốc — `_remote_entries.fragment.js` chỉ có stub `camera_filter_config` (365B), `camera_frame_config` trỏ khung `frame_crayon` không tồn tại. Nay đồng bộ từ cùng nguồn chân lý (`proxy/handler/camera_filter_config.json` + `proxy/handler/frames_manifest.json`) → `node build.mjs` → `scripts/locketgold_remote.v7.8.2.js` (455KB, syntax check PASS).
* `streak_config` → FULL (streak_visualization gradient + recovery).
* `.conf` thêm `header-del alt-svc` cho firebaseremoteconfig (chặn app tự nâng cấp HTTP/3 vượt MITM).
* Frontend `/locketvip`: PT2 toàn bộ UI Module → **.conf** (deep-link `shadowrocket://config/add/…`), “132 khung” → **106 khung** (đã dedupe 26 khung trùng); Step 2–3 cài .conf + HTTPS解密; FAQ + VersionCard + TwoPaths + FeatureGrid + FrameGallery đồng bộ.
* `api/locketgold-conf.js` / `api/locketgold-module.js`: BUILTIN v4.0.0 → v7.8.2 (đủ MITM hostname + script `.v7.8.2.js`).
* `index.html`: nút 1-Click raw-GitHub (nhúng placeholder `__LICENSE_KEY__`) → “Tải key & cài .conf 1-Click” (b1s.id.vn/locketvip).
* `ios/module-install.html` / `module.html` → luồng `.conf` (`shadowrocket://config/add/…`).
* Version `7.8.2` (`ios/version.json`), `.sgmodule` repointed mọi script → `.v7.8.2.js`.

---

## [8.0.0] — 2026-11-16 — ⭐ LOẠI BỎ HOÀN TOÀN Phương Thức 2 (Shadowrocket)

### Thay đổi lớn (BREAKING)
* **Chỉ còn Phương Thức 1 (DNS)** — cài 1 hồ sơ `.mobileconfig` (Root CA EC P-256 + DoH) → bật Root CA → xóa Locket → tải lại → Gold ✦.
* **XÓA toàn bộ mã nguồn Shadowrocket** khỏi repo: `ios/` (chỉ còn `locketgold.mobileconfig` mẫu + README), `shadowrocket/` (legacy v4.0.0), `api/locketgold-module.js`, `api/locketgold-conf.js`, toàn bộ `ios/scripts/` `ios/src/` (Vibe on-device MITM).
* **Xóa nút 1-Click .conf/Module** trên `index.html` — chỉ còn nút “Tải hồ sơ .mobileconfig 1-Click” (`doh.b1s.id.vn/mobileconfig`).
* `vercel.json`: gỡ routes `/api/module`, `/api/conf`, `/api/locketgold-module.sgmodule`, `/api/locketgold-conf.conf` + headers tương ứng.
* `package.json` 8.0.0, `api/health.js` version 8.0.0, `version.json` 8.0.0.
* Landing page (`index.html`), `README.md`, `SECURITY.md`, `docs/ARCHITECTURE.md`, `api/README.md`, `admin/public/index.html` — đồng bộ chỉ-DNS; FAQ/steps/metadata cập nhật.
* `proxy/` (Fly.io Go MITM): **không đổi** — vẫn phục vụ toàn bộ tính năng Gold qua PT1 DNS.

### Ghi chú
* Các endpoint `/api/v2/locketgold/module|config|verify` bên Cloudflare Workers (locket.b1s.id.vn) đã ngừng sử dụng — client không còn trỏ tới. Hệ thống sẽ trả 404/410 nếu gọi trực tiếp.
* Khung B1sTeam nay phục vụ qua **GitHub raw** (`assets/rc/frames/*.png`, 106 khung) — không còn router photobooth/overlay on-device.

---

## [4.1.0] — 2026-11-15 — ✨ PHƯƠNG THỨC 1 (DNS) · FULL GOLD FEATURES

### ✨ Tính năng mới

* **Phương Thức 1 — DNS (chính)**: cài 1 hồ sơ `.mobileconfig` (Root CA EC P-256 + DoH
  `doh.b1s.id.vn/fly/dns-query`) → bật Root CA → xóa Locket tải lại → **Gold ✦**.
  Không cần Shadowrocket, không cần app lậu. Deep link: `https://doh.b1s.id.vn/mobileconfig`.
* **Phương Thức 2 — Shadowrocket (phụ)**: giữ nguyên quy trình Module + MITM on-device.
* **Fly MITM — full Gold injection**: Firebase Remote Config đầy đủ (90+ cờ VIP:
  captions · frames · streak recovery · camera 60s 1080p · widgets · upsell/paywall tắt),
  `feature_gates`/`upsell_features`/`streak_config`/`camera_video_recording`/`overlays_v2_config`
  JSON lồng nhau, `b1s_frame_catalog`/`camera_frame_config`/`photo_frame_event`/
  `widget_frames_config` merge từ catalog 38 khung Kawaii, `feature_discovery_popup_config`
  (branding B1sTeam), `Attention` banner, `state=UPDATE`, `templateVersion` (ép app đọc RC mới).
* **RevenueCat**: thêm `non_subscriptions`, gỡ `management_url`, `first_seen`,
  `original_app_user_id`, `original_application_version`, `original_platform`,
  `attention_banner` (welcome popup "B1sTeam Gold").
* **/mobileconfig route mới** trong worker DoH (`backend/workers/dns-resolver`):
  `GET https://doh.b1s.id.vn/mobileconfig` → trả hồ sơ `.mobileconfig`
  (`application/x-apple-aspen-config`), nhúng Root CA EC P-256 + DoH Fly.
* **Fly static server**: MITM-only — bỏ landing page + README, `/` → 302 → b1s.id.vn/locketvip.
  Chỉ còn `/health`, `/healthz`, `/version` (tối thiểu), `/B1sTeam-LocketGold.mobileconfig`, `/robots.txt`.
* **Trang /locketvip redesign**: 2 phương thức (tab-switcher), Phương Thức 1 (DNS)
  là chính, Phương Thức 2 (Shadowrocket) là phụ. FAQ + hero + CTA cập nhật.

### 🐛 Sửa

* Firebase injection không còn thiếu cờ — trước đây chỉ `is_gold`/`gold`/`unlock_all_frames`
  (đủ Gold badge nhưng không caption/frames/streak/upsell/widget).
* `ios/locketgold.mobileconfig` nhúng Root CA **đúng** (khớp Fly secret, SHA-256 B0CEBAFA…) —
  trước đây nhúng CA khác (293A303C…) làm MITM không giải mã được.

### 🔒 Bảo mật

* Fly static `/version` không lộ `fly_ip`/IP; log khởi động cũng không in IP.
* Repo công khai: 0 occurrence của Fly.io IPv4/IPv6 — mọi IP qua `FLY_PROXY_IP` (secret).

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
  * `/fly/dns-query` → allow-list trả IP Fly MITM (đặt qua `FLY_PROXY_IP`, không commit vào repo), còn lại về `1.1.1.1`
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
