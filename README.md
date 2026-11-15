# LocketGold (Free) ✦ B1sTeam

> **Mở khoá Gold vĩnh viễn cho Locket — 0₫, mã nguồn mở, tự host được.**
> B1sTeam — [b1s.id.vn](https://b1s.id.vn) · Zalo `083.3399.553`

`public_b1s_locket` là **source-of-truth của toàn bộ hệ thống LocketGold (Free)**:
từ module Shadowrocket, proxy MITM bằng Go chạy trên Fly.io, Root CA, DoH + NextDNS
xoay vòng, worker Cloudflare phục vụ khung, tới API, admin panel và SQL migration.

---

## 1. Cài nhanh (iPhone)

| Bước | Việc cần làm |
|------|--------------|
| 1 | Cài **Shadowrocket** (App Store ID `932747118`, ~$2.99 mua 1 lần) |
| 2 | Cài **Module** — bấm nút 1-Click ở [`index.html`](./index.html) hoặc vào [b1s.id.vn/locketvip](https://b1s.id.vn/locketvip) → đăng nhập → **Kích hoạt free** |
| 3 | **Tạo chứng chỉ**: Shadowrocket → Cấu hình → (i) → HTTPS giải mã → *Tạo* |
| 4 | **Cài hồ sơ**: Safari mở hồ sơ → Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị → *Cài đặt* |
| 5 | **Tin cậy**: Cài đặt → Chung → Giới thiệu → *Cài đặt gốc chứng chỉ* → **BẬT** chứng chỉ |
| 6 | **Bật VPN** → xóa Locket → tải lại → đăng nhập cũ → **Gold ✦** |

> Bước 5 là **bắt buộc** — thiếu nó thì iOS không giải mã được → không có Gold.
> Hướng dẫn chi tiết 10 bước (kèm DNS riêng ở bước cuối): [b1s.id.vn/locketvip](https://b1s.id.vn/locketvip).

### Deep-link cài 1 chạm

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
├─ workers/frames/          6 worker luân phiên phục vụ khung Kawaii (b1steam-frames-1..6)
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
   │
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
<summary><b>6 worker khung</b></summary>

```bash
cd workers/frames
bash deploy.sh             # lặp b1steam-frames-1..6
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
