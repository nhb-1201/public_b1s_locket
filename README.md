# 💎 LocketGold (Free) ✦ — B1sTeam

> **Shadowrocket + MITM + DoH — Gold VIP vĩnh viễn 0₫.** Bản chính thức, đang chạy (v7.8.0).
> Toàn bộ source do **B1sTeam** (Nguyễn Hoàng Bách) sở hữu và vận hành.

LocketGold là bộ mở khóa tính năng Gold của app **Locket** chạy ngay trên chiếc iPhone của bạn:
bạn tự cài Shadowrocket, tự cài hồ sơ `.conf` của riêng bạn (license cá nhân hóa),
phần còn lại chạy qua hạ tầng B1sTeam. Không jailbreak, không account của người khác, không lộ dữ liệu.

**B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553**

---

## 1. Bạn nhận được gì

| # | Đặc quyền | Chi tiết |
|---|---|---|
| 1 | 🎥 Video 60 giây @ 1080p | Camera ultra-wide / tele / flash, upsize không watermark |
| 2 | 🏅 Huy hiệu Gold | Vĩnh viễn, trên hồ sơ cá nhân |
| 3 | ✅ Tích xanh Verified | Hiển thị client-side |
| 4 | 🎞️ Camera Roll 60s | Upload thẳng từ Camera Roll |
| 5 | ✏️ Captions cao cấp (163+) | General / Holiday / GenZ / Meme / Kawaii |
| 6 | 🎨 Icon & Camera Themes | 10 theme mùa, không watermark |
| 7 | 🖼️ 14 khung Kawaii + Widget | Crayon / Gold / Valentine / Noel / Halloween / Neon / Pastel |
| 8 | 🚫 0 quảng cáo | Locket + telemetry (Firebase/ads) bị chặn |
| 9 | 👁️ Locket Views | Biết ai đã xem moments của bạn |
| 10 | 🔥 Streak Recovery | Tự khôi phục chuỗi ngày đã mất |
| 11 | 🛡️ Nhóm & Shaking Recovery | 5 người / nhóm, shake recovery Hội đồng |

---

## 2. Kiến trúc (đang chạy production)

```

┌─ iPhone / iPad ─────────────────────────────┐
│  Shadowrocket (App Store, ID 932747118)      │
│   └─ .conf LocketGold (license cá nhân hóa)  │  ← tải tại b1s.id.vn/locketvip
│       ├─ [MITM] hostname=Locket/RC/FC/...    │
│       └─ [Script] 6 MITM scripts (v7.8.0)    │
└──────────────┬───────────────────────────────┘
               │ HTTPS MITM *trên đúng máy bạn*
               ▼
   ┌──────────────┐   verify  < 60 min   ┌──────────────────────┐
   │  Locket API  │ ◄────────────────── │ locket.b1s.id.vn     │  verify license (device-bound)
   │  RevenueCat  │                      │  D1: locketgold_licenses │  1 key = 1 tài khoản web
   │  Firebase RC │                      └──────────────────────┘
   └──────┬───────┘
          │  GET /apply-frame (ký x-b1s-license + x-b1s-device)
          ▼
   ┌───────────────────────────────────────────────────────┐
   │ 4 frame workers (B1s-locket02 / edge-03 /beslin /edge-05)  │
   │ Round-robin ngẫu nhiên + failover tự động              │
   └───────────────────────────────────────────────────────┘

```

- **MITM trên máy bạn** (không server trung gian giải mã) — cert do chính máy bạn tạo.
- **DoH (DNS-over-HTTPS, RFC 8484)**: `.mobileconfig` riêng → `doh.b1s.id.vn` chặn quảng cáo/telemetry triệt để ở tầng DNS, kể cả khi Shadowrocket tắt.
- **Frames**: 4 edge workers phân tải theo Fisher-Yates random + failover khi 1 edge lỗi.

---

## 3. Cài đặt (5 phút)

