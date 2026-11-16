# LocketGold (Free) ✦ B1sTeam

> **Mở khoá Gold vĩnh viễn cho Locket — 0₫, mã nguồn mở, tự host được.**
> B1sTeam — [b1s.id.vn](https://b1s.id.vn) · Zalo `083.3399.553`

`public_b1s_locket` là **source-of-truth của toàn bộ hệ thống LocketGold (Free)**:
từ module Shadowrocket, proxy MITM bằng Go chạy trên Fly.io, Root CA, DoH + NextDNS
xoay vòng, worker Cloudflare phục vụ khung, tới API, admin panel và SQL migration.

---

## 1. Cài nhanh (iPhone)

### Phương Thức 1 — DNS (Khuyên dùng — không cần Shadowrocket)

| Bước | Việc cần làm |
|------|--------------|
| 1 | Vào [b1s.id.vn/locketvip](https://b1s.id.vn/locketvip) → chọn **Phương Thức 1** → bấm **“Tải Phương Thức 1”** |
| 2 | Safari hiện **“Hồ sơ đã tải”** → Cài đặt → Cài đặt chung → **VPN & Quản lý thiết bị** → chọn hồ sơ → **Cài đặt** → nhập mật mã |
| 3 | Cài đặt → Chung → Giới thiệu (About) → **Cài đặt gốc chứng chỉ** → bật **B1sTeam Root CA** |
| 4 | **Xóa Locket** → App Store tải lại → đăng nhập ID cũ |
| 5 | Mở Locket → **Gold ✦** |

> Bước 3 là **bắt buộc** — thiếu nó iOS không giải mã được → không có Gold.

Hồ sơ `.mobileconfig` đầy đủ (Root CA EC P-256 + DoH) cũng có thể tải tại `https://doh.b1s.id.vn/mobileconfig`.

### Phương Thức 2 — Shadowrocket (Phụ — dành cho người dùng Shadowrocket)

| Bước | Việc cần làm |
|------|--------------|
| 1 | Cài **Shadowrocket** (App Store ID `932747118`, ~$2.99 mua 1 lần) |
| 2 | Vào [b1s.id.vn/locketvip](https://b1s.id.vn/locketvip) → đăng nhập → chọn **Phương Thức 2** → **Kích hoạt free** |
| 3 | **Cài .conf** qua `shadowrocket://config/add/` hoặc **Copy .conf URL** → Shadowrocket → **“+”** → Cấu hình → Paste → Add (file `ios/alfretro-allinone.conf`, key nhúng sẵn) |
| 4 | Tạo chứng chỉ → cài hồ sơ → **Tin cậy Root CA** trong Cài đặt gốc chứng chỉ |
| 5 | Bật VPN → xóa Locket → tải lại → mở Locket → **Gold ✦** |

> Bước 4 là **bắt buộc**.
> Cả hai phương thức đều 0₫ và cho Gold giống nhau.

### Deep-link cài 1 chạm (Phương Thức 2)

```
shadowrocket://install?module=<RAW_URL>          ← module (URL KHÔNG encodeURIComponent)
shadowrocket://config/add/<RAW_URL>              ← .conf
```

`shadowrocket://import?module=` **không hoạt động** trên iOS — đừng dùng.

---

## 2. Cấu trúc repo

```
public_b1s_locket/
├─ index.html               Trang landing (1-click install, live status, gallery)
├─ shadowrocket/            ★ Module + script MITM (nguồn chân lý)
│   ├─ js/                  12 script tự chứa (RevenueCat · Firebase · Locket API · Photobooth · Frames)
│   ├─ modules/             .sgmodule · .snippet · .plugin · .stoverride · .module
│   ├─ assets/frames/       Ảnh khung + catalog.json
│   ├─ build.mjs            Build/kiểm tra script + nhúng `__LICENSE_KEY__`
│   └─ README.md
├─ proxy/                   ★ MITM proxy Go (Fly.io)
│   ├─ main.go              TLS listener :8443 · reverse proxy · /health · .mobileconfig tĩnh
│   ├─ config/config.go     Env-driven config (allow-list SNI, rate-limit, worker pool)
│   ├─ tls/ca.go            Root CA ECDSA P-256 · forge leaf · SAN list
│   ├─ tls/cache.go         Cache leaf theo host (TTL 24h · max 256)
│   ├─ handler/             revenuecat · firebase · locket_api · photobooth · frames
│   ├─ Dockerfile           Build multi-stage · static binary (CGO_ENABLED=0)
│   └─ fly.toml             app b1steam-locketgold · region sin · TCP 443 + HTTP 8080
├─ ca/                      Root CA + sinh hồ sơ iOS (Python, chỉ cần `cryptography`)
├─ dns/                     ★ Cloudflare Worker DoH
│   ├─ src/index.js          /<token>/dns-query (NextDNS riêng) · /fly/dns-query (allow-list → Fly)
│   ├─ src/whitelist.js      danh sách host Locket/RevenueCat/Firebase
│   ├─ src/rotator.js        xoay vòng NextDNS 80%
│   ├─ src/ratelimit.js      60 truy vấn / 10 phút / IP
│   └─ wrangler.toml
├─ nextdns/                 API client NextDNS + engine xoay vòng 80%
├─ workers/frames/          6 worker luân phiên phục vụ khung Kawaii (b1steam-frames-1..6-<subdomain>.workers.dev)
├─ frame-worker/            ★ Worker photon WASM — VE KHUNG lên ảnh user (α) (b1steam-frame-raw)
│   ├─ src/index.ts         POST /apply-frame (input_url → 1024² ảnh đã có khung) · /frame-raw (upload) · /health
│   ├─ src/frames-data.ts   ảnh khung nhúng base64 (fallback) + URL CDN
│   └─ wrangler.raw.toml    deploy: npx wrangler deploy --config wrangler.raw.toml (+ secret PROXY_SHARED_KEY)
├─ api/                     Handler Vercel: module · conf · .mobileconfig · nextdns-create/usage · health
├─ admin/                   Bảng quản trị (HTML tĩnh) + API HMAC-session
├─ scanner/                 Quét IP/domain hardcode trong cây module
├─ sql/migrations/          DDL SQLite/D1 + seed
├─ tests/                   node:test — license · mobileconfig · rotation · scanner
├─ ios/                     .conf + .sgmodule dựng sẵn + hồ sơ .mobileconfig mẫu
├─ assets/                  Icon · khung · sticker
└─ docs/ARCHITECTURE.md     Sơ đồ luồng dữ liệu chi tiết
```

---

## 3. Kiến trúc

```
 iPhone
   │  HTTPS (RevenueCat · Firebase · Locket API)
   ▼
┌────────────────────────┐   MITM (on-device)   ┌───────────────────────────┐
│ Shadowrocket           │ ────────────────────► │ Script MITM B1sTeam      │
│ + Module B1sTeam       │                       │ (shadowrocket/js/*.js)   │
│ + CA (do bạn tạo)      │ ◄──────────────────── │ ghi đè entitlement Gold  │
└────────────────────────┘   JSON đã sửa         └───────────────────────────┘
   │  DNS (DoH)
   ▼
┌─────────────────────────────────────────────┐
│ doh.b1s.id.vn  (Cloudflare Worker)           │
│  /<token>/dns-query  → NextDNS riêng user    │
│  /fly/dns-query      → allow-list → IP Fly   │
└─────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────┐
│ Fly.io  b1steam-locketgold  (raw TCP :443)  │
│  Go MITM proxy — forge leaf EC P-256         │
│  allow-list SNI · rate-limit · không log body│
└─────────────────────────────────────────────┘
   │  generateFilteredImage (filter khung)
   ▼
┌─────────────────────────────────────────────┐
│ b1steam-frame-raw  (Cloudflare photon WASM)  │
│  crop √ + vẽ khung Kawaii vào ảnh của bạn    │
│  → trả data:image/png;base64 (không lưu ảnh) │
└─────────────────────────────────────────────┘
   │  catalog khung (Firebase entries)
   ▼
┌─────────────────────────────────────────────┐
│ b1steam-frames-1..6  (Cloudflare Workers)    │
│  phục vụ khung Kawaii — round-robin          │
└─────────────────────────────────────────────┘
```

Chi tiết từng luồng: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## 4. Bảo mật

| Lớp | Cơ chế |
|-----|--------|
| Truyền tải | TLS 1.2+ · ECDHE-ECDSA · leaf ECDSA P-256 |
| MITM | Chỉ giải mã SNI trong **allow-list**; ngoài danh sách → từ chối |
| CA | Root CA tự ký ECDSA P-256, private key ngoài repo, không log |
| License | Key `B1S-XXXX-XXXX-XXXX` ký **HMAC-SHA256**, khóa theo thiết bị, so sánh constant-time |
| Rate-limit | Fly MITM 100 burst / 60 mỗi phút · tĩnh 20/15 · DoH 60 / 10 phút → `429` |
| Quyền riêng tư | Không log body/ảnh; DNS không lưu query của người dùng |
| Web | CSP · HSTS preload · `X-Frame-Options: DENY` · COOP/CORP |

Chi tiết: [`SECURITY.md`](./SECURITY.md).

---

## 5. Tự host

<details>
<summary><b>Proxy Go trên Fly.io</b></summary>

```bash
cd proxy
export ROOT_CA_CRT="$(cat ../ca/root-ca.crt)"   # PEM
export ROOT_CA_KEY="$(cat ../ca/root-ca.key)"   # PEM
export MITM_SANS="api.revenuecat.com,api.rc-backup.com,rev.cat,..."
fly deploy --depot=false --config fly.toml
```
</details>

<details>
<summary><b>Worker DoH</b></summary>

```bash
cd dns
npx wrangler deploy        # cần biến FLY_PROXY_IP, NEXTDNS_PROFILE_*
```
</details>

<details>
<summary><b>6 worker khung (static)</b></summary>

```bash
cd workers/frames
bash deploy.sh             # lặp b1steam-frames-1..6 (--env fN)
# đã deploy tại: b1steam-frames-{1..6}.nhb-120111.workers.dev
```
</details>

<details>
<summary><b>Worker vẽ khung (photon WASM) — b1steam-frame-raw</b></summary>

```bash
cd frame-worker
npx wrangler deploy --config wrangler.raw.toml
npx wrangler secret put PROXY_SHARED_KEY --config wrangler.raw.toml   # khóa chia sẻ với MITM Fly
# trên Fly đặt cùng khóa, tên FRAME_DRAW_KEY:
flyctl secrets set FRAME_DRAW_KEY=<cùng khóa> --app b1steam-locketgold
# đã deploy tại: https://b1steam-frame-raw.nhb-120111.workers.dev
#   POST /apply-frame  {input_url, filter_id} → 200 { result.outputUrl = data:image/png;base64 }
#   POST /frame-raw    {image_base64, filter_id} → 200 { image_base64 }
```
</details>

<details>
<summary><b>Test</b></summary>

```bash
node --test tests/          # license · mobileconfig · rotation · scanner
node scanner/index.js --self-check
```
</details>

---

## 6. Giấy phép & ghi nhận

Mã nguồn trong repo này do **B1sTeam** tự viết. Không sao chép mã nguồn hay asset từ
dự án khác; chỉ tham khảo *hành vi* công khai để tương thích API của Locket / RevenueCat /
Firebase. `Locket` là nhãn hiệu của **Locket, Inc.** — B1sTeam không liên kết với họ.

Xem [`LICENSE.md`](./LICENSE.md) và [`SECURITY.md`](./SECURITY.md).

---

## 7. Liên hệ

* Website — <https://b1s.id.vn/locketvip>
* Zalo — `083.3399.553`
* GitHub — <https://github.com/nhb-1201/public_b1s_locket>
