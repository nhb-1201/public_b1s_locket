# Proxy MITM — B1sTeam

Proxy TLS giả mạo (MITM) chạy phía máy chủ, dùng để **ghi đè phản hồi API** của
Locket / RevenueCat / Firebase Remote Config.

Không phải proxy đầy đủ cho toàn bộ traffic của máy — chỉ MITM đúng những hostname cần thiết.

---

## 1. Cơ chế

```
Thiết bị (đã cài Root CA)
   │  SNI: api.locketcamera.com
   ▼
Proxy (leaf cert ký bằng Root CA trong hồ sơ .mobileconfig)
   │  ModifyResponse: ghi đè body
   ▼
API thật
```

- `tls/ca.go` — nạp Root CA, cấp leaf certificate.
- `tls/cache.go` — cache leaf theo SNI (TTL để không cấp lại liên tục).
- `handler/` — logic ghi đè theo từng host.

## 2. Handler

| File | Phạm vi | Việc làm |
|---|---|---|
| `handler/firebase.go` | `firebaseremoteconfig.googleapis.com` | Ép toàn bộ feature gate (`can_record_60s_video`, `ai_filters`, `profile_badge`…) + catalog filter |
| `handler/revenuecat.go` | `api.revenuecat.com` | Gắn entitlement `Gold` + `subscriptions` vĩnh viễn (`expires_date` 2099) |
| `handler/locket_api.go` | `*.locketcamera.com` | Badge Gold, `is_locked=false`, bỏ paywall 400/402/403, gỡ blur ảnh |
| `handler/photobooth.go` | `*/generateFilteredImage` | Trả 200 với ảnh gốc; khung vẽ bởi frame worker |
| `handler/assets.go` | – | Cấu hình CDN static cho catalog filter |

## 3. Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `ROOT_CA_CRT` | ✔ (nếu không mount `ca/`) | `ca/root-ca.crt` | Root CA (PEM) |
| `ROOT_CA_KEY` | ✔ (nếu không mount `ca/`) | `ca/root-ca.key` | Private key của Root CA |
| `PROXY_SHARED_KEY` | ✔ | – | Secret chia sẻ với frame worker (`x-b1s-proxy-key`). Không có key → `/apply-frame` luôn 403 |
| `ASSET_CDN_BASE` | – | `https://frame.b1s.id.vn/assets` | Base URL cho sticker/frame trong catalog filter |
| `FRAME_WORKER_URL` | – | `https://frame.b1s.id.vn` | Worker vẽ khung ảnh (`generateFilteredImage`) |
| `PORT` | – | `8443` | Cổng TLS |

> Worker `/apply-frame` chỉ nhận request có header `x-b1s-proxy-key`. Giá trị `PROXY_SHARED_KEY`
> ở proxy phải trùng secret `PROXY_SHARED_KEY` của `locket-filter-frame` (đặt `wrangler secret put PROXY_SHARED_KEY`).

## 4. Deploy (Fly.io)

```bash
fly launch --no-deploy
fly secrets set ROOT_CA_CRT="$(cat ../ca/root-ca.crt)" \
                ROOT_CA_KEY="$(cat ../ca/root-ca.key)" \
                PROXY_SHARED_KEY="$(openssl rand -hex 32)"
fly deploy
```

## 5. Kiểm tra nhanh

```bash
# CA đúng định dạng?
openssl x509 -in ca/root-ca.crt -noout -subject -dates

# Proxy còn sống?
curl -k https://<proxy-host>:8443/healthz
```

## 6. Lưu ý vận hành

- **Root CA phải ổn định.** Đổi CA ⇒ mọi máy đã cài hồ sơ phải cài lại từ đầu.
- `camera_filter_config.json` được `go:embed` ⇒ thay đổi file cần rebuild image.
- `ASSET_CDN_BASE` chỉ nên trỏ tới nơi **bạn kiểm soát** — đừng phụ thuộc worker của người khác.


---

## 6. Ban Python chay that (B1sTeam, port 443 + Task Scheduler)

> Go/Fly.io cua muc 4 la kien truc cu (Fly machine chet, khong co credentials trong may). Ban Python
> la runtime hien tai, tu ky leaf theo SNI bang B1sTeam Root CA, khong phu thuoc Fly.

### Cau truc
| File | Tac dung |
|---|---|
| `python/mitm_proxy.py` | MITM proxy: peek ClientHello lay SNI -> ky leaf (B1sTeam Root CA) -> TLS -> HTTP: ghi de RC/FC/Locket responses, ve khung qua frame worker, /healthz |
| `python/firebase_overrides.py` | 131 override RemoteConfig (generated tu Go source) |
| `watchdog.py` | Giu proxy song: poll process, health-check /healthz moi 600-900s ngau nhien (qua SNI hop le + B1sTeam CA), restart khi chet/sai 2 lan lien tiep |
| `Install-AutoStart.ps1` | Dang ky Task Scheduler `B1sTeam-Proxy-Watchdog` (ONSTART, SYSTEM, restart 999 lan neu fail) |
| `proxy.env` (gitignored) / `proxy.env.example` | PROXY_SHARED_KEY cho frame worker, PORT, BIND |

### Chay
```powershell
python mitm_proxy.py            # thu cong (PORT/BIND doc tu env)
python watchdog.py              # watchdog (Task Scheduler tu goi)
schtasks /run /tn B1sTeam-Proxy-Watchdog   # start tay
powershell -ExecutionPolicy Bypass -File .\Install-AutoStart.ps1   # cai auto-start
powershell -ExecutionPolicy Bypass -File .\Install-AutoStart.ps1 -Remove   # go auto-start
```

### Trang thai
- Proxy chay o `0.0.0.0:443`, thiet bi trong WiFi LAN (vd iPhone, PC 192.168.1.212) tro toi day khi DNS
  tra ve IP nay.
- `.mobileconfig` (B1sTeam DNS — LocketGold) chua B1sTeam Root CA -> may tu tin leaf cua proxy.
- Log: `proxy/watchdog.log` (xoay vong 5MB).
- **Chua cau hinh DNS cong khai**: doh.b1s.id.vn can tro toi resolver worker (branch `backend` cua
  b1steam_web) hoac router/DHCP phan phoi DNS. DoH nay phai tra ve IP proxy (LAN 192.168.1.212 cho
  WiFi, hoac IP public khi co).
