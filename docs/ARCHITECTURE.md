# Kiến trúc hệ thống DNS thuần — B1sTeam

Tài liệu này mô tả chi tiết cách hệ thống **B1sTeam DNS** hoạt động từ lúc người dùng bấm
“Cấp DNS cho tôi” đến khi tính năng Locket Gold hoạt động trên máy.

---

## 1. Vai trò từng thành phần

| Thành phần | Công nghệ | Nhiệm vụ |
|---|---|---|
| **Web portal** | Next.js (Vercel) — repo `b1steam_web` nhánh `main` | Landing `/alfretro`, `/dns`, `/quantri/dns`, `/locketgold/vip` |
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
                                                        │
user vào /dns ──────────────────────────────────────┴─> thấy banner "Bắt buộc cập nhật DNS"
                          bấm "Cập nhật DNS" → rotateDnsProfile():
                            · revoke profile hiện tại (+superseded tài khoản)
                            · kích hoạt tài khoản 'ready' (MỚI NGAY LẬP TỨC)
                            · user_update_required = 1
                          tải lại .mobileconfig → cài đè → user_update_required tự về 0
```

**Không tự xoay vòng**: cron không bao giờ tự đổi tài khoản — user luôn là người tới `/dns`
và cài đè hồ sơ. Nếu cron chưa kịp tạo sẵn, `rotateDnsProfile()` tự tạo tài khoản mới ngay lúc bấm.

**Vì sao xoay bằng “tài khoản mới” chứ không “profile mới cùng tài khoản”?**

- Hạn mức 300k/tháng bên NextDNS Free đếm theo **tài khoản**.
- Tài khoản mới = hạn mức mới hoàn toàn.
- Email tài khoản là địa chỉ tự sinh (`dns-<user>-<random>@<NEXTDNS_MAIL_DOMAIN>`), mật khẩu ngẫu nhiên
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
| GET | `/api/v2/internal/dns-sync` | cron (HMAC) | Đồng bộ + preprovision (không tự xoay vòng) |

---

## 7. Bảo mật

- Mật khẩu & cookie NextDNS mã hoá bằng `encryptSecret` (ECC P-256 hybrid, v2).
- Token truy cập 32 hex ngẫu nhiên → không thể đoán link DNS của người khác.
- Admin API dùng `requireAdmin`; route cron dùng HMAC-SHA256 + cửa sổ ±5 phút.
- Rate-limit theo user cho `provision` (10/lần), `rotate` (5/lần), VIP join/leave (10/lần).
- Không log nội dung truy vấn DNS — chỉ đếm số lượng.
- Khi bị chạm ngưỡng, người dùng bị chặn hoàn toàn cho tới khi cài lại hồ sơ.

---

## 8. Asset catalog — 82 file thiếu

`proxy/handler/camera_filter_config.json` chứa ~2.457 tham chiếu `<domain>/assets/<path>` cho catalog
Photobooth + Cue (504 filter `cutout`/`normal`). 82 file unique (`stickers/stk_*.png`, `frames/khung_*.png`,
`frames/pb_*.png`, …) **không có trong repo này** — trước đây chúng nằm trên CDN bên thứ 3 (nay 404, và đây là
tác phẩm của tác giả riêng). Khi chưa có file:

- Các khung/cue trong **picker** bị thiếu; các tính năng Locket Gold khác **không bị ảnh hưởng**.
- Server-side vẽ khung đi đường `/apply-frame` với 14 khung Kawaii trong `assets/images/kawaii/` + `assets/frames/` — vẫn chạy.

Cách bổ sung: thả đúng tên file (`assets/stickers|frames/<filename>.png` đúng như catalog tham chiếu), rồi cho
worker phục vụ `/assets/*` (hoặc trỏ `ASSET_CDN_BASE`/`ASSET_RAW_BASE` về nơi chứa file).

