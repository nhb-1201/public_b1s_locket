# SECURITY — B1sTeam LocketGold

> Mục tiêu: người dùng và cộng đồng hiểu rõ **không có server nào giữ private key** của bạn,
> và code ở đây có thể kiểm tra.

## Kiến trúc bảo mật

| Thành phần | Private key nằm ở đâu? | Ghi chú |
|---|---|---|
| B1sTeam Root CA (CN=B1sTeam Root CA) | Fly.io (qua secret, KHÔNG commit vào repo) | Sinh leaf theo SNI — ngoài repo, không log |
| Backend (`locket.b1s.id.vn`) | Cloudflare (không xuất) | DoH riêng + NextDNS tài khoản; không giữ CA |
| DoH worker | — | Không log domain; không quan hệ tới nội dung request |
| Frame workers | Cloudflare | Bắt buộc `x-b1s-proxy-key` (hoặc `x-b1s-license + x-b1s-device`) |

## Những gì bạn nên biết

1. **MITM chỉ chạy trên đường truyền của Locket** — hồ sơ .mobileconfig chỉ cài CA hệ thống; proxy Fly chỉ giải mã đúng các host trong allow-list (Locket / RevenueCat / Firebase). Domain khác không đi qua MITM.
2. MITM chỉ áp dụng cho các hostname trong allowlist: Locket / RevenueCat / Firebase RC / Firebase Storage / **Firebase Auth + Firestore** (để chỉnh sửa hồ sơ) + `us-central1-locket-4252a.cloudfunctions.net` — không app/domain nào khác.
3. `.mobileconfig` sinh server-side với UUID deterministic từ tài khoản của bạn — không gửi dữ liệu gì về B1sTeam.
4. DoH worker trả `429` khi vượt 60 truy vấn / 10 phút / IP — chống lạm dụng.
5. CDN scripts qua HTTPS (`raw.githubusercontent.com`) — bạn luôn đọc được code công khai tại repo này.
6. Không telemetry, không analytics nhúng vào hồ sơ bạn cài.

## Báo cáo lỗ hổng

- Email: **nhb.b1steam@gmail.com** (tiêu đề: `SECURITY: <mô tả ngắn>`)
- Zalo: **083.3399.553**
- Vui lòng không công bố chi tiết khai thác trước khi B1sTeam phản hồi (window 7 ngày).
