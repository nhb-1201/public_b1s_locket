# B1sTeam — DoH Worker (RFC 8484) — `doh.b1s.id.vn`

> Trạng thái: **đang chạy production** (worker `locketgold-dns` trên account B1sTeam chính).
> Lưu ý: hệ chính hiện tại là **Shadowrocket**; DoH là tuyến **bổ trợ** (chặn ads/telemetry mọi lúc,
> không cần module).

## Luồng tổng thể

```
iPhone (hồ sơ .mobileconfig sinh bởi backend — bản ECC P-256 B1sTeam Root CA)
   │  DoH → https://doh.b1s.id.vn/dns-query
   ▼
B1sTeam DoH Worker (`locketgold-dns`, account chính)
   ├─ Phân giải truy vấn:
   │     locketcamera.com / locket.camera       → IP proxy MITM (LAN / WAN)
   │     firebaseremoteconfig.googleapis.com   → IP proxy MITM (LAN / WAN)
   │     ads/telemetry/Firebase-analytics      → 0.0.0.0 (chặn)
   │     khác                                  → forward 1.1.1.1 / 8.8.8.8
   ▼
API thật của Locket / RevenueCat / Firebase (bị ghi đè lúc về trong Shadowrocket)
```

## Cấu trúc

```
dns/
├── src/index.ts     # DoH worker (RFC 8484, recursive fallback, blocklist)
├── schema.sql       # (Tham khảo — schema D1 thật: `b1steam_web/d1`)
├── wrangler.toml    # config / route doh.b1s.id.vn
└── README.md
```

## Build & Deploy

```bash
cd dns
npx wrangler deploy
# route doh.b1s.id.vn đã gắn vào zone b1s.id.vn (DNS: CNAME doh → workers.dev, proxied)
```

## Check nhanh

```bash
python -c "
import base64, urllib.request
tid=b'\x00\x01'; flags=b'\x01\x00'; counts=b'\x00\x01\x00\x00\x00\x00\x00\x00'
name='api.locketcamera.com'
q=b''.join(bytes([len(p)])+p.encode() for p in name.split('.'))+b'\x00'
packet=tid+flags+counts+q+b'\x00\x01\x00\x01'
url='https://doh.b1s.id.vn/dns-query?dns='+base64.urlsafe_b64encode(packet).rstrip(b'=').decode()
req=urllib.request.Request(url, headers={'accept':'application/dns-message'})
r=urllib.request.urlopen(req, timeout=12)
print('status', r.status, 'bytes', len(r.read()))
"
```

## Back-compat

Worker hỗ trợ `/dns-query` (wire format) cho Shadowrocket cũ và ở bất kỳ hệ thống DoH nào.

---

© B1sTeam — Nguyễn Hoàng Bách — b1s.id.vn — Zalo 083.3399.553
