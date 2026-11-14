# Kiến trúc — B1sTeam — LocketGold (Free) v7.8.0

Tài liệu này mô tả cách hệ thống hoạt động từ lúc người dùng bấm
**"Tải LocketGold"** đến khi tính năng Gold hoạt động trên máy. Hai tầng, lựa chọn cho người dùng:

1. **Shadowrocket (khuyến nghị)** — MITM trên máy iPhone, không server trung gian giải mã.
2. **DoH (tùy chọn, bổ trợ)** — chặn quảng cáo/telemetry ở tầng DNS (`.mobileconfig`).

---
## 1. Kiến trúc tổng quan

```

┌─ iPhone / iPad ───────────────────────────────────┐
│  Shadowrocket (App Store ID 932747118)            │
│   └─ .conf LocketGold (license cá nhân hóa)        │
│       ├─ [MITM] hostname=Locket/RC/FC/...          │
│       ├─ [Script] 6 MITM scripts (v7.8.0)          │
│       └─ MITM CA của Shadowrocket (do bạn tạo)     │
└────────────────┬──────────────────────────────────┘
                 │ HTTPS MITM on-device (cert bạn tin tưởng)
                 ▼
        ┌────────────────┐  verify < 60 min  ┌──────────────────────────┐
        │  Locket API    │ ◄──────────────── │ locket.b1s.id.vn         │
        │  RevenueCat    │                    │  D1: locketgold_licenses  │
        │  Firebase RC   │                    │  1 key = 1 tài khoản web  │
        └───────┬────────┘                    └──────────────────────────┘
                │  POST generateFilteredImage
                ▼
        ┌─────────────────────────────────────────────┐
        │  Frame workers (4 accounts CF, round-robin)  │
        │  locket-filter-frame v2.0.0                  │
        └─────────────────────────────────────────────┘

┌─ Tầng DNS (tùy chọn, mọi lúc) ───────────────────────┐
│  (.mobileconfig B1sTeam DNS)                          │
│   ├─ Root CA B1sTeam (ECC P-256) — chỉ proxy LAN     │
│   └─ DNSSettings → DoH: doh.b1s.id.vn / proxy LAN    │
└───────────────────────────────────────────────────────┘
```

**Vai trò các thành phần**

| Thành phần | Công nghệ | Nhiệm vụ |
|---|---|---|
| **Shadowrocket package** | `.conf` / `.sgmodule` + 6 MITM scripts (`ios/scripts/*.v7.8.0.js`) | MITM RC/Locket/FC ngay trên máy; mở khóa Gold + unlock khung Kawaii |
| **Web portal** | `b1s.id.vn/locketvip` (b1steam_web `main`) | Landing "LocketGold (Free)" + wizard càiđặt + VipHonorCard |
| **Backend** | `locket.b1s.id.vn` (CF Workers v3.3.5) | Verify license + serve module/.conf cá nhân hóa + VIP list + tick |
| **Rewards/frames** | `locket-filter-frame` v2.0.0 | Vẽ khung Kawaii lên ảnh (4 accounts, round-robin + failover) |
| **Edge gateway** | `b1steam-edge` v1.0.0 (4 accounts) | Relay minh bạch (`/rc`, `/vip/list`, `/health`), strict allowlist |
| **DoH** | `doh.b1s.id.vn` (`locketgold-dns`) | RFC 8484 — phân giải / block ads / **không log** |
| **Proxy (LAN, tùy chọn)** | Python (`proxy/python/mitm_proxy.py`) | Shadowrocket-free fallback LAN — 443 + 8443, watchdog auto-start |

---
## 2. Shadowrocket là đường chính

```
b1s.id.vn/locketvip → màn cài đặt 5 phút:
  1. Tải Shadowrocket (App Store)
  2. Đăng nhập → Tải .conf cá nhân (nhúng key B1S-… của bạn)
  3. Shadowrocket → Cấu hình → alfretro-*.conf → HTTPS解密 → 生成证书 → 安装证书
  4. Cài đặt iPhone → Cài đặt tin cậy chứng nhận → Shadowrocket CA → Bật
  5. Bật Shadowrocket (góc trên-phải) → More → Locket — Gold hiện ngay
```

- **MITM CA do Shadowrocket sinh** trên máy bạn — không AI/server nào giữ private key.
- `.conf` khai báo `[MITM] hostname =` RC/Locket/FC/RevenueCat/Firebase-Storage/CDN Locket.
- `updateInterval=43200` (12h) → module tự cập nhật, ai quên mở cũng vẫn được bản mới.