| Bước | Việc | Không làm được? |
|---|---|---|
| 1 | Tải **Shadowrocket** trên App Store (ID 932747118, chính thức, ~$2.99 mua 1 lần) | Chỉ cài từ App Store chính thức |
| 2 | Vô **b1s.id.vn/locketvip** → đăng nhập → bấm "Tải .conf" (key cá nhân sẵn bên trong) | Kiểm tra hộp thư / báo Zalo nếu chưa có key |
| 3 | Cấu hình Shadowrocket → Cấu hình → .conf → **HTTPS解密 → 生成证书 → 安装证书** | Cài hồ sơ trên Cài đặt iPhone → Giới thiệu → Cài đặt tin cậy |
| 4 | Bật Shadowrocket (góc trên-phải) → mở Locket → đợi 5-10s → **Gold ✦ hiện** | Nếu chưa thấy: Cài đặt Locket → "Khôi phục gói mua" |

> **Khuyến cáo**: cài luôn `.mobileconfig` sau khi Gold hoạt động — chặn quảng cáo + telemetry toàn máy khi online.

---

## 4. Full tính năng khả dụng

| Tuyến | Những gì sẽ bật |
|---|---|
| RevenueCat | Entitlement **Gold Lifetime 2099**, subscriptions (`locket_1600_1y`, `com.locket02.premium.yearly`), 4 dòng subscriptions, `Attention: B1sTeam Activated (Gold Lifetime)!` |
| Firebase Remote Config | `state=UPDATE`, `templateVersion=Date.now()`, 131 entries (`feature_gates`, `campaign_badges`, `feature_discovery_popup_config` v.v.), cache bị vô hiệu hóa |
| Locket API (cloudfunctions) | `badge=locket_gold`, `is_gold=true`, `is_locked=false`, `requires_gold=false`, `unlocked=true`, `is_premium=true`, blurred → clean |
| changeProfileInfo | Trả 200 tức thì badge Gold + Verified (không round trip) |
| generateFilteredImage | Overlay (`khung_/pb_/photobooth/4cut/cmt_locket/sticker`) → giữ nguyên ảnh; AI filter → frame worker |
| Ads/telemetry | admob, doubleclick, appsflyer, adjust, moloco, criteo, amplitude, mixpanel, sentry.io, amp-api-edge → REJECT-DROP |
| Groups | 5 thành viên / nhóm, sức chứa Gold |
| Streak Recovery | Tự động bật, không cần thao tác |
| Hashtag AI / Foto | Qua Remote Config `ai_filters` mở khóa |

---

## 5. Security (bảo mật)

1. **Shadowrocket CA của bạn** sinh trên máy — B1sTeam **không bao giờ** giữ bản key hoặc certmit your cert của bạn. CA private key không đi ra khỏi thiết bị.
2. **`.conf` được cá nhân hóa** bằng license key của tài khoản bạn (`__LICENSE_KEY__` được thay server-side lúc download, không nằm trên GitHub).
3. **HTTPS everywhere** — CDN raw.githubusercontent là HTTPS; backend locket.b1s.id.vn là custom domain HTTPS (không qua WAF zone proxy → UA ứng dụng không bị chặn).
4. **Verify endpoint rate-limit 120 req / 10 phút / key** + device-bound deterministic id (`mitm-<hash>`) → không thể spamverify ngần ngạt máy chủ.
5. **MITM chỉ mở khóa Locket** — không API nào được can thiệp xuyên ứng dụng khác (allowlist cứng: locket/RC/Firebase/cloudfunctions).
6. **DoH**: `doh.b1s.id.vn` **không lưu log** truy vấn (đếm truy vấn tổng, không lưu hostname).
7. **Frame workers**: yêu cầu `x-b1s-proxy-key` (server-side) hoặc `x-b1s-license` + `x-b1s-device` (device-bound 60 phút) — từ chối mọi request lạ.
8. **Private CA** `ca/b1steam-root-ca.key` **không bao giờ được push** (gitignore) — chỉ public cert `.crt` được chia sẻ (dùng cho proxy LAN — không bắt buộc cho Shadowrocket).
9. **`.mobileconfig`** cũng tự sinh UUID deterministic từ access_token → cài lại không tạo payload trùng; không gửi dữ liệu về B1sTeam.

