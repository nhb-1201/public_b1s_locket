<!-- author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket -->

# 👑 LocketGold — B1sTeam v3.0

> **Mở khóa Locket Gold VIP vĩnh viễn — miễn phí 100% từ B1sTeam**
> 🌐 Trang chủ: <https://b1s.id.vn/locketgold> · 📢 Telegram: [@b1steam](https://t.me/b1steam)
> 🛠 Phát triển bởi **B1sTeam — Nguyễn Hoàng Bách** · 📦 Repo: <https://github.com/nhb-1201/public_b1s_locket>
> 🔢 Phiên bản: **3.0.0** (2026-11-09)

---

## 📥 Tải file cấu hình (raw, không cần đăng nhập)

### 📱 iOS — Shadowrocket

| Bước | Link tải |
|---|---|
| ⚡ Cài Module (khuyến dùng) | `shadowrocket://install?module=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold.sgmodule` |
| 📄 Thêm Config | `shadowrocket://config/add/https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold.conf` |
| 🛡️ Profile DNS chống thu hồi | <https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold.mobileconfig> |
| 📎 **B1sDev_ WebClip** (màn hình chính) | <https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold-webclip.mobileconfig> |

### 🤖 Android — V2RayNG / Sing-Box / NekoBox

| Bước | Link tải |
|---|---|
| ⚡ V2RayNG / NekoBox | <https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/android/v2rayng.json> |
| ⚡ Sing-Box | <https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/android/singbox.json> |
| 🛡️ DNS (Private DNS: `doh.b1s.id.vn`) | <https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/android/locketgold.dns> |

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
│   └── icon-locketgold.svg        # Icon vương miện B1sTeam
├── ios/
│   ├── locketgold.conf            # Shadowrocket Config (MITM routing)
│   ├── locketgold.sgmodule        # Shadowrocket Module (khuyên dùng)
│   ├── locketgold.mobileconfig    # Profile DNS chống thu hồi (iOS 14+)
│   ├── locketgold-webclip.mobileconfig  # B1sDev_ — WebClip → b1s.id.vn/about
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
```

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