---
## 3. Cấu trúc repo

```text
ios/            # Shadowrocket (v7.8.0) — nguồn chân lý
  src/          # MITM scripts (*.src.js) — CHỈNH Ở ĐÂY, không sửa scripts/*.js
  scripts/      # OUTPUT generated (commit luôn; cache-bust file name .v7.8.0.js)
  alfretro-allinone.conf          # Nguồn chính SHADOWROCKET
  locketgold.sgmodule             # GENERATED (build.mjs) — %APPEND% [MITM]
  conf.html / module.html         # Landing cute → /locketvip
  README.md / CHANGELOG.md
dns/            # DoH worker (RFC 8484)
proxy/          # Python MITM proxy LAN (+ watchdog, Task Scheduler, public-ip)
edge/           # b1steam-edge gateway (relay minh bạch)
frame-worker/   # locket-filter-frame v2.0.0 (dual auth)
scanner/        # Endpoint/host scanner
tools/          # gen-missing-assets.mjs (82 asset gốc B1sTeam)
assets/         # frames/stickers/icons/welcome banner
ca/             # B1sTeam Root CA (ECC P-256, 10 năm) — key gitignored
docs/           # tài liệu này
```

---
## 4. Chi tiết kỹ thuật (tham số)

### 4.1 Shadowrocket MITM

- Xác thực RC request/response: `b1s_unlock.v7.8.0.js` (biên tập LocalGold-Fence).
- Locket API transform đệ quy (badge locket_gold, `is_gold`, `is_locked`...).
- Remote Config `state=UPDATE + templateVersion=Date.now()` + `cache_ttl=0`.
- VIP honor API (`/api/v2/locketgold/vip/list`) — danh sách được inject vào profile.

### 4.2 DoH (RFC 8484)

- `GET https://doh.b1s.id.vn/dns-query?dns=<base64url>`
- Block list: admob, doubleclick, appsflyer, adjust, criteo, amp-api-edge, app-measurement, … → 0.0.0.0.
- Recursive fallback 1.1.1.1 nếu không match → Apps vẫn resolve bình thường ngoài Locket.
- Không log nội dung truy vấn; chỉ đếm (`dns_usage_counters`).

### 4.3 Frame pipeline

- generateFilteredImage: overlay (`khung_/pb_/photobooth/4cut/cmt_locket/sticker/`) → giữ ảnh gốc; mọi AI filter → forward tới edge worker với `x-b1s-license + x-b1s-device` (device-bound 60 phút).
- Worker verify license qua `locket.b1s.id.vn/api/v2/locketgold/verify` (key + device id `mitm-<hash>`).
- 4 edge phân tải round-robin + failover + 60s cooldown.

---
# Chi tiết vận hành & đặc tính (legacy DNS-first) — giữ nguyên nội dung dưới đây


---

## 1. Vai trò từng thành phần

| Thành phần | Công nghệ | Nhiệm vụ |
|---|---|---|
| **Web portal** | Next.js (Vercel) — repo `b1steam_web` nhánh `main` | Landing `/locketvip`, `/dns`, `/quantri/dns`, `/locketgold/vip` |
| **AR / Sticker assets** | 27 frame + 55 sticker do B1sTeam tự sinh bằng `tools/gen-missing-assets.mjs` (SVG → PNG) | Phục vụ RemoteConfig + frame worker; AR overlay phía client |
| **Backend API** | Next.js Route Handlers (Cloudflare Workers / OpenNext) — repo `b1steam_web` nhánh `backend` | Quản lý tài khoản/profile NextDNS, hạn mức, xoay vòng, cấp hồ sơ iOS, Vinh danh Gold |
| **DoH Worker** | Cloudflare Worker (TypeScript) — repo này, `dns/` | Cửa vào DoH, đếm lượt truy vấn, chặn telemetry/ads, REFUSED khi chạm ngưỡng |
| **Proxy MITM** | Go (Fly.io) — repo này, `proxy/` | Ký TLS bằng Root CA, ghi đè phản hồi Firebase RC / RevenueCat / Locket API |
| **Frame Worker** | Cloudflare Worker (WASM) — repo này, `frame-worker/` | Vẽ khung Kawaii lên ảnh người dùng; phục vụ `/assets/*` (301 sang raw repo) và `/apply-frame`, `/frame-raw` |
| **Database** | Cloudflare D1 (`b1steam`) | `dns_nextdns_accounts`, `dns_profiles`, `dns_usage_counters`, `dns_usage_snapshots`, `dns_events`, `dns_config`, `locketgold_vip_honor` |

