# LocketGold (Free) ✦ — iOS (Shadowrocket) — B1sTeam v7.8.0

> B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách

## Cách cài hiện tại (khuyến nghị)

1. Vào **[b1s.id.vn/locketvip](https://b1s.id.vn/locketvip)** → đăng nhập tài khoản B1sTeam.
2. Vào **[b1s.id.vn/da-kich-hoat](https://b1s.id.vn/da-kich-hoat)** → bấm **Kích hoạt miễn phí** (0₫, vĩnh viễn).
3. Bấm **Tải file .conf về máy** — Shadowrocket tự nhận `alfretro-<tail>.conf` (key của bạn nhúng sẵn,
   gồm toàn bộ script LocketGold + 23 App Premium + DoH).
   *(Nếu .conf lỗi trên máy → bấm "Cài module (dự phòng)" ngay bên dưới — Shadowrocket module, gộp y hệt.)*
4. **Bật Shadowrocket** → xoay lỗi Locket → **Gold VIP ✦**.

> File .conf/module đã gồm: script **LocketGold VIP** + **23 App Premium** + **DNS chống trả phí nhầm** (DoH B1sTeam) + chặn quảng cáo/telemetry — **một file duy nhất**, không cần cài thêm gì.

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

## Hướng dẫn cài từng bước (iOS + Shadowrocket)

1. **Cài Shadowrocket** từ App Store (~72.000₫ mua 1 lần — app của bên thứ ba, B1sTeam không phát hành lại).
2. **HTTPS解密**: *Cấu hình* → nút **(i)** cạnh config → bật **HTTPS Decrypt**.
3. **Tạo CA**: *CA Certificate* → **Generate New CA** → **Install CA to system** → Safari mở, bấm **Allow**.
4. **Cài profile**: *Settings → Downloaded Profile* → chọn profile Shadowrocket → **Install** → nhập passcode.
5. **Tin cậy root**: *Settings → General → About → Certificate Trust Settings* → bật Shadowrocket → **Continue**.
6. **Bật VPN & mở app**: tab **Home** → gạt kết nối **ON** → vuốt tắt Locket khỏi đa nhiệm → mở lại → **Gold VIP ✦**.

> **Config/module do b1s.id.vn/da-kich-hoat sinh** chứa sẵn license key của bạn — **không chia sẻ**.
> Script cũng tự verify key khi chạy (không license → trả nguyên body, không bơm cờ nào).
