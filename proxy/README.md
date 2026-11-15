# B1sTeam — LocketGold (Free) · MITM Proxy

Proxy TLS-intercept (MITM) cho **Locket**: ép **Gold vĩnh viễn**, gỡ paywall, gỡ blur ảnh,
mở khoá bộ lọc/khung — chỉ cần **1 hồ sơ `.mobileconfig`**, không cần Shadowrocket, không cần jailbreak.

> **B1sTeam** — b1s.id.vn · Nguyen Hoang Bach
> Phiên bản: **4.0.0** · Region: **sin (Singapore)**

---

## 1. Kiến trúc

```
        iOS (Locket)                      B1sTeam Fly.io (b1steam-locketgold)
   ┌────────────────────┐            ┌──────────────────────────────────────────┐
   │  Locket app        │            │  :8443  TLS listener  (MITM)            │
   │   ├─ api.revenuecat│───HTTPS──▶│    GetConfigForClient(SNI)               │
   │   ├─ firebase RC   │            │    → allow-list? → forge leaf cert       │
   │   └─ api.locket... │            │    → ReverseProxy (Director/ModifyResp)  │
   └────────────────────┘            │                                          │
                                     │  handler/                                │
                                     │    revenuecat.go → Gold lifetime          │
                                     │    firebase.go    → vip / is_gold / frames│
                                     │    locket_api.go  → unblur + gold badge   │
                                     │    photobooth.go  → mock filter response  │
                                     │    frames.go      → pool Worker (RR+health)│
                                     │    ratelimit.go   → token bucket / IP     │
                                     │                                          │
   ┌────────────────────┐            │  :8080  static HTTP                      │
   │  Safari            │───HTTP────▶│    /, /health, /healthz, /version,        │
   │   ↓ .mobileconfig  │            │    /B1sTeam-LocketGold.mobileconfig,       │
   │  cài Root CA + DoH │            │    /README.txt, /robots.txt               │
   └────────────────────┘            └──────────────────────────────────────────┘
                                                        │
                                                        ▼
                                     Cloudflare Worker pool (round-robin)
                                     /frames  ·  /f/:id  ·  /health
```

### Luồng chính

1. **TLS**: client bắt tay với `:8443`. `GetConfigForClient` đọc SNI:
   - Không có SNI → **từ chối** (không fallback sang host mặc định).
   - SNI không nằm trong allow-list → **từ chối** (anti-abuse).
   - Hợp lệ → lấy/forge leaf cert **ECDSA P-256**, hạn **397 ngày**, SAN = host + allow-list.
2. **Reverse proxy**: bỏ hết header cache (`Accept-Encoding`, `If-None-Match`, `If-Modified-Since`,
   `X-RevenueCat-ETag`, `X-Goog-If-None-Match`) để luôn nhận bản mới.
3. **Sửa response** theo host:
   | Host | Xử lý |
   |------|--------|
   | `api.revenuecat.com`, `api.rc-backup.com`, `rev.cat` | Inject `subscriber.subscriptions` + `subscriber.entitlements` (Gold lifetime) — **idempotent** |
   | `firebaseremoteconfig.*`, `www.remoteconfig.*` | Ép `vip`/`is_gold`/`enable_gold` = true, merge catalog frame |
   | `*.locketcamera.com`, `locket.camera` | `is_locked`/`locked`/`requires_gold`/`paywall`/`blurred` = false, `can_view`/`unlocked`/`is_free` = true, thay URL ảnh mờ bằng URL gốc, gắn badge Gold cho object có `uid`, đổi 400/402/403 → 200 (trừ endpoint feed/bạn bè) |
   | `generateFilteredImage` | Chuyển host sang pool Worker frame + header `X-B1s-Frame-Source: b1steam`; nếu là khung overlay/photobooth → trả **200 mock** kèm URL ảnh gốc |
   | `changeProfileInfo` | Luôn trả 200 + JSON badge Gold |

---

## 2. Triển khai Fly.io

### 2.1. Chuẩn bị Root CA

```bash
cd public_b1s_locket
python ca/gen-ca.py --out /tmp/b1s-ca          # test trước, KHÔNG ghi đè ca/ hiện có
python ca/gen-ca.py                          # sinh thật vào ca/ (root-ca.crt/.key/.cer)
```

