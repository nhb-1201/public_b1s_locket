# LocketGold — iOS (Shadowrocket) — B1sTeam · v6.0

> B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách

## Cách cài hiện tại (khuyến nghị)

1. Vào **[b1s.id.vn/alfretro](https://b1s.id.vn/alfretro)** → Đăng nhập tài khoản B1sTeam.
2. Vào **[b1s.id.vn/da-kich-hoat](https://b1s.id.vn/da-kich-hoat)** → bấm **Kích hoạt miễn phí** (0₫, vĩnh viễn).
3. Bấm **Cài module duy nhất** — Shadowrocket tự mở file `.module` có nhúng key của bạn.
4. Bấm **Dùng (Use)** cho module → xoay lại Locket → **Gold VIP ✦**.

> Module chứa sẵn: script **LocketGold VIP** + **23 App Premium** + **DNS chống thu hồi** (DoH B1sTeam) + chặn quảng cáo/telemetry — **một file duy nhất**, không cần cài thêm gì.

## File trong thư mục này

```
ios/
├── locketgold.mobileconfig   # Profile DNS chống thu hồi (Split DNS qua doh.b1s.id.vn, iOS 14+)
├── locketgold.conf         # Config Shadowrocket tĩnh (phiên bản mở khóa LocketGold — script từ repo tự host)
├── module.html             # Trang chuyển hướng → cài Module (noindex)
├── conf.html               # Trang chuyển hướng → cài Config (noindex)
├── .htaccess               # Apache: CORS + MIME types + cache headers
└── scripts/
    ├── locketgold_revenuecat.js   # entitlement Gold (chỉ máy đã verify key)
    ├── locketgold_deleteHeader.js # Xoá ETag/If-None-Match → luôn nhận entitlement mới nhất
    ├── locketgold_remote.js       # Remote Config premium flags (248 entries)
    ├── locketgold_profile.js      # badge Gold + mở khoá paywall filter + unblur
    ├── locketgold_filters.js      # ép vùng US + unblur ảnh + xóa cache
    ├── b1s_unlock.js              # engine MITM chung cho 21 app Premium
    ├── b1s_youtube.js             # YouTube (InnerTube) của B1sTeam
    └── b1s_spotify.js             # Spotify (Protobuf engine tự viết)
```

> **v6.0 (2026-11-12):** config/static files đồng bộ với module do worker sinh:
> `#hostname` scoping, DNS DoH B1sTeam, `[Host]` chặn Firebase realtime RC, **không còn `FINAL,DIRECT`**
> (mọi traffic cần MITM sẽ qua PROXY — từ đây script mới chạy được).

## Hướng dẫn cài từng bước

1. **Cài Shadowrocket** từ App Store (~72.000₫ mua 1 lần — app của bên thứ ba, B1sTeam không phát hành lại).
2. **HTTP Decryption**: *Cấu hình* → nút **(i)** cạnh config → bật **HTTPS Decrypt**.
3. **Tạo CA**: *CA Certificate* → **Generate New CA** → **Install CA to system** → Safari mở, bấm **Allow**.
4. **Cài profile**: *Settings → Downloaded Profile* → chọn profile Shadowrocket → **Install** → nhập passcode.
5. **Tin cậy root**: *Settings → General → About → Certificate Trust Settings* → bật shadowrocket → **Continue**.
6. **Bật VPN & mở app**: tab **Home** → gạt kết nối **ON** → vuốt tắt Locket khỏi đa nhiệm → mở lại → **Gold VIP ✦**.

> **Module/config do b1s.id.vn/da-kich-hoat sinh** chứa sẵn license key của bạn — **không chia sẻ**.
> Script cũng tự verify key khi chạy (không license → trả nguyên body, không bơm cờ).
