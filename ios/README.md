# LocketGold (Free) — iOS (Shadowrocket) · B1sTeam

> **Nguồn chân lý: `shadowrocket/`** — bộ script + module đã được viết lại toàn bộ trong v4.0.0 (12 script tách lớp, 5 định dạng module).
> Thư mục `ios/` giữ các file tương thích ngược (Module/cấu hình/.mobileconfig mẫu).
> Bản cài 1 chạm qua b1s.id.vn/locketvip luôn phát hành từ `shadowrocket/`.
>
> ⭐ **Phương Thức 1 (DNS — khuyến dùng)**: chỉ cần cài `.mobileconfig` (Root CA + DoH) → bật Root CA trong Cài đặt gốc chứng chỉ → xóa Locket tải lại → Gold ✦. Không cần Shadowrocket.
> Phương Thức 2 (Shadowrocket — phụ) là tài liệu trong file này.
> Zalo 083.3399.553 · b1s.id.vn

# LocketGold (Free) — iOS (Shadowrocket)
## Phương Thức 2 — Shadowrocket (phụ, 10 bước)

1. **Cài Shadowrocket** — App Store (ID 932747118, ~$2.99 — mua 1 lần).
2. **Cài .conf** — [b1s.id.vn/locketvip](https://b1s.id.vn/locketvip) → đăng nhập → **Kích hoạt free** → **Cài .conf tự động qua Shadowrocket** (`shadowrocket://config/add/…`) — hoặc **Copy .conf URL** → Shadowrocket → **“+”** → **Cấu hình** → **Paste** → **Add** → “alfretro-*.conf” ✓.
3. **Chọn cấu hình + HTTPS解密 (MITM)** — Shadowrocket → tab **Cấu hình** → chọn **alfretro-*.conf** (check xanh) → (i) → **HTTPS解密** BẬT (hostnames Locket · RevenueCat · Firebase, đã có sẵn trong .conf — không cần module riêng).
4. **Tạo chứng chỉ Shadowrocket CA** — trong Shadowrocket: HTTPS解密 → **Certificate → Generate** (~2s).
5. **Cài hồ sơ chứng chỉ** — Safari → **Cài đặt → Cài đặt chung → VPN và quản lý thiết bị** → **Shadowrocket Root CA** → Cài đặt → nhập mã máy → Xong.
6. **Tin cậy chứng nhận (BẮT BUỘC)** — **Cài đặt → Cài đặt chung (General) → Giới thiệu (About) → Tin cậy chứng nhận (Certificate Trust Settings)** → bật **Shadowrocket Root CA** → Tiếp tục.
7. **Bật VPN** — tab **Home** → chọn **alfretro-*.conf** → chạm bật cấu hình → iOS hỏi cho phép thêm cấu hình VPN → **Cho phép** → status bar hiện **VPN**. Không thấy gì? → tab Cấu hình → “alfretro-*.conf” BẬT + (i) → **HTTPS解密** → lặp lại bước 4–6.
8. **Xóa Locket → tải lại** — xóa hẳn, tải lại từ App Store, đăng nhập lại bằng Apple/Google ID cũ.
9. **Mở Locket → Gold ✦** — đợi 5–10s → huy hiệu Gold, 60s video, caption, khung Kawaii, Widget Gold, 0 quảng cáo.
10. **Cài DNS riêng (DoH) — bước cuối, bổ trợ** — Bước 10 trên [b1s.id.vn/locketvip#cai-dat](https://b1s.id.vn/locketvip#cai-dat) → **Cấp DNS**: NextDNS riêng (300k truy vấn / 30 ngày) + DoH RFC 8484 → tải `.mobileconfig` → Cài đặt. Shadowrocket vẫn là đường mở Gold; DoH chỉ bổ trợ.

> Xong ✦ Gold vĩnh viễn 0₫. Giữ VPN bật khi dùng Locket. File .conf chứa license riêng — không chia sẻ. Đổi máy → lặp lại bước 3 → 6.

## Build (dành cho B1sTeam)

```
node ios/build.mjs          # src → scripts/*.js
node ios/build.mjs --check  # CI: exit 1 nếu output chưa build lại
```

- Sửa **`ios/src/**`** (bao gồm `src/lib/license-gate.js` — license gate dùng chung), KHÔNG sửa `scripts/*.js` (generated).
- `ios/alfretro-allinone.conf` là **file cài chính** (v7.8.2) — backend `/api/v2/locketgold/config/alfretro?key=` đọc file này và nhúng key trước khi phát hành.
- `ios/locketgold.sgmodule` là bản **tương thích** (source-of-truth riêng cho module, `%APPEND%` ở [MITM]) — giữ cho người đã cài dạng Module; bản cài mới nên dùng `.conf`.

## File trong thư mục này

```
ios/
├─ alfretro-allinone.conf     # Cấu hình Shadowrocket All-In-One (nguồn chân lý)
├─ locketgold.sgmodule        # Module Shadowrocket (source-of-truth — %APPEND% ở [MITM])
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

> File **`.module`** (hoặc `.conf`) được sinh từ **b1s.id.vn/locketvip** chứa sẵn license key của bạn — **không chia sẻ**.
> Script cũng tự verify key khi chạy (không license → trả nguyên body, không bơm cờ nào).