### 2.2. Deploy

```bash
cd public_b1s_locket/proxy

flyctl launch --no-deploy --copy-config --name b1steam-locketgold   # chỉ lần đầu
flyctl secrets set ROOT_CA_CRT="$(base64 -w0 ../ca/root-ca.crt)" \
                   ROOT_CA_KEY="$(base64 -w0 ../ca/root-ca.key)" \
                   FLY_IP="<IP public cua may fly>"
flyctl deploy --depot=false
```

> `ROOT_CA_CRT` / `ROOT_CA_KEY` nhận **PEM thuần** hoặc **base64(PEM/DER)** — proxy tự nhận diện.
> Nếu không set, proxy đọc `ca/root-ca.crt` + `ca/root-ca.key` trên đĩa; không có cả hai → **fail loudly**.

Sau khi deploy:

```bash
flyctl ips show                  # lay IP public -> tro A record cho domain
flyctl logs -a                   # xem log JSON
curl https://<domain>/healthz    # {"ok":true,"service":"b1steam-locketgold","version":"4.0.0"}
```

### 2.3. DNS / DoH

- `api.locketcamera.com`, `api.revenuecat.com`, `rev.cat`, `firebaseremoteconfig.*` … → trỏ về **IP của Fly** (hoặc bật DoH `https://doh.b1s.id.vn/fly/dns-query`).
- Hồ sơ `.mobileconfig` đã kèm sẵn payload DoH (`com.apple.dnsSettings.managed`) với `SupplementalMatchDomains` = allow-list.

---

