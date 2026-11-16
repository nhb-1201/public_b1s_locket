# LocketGold (Free) — iOS (DNS / PT1) · B1sTeam

> ⭐ **Chỉ còn Phương Thức 1 (DNS)**. Phương Thức 2 (Shadowrocket / `.conf` / `.sgmodule`) đã **bị loại bỏ hoàn toàn** — toàn bộ mã nguồn on-device MITM đã được xóa khỏi repo này (trước đây nằm ở `ios/`, nay `ios/` chỉ còn hồ sơ mẫu).

## Phương Thức 1 — DNS (duy nhất, khuyến dùng)

1. **Tải hồ sơ `.mobileconfig`** — [b1s.id.vn/locketvip](https://b1s.id.vn/locketvip) → **Tải Phương Thức 1** (hoặc trực tiếp `https://doh.b1s.id.vn/mobileconfig`) → Safari hiện “Hồ sơ đã tải”.
2. **Cài đặt hồ sơ** — Cài đặt → Cài đặt chung → VPN và Quản lý thiết bị → chọn hồ sơ → Cài đặt → nhập mật mã → Xong.
3. **Tin cậy B1sTeam Root CA (BẮT BUỘC)** — Cài đặt → Cài đặt chung → Giới thiệu (About) → Cài đặt gốc chứng chỉ (Certificate Trust Settings) → bật “B1sTeam Root CA” → Tiếp tục.
4. **Xóa Locket → tải lại** — App Store tải lại Locket → đăng nhập bằng Apple/Google ID cũ → mở Locket → **Gold ✦**.

> Xong ✦ Gold vĩnh viễn 0₫. Không cần app bên thứ ba, không cần tài khoản, không jailbreak.
> Hồ sơ: Root CA EC P-256 (CN=B1sTeam Root CA) + DoH `doh.b1s.id.vn/fly/dns-query` (RFC 8484).

## File trong thư mục này

```
ios/
├─ locketgold.mobileconfig   # Hồ sơ mẫu (tham khảo) — bản phát hành luôn sinh từ CA thật
└─ README.md                 # Tài liệu này
```

## Build / vận hành

- Proxy MITM Fly.io: `proxy/` (Go) — xem `proxy/README.md`.
- DoH: `dns/` (Cloudflare Worker) + `nextdns/` (rotation 80/20) — xem `dns/README.md`.
- Worker khung: `workers/frames/` + `frame-worker/` — xem `workers/frames/README.md`.
- API serverless (Vercel): `api/` — `generate-profile` (.mobileconfig cá nhân hóa), `nextdns-*`, `health`.
- Landing page: `index.html` — hướng dẫn DNS 1 chạm.
