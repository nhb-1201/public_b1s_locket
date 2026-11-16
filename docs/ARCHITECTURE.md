# Kiến trúc LocketGold (Free) ✦ B1sTeam

> Tài liệu kỹ thuật của `public_b1s_locket` — bản `8.0.0` (Phương Thức 2 đã bị loại bỏ).

---

## 0. Tổng quan

Hệ thống gồm **6 tầng độc lập** (nay chỉ còn 1 đường cài đặt — DNS), mỗi tầng vẫn thay
thế được cho nhau để luôn có ít nhất một đường hoạt động:

| # | Tầng | Công nghệ | Nhiệm vụ |
|---|------|-----------|-----------|
| 1 | DoH Edge | Cloudflare Worker | Định tuyến DNS Locket → proxy Fly / NextDNS riêng |
| 2 | MITM proxy | Go 1.25 trên Fly.io | Bơm entitlement + mở khung **qua mạng** |
| 3 | Root CA hệ thống | ECDSA P-256 | Cho phép iOS giải mã TLS tới MITM proxy |
| 4 | Worker khung | 6 × Cloudflare Worker | Phục vụ PNG khung Kawaii (round-robin) |
| 5 | Backend | Cloudflare Workers + D1 | DoH riêng theo tài khoản, audit |
| 6 | Frame draw | Cloudflare photon WASM | Vẽ khung trực tiếp lên ảnh người dùng |

Nguyên tắc: **Phương Thức 1 (DNS) là đường duy nhất**. Không còn app bên thứ ba,
không còn on-device MITM, không còn license key cho người dùng cuối.

---

## 1. Luồng mở Gold (Phương Thức 1 — DNS)

```
┌──────────── iPhone (hồ sơ .mobileconfig) ───┐
│  Locket.app                                  │
│    │  DNS (RFC 8484 DoH)                     │
│    ▼                                          │
│  doh.b1s.id.vn  /fly/dns-query               │
│    │  allow-list → IP Fly (TTL 60)           │
│    ▼                                          │
│  Fly.io :443 (raw TCP)                       │
│    │  forge leaf EC P-256 (Root CA hệ thống) │
│    ▼                                          │
│  Go MITM proxy :8443                          │
│    • RevenueCat → entitlement Gold           │
│    • Firebase Remote Config → VIP flags      │
│      + camera_filter_config (247KB)          │
│      + b1s_frame_catalog / camera_frame_config│
│    • Locket API → bỏ paywall, unblur, badge  │
│    • generateFilteredImage → photon worker   │
│    ▼                                          │
│  Locket.app nhận entitlement → huy hiệu Gold ✦│
└────────────────────────────────────────────────┘
```

Các host được MITM (allow-list SNI):

```
api.revenuecat.com · api.rc-backup.com · rev.cat
firebaseremoteconfig.googleapis.com · firebaseremoteconfig.google.com
www.remoteconfig.googleapis.com · firebaseremoteconfigrealtime.googleapis.com
api.locketcamera.com · cdn.locketcamera.com · public.locketcamera.com
locket.camera · us-central1-locket-4252a.cloudfunctions.net
firebasestorage.googleapis.com · storage.googleapis.com
identitytoolkit.googleapis.com · securetoken.googleapis.com
firestore.googleapis.com · firebase.googleapis.com
```

> **Vì sao DNS + Root CA hoạt động?** Locket dùng `URLSession` tiêu chuẩn của iOS —
> chứng chỉ TLS đi qua trust store của hệ điều hành. Sau khi người dùng bật
> “B1sTeam Root CA” trong Certificate Trust Settings, iOS chấp nhận leaf do proxy
> tự ký theo SNI. Không có certificate pinning riêng trên các host RC/Firebase/Locket
> trong allow-list (đã kiểm thử trên máy thật).

---

## 2. DoH + MITM proxy (đường chính)

```
iOS (hồ sơ .mobileconfig)
  │  DoH: https://doh.b1s.id.vn/fly/dns-query
  ▼
Cloudflare Worker (dns/)
  ├─ name ∈ allow-list  → A mitm.b1s.id.vn (TTL 60)  ← trỏ thẳng vào MITM proxy
  └─ name ∉ allow-list  → 1.1.1.1 (RFC 8484)        ← không bao giờ làm open-resolver
  ▼
Fly.io :443 (raw TCP) → Go MITM proxy :8443
  ├─ SNI ∉ allow-list → đóng kết nối
  ├─ forge leaf ECDSA P-256 (CN = SNI, SAN = SNI + danh sách)
  ├─ chặn cache (If-None-Match, ETag, Accept-Encoding)
  ├─ response theo host:
  │    • revenuecat → entitlement Gold
  │    • firebase   → VIP flags + catalog khung (full camera_filter_config 247KB)
  │    • locket API → bỏ paywall, unblur, badge Gold
  │    • generateFilteredImage → **worker photon** (vẽ khung thật) — fallback pool tĩnh
  └─ rate-limit per-IP → 429
```