---

## 2. Luồng cấp DNS lần đầu

```
Người dùng                Backend (Workers)            NextDNS
    │                            │                         │
    │ POST /api/v2/dns/provision │                         │
    ├───────────────────────────>│                         │
    │                            │ chưa có dns_nextdns_accounts? │
    │                            │ POST /accounts ────────>│  (tạo tài khoản + profile + rewrites)
    │                            │ <──── cookie pst/sid ───┤
    │ <── doh_url + mobileconfig │                         │
```

**Quan trọng — API NextDNS đã kiểm chứng thực tế (2026-11):**

| Method | Path | Body | Ghi chú |
|---|---|---|---|
| POST | `/accounts` | `{email, password, profile:{...}}` | Trả **text `"OK"`** (không phải JSON) + cookie `pst`,`sid` |
| GET | `/profiles` | – | `{data:[{id, fingerprint, role, name}]}` |
| POST | `/profiles` | `{name, security, privacy, settings}` | Tạo profile mới trong cùng tài khoản |
| PATCH | `/profiles/{id}` | `{name}` | 204 |
| DELETE | `/profiles/{id}` | – | 204 |
| GET/POST | `/profiles/{id}/rewrites` | `{name, content}` | ⚠️ `content`, **không phải** `answer` |
| GET | `/profiles/{id}/analytics/status` | – | `{data:[], meta:{...}}` — thường rỗng, **không dùng làm nguồn số liệu** |

> NextDNS **không có** endpoint đăng nhập (`POST /accounts/login` → 404).
> Session cookie được lưu (mã hoá ECC P-256 hybrid) trong D1 ngay khi đăng ký và dùng lại cho
> mọi thao tác API. Khi cookie hết hạn, bước `rotate` sẽ create tài khoản mới lúc bấm nút.

---

## 3. Luồng truy vấn DNS

```
iPhone ──DoH──> DoH Worker ──DoH──> NextDNS (tài khoản của user) ──(rewrite)──> IP proxy ──TLS──> API thật
```

### 3.1 DoH Worker

1. Parse token từ path (`/<token>` hoặc `/<token>/dns-query`).
2. Tra `dns_profiles` trong D1 (cache trong bộ nhớ isolate 60 giây).
3. **Enforce** (theo thứ tự):
   - `rotation_required = 1` hoặc `status = 'revoked'` hoặc `is_current = 0` (kể cả profile `pending`) → **REFUSED / 403** + header `X-Update-Required: 1`.
   - `count >= query_limit` → **REFUSED / 403**.
4. **Đếm lượt truy vấn**: bộ đếm trong bộ nhớ isolate, ghi D1 mỗi 10 giây.
5. **Blocklist**: telemetry + ads global + ads VN → REFUSED.
   - Không chặn domain nào được rewrite về proxy (RevenueCat, Firebase RC, Locket API).
6. **Forward** sang `https://dns.nextdns.io/<nextdns_profile_id>` (GET json hoặc POST dns-message, race 2 đường).
7. **Cache edge**: 5 phút fresh + 24 giờ stale-if-error. POST cache key = SHA-256 bản tin DNS bỏ 2 byte transaction ID.

### 3.2 Proxy MITM (Go)

- TLS server dùng **leaf certificate** ký bằng Root CA, cache theo SNI (`tls/cache.go`).
- `X-Forwarded-*` / `Accept-Encoding` bị xoá để luôn nhận body gốc.
- `generateFilteredImage` → path được **đổi sang `/apply-frame`** trước khi đẩy sang Frame Worker,
  kèm header `x-b1s-proxy-key: <PROXY_SHARED_KEY>` (worker từ chối mọi request thiếu header này).
  Nếu filter_id thuộc nhóm overlay/photobooth → Go mock 200 với ảnh gốc (app tự vẽ overlay).
- `ModifyResponse` ghi đè theo host:
  | Host | Handler | Việc làm |
  |---|---|---|
  | `firebaseremoteconfig.googleapis.com` | `handler.InjectFirebase` | Ép toàn bộ feature gate + camera filter config |
  | `api.revenuecat.com` | `handler.InjectRevenueCat` | Gắn entitlement `Gold` vĩnh viễn |
  | `*.locketcamera.com` | `handler.RewriteLocketAPI` | Badge Gold, bỏ paywall 400/402/403, gỡ blur |
  | `*/generateFilteredImage` | frame worker | Chuyển khung ảnh về worker của B1sTeam |

