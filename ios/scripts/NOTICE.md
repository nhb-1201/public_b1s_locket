# Script MITM của B1sTeam — LocketGold — 100% tự viết

B1sTeam tự host toàn bộ script MITM trong thư mục này. **Không cần file JS nào của repo
khác** — tất cả đã được viết lại (rewrite) để chạy trên engine chung của B1sTeam.

> B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553

## Danh sách script (v7.8.0)

| File | Phạm vi | Mô tả |
|---|---|---|
| `b1s_unlock.v7.8.0.js` | RevenueCat / Locket API (dùng chung) + Badge Gold | Engine MITM tổng quát — 1 file xử lý mọi app: `merge`/`replace`/`revenuecat`, patch theo đường dẫn, `variants` + `force` (ép key theo regex). |
| `locketgold_remote.v7.8.0.js` | LocketGold | Ép Firebase Remote Config → 131 entries (`state=UPDATE`, `templateVersion=Date.now()`), popup B1STEAM GOLD, unlock AI filters, camera filter config. |
| `locketgold_profile.v7.8.0.js` | LocketGold | Huy hiệu Gold + unblur + paywall filter 402/403. |
| `locketgold_locket.v7.8.0.js` | LocketGold | Badge Gold + `is_gold/is_locked` transform đệ quy + VIP honor inject + `changeProfileInfo` → 200 Gold. |
| `locketgold_upload.v7.8.0.js` | khung Kawaii | `generateFilteredImage`: overlay filters (`khung_/pb_/photobooth/4cut/cmt_locket/sticker`) → giữ ảnh; AI filters → frame worker (`x-b1s-proxy-key`/`x-b1s-license`). |
| `locketgold_vip.v7.8.0.js` | Vinh danh Gold | Inject danh sách Cộng đồng Gold (`locket.b1s.id.vn/api/v2/locketgold/vip/list`). |
| `locketgold_filters.v7.8.0.js` | LocketGold | Mở khóa filter cá nhân + ép vùng US (header + query). |

> **Build**: các file trên là OUTPUT của `ios/build.mjs` từ `ios/src/**` — không sửa tay.
> License gate (fail-closed) nằm ở 1 nguồn duy nhất: `ios/src/lib/license-gate.js` —
> inline vào mỗi script khi build. Xem chi tiết trong `docs/ARCHITECTURE.md`.

**Module (2026-11-14) — CDN, self-contained:**

- `ios/alfretro-allinone.conf` → `ios/locketgold.sgmodule` (`%APPEND%` ở `[MITM]`).
- Mỗi script được Shadowrocket tải trực tiếp từ CDN GitHub:
  `https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/<file>.js`

**Tham số:**

```
argument=B1S-XXXX-XXXX-XXXX                   # license key của bạn
```

## Quy tắc an toàn (B1sTeam tự áp)

- **KHÔNG** script nào gọi máy chủ lạ / telemetry / tracking.
- **KHÔNG** gửi uid/username/dữ liệu người dùng ra ngoài — mọi thay đổi diễn ra cục bộ trên máy.
- **License gate fail-closed**: key sai, sai máy, hoặc offline > 72h → script trả nguyên body gốc.
- Xác thực qua `GET /api/v2/locketgold/verify` (cache 72h trên máy, rate-limit 120/10 phút).

---

B1sTeam — b1s.id.vn
