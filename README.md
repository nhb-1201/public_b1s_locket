<!-- author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket -->

# 👑 LocketGold — B1sTeam v3.0

> **Mở khóa Locket Gold VIP vĩnh viễn — miễn phí 100% từ B1sTeam**
> 🌐 Trang chủ: <https://b1s.id.vn/locketgold> · 📢 Telegram: [@b1steam](https://t.me/b1steam)
> 🛠 Phát triển bởi **B1sTeam — Nguyễn Hoàng Bách** · 📦 Repo: <https://github.com/nhb-1201/public_b1s_locket>
> 🔢 Phiên bản: **3.0.0** (2026-11-09)

---

## 📥 Tải file cấu hình

Kể từ v4.0, LocketGold phát hành **file cá nhân hóa** (khóa đúng thiết bị — Device ID + mật khẩu ngẫu nhiên + hết hạn tự thu hồi) — tải từ trang đăng nhập, không dùng file public.

1. Vào <https://b1s.id.vn/locketgold> — đăng nhập.
2. Cài **V2Box** (iOS App Store / Android Google Play — miễn phí).
3. V2Box → Cài đặt → Thông tin → sao chép **Device ID** → dán vào trang → chọn gói (Thử 15 ngày / Vĩnh viễn).
4. Bấm **Tạo file cấu hình** → tải **locketgold-b1sdev.v2box** + mật khẩu ngẫu nhiên → mở trong V2Box → bật kết nối → Gold ✦.

### Hồ sơ DNS (tùy chọn — chống thu hồi thêm lớp)
- iOS: <https://b1s.id.vn/locketgold/ios/locketgold.mobileconfig> (Safari → Cài đặt)
- Android: Private DNS `doh.b1s.id.vn`

> Các file public cũ (.sgmodule/.conf/v2rayng/singbox) không còn là kênh phân phối chính — b1s.id.vn/locketgold mới là nơi phát hành file khóa thiết bị.

Hướng dẫn cài đặt đầy đủ từng bước: <https://b1s.id.vn/locketgold>

---

## ✨ LocketGold mở khóa gì?

| # | Tính năng | Trạng thái |
|---|-----------|:---:|
| 1 | Gói Locket Gold VIP 1 năm (gia hạn tự động → 9999) | ✅ |
| 2 | Huy hiệu Gold Badge | ✅ |
| 3 | App Icon & Camera Themes độc quyền | ✅ |
| 4 | Tải Album & Video 60s không giới hạn | ✅ |
| 5 | Locket Views — xem ai đã xem | ✅ |
| 6 | Chú thích dài & vô hạn bạn bè | ✅ |
| 7 | Khung Widget cao cấp | ✅ |
| 8 | Khôi phục chuỗi (Streak Recovery) | ✅ |
| 9 | Xóa 100% quảng cáo | ✅ |

## 📁 Cấu trúc repo

```
public_b1s_locket/
├── README.md                      # Tài liệu này (author: B1sTeam)
├── CHANGELOG.md                   # Lịch sử phiên bản
├── LICENSE.md                     # Giấy phép phát hành
├── .gitignore
├── assets/
│   ├── banner.svg                 # OG banner 1200×630
│   ├── icon-locketgold.svg        # Icon vương miện B1sTeam
│   ├── icon-doh-locketgold.svg    # Icon khiên DoH (profile DNS)
│   ├── icon-doh-locketgold-1024.png # Icon PNG 1024 (nhúng trong profile)
│   └── icon-locketgold-512.png    # Icon PNG 512 (nhúng trong Web Clip)
├── ios/
│   ├── locketgold.conf            # Shadowrocket Config (MITM routing)
│   ├── locketgold.sgmodule        # Shadowrocket Module (khuyên dùng)
│   ├── locketgold.mobileconfig    # Profile DNS DoH chống thu hồi (iOS 14+, Split DNS + icon riêng)
│   ├── locketgold-webclip.mobileconfig  # B1sTeam ✦ Giới thiệu — WebClip → b1s.id.vn/about
│   ├── module.html / conf.html    # Trang chuyển hướng 1-Click
│   ├── .htaccess                  # CORS + MIME types (Apache)
│   └── scripts/
│       ├── locketgold_revenuecat.js    # Entitlement locket_gold vĩnh viễn
│       ├── locketgold_deleteHeader.js  # Xóa ETag → entitlement tươi mới
│       ├── locketgold_remote.js        # Firebase Remote Config premium flags
│       └── locketgold_profile.js       # Giữ badge Gold luôn bật
├── android/
│   ├── v2rayng.json               # V2RayNG / NekoBox / Kitsunebi
│   ├── singbox.json               # sing-box
│   ├── locketgold.dns             # Private DNS / DoH config
│   ├── .htaccess
│   └── README.md
└── dns/
    ├── worker.js                  # DoH Worker (Cloudflare, RFC 8484)
    └── wrangler.toml              # Deploy doh.b1s.id.vn
├── tools/
│   ├── gen-profiles.cjs            # Sinh lại 2 .mobileconfig (dùng @zone-eu/mobileconfig)
│   └── package.json
```

## 🧩 Tái tạo hồ sơ .mobileconfig (zone-eu/mobileconfig)

Hồ sơ iOS được sinh bằng [zone-eu/mobileconfig](https://github.com/zone-eu/mobileconfig) (npm: `@zone-eu/mobileconfig`) — build qua `plist` (round-trip parse OK), ký CMS khi có CA cert thật (tự ký không giúp gì — hiện “Not Verified” như unsigned; unsigned là chuẩn chung của AdGuard/NextDNS).

```bash
cd tools && npm install
node gen-profiles.cjs                      # unsigned — mặc định
PROFILE_KEY_PEM=key.pem PROFILE_CERT_PEM=cert.pem node gen-profiles.cjs --sign  # ký (CA tin cậy)
```

`PayloadUUID` cố định → người dùng cũ nhận **Update** thay vì cài trùng hồ sơ. iOS hiển thị trực tiếp `PayloadDisplayName` / `PayloadDescription` / `PayloadIcon` — đây chính là “UI” của hồ sơ.

## 🛡️ Minh bạch & Bảo mật

- **Chỉ 4 domain được MITM**: `api.revenuecat.com`, `api.rc-backup.com`, `firebaseremoteconfig.googleapis.com`, `api.locketcamera.com`.
- **Không thu thập dữ liệu**: không log IP, không log tên miền, không gửi telemetry.
- **Công khai toàn bộ mã nguồn**: mọi file đều có thể kiểm tra (xem headers `author: B1sTeam`).
- LocketGold là dự án cộng đồng **không liên kết** với Locket Labs, Inc.

## 🔗 Liên kết

- 🌐 Website: <https://b1s.id.vn> · Trang công cụ: <https://b1s.id.vn/locketgold> · Về chúng tôi: <https://b1s.id.vn/about>
- 📢 Telegram: [@b1steam](https://t.me/b1steam) · ✉️ Email: <nhb.b1steam@gmail.com>
- 💻 Repo: <https://github.com/nhb-1201/public_b1s_locket>

**Giấy phép:** Phát hành miễn phí cho cộng đồng iOS/Android — xem [LICENSE.md](LICENSE.md). Nghiêm cấm mọi hành vi thương mại hóa trái phép.