### 2.1. Vẽ khung photon (generateFilteredImage) + pool tĩnh

`generateFilteredImage` (Photobooth / overlay / khung) được chuyển tới worker photon —
tự `fetch(input_url)` → crop √1024 → vẽ khung → trả `data:image/png;base64,...` trong JSON
Locket (`result.outputUrl`):

```
Fly MITM  ── POST /apply-frame { input_url, filter_id } + header x-b1s-proxy-key
             ─► b1steam-frame-raw.nhb-120111.workers.dev
                 └─ photon WASM (@cf-wasm/photon) → 1024×1024 PNG đã có khung
             ◄── 200 { ok:true, frame:"frame-12-gold", result:{ outputUrl:"data:image/png;base64,…" } }

FAIL-OPEN: worker chết / ảnh hỏng / quá lớn (>15 MB)
             ─► Fly trả 200 với ảnh GỐC (không bao giờ làm vỡ app)
```

Endpoint `/frame-raw` nhận base64 từ **upload ảnh của người dùng**; xác thực bằng
`x-b1s-proxy-key` từ MITM (hoặc `x-b1s-license` + `x-b1s-device` qua
`https://locket.b1s.id.vn/api/v2/locketgold/verify` — giữ lại để tương thích nội bộ).

Pool tĩnh phục vụ **catalog khung** (Firebase entries → widget / gallery):

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
| DNS query của user | Không lưu ở worker Fly | NextDNS tự quản lý log của account |
| Ảnh người dùng | **Không lưu** | Proxy không ghi body |
| Audit admin | D1 (`locketgold_audit`) | Chỉ `ip_hash` (sha256+salt), không lưu IP thô |
| Hồ sơ .mobileconfig | Không lưu | Client tự cài, không gửi dữ liệu về B1sTeam |

---

## 4. Bảo mật theo lớp

```
┌─────────────────────────────────────────────────────────────┐
│ L7  CSP · HSTS preload · X-Frame-Options DENY · COOP/CORP   │
├─────────────────────────────────────────────────────────────┤
│ L6  DoH riêng theo tài khoản (NextDNS) + HMAC payload       │
├─────────────────────────────────────────────────────────────┤
│ L5  Rate-limit 3 tầng (proxy MITM · static · DoH)           │
├─────────────────────────────────────────────────────────────┤
│ L4  Allow-list SNI (proxy) + allow-list domain (DoH)        │
├─────────────────────────────────────────────────────────────┤
│ L3  Root CA ECDSA P-256 — private key ngoài repo            │
├─────────────────────────────────────────────────────────────┤
│ L2  TLS 1.2+ · ECDHE-ECDSA · leaf P-256 · TTL 397 ngày      │
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
| `FLY_PROXY_IP` | *đặt trong `[vars]`/secret, KHÔNG commit vào repo* | IP trả về cho domain trong allow-list (IP Fly.io MITM) |
| `NEXTDNS_BASE` | `https://dns.nextdns.io` | Upstream NextDNS |
| `PUBLIC_DOH` | `https://1.1.1.1/dns-query` | Fallback |

### 5.3. API / Admin

| Biến | Ý nghĩa |
|------|---------|
| `LICENSE_SECRET` | Khóa HMAC-SHA256 ký license key (nếu bật lại license nội bộ) |
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
| `proxy/` | MITM proxy Go | Fly.io `b1steam-locketgold` |
| `ios/` | Hồ sơ mẫu `.mobileconfig` | — (tham khảo) |
| `ca/` | Root CA + sinh hồ sơ | Chạy 1 lần, offline |
| `dns/` | Worker DoH | Cloudflare Workers (`doh.b1s.id.vn`) |
| `nextdns/` | Engine + client | Dùng bởi `api/`, `dns/` |
| `workers/frames/` | Worker khung | Cloudflare Workers × 6 |
| `api/` | Handler HTTP | Vercel / Worker |
| `admin/` | Bảng quản trị | Vercel / Worker |
| `scanner/` | Công cụ kiểm tra | CLI (CI) |
| `sql/migrations/` | DDL | Cloudflare D1 |
| `tests/` | Test tự động | CI |
