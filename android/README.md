<!-- author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket -->

# 🤖 Locket Gold — Android (V2RayNG / Sing-Box) · B1sTeam v6.0

> B1sTeam — b1s.id.vn · Telegram @b1steam · Nguyễn Hoàng Bách

## Cấu trúc thư mục

```
android/
├── v2rayng.json      # Cấu hình cho V2RayNG / NekoBox / Kitsunebi
├── singbox.json      # Cấu hình sing-box (có thể dùng cho NekoBox · sing-box for Android)
├── locketgold.dns    # Thông số DoH + hướng dẫn Private DNS toàn hệ thống
├── .htaccess         # Apache: CORS + MIME types + cache headers
└── README.md
```

## Cài đặt — 4 bước

1. **Tải V2RayNG** ([Google Play](https://play.google.com/store/apps/details?id=com.v2ray.ang) / [F-Droid](https://f-droid.org)) hoặc **Sing-Box** ([Google Play](https://play.google.com/store/apps/details?id=io.singbox.app) / [F-Droid](https://f-droid.org/packages/io.nekohasekai.sagernet/)).
2. **Import cấu hình**: mở app → **Nhập từ tệp** → chọn `v2rayng.json` hoặc `singbox.json` vừa tải.
3. **Bật kết nối VPN**: gạt công tắc → cấp quyền VPN khi Android hỏi.
4. **Mở Locket** → Gold VIP tự kích hoạt. Xong ✦

## Chống thu hồi vĩnh viễn qua Private DNS (toàn hệ thống)

1. *Cài đặt Android → Mạng & Internet → Private DNS*
2. Chọn **Tên máy chủ của nhà cung cấp Private DNS**
3. Nhập: **`doh.b1s.id.vn`** → Lưu

> Split DNS: chỉ truy vấn Locket/RevenueCat đi qua DoH B1sTeam — toàn bộ mạng còn lại giữ DNS gốc. Không lag, không tốn pin, không giới hạn lượt.

## Link tải về

| Mục | Link |
|---|---|
| V2RayNG / NekoBox | <https://b1s.id.vn/alfretro/android/v2rayng.json> |
| Sing-Box | <https://b1s.id.vn/alfretro/android/singbox.json> |
| Thông số DNS | <https://b1s.id.vn/alfretro/android/locketgold.dns> |
| Hướng dẫn đầy đủ | <https://b1s.id.vn/alfretro> |

## Bảo mật & Minh bạch

- Chỉ định tuyến 8 domain Locket/RevenueCat qua cấu hình B1sTeam; mọi traffic khác DIRECT.
- Không thu thập lịch sử duyệt web, không log tên miền, không chèn quảng cáo.