### 3.3 Frame Worker (`locket-filter-frame`)

- `/apply-frame` · `/frame-raw` — **bắt buộc header `x-b1s-proxy-key`** (secret chia sẻ với proxy).
- `/assets/*` — 301 redirect sang raw GitHub base của repo này (nơi chứa khung/icons).
- `/health` — version.
- Khung Kawaii: 01–07 tải từ CDN (raw.githubusercontent.com), 08–14 nhúng base64 trong worker.
- Không lưu ảnh — mọi thứ xử lý trong memory.

---

## 4. Hạn mức & xoay vòng — **NextDNS Free tính theo tài khoản**

> NextDNS Free: 300.000 truy vấn / 30 ngày, **theo tài khoản** (không phải theo profile).
> → Mỗi vòng xoay = **1 tài khoản NextDNS mới**. Tạo profile mới cùng tài khoản KHÔNG reset hạn mức.

```
cron (mỗi giờ) ──> GET /api/v2/internal/dns-sync (HMAC)
                       │
                       ├─ syncProfileUsage(): đọc dns_usage_counters, tính %
                       ├─ ≥ 60% (preprovision_percent) → preprovisionDnsAccount():
                       │      tạo tài khoản NextDNS mới + profile + rewrites,
                       │      status='ready', is_current=0 (idempotent)
                       └─ ≥ 80% (threshold_percent) → rotation_required = 1,
                             status = 'rotation_required',
                             gửi in-app notification + email cho user,
                             DoH Worker CHẶN link (REFUSED)
                             → rotateDnsProfile() NGAY LẬP TỨC (tự động):
                               · revoke profile hiện tại (+superseded tài khoản)
                               · kích hoạt tài khoản 'ready' đã tạo sẵn
                                 (hoặc tạo mới ngay nếu cron chưa kịp)
                               · is_current = 1, user_update_required = 1
                                                             │
user vào /dns ─────────────────────────────────────────────┴─> thấy banner "Bắt buộc cập nhật DNS"
                          bấm "Tải hồ sơ & cài đè" → tải lại .mobileconfig
                          · user_update_required tự về 0 (tải xong)
                          cài đè lên hồ sơ cũ (không cần gỡ)
```

**Tự động xoay vòng 100%**: khi chạm ngưỡng 80%, cron tự kích hoạt tài khoản NextDNS mới
trong lần chạy kế tiếp — user không cần bấm gì, chỉ cần cài lại `.mobileconfig` cho thiết bị.
Nếu cron chưa kịp tạo sẵn, `rotateDnsProfile()` tự tạo tài khoản mới ngay tại thời điểm đó.

**Vì sao xoay bằng “tài khoản mới” chứ không “profile mới cùng tài khoản”?**

- Hạn mức 300k/tháng bên NextDNS Free đếm theo **tài khoản**.
- Tài khoản mới = hạn mức mới hoàn toàn.
- Email tài khoản là địa chỉ ngẫu nhiên `[a-z0-9]{9–16}@nhbz1s.id.vn` (local-part toàn bộ a-z0-9 độ dài 9–16, không lộ user_id thật), mật khẩu 24 ký tự ngẫu nhiên (`B1s` + 24 ký tự từ 72 ký hiệu ~126 bit entropy)
  đủ mạnh, cả hai đều mã hoá ECC P-256 hybrid trong D1.

---

## 5. Bảng dữ liệu

| Bảng | Mục đích |
|---|---|
| `dns_nextdns_accounts` | **1 tài khoản NextDNS / vòng xoay** (email, mật khẩu & cookie đã mã hoá). `is_current=1` → đang phục vụ; `status='ready'` → đã tạo sẵn |
| `dns_profiles` | 1 profile / vòng xoay (`pending` = sẵn sàng, `is_current=1` = đang phục vụ). `user_update_required` = user bắt buộc cài lại |
| `dns_usage_counters` | Bộ đếm truy vấn thực (DoH Worker ghi, backend đọc) |
| `dns_usage_snapshots` | Lịch sử mốc thời gian (vẽ biểu đồ) |
| `dns_events` | Audit log thao tác DNS |
| `dns_config` | Cấu hình runtime (ngưỡng, hạn mức, IP proxy, danh sách domain) |
| `locketgold_vip_honor` | Vinh danh Cộng đồng Gold (opt-in, username Locket công khai) |

