# 💛 Locket Gold Hub (public_b1s_locket) — B1sTeam DNS thuần

> **DNS thuần. Không Shadowrocket. Không Quantumult X. Không jailbreak.**
> Toàn bộ mã nguồn do **B1sTeam** (Nguyễn Hoàng Bách) sở hữu và vận hành.

Hệ thống mở khóa tính năng Locket Gold hoàn toàn bằng DNS: mỗi người dùng có một
**tài khoản NextDNS riêng**, thiết bị chỉ cần cài **một hồ sơ iOS (.mobileconfig)**,
phần còn lại chạy trên máy chủ của B1sTeam.

**B1sTeam — Nguyễn Hoàng Bách · b1s.id.vn · Zalo 083.3399.553**

---

## 1. Hệ thống gồm những gì

```
┌──────────── iPhone / iPad ───────────┐
│  Hồ sơ .mobileconfig                 │
│   · Root CA (tin cậy)                │
│   · DNSSettings → https://doh.b1s.id.vn/<token> │
└──────────────┬───────────────────────┘
               │ DoH (RFC 8484)
               ▼
   ┌──────────────────────────┐   ┌─────────────┐
   │ DoH Worker (Cloudflare)  │──▶│  NextDNS     │  account riêng của user
   │  · proxy/b1steam-dns     │   │  · 300k/30d  │
   │  · đếm + chặn            │   └─────┬───────┘
   └──────────────────────────┘         │ rewrite → IP proxy
                                         ▼
                              ┌──────────────────────┐
                              │ MITM Proxy (Go, Fly) │── /apply-frame ──▶ Frame Worker (WASM)
                              └──────────────────────┘
                                         │
                                         ▼
                      API thật của Locket / RevenueCat / Firebase (ghi đè phản hồi)
```

## 2. Cấu trúc repo

```text
public_b1s_locket/
├── dns/                 # ☁️ DoH Worker (Cloudflare / TypeScript) — multi-tenant
│   ├── src/index.ts     #   tra token → tài khoản NextDNS riêng của user
│   └── schema.sql       #   bảng D1 tối thiểu (bản chép chính: b1steam_web backend)
├── proxy/               # 🐹 Proxy MITM (Go) — ký TLS, ghi đè phản hồi API
│   ├── main.go
│   ├── handler/         #   firebase · revenuecat · locket_api · photobooth · camera_filter_config.json
│   ├── tls/             #   CA loader + leaf allowlist
│   └── Dockerfile
├── frame-worker/        # 🖼️ Cloudflare Worker (WASM) — vẽ khung Kawaii lên ảnh & serve /assets
├── assets/              # 🖼️ Khung Kawaii, icons, banner (phục vụ RemoteConfig + frame worker)
│   ├── frames/
│   ├── images/kawaii/
│   ├── upstream-archive/   # 📦 Toàn bộ asset Xwuan19/locket-gold-hub (91 ảnh marketing +
│   │                       #    21 font OFL) — kèm UPSTREAM-ASSETS.md ghi nguồn/giấy phép
│   └── icon-*.svg, welcome_banner.*, banner.svg, locket_gold.jpg
├── ca/                  # 🔐 Root CA (crt public — `.gitignore` chặn `.key`)
├── scanner/             # 🔍 Quét endpoint/domain trong mã nguồn
├── docs/                # 📚 ARCHITECTURE.md
├── CHANGELOG.md
├── LICENSE.md
└── README.md
```

> **Web portal / backend / admin** (đăng nhập, `/dns`, `/quantri/dns`, quản lý NextDNS, cron
> preprovision) nằm ở repo [`b1steam_web`](https://github.com/nhb-1201/b1steam_web)
> (nhánh `main` = frontend, nhánh `backend` = Cloudflare Workers).

## 3. Triển khai sản phẩm

| Thành phần | Cách deploy |
|---|---|
| **DoH Worker** `b1steam-dns` → `doh.b1s.id.vn` | CI (nhánh `backend` của `b1steam_web`) tự deploy từ `workers/dns-resolver` |
| **MITM Proxy** → `locket-proxy` (Fly.io, port 443) | `fly secrets set ROOT_CA_CRT=... ROOT_CA_KEY=... PROXY_SHARED_KEY=...` → `fly deploy` |
| **Frame Worker** → `frame.b1s.id.vn` | `cd frame-worker && npx wrangler secret put PROXY_SHARED_KEY && npx wrangler deploy` |
| **Web portal + backend API** | Push `main` (Vercel) / `backend` (GitHub Actions → Cloudflare) của `b1steam_web` |
| **D1 migrations** (`b1steam`) | `wrangler d1 execute b1steam --remote --file=d1/migrations/0021_...` |

## 4. Hạn mức & xoay vòng (NextDNS Free — **tính theo TÀI KHOẢN**)

NextDNS Free = **300.000 truy vấn / 30 ngày theo tài khoản** → mỗi vòng xoay = **1 tài khoản NextDNS mới**:

1. Đạt ngưỡng cảnh báo (60%, cấu hình) → cron tự **tạo sẵn** tài khoản + profile mới (`ready`).
2. Đạt ngưỡng xoay vòng (80%, cấu hình) → DoH chặn (REFUSED) + **in-app + email** yêu cầu người dùng
   vào **b1s.id.vn/dns** → bấm **“Cập nhật DNS”** (link mới ngay vì đã tạo sẵn) → tải `.mobileconfig` → cài đè.
3. Tải `.mobileconfig` xong → hệ thống tự tắt `user_update_required`.
4. Nếu chưa tạo sẵn kịp → nút “Cập nhật DNS” sẽ tự tạo tài khoản mới ngay tại thời điểm bấm.

## 5. Bảo mật

- Chứng thư chỉ dùng cho Locket (`*.locketcamera.com`, `*.revenuecat.com`, Firebase RC).
  Proxy **từ chối ký leaf for hostname ngoài allowlist** (`proxy/tls/cache.go`).
- Leaf ký theo SNI (cache, TTL). Root CA private key **không** nằm trong repo.
- DoH Worker không lưu log truy vấn — chỉ đếm.
- Frame Worker từ chối mọi request thiếu `x-b1s-proxy-key`.
- Chạm ngưỡng → user **bắt buộc** cài lại hồ sơ (link cũ bị chặn hoàn toàn).

## 6. Trách nhiệm & giới hạn

- Mọi thứ chạy phía máy chủ của B1sTeam: ghi đè phản hồi API qua proxy; không tấn công máy chủ Locket,
  không sửa dữ liệu tài khoản người dùng.
- Nếu Locket vá endpoint → tính năng tương ứng tạm ngừng tới khi cập nhật `proxy/handler/`.
- Dự án cộng đồng, **không liên kết** với Locket Labs, Inc.

## 7. Nguồn gốc / giấy phép

Xem [`LICENSE.md`](LICENSE.md). Thư viện/khung ảnh bên thứ 3 (nếu có) đều có ghi công trong `docs/`.

© B1sTeam — b1s.id.vn · Zalo 083.3399.553