## 3. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `PORT` | `8443` | Port TLS MITM (Fly: 443 → 8443) |
| `STATIC_PORT` | `8080` | Port HTTP static (Fly: 80 → 8080) |
| `FLY_IP` | — | IP public hiển thị trên landing page |
| `MITM_SANS` | danh sách mặc định (15 host) | **Allow-list MITM** + SAN của leaf cert, phân tách bằng dấu phẩy |
| `FRAME_WORKERS` | `https://b1steam-frames-1..6.workers.dev` | Pool Worker frame (round-robin) |
| `ROOT_CA_CRT` / `ROOT_CA_KEY` | — | Root CA (PEM hoặc base64) |
| `ROOT_CA_FILE` / `ROOT_CA_KEY_FILE` | `ca/root-ca.crt` / `ca/root-ca.key` | Fallback đọc từ đĩa |
| `MOBILECONFIG_PATH` | `mobileconfig/B1sTeam-LocketGold.mobileconfig` | Profile có sẵn trên đĩa (nếu không → sinh runtime từ CA trong RAM) |
| `README_PATH` | `README.md` | File phục vụ ở `/README.txt` |
| `RATE_MITM_BURST` / `RATE_MITM_REFILL_PER_MIN` | `100` / `60` | Token bucket cho đường MITM |
| `RATE_STATIC_BURST` / `RATE_STATIC_REFILL_PER_MIN` | `20` / `15` | Token bucket cho static server |
| `UPSTREAM_WORKERS` | `32` | Số request upstream chạy song song |
| `MAX_IDLE_CONNS_PER_HOST` | `16` | Pool connection của `http.Transport` |
| `CERT_CACHE_MAX` / `CERT_CACHE_TTL_HOURS` | `256` / `24` | Cache leaf certificate (LRU-ish + TTL) |
| `FRAME_HEALTH_TTL_SEC` | `60` | Thời gian cache health của Worker |
| `DOH_URL` | `https://doh.b1s.id.vn/fly/dns-query` | ServerURL trong payload DoH |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` (log JSON qua `log/slog`) |

---

## 4. Bảo mật

| Chủ đề | Cách B1sTeam xử lý |
|--------|-------------------|
| **Anti-abuse (allow-list)** | Proxy **chỉ** MITM host trong `MITM_SANS`. Host khác → handshake thất bại ngay ở tầng TLS. Không có SNI → từ chối. |
| **Root CA** | ECDSA P-256, self-signed, hạn 10 năm. Private key **không** nằm trong image; đưa vào bằng `flyctl secrets set`. |
| **Leaf cert** | ECDSA P-256, hạn **397 ngày** (iOS chỉ chấp nhận ≤ 398 ngày với TLS server), SAN khớp allow-list, cache 24h / tối đa 256 entry, evict entry cũ nhất. |
| **TLS** | `MinVersion = TLS1.2`, ưu tiên cipher `ECDHE-ECDSA` (AES-128/256-GCM, ChaCha20-Poly1305), ALPN chỉ `http/1.1`. |
| **Rate limit** | Token bucket **theo IP thật** (đọc `RemoteAddr`, **không** tin `X-Forwarded-For` vì spoof được). Quá hạn → `429` + JSON. |
| **Header** | Static server trả `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`; profile trả `Content-Type: application/x-apple-aspen-config`. |
| **Rò rỉ dữ liệu** | Proxy **không** lưu ảnh/chat; chỉ sửa response rồi chuyển tiếp. Ảnh đi thẳng qua bộ nhớ Worker. |
| **Fail-safe** | Không load được Root CA → **exit ngay**, không chạy nửa vời. Không cache lỗi forge. |
| **Graceful** | `SIGINT`/`SIGTERM` → shutdown trong 20s, drain connection. |

### Lưu ý pháp lý

Công cụ này **can thiệp TLS của chính thiết bị của bạn** để mở khoá tính năng của ứng dụng bạn sử dụng.
B1sTeam **không** phát tán khóa Root CA công khai, **không** chặn băng người dùng khác và **không** thu thập dữ liệu cá nhân.
Tự trách nhiệm khi sử dụng — không dùng để vượt quyền truy cập trái phép.

---

## 5. Chạy local

```bash
cd public_b1s_locket/proxy
python ../ca/gen-ca.py --out ../ca        # sinh CA (lần đầu)
go test ./...                             # unit test (stdlib only)
go build -o b1steam-locketgold .          # binary tĩnh
ROOT_CA_CRT="$(base64 -w0 ../ca/root-ca.crt)" \
ROOT_CA_KEY="$(base64 -w0 ../ca/root-ca.key)" \
PORT=8443 STATIC_PORT=8080 ./b1steam-locketgold
```

Test nhanh:

```bash
curl -k https://127.0.0.1:8443/healthz
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/B1sTeam-LocketGold.mobileconfig -o profile.mobileconfig
```

> Muốn MITM thật, DNS phải trỏ host trong allow-list về IP máy chạy proxy (hoặc dùng DoH của B1sTeam).

---

## 6. Cấu trúc thư mục

```
proxy/
├── main.go                  # entrypoint: TLS listener + reverse proxy + health + shutdown
├── static.go                # static HTTP server (:8080) + sinh .mobileconfig runtime
├── proxy_test.go            # unit test (stdlib only)
├── go.mod                   # module github.com/nhb-1201/public_b1s_locket (go 1.22)
├── Dockerfile               # golang:1.22-alpine → alpine:3.20, CGO_ENABLED=0
├── fly.toml                 # app b1steam-locketgold · sin · tcp 443→8443 · http 80→8080
├── README.md
├── config/config.go         # cấu hình env-driven
├── tls/ca.go                # Root CA ECDSA P-256 + forge leaf (multi-SAN, 397 ngày)
├── tls/cache.go             # cache cert thread-safe (TTL + LRU-ish)
└── handler/
    ├── revenuecat.go        # inject entitlement Gold (idempotent)
    ├── firebase.go          # inject flag Gold/VIP + merge catalog frame
    ├── locket_api.go        # unblur + xoá paywall + badge Gold
    ├── photobooth.go        # mock generateFilteredImage + clean filter response
    ├── frames.go            # pool Worker Cloudflare (round-robin + health cache 60s)
    ├── frames_manifest.json # catalog khung B1sTeam
    └── ratelimit.go         # token bucket theo IP
```

---

## 7. Test

```bash
cd public_b1s_locket/proxy
go test ./...          # entitlement idempotent, unblur/badge, manifest, rate limit, CA SAN
```

B1sTeam — b1s.id.vn · Nguyen Hoang Bach
