# B1sTeam DNS — DoH Worker (multi-tenant)

Worker DoH của hệ thống **DNS thuần** (không Shadowrocket, không Quantumult X).

> Bản triển khai chính của B1sTeam nằm trong repo `b1steam_web`
> (`backend/workers/dns-resolver`). Thư mục này là bản độc lập, có thể deploy riêng.

## Luồng tổng thể

```
iPhone (hồ sơ .mobileconfig do backend sinh)
   │  DoH → https://doh.b1s.id.vn/<token-32-hex>
   ▼
B1sTeam DoH Worker  ←── D1: dns_profiles + dns_usage_counters
   │  · tra token → profile NextDNS của user
   │  · đếm truy vấn (ghi D1 mỗi 10s)
   │  · chặn telemetry/ads
   │  · chặn nếu user đã chạm ngưỡng 80%
   ▼
NextDNS (dns.nextdns.io/<nextdns_profile_id>)
   │  áp dụng rewrite do B1sTeam cấu hình:
   │    api.locketcamera.com, api.revenuecat.com,
   │    firebaseremoteconfig.googleapis.com, …  →  IP proxy MITM
   ▼
Proxy MITM (Go, Fly.io) — ký TLS bằng Root CA trong hồ sơ .mobileconfig
   │
   ▼
API thật của Locket / RevenueCat / Firebase (được ghi đè phản hồi)
```

## Vì sao không trỏ thẳng `dns.nextdns.io`?

| Nhu cầu | Worker | Trỏ thẳng NextDNS |
|---|---|---|
| Biết user nào đang truy vấn | ✅ token → D1 | ❌ |
| Chặn khi hết hạn mức / cần xoay vòng | ✅ | ❌ (NextDNS tự trả trang upgrade) |
| Chặn telemetry + ads theo chính sách B1sTeam | ✅ | ⚠️ (chỉ blocklist chung) |
| Thu hồi link khi user vi phạm | ✅ (`status='revoked'`) | ❌ |
| Vẫn dùng đúng hạn mức NextDNS Free | ✅ (forward sang profile) | ✅ |

## Endpoint

| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | Trạng thái + policy (nhóm blocklist) |
| GET | `/<token>` | DoH RFC 8484 (`?name=&type=` hoặc `?dns=<base64url>`) |
| POST | `/<token>` | DoH RFC 8484 `application/dns-message` |
| GET/POST | `/<token>/dns-query` | Tương đương `/<token>` |

`token` = 32 ký tự hex, sinh ngẫu nhiên mỗi lần xoay vòng profile.

## Cache

- **Edge cache** (Cloudflare `caches.default`): 5 phút (fresh) + 24 giờ (stale-if-error).
- **POST** dùng hash SHA-256 của bản tin DNS **bỏ transaction ID** làm cache key → nhiều thiết bị chia sẻ cache.
- Khi upstream chết, worker vẫn phục vụ bản cache cũ (không sập hệ thống).

## Đếm lượt truy vấn

- Bộ đếm nằm trong bộ nhớ isolate (`pending`), **ghi D1 mỗi 10 giây** (gom theo token).
- Backend đọc `dns_usage_counters.count` khi đồng bộ → tính % hạn mức → đánh dấu `rotation_required` khi ≥ 80%.

## Deploy

```bash
cd dns
npx wrangler d1 execute b1steam --remote --file=./schema.sql
npx wrangler deploy
```

> Với bản chính (trong `b1steam_web`), migration đầy đủ là:
> `cd ../backend && npx wrangler d1 execute b1steam --remote --file=d1/migrations/0020_nextdns_dns.sql`

## Biến môi trường

Worker không cần secret — mọi cấu hình nằm trong D1 (`dns_config`) và được backend quản lý.