Ràng buộc quan trọng:

```sql
CREATE UNIQUE INDEX idx_dns_profiles_current
  ON dns_profiles (user_id) WHERE is_current = 1;

CREATE UNIQUE INDEX idx_dns_nextdns_accounts_current
  ON dns_nextdns_accounts (user_id) WHERE is_current = 1;

CREATE UNIQUE INDEX idx_dns_nextdns_accounts_ready
  ON dns_nextdns_accounts (user_id) WHERE status = 'ready';
```

→ mỗi user chỉ có đúng **một** tài khoản/profile “hiện tại” và **không quá một** tài khoản “sẵn sàng”.

`dns_accounts` (1 tài khoản/user — bản cũ) **không còn được đọc**; dữ liệu được giữ lại làm đường lui.

---

## 6. Endpoint API

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v2/dns/provision` | user | Xem trạng thái (không tạo mới) |
| POST | `/api/v2/dns/provision` | user | Cấp / đảm bảo có profile |
| POST | `/api/v2/dns/rotate` | user | Xoay vòng → link DNS mới (tài khoản mới) |
| GET | `/api/v2/dns/mobileconfig` | user | Tải hồ sơ iOS (tự tắt `user_update_required`) |
| GET | `/api/v2/dns/snapshots` | user | Lịch sử hạn mức |
| GET/POST | `/api/v2/locketgold/vip` | public / user | Danh sách vinh danh · `{action:'join'\|'leave'}` |
| GET | `/api/v2/locketgold/vip/status` | user | Trạng thái vinh danh của user |
| GET | `/api/v2/admin/dns/profiles` | admin | Danh sách profile + stats (sẵn sàng, cần cập nhật) |
| POST | `/api/v2/admin/dns/profiles` | admin | `sync` · `rotate` · `preprovision` · `revoke` · `delete` |
| GET/PATCH | `/api/v2/admin/dns/config` | admin | Cấu hình runtime (`threshold_percent`, `warn_percent`, `preprovision_percent`, …) |
| GET | `/api/v2/internal/dns-sync` | cron (HMAC) | Đồng bộ + preprovision + TỰ ĐỘNG XOAY VÒNG |

---

## 7. Bảo mật

- Mật khẩu & cookie NextDNS mã hoá bằng `encryptSecret` (ECC P-256 hybrid, v2).
- Token truy cập 32 hex ngẫu nhiên → không thể đoán link DNS của người khác.
- Admin API dùng `requireAdmin`; route cron dùng HMAC-SHA256 + cửa sổ ±5 phút.
- Rate-limit theo user cho `provision` (10/lần), `rotate` (5/lần), VIP join/leave (10/lần).
- Không log nội dung truy vấn DNS — chỉ đếm số lượng.
- Khi bị chạm ngưỡng, người dùng bị chặn hoàn toàn cho tới khi cài lại hồ sơ.

---

## 8. Asset catalog — 82 file ĐÃ có (do B1sTeam sinh)

`proxy/handler/camera_filter_config.json` chứa ~2.457 tham chiếu `<domain>/assets/<path>` cho catalog
Photobooth + Cue (~500 filter `cutout`/`normal`). 82 file unique (`stickers/stk_*.png`, `frames/khung_*.png`,
`frames/pb_*.png`…) trước đây nằm trên CDN bên thứ 3 (đã chết 404), **không phải tác phẩm của người dùng NextDNS** mà là
tác phẩm Nico/Creative Commons-ish của tác giả riêng — vì vậy B1sTeam tự vẽ bộ mới đặt cùng tên file:

- Vẽ bằng `tools/gen-missing-assets.mjs` (SVG → `sharp` → PNG, alpha hoàn toàn trong suốt ở phần giữa cho AR overlay).
- Thiết kế 100% gốc (kawaii/photobooth vector), **không** sao chép khung gốc.
- Nếu bạn có bản gốc hoặc thay 1 ảnh bất kỳ: thả file cùng tên vào `assets/frames/` hoặc `assets/stickers/` là được
  (vùng trung tâm trong suốt, kích thước 1024×1024 cho frame / 512×512 cho sticker, hoặc bất kỳ kích thước nào — Locket
  tự scale).
- `frame-worker` phục vụ `/assets/*`: nhiều path đã có trong repo (kawaii frames, icon…); còn lại 301 sang raw repo.


