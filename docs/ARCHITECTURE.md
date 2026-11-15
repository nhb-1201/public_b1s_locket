# Kiến trúc LocketGold (Free) ✦ B1sTeam

> Tài liệu kỹ thuật của `public_b1s_locket` — bản `4.0.0` (viết lại toàn bộ).

---

## 0. Tổng quan

Hệ thống gồm **6 tầng độc lập**, mỗi tầng thay thế được cho nhau để luôn có ít nhất
một đường hoạt động:

| # | Tầng | Công nghệ | Nhiệm vụ |
|---|------|-----------|-----------|
| 1 | Module Shadowrocket | JS (JSCore) | Ghi đè entitlement **trên máy người dùng** |
| 2 | CA của máy | CA do Shadowrocket sinh | Cho phép giải mã HTTPS |
| 3 | DoH Edge | Cloudflare Worker | Định tuyến DNS Locket → proxy Fly / NextDNS riêng |
| 4 | MITM proxy | Go 1.25 trên Fly.io | Bơm entitlement + mở khung **qua mạng** |
| 5 | Worker khung | 6 × Cloudflare Worker | Phục vụ PNG khung Kawaii (round-robin) |
| 6 | Backend | Cloudflare Workers + D1 | License key, module cá nhân hoá, audit |

Nguyên tắc: **tầng 1 là đường chính** (nhanh, riêng tư, không phụ thuộc hạ tầng B1sTeam).
Các tầng còn lại là dự phòng + tiện ích.

---

## 1. Luồng mở Gold (đường chính — on-device)

```
┌──────────── iPhone ────────────┐
│  Locket.app                     │
│    │  GET https://api.revenuecat.com/v1/.../customer_info
│    ▼                            │
│  Shadowrocket (TLS MITM)        │
│    │  giải mã bằng CA người dùng │
│    ▼                            │
│  script: b1s_revenuecat_response │
│    • parse JSON                  │
│    • subscriber.subscriptions    │
│        += locket_1600_1y (PURCHASED, expires 9999-01-09)
│    • subscriber.entitlements     │
│        += Gold / gold / pro / premium / locket_gold
│    • top-level "Attention"       │
│    ▼                            │
│  Locket.app nhận entitlement Gold → hiện huy hiệu ✦
└─────────────────────────────────┘
```

Các host được MITM (allow-list SNI):

```
api.revenuecat.com · api.rc-backup.com · rev.cat
firebaseremoteconfig.googleapis.com · firebaseremoteconfig.google.com
www.remoteconfig.googleapis.com · firebaseremoteconfigrealtime.googleapis.com
api.locketcamera.com · cdn.locketcamera.com · public.locketcamera.com
locket.camera · us-central1-locket-4252a.cloudfunctions.net
firebasestorage.googleapis.com · storage.googleapis.com
```

> **Vì sao phải MITM?** Locket dùng **certificate pinning** cho RevenueCat/Firebase.
> Một hồ sơ `.mobileconfig` chỉ cài CA cho hệ thống **không** đủ để app chấp nhận
> chứng chỉ giả — vì vậy tầng 1 (module) là đường chắc chắn nhất.

---

## 2. Luồng DoH + MITM proxy (đường dự phòng qua mạng)

```
iOS (hồ sơ .mobileconfig)
  │  DoH: https://doh.b1s.id.vn/fly/dns-query
  ▼
Cloudflare Worker (dns/)
  ├─ name ∈ allow-list  → A 137.66.53.108 (TTL 60)   ← trỏ thẳng vào MITM proxy
  └─ name ∉ allow-list  → 1.1.1.1 (RFC 8484)        ← không bao giờ làm open-resolver
  ▼
Fly.io :443 (raw TCP) → Go MITM proxy :8443
  ├─ SNI ∉ allow-list → đóng kết nối
  ├─ forge leaf ECDSA P-256 (CN = SNI, SAN = SNI + danh sách)
  ├─ chặn cache (If-None-Match, ETag, Accept-Encoding)
  ├─ response theo host:
  │    • revenuecat → entitlement Gold
  │    • firebase   → VIP flags + catalog khung
  │    • locket API → bỏ paywall, unblur, badge Gold
  │    • generateFilteredImage → pool worker khung
  └─ rate-limit per-IP → 429
```

### 2.1. Rotate khung qua worker

`generateFilteredImage` (Photobooth / overlay) được chuyển hướng tới pool:

```
b1steam-frames-1.nhb-120111.workers.dev ─┐
b1steam-frames-2.nhb-120111.workers.dev  │
b1steam-frames-3.nhb-120111.workers.dev  ├─ round-robin + cooldown 60s khi lỗi
b1steam-frames-4.nhb-120111.workers.dev  │
b1steam-frames-5.nhb-120111.workers.dev  │
b1steam-frames-6.nhb-120111.workers.dev ─┘
```

Mỗi worker phục vụ:

* `GET /frames` → catalog JSON (id, name, group, file, tags, premium)
* `GET /f/:id` → bytes PNG (thiếu asset → trả PNG 1×1 trong suốt, **không** 500)
* `GET /health` → `{"ok":true,"worker":"b1steam-frames"}`

### 2.2. Xoay vòng NextDNS 80%

