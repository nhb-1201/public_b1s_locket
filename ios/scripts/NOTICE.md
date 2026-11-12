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

## Cấu hình theo app — 2 đường (tương thích ngược)

**Module mới (≥ 2026-11-13) — CDN jsDelivr, self-contained:**

- Mọi script được Shadowrocket tải trực tiếp từ CDN GitHub:
  `https://cdn.jsdelivr.net/gh/nhb-1201/public_b1s_locket@main/ios/scripts/<file>.js`
  (hoặc raw: `https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/<file>.js`).
  Script không nằm trên worker nữa → không dính rate-limit theo IP (CGNAT/proxy Vercel).
- `b1s_unlock.js` nhúng sẵn toàn bộ `APP_UNLOCK_CONFIGS` (dòng `var B1S_CONFIGS = {...}`); `b1s_spotify.js` nhúng `spotify-premium`.
- Key + slug app truyền qua `argument` (không chứa dấu phẩy — an toàn trong INI Shadowrocket), định dạng:

  ```
  argument=B1S-XXXX-XXXX-XXXX|<slug>        # vd: argument=B1S-AA1B-CC2D-EE3F|vsco
  argument=B1S-XXXX-XXXX-XXXX               # script không cần slug (locketgold_remote…)
  argument=B1S-XXXX-XXXX-XXXX|request       # locketgold_profile request-mode
  argument=B1S-XXXX-XXXX-XXXX|response      # locketgold_profile response-mode
  ```

  Script đọc segment đầu làm `LICENSE_KEY`, segment thứ 2 làm slug; chọn config từ `B1S_CONFIGS[slug]`.

**Module cũ (≤ 2026-11-12) — worker vá placeholder (giữ tương thích):**

- `/api/v2/locketgold/script/<name>?key=KEY` trên worker vẫn chạy: worker thay đúng 2 dòng placeholder
  `var LICENSE_KEY = "__LICENSE_KEY__";` và `var B1S_CONFIG = { "__B1S_CONFIG__": 1 };` rồi trả file ở dạng `no-store`.
- Nếu script không thấy `$argument` hợp lệ → dùng giá trị placeholder đã vá (module cũ vẫn hoạt động bình thường).

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
  (script-path trỏ CDN `cdn.jsdelivr.net/gh/...@main`, jsDelivr cache ~12h; module vẫn hoạt động khi worker chết).

---

B1sTeam — b1s.id.vn
