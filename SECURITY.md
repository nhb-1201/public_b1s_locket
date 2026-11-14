# SECURITY — B1sTeam LocketGold

> Mục tiêu: người dùng và cộng đồng hiểu rõ **không có server nào giữ private key** của bạn,
> MITM chỉ chạy **trên thiết bị của bạn**, và code ở đây có thể kiểm tra.

## Kiến trúc bảo mật

| Thành phần | Private key nằm ở đâu? | Ghi chú |
|---|---|---|
| Shadowrocket CA (khuyến nghị) | **Trên thiết bị bạn** | Shadowrocket sinh + lưu local — B1sTeam không biết |
| B1sTeam Root CA (proxy LAN) | **Chỉ trên máy bạn** | `ca/*.key` gitignored; cert công khai `.crt` chia sẻ |
| Backend (`locket.b1s.id.vn`) | Cloudflare (không xuất) | License + D1; không giữ CA |
| DoH worker | — | Không log domain; không quan hệ tới nội dung request |
| Frame workers | Cloudflare | Bắt buộc `x-b1s-proxy-key` hoặc `x-b1s-license + x-b1s-device` |

## Những gì bạn nên biết

1. **MITM chạy trên máy bạn** — không có server trung gian nào "nghe trộm" được phiên Locket của bạn.
2. MITM chỉ áp dụng cho các hostname trong allowlist: Locket / RevenueCat / Firebase RC / Firebase Storage + `us-central1-locket-4252a.cloudfunctions.net` — không app/domain nào khác.
3. `.conf` phát hành server-side, gắn với license key của tài khoản bạn; bị lộ key vẫn không mở được máy khác (device-bound `mitm-<hash>` ghi từ license key — không phải mật khẩu).
4. Backend `verify` rate-limit 120 req / 10 phút / key; các endpoint admin có HMAC + window ±5 phút.
5. CDN scripts qua HTTPS (`raw.githubusercontent.com`); bản code nào bạn nhận luôn xem được công khai tại repo này.
6. `.mobileconfig` sinh UUID deterministic từ access_token của bạn — không gửi dữ liệu gì về B1sTeam.
7. Không telemetry, không analytics nhúng vào module/ứng dụng bạn cài.

## Báo cáo lỗ hổng

- Email: **nhb.b1steam@gmail.com** (tiêu đề: `SECURITY: <mô tả ngắn>`)
- Zalo: **083.3399.553**
- Vui lòng không công bố chi tiết khai thác trước khi B1sTeam phản hồi (window 7 ngày).

## Cài đặt an toàn (đúng cách)

- **Chỉ cài Shadowrocket từ App Store chính thức** (ID 932747118, tên nhà phát hành: Shadow Launch Technology Limited). Không cài bản lậu từ web.
- **Chỉ cài .mobileconfig từ b1s.id.vn/dns** — không cài profile từ nguồn khác lạ.
- **Không chia sẻ license key** của bạn cho người khác — mỗi key chỉ được một máy verify mỗi lúc.

---

© B1sTeam — Nguyễn Hoàng Bách — b1s.id.vn — Zalo 083.3399.553