```
nextdns/rotate.js
  pickProfile(profiles, { profileId, ratio = 0.8 })
  → 80% : profile NextDNS riêng của user (rewrite domain → IP Fly)
  → 20% : profile dự phòng / direct
  → fallback 1.1.1.1 khi profile bão hòa hoặc lỗi
```

Quyết định **ổn định theo user** (hash `profileId`) để cache/CDN hiệu quả, nhưng tỉ lệ
tổng vẫn ~80%. Số liệu lượng truy vấn đọc từ
`https://api.nextdns.io/profiles/<id>/analytics/status`.

---

## 3. Đường dẫn dữ liệu người dùng

| Dữ liệu | Lưu ở đâu | Ghi chú |
|----------|-----------|---------|
| License key | D1 (`locketgold_license_keys`) | Chỉ lưu `sha256(key)` + 4 ký tự cuối |
| Module/.conf đã phát | Không lưu | Response `Cache-Control: no-store` |
| Ảnh người dùng | **Không lưu** | Proxy không ghi body |
| Query DNS của user | Không lưu ở worker Fly | NextDNS tự quản lý log của account |
| Audit admin | D1 (`locketgold_audit`) | Chỉ `ip_hash` (sha256+salt), không lưu IP thô |

---

## 4. Bảo mật theo lớp

```
┌─────────────────────────────────────────────────────────────┐
│ L7  CSP · HSTS preload · X-Frame-Options DENY · COOP/CORP   │
├─────────────────────────────────────────────────────────────┤
│ L6  License HMAC-SHA256 · device-bound · constant-time cmp │
├─────────────────────────────────────────────────────────────┤
│ L5  Rate-limit 3 tầng (proxy MITM · static · DoH)           │
├─────────────────────────────────────────────────────────────┤
│ L4  Allow-list SNI (proxy) + allow-list domain (DoH)        │
├─────────────────────────────────────────────────────────────┤
│ L3  Root CA ECDSA P-256 — private key ngoài repo            │
├─────────────────────────────────────────────────────────────┤
│ L2  TLS 1.2+ · ECDHE-ECDSA · leaf P-256 · TTL 397 ngày     │
└─────────────────────────────────────────────────────────────┘
```

### 4.1. Vì sao chọn ECDSA P-256?

* Handshake nhanh hơn RSA-2048 rõ rệt trên CPU iPhone.
* Leaf nhỏ hơn → băng thông thấp hơn.
* Tương thích iOS 12+ và mọi TLS stack hiện đại.

### 4.2. Chống lạm dụng proxy MITM

Proxy **không** phải open-proxy: chỉ nhận SNI trong allow-list, có rate-limit theo IP và
trả `429`. Đây là ranh giới giữa "hỗ trợ người dùng" và "trở thành hạ tầng MITM công cộng".

---

## 5. Cấu hình môi trường

### 5.1. Proxy (Fly.io)

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `PORT` | `8443` | Cổng TLS nội bộ |
| `ROOT_CA_CRT` / `ROOT_CA_KEY` | — | PEM hoặc base64; bắt buộc khi deploy |
| `MITM_SANS` | danh sách mặc định | Allow-list SNI, ngăn cách bằng dấu phẩy |
| `FRAME_WORKERS` | 6 worker mặc định | Pool worker khung (dấu phẩy) |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

### 5.2. Worker DoH

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `FLY_PROXY_IP` | `137.66.53.108` | IP trả về cho domain trong allow-list |
| `NEXTDNS_BASE` | `https://dns.nextdns.io` | Upstream NextDNS |
| `PUBLIC_DOH` | `https://1.1.1.1/dns-query` | Fallback |

### 5.3. API / Admin

| Biến | Ý nghĩa |
|------|---------|
| `LICENSE_SECRET` | Khóa HMAC-SHA256 ký license key |
| `ADMIN_PASSWORD` | Mật khẩu admin panel |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Lưu account NextDNS (tuỳ chọn) |
| `D1_API_TOKEN` / `D1_DATABASE_ID` | Lưu vào Cloudflare D1 (tuỳ chọn) |

---

## 6. Kiểm thử

```bash
node --test tests/                 # license · mobileconfig · rotation · scanner
node scanner/index.js --self-check # assert logic scanner
node scanner/index.js --dns        # resolve host tìm thấy
```

Test proxy (Go) chạy trong container:

```bash
cd proxy && go test ./...
```

---

## 7. Sơ đồ thư mục ↔ vai trò

| Thư mục | Vai trò | Nơi deploy |
|---------|---------|-----------|
| `shadowrocket/` | Module + script MITM | GitHub raw (CDN cho Shadowrocket) |
| `proxy/` | MITM proxy Go | Fly.io `b1steam-locketgold` |
| `ca/` | Root CA + sinh hồ sơ | Chạy 1 lần, offline |
| `dns/` | Worker DoH | Cloudflare Workers (`doh.b1s.id.vn`) |
| `nextdns/` | Engine + client | Dùng bởi `api/`, `dns/` |
| `workers/frames/` | Worker khung | Cloudflare Workers × 6 |
| `api/` | Handler HTTP | Vercel / Worker |
| `admin/` | Bảng quản trị | Vercel / Worker |
| `scanner/` | Công cụ kiểm tra | CLI (CI) |
| `sql/migrations/` | DDL | Cloudflare D1 |
| `tests/` | Test tự động | CI |
