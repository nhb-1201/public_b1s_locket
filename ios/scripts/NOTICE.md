# Script MITM của B1sTeam — 100% tự viết

B1sTeam tự host toàn bộ script MITM trong thư mục này. **Không còn file JS nào của repo
khác** — tất cả đã được viết lại (rewrite) để chạy trên engine chung của B1sTeam.

> B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553

## Danh sách script

| File | Phạm vi | Mô tả |
|---|---|---|
| `b1s_unlock.js` | 21 App Premium | **Engine MITM tổng quát** — 1 file xử lý mọi app: `merge` / `replace` / `revenuecat`, patch theo đường dẫn, `variants` (chọn cấu hình theo URL), `force` (ép key theo regex), sửa URL/header ở request phase. |
| `b1s_youtube.js` | YouTube Premium | Scrub quảng cáo InnerTube (`adPlacements`, `playerAds`, `promotedVideoRenderer`…), ép `playabilityStatus.status = OK`, ép `HTML5_PREF_WANTS`. |
| `b1s_spotify.js` | Spotify Premium | **Engine Protobuf tự viết** (varint / 64-bit / length-delimited / 32-bit) + Base64 thuần JS. Patch `ProductState`/`UserAttributes` theo chữ ký field, ép JSON `product = premium`. |
| `locketgold_remote.js` | LocketGold | Ép Firebase Remote Config — 196 entry (camera, widget frame, streak, caption, upsell…). |
| `locketgold_revenuecat.js` | LocketGold | Bật entitlement Gold của Locket qua RevenueCat. |
| `locketgold_profile.js` | LocketGold | Huy hiệu Gold + thông tin hồ sơ. |
| `locketgold_filters.js` | LocketGold | Mở khoá AI Filter (paywall 402/403) + ép vùng US (header + query). |
| `locketgold_deleteHeader.js` | LocketGold | Xoá header cache `x-revenuecat-etag` để app không nhận 304 (body rỗng). |

## Cấu hình theo app

Cấu hình nằm trong **worker** (`locketgold-backend/src/app-configs.ts` → `APP_UNLOCK_CONFIGS`).
Worker chèn vào script qua placeholder:

```js
var B1S_CONFIG = { "__B1S_CONFIG__" };
```

và thay `var LICENSE_KEY = "__LICENSE_KEY__";` bằng key thật của user.

## Quy tắc an toàn (B1sTeam tự áp)

- **KHÔNG** script nào gọi máy chủ lạ / telemetry / tracking.
- **KHÔNG** gọi `translate.google.com` (đã loại bỏ hoàn toàn từ bản gốc của bên thứ ba).
- **KHÔNG** gửi uid / username / dữ liệu người dùng ra ngoài — mọi thay đổi diễn ra cục bộ trên máy.
- **License gate fail-closed**: key sai, sai máy, hoặc offline > 72h → script trả nguyên body gốc
  (không bơm cờ nào). Xác thực qua `GET /api/v2/locketgold/verify` (cache 72h trên máy).

## Lưu ý

- Script MITM làm thay đổi **phản hồi API của app trên thiết bị người dùng** — không thay đổi dữ liệu
  trên máy chủ của app, không thu thập dữ liệu người dùng.
- Nếu app phía hãng sửa/xoá endpoint tương ứng thì script có thể ngừng hoạt động tạm thời
  (B1sTeam sẽ cập nhật).
- Khi B1sTeam cập nhật script, chỉ cần push file mới vào thư mục này — module tự lấy bản mới
  (script-path trỏ raw URL, cache TTL ngắn).

---

B1sTeam — b1s.id.vn
