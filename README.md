# 💎 LocketGold (Free) ✦ — B1sTeam

> **Shadowrocket MITM + Frames — Gold VIP vĩnh viễn 0₫.**
> Toàn bộ source do **B1sTeam** (Nguyễn Hoàng Bách) sở hữu và vận hành.
> Kiến trúc đơn giản: 1 app (Shadowrocket), 1 file (.conf), 5 phút — xong.
> **DoH / DNS riêng đã gỡ khỏi hướng dẫn người dùng** (2026-11-15) — Shadowrocket MITM là đường duy nhất.

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
```

**2 thành phần chính:**

| # | Thành phần | Vai trò |
|---|---|---|
| 1 | **Shadowrocket** (`ios/alfretro-allinone.conf` v7.8.0) | MITM / unlock Gold / kill ads + telemetry |
| 2 | **Frame workers** (4 accounts CF) | Vẽ Khung Kawaii lên ảnh (round-robin, cooldown nếu lỗi) |

<details><summary>Hạ tầng DoH (không cần cho người dùng cuối)</summary>

DoH worker `b1steam-dns` (doh.b1s.id.vn, RFC 8484) vẫn chạy production cho mục đích nội bộ/kỹ thuật,
nhưng **người dùng không cài .mobileconfig và không cần tài khoản NextDNS riêng nữa** — đã gỡ khỏi toàn bộ hướng dẫn người dùng (2026-11-15). MITM on-device là đường duy nhất.

</details>

---

## Cài đặt từng bước (9 bước — 5 phút)

1. **Cài Shadowrocket** — App Store → tìm **Shadowrocket** (ID 932747118, ~$2.99 — mua 1 lần). App chính thức của App Store, không jailbreak.
2. **Tải .conf của bạn** — vô **b1s.id.vn/locketvip** → đăng nhập → bấm **Kích hoạt free** → bấm **Tải .conf** (license đã nhúng sẵn; file `alfretro-*.conf` / `.sgmodule` — cả 2 đều đọc được). *Trên web: bấm ngay Bước 2 trong phần “Hướng dẫn từng bước” — file tải về kèm hướng dẫn, tiến trình được nhớ tự động.*
3. **Bật HTTPS giải mã (MITM)** — Shadowrocket → tab **Cấu hình** → chạm vào file vừa tải → nút **(i)** → **HTTPS解密 (HTTPS Decryption)**: BẬT, hostnames giữ nguyên (Locket · RevenueCat · Firebase).
4. **Tạo chứng chỉ Shadowrocket CA** — trong Shadowrocket: HTTPS解密 → **Certificate → Generate** → đợi ~2s — chứng chỉ gốc được tạo ngay trên máy bạn.
5. **Cài hồ sơ chứng chỉ** — Safari tự mở “Hồ sơ đã tải” → **Cài đặt → Cài đặt chung → VPN và quản lý thiết bị** → chọn **Shadowrocket Root CA** → **Cài đặt** → nhập mật mã → **Xong**.
6. **Tin cậy chứng nhận (BẮT BUỘC)** — **Cài đặt → Cài đặt chung (General) → Giới thiệu (About) → Tin cậy chứng nhận (Certificate Trust Settings)** → bật **Shadowrocket Root CA** → **Tiếp tục**. Thiếu bước này → Gold **không** hiện.
7. **Bật VPN** — Shadowrocket → tab **Home** → gạt lên **BẬT** → iOS hỏi “Cho phép cấu hình VPN?” → **Cho phép** → biểu tượng **VPN** hiện trên status bar.
8. **Xóa Locket → tải lại** — xóa hẳn Locket khỏi máy → App Store → tải lại **Locket** → đăng nhập lại bằng Apple ID / Google cũ — app sẽ đọc lại entitlement Gold vừa được MITM.
9. **Mở Locket → Gold ✦** — đợi 5–10 giây → huy hiệu Gold ✦, video 60s · 163+ caption · khung Kawaii · Widget Gold · 0 quảng cáo. **Hoàn thành ✦**

> Xong ✦ Gold vĩnh viễn 0₫. Giữ VPN bật khi dùng Locket. File `.conf` chứa license riêng của bạn — không chia sẻ. Đổi máy / mất cert → lặp lại bước 3 → 6.
>
> **DoH / DNS riêng đã gỡ khỏi hướng dẫn** (2026-11-15): người dùng không cần cài `.mobileconfig` hay tài khoản NextDNS riêng nữa — Shadowrocket MITM là đường duy nhất cần thiết.

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
  locketgold.mobileconfig  # [legacy] .mobileconfig demo — DoH đã gỡ khỏi hướng dẫn người dùng (2026-11-15)
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
6. DoH (nội bộ/kỹ thuật, không dành cho người dùng cuối): không log domain; đếm query tổng; REFUSED chỉ áp khi người dùng của token đó quá hạn mức.
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
