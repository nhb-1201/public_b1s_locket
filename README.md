# 💎 LocketGold (Free) ✦ — B1sTeam

> **Shadowrocket MITM + DoH (bổ trợ) + Frames — Gold VIP vĩnh viễn 0₫.**
> Toàn bộ source do **B1sTeam** (Nguyễn Hoàng Bách) sở hữu và vận hành.
> Kiến trúc đơn giản: 1 app (Shadowrocket), 1 file (.conf), 1 phút — xong.
> DNS là khi bạn **muốn** chặn telemetry/ads toàn máy; không bắt buộc để Gold chạy.

**B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553**

---

## Kiến trúc

```

┌─ iPhone / iPad ────────────────────────────┐
│  Shadowrocket (App Store ID 932747118)      │
│   └─ alfretro-<tail>.conf                   │  ← tải tại b1s.id.vn/locketvip
│       ├─ [MITM] hostname=Locket/RC/FC/...   │
│       ├─ [Script] 6 MITM scripts (v7.8.0)   │
│       └─ MITM CA của Shadowrocket           │  ← bạn tự tạo & tự tin trên máy bạn
└────────────────┬────────────────────────────┘
                 │ HTTPS MITM on-device (chứng thư bạn tin tưởng)
                 ▼
     ┌─────────────────┐  verify < 60 phút  ┌──────────────────────────┐
     │  Locket API     │ ◄──────────────── │ locket.b1s.id.vn         │
     │  RevenueCat     │                    │  D1: locketgold_licenses  │
     │  Firebase RC    │                    │  1 key = 1 tài khoản web  │
     └───────┬─────────┘                    └──────────────────────────┘
             │  POST generateFilteredImage (license + device auth)
             ▼
     ┌──────────────────────────────────────────────────┐
     │  Frame workers (4 accounts CF, round-robin+failover) │
     │  locket-filter-frame v2.0.0 (dual-auth)          │
     └──────────────────────────────────────────────────┘

┌─ Tầng DNS (bổ trợ, mọi lúc) ───────────────────┐
│  (.mobileconfig "B1sTeam DNS — LocketGold")     │
│   └─ DNSSettings → DoH: doh.b1s.id.vn/<token>   │
└─────────────────────────────────────────────────┘
```

**3 thành phần chính:**

| # | Thành phần | Vai trò |
|---|---|---|
| 1 | **Shadowrocket** (`ios/alfretro-allinone.conf` v7.8.0) | MITM / unlock Gold / kill ads + telemetry |
| 2 | **DoH** (worker `b1steam-dns` @ `doh.b1s.id.vn`) | RFC 8484 — blocklist 7 nhóm (telemetry/ads-global/ads-vn), pass-through Locket, fallback 1.1.1.1, stale-if-error 24h, **không log domain** |
| 3 | **Frame workers** (4 accounts CF) | Vẽ Khung Kawaii lên ảnh (round-robin, cooldown nếu lỗi) |

---

## Cài đặt (5 phút)

| Bước | Việc |
|---|---|
| 1 | Tải **Shadowrocket** trên App Store (ID 932747118, chính thức, ~$2.99 mua 1 lần) |
| 2 | Vô **b1s.id.vn/locketvip** → đăng nhập → bấm **Tải .conf** (license cá nhân nhúng sẵn) |
| 3 | Shadowrocket → Cấu hình → `alfretro-*.conf` → **HTTPS解密 → 生成证书 → 安装证书** |
| 4 | Cài đặt iPhone → Cài đặt tin cậy chứng nhận → **Shadowrocket CA** → Bật |
| 5 | Bật Shadowrocket (góc trên-phải) → mở Locket → đợi 5–10s → **Gold ✦ hiện** |

> **Khuyến nghị**: cài `.mobileconfig` bổ trợ (tại b1s.id.vn/dns hoặc gen `/locketvip`) — chặn ads/telemetry toàn máy kể cả khi Shadowrocket tắt.

---

## Full tính năng khả dụng

