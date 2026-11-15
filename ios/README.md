# LocketGold (Free) ✦ — iOS (Shadowrocket) — B1sTeam v7.8.0

> B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách

## Cài từng bước (10 bước — 5 phút, khớp b1s.id.vn/locketvip)

1. **Cài Shadowrocket** — App Store (ID 932747118, ~$2.99 — mua 1 lần).
2. **Tải .conf của bạn** — [b1s.id.vn/locketvip](https://b1s.id.vn/locketvip) → đăng nhập → **Kích hoạt free** → **Tải .conf** (key nhúng sẵn; `.conf` / `.sgmodule` đều được).
3. **HTTPS解密 (MITM)** — Cấu hình → `alfretro-*` → (i) → **HTTPS解密** BẬT (hostnames Locket · RevenueCat · Firebase).
4. **Tạo chứng chỉ Shadowrocket CA** — trong Shadowrocket: HTTPS解密 → **Certificate → Generate** (~2s).
5. **Cài hồ sơ chứng chỉ** — Safari → **Cài đặt → Cài đặt chung → VPN và quản lý thiết bị** → **Shadowrocket Root CA** → Cài đặt → nhập mã máy → Xong.
6. **Tin cậy chứng nhận (BẮT BUỘC)** — **Cài đặt → Cài đặt chung (General) → Giới thiệu (About) → Tin cậy chứng nhận (Certificate Trust Settings)** → bật **Shadowrocket Root CA** → Tiếp tục.
7. **Bật VPN** — tab **Home** → gạt **BẬT** → iOS hỏi cho phép thêm cấu hình VPN → **Cho phép**.
8. **Xóa Locket → tải lại** — xóa hẳn, tải lại từ App Store, đăng nhập lại bằng Apple/Google ID cũ.
9. **Mở Locket → Gold ✦** — đợi 5–10s → huy hiệu Gold, 60s video, caption, khung Kawaii, Widget Gold, 0 quảng cáo.
10. **Cần DNS?** — nếu Locket / B1sTeam hiện yêu cầu: [b1s.id.vn/locketvip#dns](https://b1s.id.vn/locketvip#dns) → **Cấp DNS riêng** → tải **B1sTeam-DNS.mobileconfig** → Cài đặt → quay lại Locket → **sau đó mới được tắt VPN.**

> Xong ✦ Gold vĩnh viễn 0₫. Giữ VPN bật khi dùng Locket; tắt VPN chỉ an toàn khi DoH đã cài. File .conf chứa license riêng — không chia sẻ. Đổi máy → lặp lại bước 3 → 6.

## Build (dành cho B1sTeam)

```
node ios/build.mjs          # src → scripts/*.js + locketgold.sgmodule
node ios/build.mjs --check  # CI: exit 1 nếu output chưa build lại
```

- Sửa **`ios/src/**`** (bao gồm `src/lib/license-gate.js` — license gate dùng chung), KHÔNG sửa `scripts/*.js` (generated).
- `locketgold.sgmodule` sinh từ `alfretro-allinone.conf` — chỉ sửa `.conf`, module tự đồng bộ.

## File trong thư mục này

```
ios/
├─ alfretro-allinone.conf     # Cấu hình Shadowrocket All-In-One (nguồn chân lý)
├─ locketgold.sgmodule        # Module Shadowrocket (GENERATED — %APPEND% ở [MITM])
├─ locketgold.conf            # Bản tĩnh LocketGold-only (legacy)
├─ locketgold.mobileconfig    # Profile DNS Split DNS qua doh.b1s.id.vn (iOS 14+)
├─ build.mjs                  # Build tool (inline lib → scripts + sinh module)
├─ src/                       # NGUỒN script MITM
│  ├─ lib/                      # license-gate.js (fail-closed gate) + cdn-arg.js
│  ├─ *.src.js                  # mã nguồn từng script
│  └─ _*.fragment.js            # dữ liệu (B1S_CONFIGS / FORCE_ENTRIES)
├─ scripts/                   # OUTPUT (GENERATED)
│  ├─ locketgold_remote.js      # Remote Config premium flags (~196 entries)
│  ├─ locketgold_profile.js     # badge Gold + paywall filter + unblur
│  ├─ locketgold_filters.js     # ép vùng US + unblur + forward overlay → khung Kawaii
│  ├─ locketgold_deleteHeader.js# xoá ETag/If-None-Match (không cần license gate)
│  ├─ b1s_unlock.js             # engine MITM chung cho 21 app Premium
│  ├─ b1s_youtube.js            # YouTube (InnerTube)
│  └─ b1s_spotify.js            # Spotify (Protobuf engine tự viết)
├─ module.html                # Trang chuyển hướng → cài Module (noindex)
├─ conf.html                  # Trang chuyển hướng → cài Config (noindex)
└─ .htaccess                  # Apache: CORS + MIME types + cache headers
```

> **v7.0 (2026-11-13):** rewrite toàn bộ JS (license gate dùng chung 1 nguồn), module sinh từ
> `.conf` (không lệch), DNS v7.0 (bỏ chặn nhầm vnexpress/fpt/zing; bỏ anti-revoke RevenueCat —
> MITM đã xử lý; `.conf` sửa `[MITM]` thành cú pháp chuẩn (bỏ `%APPEND%`/`enable = true` của
> `.module`), bỏ `%APPEND%` khỏi `.conf` legacy.

## Ghi chú license

> File **`.conf` / `.sgmodule`** được sinh từ **b1s.id.vn/locketvip** chứa sẵn license key của bạn — **không chia sẻ**.
> Script cũng tự verify key khi chạy (không license → trả nguyên body, không bơm cờ nào).
