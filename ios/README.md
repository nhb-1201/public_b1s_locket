<!-- author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket -->

# 🍎 Locket Gold — iOS (Shadowrocket) · B1sTeam v3.0

> B1sTeam — b1s.id.vn · Telegram @b1steam · Nguyễn Hoàng Bách

## Cấu trúc thư mục

```
ios/
├── locketgold.conf           # Cấu hình Shadowrocket (.conf) — routing + MITM
├── locketgold.sgmodule       # Module Shadowrocket (.sgmodule) — bản khuyên dùng
├── locketgold.mobileconfig   # Profile DNS chống thu hồi (.mobileconfig · iOS 14+)
├── module.html               # Trang chuyển hướng → cài Module 1-Click (noindex)
├── conf.html                 # Trang chuyển hướng → thêm Config 1-Click (noindex)
├── .htaccess                 # Apache: CORS + MIME types + cache headers
└── scripts/
    ├── locketgold_revenuecat.js   # Entitlement locket_gold vĩnh viễn (hết hạn 9999)
    ├── locketgold_deleteHeader.js # Xóa ETag/If-None-Match → luôn nhận bản mới
    ├── locketgold_remote.js       # Firebase Remote Config → bật toàn bộ flag premium
    └── locketgold_profile.js      # Giữ badge Gold luôn bật trên api.locketcamera.com
```

## Cài đặt — 7 bước (A → Z)

1. **Cài Shadowrocket** từ App Store (trả phí; có thể dùng tài khoản chia sẻ hoặc IPA).
2. **Cài Module 1-Click**: bấm nút *Cài Module* trên [b1s.id.vn/locketgold](https://b1s.id.vn/locketgold) → iPhone mở Shadowrocket → bấm **Used** cho module `locketgold.sgmodule`.
3. **Bật Giải mã HTTPS**: tab *Cấu hình* → biểu tượng **(i)** cạnh config → gạt **Giải mã HTTPS** sang BẬT.
4. **Tạo Chứng chỉ CA**: mục *Chứng chỉ CA* → **Tạo Chứng chỉ CA mới** → **Cài đặt CA vào hệ thống** → Safari mở, bấm **Cho phép**.
5. **Cài hồ sơ chứng chỉ**: *Cài đặt → Đã tải về hồ sơ* → chọn hồ sơ Shadowrocket → **Cài đặt** → nhập mật mã máy.
6. **Tin cậy chứng nhận gốc** ⚠️ BẮT BUỘC: *Cài đặt → Cài đặt chung → Giới thiệu → Cài đặt tin cậy chứng nhận* → gạt chứng chỉ Shadowrocket sang BẬT → **Tiếp tục**.
7. **Bật VPN & tận hưởng**: tab *Nhà* → gạt kết nối BẬT → **vuốt tắt hẳn Locket** khỏi đa nhiệm → mở lại → **Gold VIP ✦**.

## Chống thu hồi vĩnh viễn (không cần bật VPN)

Sau khi Locket đã lên Gold:

1. Tắt VPN Shadowrocket.
2. Mở Safari → vào [b1s.id.vn/locketgold/ios/locketgold.mobileconfig](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold.mobileconfig).
3. *Cài đặt → Đã tải về hồ sơ* → **Cài đặt**.
4. *Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị → DNS* → chọn **Locket Gold DNS — B1sTeam**.

Split DNS chỉ định tuyến truy vấn Locket/RevenueCat qua DoH riêng (`https://doh.b1s.id.vn/dns-query`) — mọi app khác vẫn dùng mạng gốc, tốc độ 100%.

## Link cài đặt nhanh

| Mục | Link |
|---|---|
| Cài Module | `shadowrocket://install?module=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold.sgmodule` |
| Thêm Config | `shadowrocket://config/add/https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold.conf` |
| Tải Profile DNS | <https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/locketgold.mobileconfig> |
| Hướng dẫn đầy đủ | <https://b1s.id.vn/locketgold> |

## Bảo mật & Minh bạch

- Chỉ 4 domain được MITM: `api.revenuecat.com`, `api.rc-backup.com`, `firebaseremoteconfig.googleapis.com`, `api.locketcamera.com`.
- Script không thu thập dữ liệu cá nhân, không gửi thông tin ra ngoài.
- `.htaccess` chặn hotlink, chỉ cho phép `GET/OPTIONS` + CORS `*` cho file cấu hình công khai.