| Tuyến | Những gì sẽ bật |
|---|---|
| **RevenueCat** | Entitlement **Gold Lifetime 2099**, subscriptions (`locket_1600_1y`, `com.locket02.premium.yearly`), 4 dòng subscriptions, `Attention: B1sTeam Activated (Gold Lifetime)!` |
| **Firebase Remote Config** | `state=UPDATE`, `templateVersion=Date.now()`, 131 entries (`feature_gates`, `campaign_badges`, `feature_discovery_popup_config` v.v.) |
| **Locket API** | `badge=locket_gold`, `is_gold=true`, `is_locked=false`, `requires_gold=false`, `unlocked=true`, unblur |
| **generateFilteredImage** | Overlay (`khung_/pb_/photobooth/4cut/cmt_locket/sticker/`) → giữ nguyên; AI filters → frame worker |
| **changeProfileInfo** | Trả 200 tức thì badge Gold + Verified (không round trip) |
| **Ads/telemetry** | admob, doubleclick, appsflyer, adjust, moloco, criteo, amplitude, mixpanel, sentry.io, amp-api-edge → REJECT-DROP |
| **Groups** | 5 thành viên mỗi nhóm (Locket Gold) |
| **Streak Recovery** | Tự động bật |
| **Khung Kawaii** | 14 khung hiển thị trong ảnh/widget của bạn |

---

## Cấu trúc repo

```text
ios/            # Shadowrocket (v7.8.0) — nguồn chân lý Shadowrocket
  src/          # MITM scripts source (src/*.src.js) — KHÔNG sửa scripts/*.js
  scripts/      # OUTPUT generated (commit được; cache-bust qua file name .v7.8.0.js)
  alfretro-allinone.conf   # Nguồn chính
  locketgold.sgmodule      # GENERATED (build.mjs) — %APPEND% [MITM]
  conf.html / module.html  # Landing cute → /locketvip
  locketgold.mobileconfig  # Demo .mobileconfig bổ trợ DoH (cho ReadMe; .mobileconfig cá nhân gen bởi backend)
  README.md     # Hướng dẫn người dùng cuối
edge/           # B1sTeam Edge Gateway (workers 14.31, strict allowlist, zero logging)
frame-worker/   # locket-filter-frame v2.0.0 (dual auth)
assets/         # frames/stickers/icons/banners (CDN + RemoteConfig)
docs/           # ARCHITECTURE.md — chi tiết kỹ thuật
CHANGELOG.md / LICENSE.md / SECURITY.md / README.md
```

---

## Security (bảo mật)

1. **Shadowrocket CA trên máy bạn** — B1sTeam không bao giờ biết private key — không AI/server nào có thể thay hình.
2. `.conf` **cá nhân hóa** qua license key, server-side (`__LICENSE_KEY__` được thay lúc tải về; không public ở repo).
3. CDN HTTPS (`raw.githubusercontent.com`) + backend `locket.b1s.id.vn` custom domain HTTPS.
4. Verify `GET .../verify?key=&device_id=` **rate-limit 120 req/10min/key** + device deterministic id `mitm-<hash>`.
5. MITM allowlist: Locket/RC/FC/Firebase — **không app nào khác bị can thiệp**.
6. DoH: không log domain; đếm query tổng; REFUSED chỉ áp khi người dùng của token đó quá hạn mức.
7. Frame worker cần `x-b1s-proxy-key` **hoặc** `x-b1s-license` + `x-b1s-device` (device-bound 60 phút).

---

## Giới hạn & rủi ro (trung thực)

- Chỉ **iOS/iPadOS**. Android không chạy được MITM → không có Gold.
- App Store chính thức (~$2.99, 1 lần duy nhất).
- Locket thay đổi API → MITM scripts cần cập nhật (`updateInterval=43200` = 12h, tự update).
- B1sTeam **không liên kết** với Locket Labs / Apple / RevenueCat / Google.
- Không phá khóa ga/non-Locket — chỉ ảnh hưởng các hostname trong `.conf` allowlist.

---

© 2026 **Nguyễn Hoàng Bách — B1sTeam** — xem [`LICENSE.md`](LICENSE.md) — báo lỗ hổng: `nhb.b1steam@gmail.com` / Zalo 083.3399.553