---

## 6. Giới hạn & rủi ro thật (trung thực)

- **Chỉ iOS/iPadOS**. Android không chạy được MITM → không có Gold trên Android.
- **App Store chính thức** (có phí, ~$2.99, một lần duy nhất, không subscription).
- Nếu Locket lõi API thay đổi cách xác thực, Gold có thể tự tắt → module tự cập nhật (`updateInterval=43200` = 12h) — cứ mở Locket, hệ thống tự vá.
- Nếu bạn **đổi license** → tải lại `.conf` (link cũ vô hiệu, file cũ fail-closed).
- B1sTeam **không liên kết** với Locket Labs / Apple / RevenueCat / Google/Firebase.
- Không phá khóa robotics/acting games/Server-side GA; không đọc được message bạn/của người khác.

---

## 7. Cấu trúc repo

```text
public_b1s_locket/
├── ios/                  # Shadowrocket MITM package (v7.8.0)
│   ├── alfretro-allinone.conf   # Nguồn: .conf chính (homepage = b1s.id.vn/locketvip)
│   ├── locketgold.sgmodule     # Module .sgmodule — GENERATED từ .conf (%APPEND%)
│   ├── locketgold.conf          # LocketGold-only legacy
│   ├── locketgold.mobileconfig  # Profile DoH (B1sTeam DNS)
│   ├── conf.html / module.html  # Landing cute → /locketvip
│   ├── README.md                # Guide iOS
│   ├── build.mjs                # Build tool (inline libs + sinh .sgmodule)
│   ├── src/                     # NGUỒN scripts (src/*.src.js + src/lib)
│   └── scripts/                 # OUTPUT GENERATED (scripts/*.v7.8.0.js) — committed
├── dns/                   # DoH Worker (RFC 8484) — doh.b1s.id.vn (optional)
├── proxy/                 # MITM proxy Python (LAN) + watchdog + Task Scheduler
├── frame-worker/          # 4 Cloudflare Workers (khung Kawaii + assets)
├── edge/                # Edge Gateway (failover relay cho frame worker)
├── ca/                    # B1sTeam Root CA (crt public; key gitignored)
├── assets/                # Khung/Icon/Banner (CDN + RemoteConfig)
├── scanner/               # Scanner (endpoint/host audit)
├── tools/                 # Gen assets
├── docs/                  # ARCHITECTURE.md
├── CHANGELOG.md
├── LICENSE.md
├── version.json           # repo meta (3.0.0)
└── README.md              # bạn đang đọc ✦
```

---

## 8. Triển khai

| Thành phần | Deploy |
|---|---|
| Module/scripts/CDN | push `main` (CDN tự update trong ~5 phút) |
| Backend `locket.b1s.id.vn` | `cd locketgold-backend && wrangler deploy` |
| DNS `doh.b1s.id.vn` | Branch `backend` của `b1steam_web` → CI |
| Frame workers | `wrangler deploy` trong `frame-worker/` (4 accounts, xem `wrangler.edge.toml`) |
| DoH PROFILE | tải `locketgold.mobileconfig` ở iPhone |

## 9. Credits

Toàn bộ module, scripts, assets và backend do **B1sTeam — Nguyễn Hoàng Bách** tự viết và vận hành.
Frames/images Kawaii gốc: chính Nguyễn Hoàng Bách biên tập. Upstream-assets tham khảo với thẩm quyền phù hợp tại `assets/upstream-archive/`.

© 2026 **Nguyễn Hoàng Bách — B1sTeam** — xem [`LICENSE.md`](LICENSE.md).
