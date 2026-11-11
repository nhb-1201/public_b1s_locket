# Script App Premium — nguồn gốc & giấy phép

B1sTeam tự host toàn bộ script MITM cho **23 App Premium** trong thư mục này — **không hotlink**
(khi repo bên thứ 3 xoá/chặn, module của B1sTeam vẫn chạy).

> B1sTeam — b1s.id.vn · Nguyễn Hoàng Bách · Zalo 083.3399.553

## Nguồn gốc

| Script | Nguồn ban đầu | Repo/CDN |
|---|---|---|
| `youtube.response.js` | AppPre (cộng đồng) | `dinhduyvinh09/AppPre` (jsDelivr) |
| `spotify-json.js`, `spotify-proto.js` | AppPre | `dinhduyvinh09/AppPre` |
| `SoundCloudGoPlus.js`, `VSCO.js`, `AlightMotion.js` | AppPre | `dinhduyvinh09/AppPre` |
| `PicsArt.js`, `PicsArtStorages.js`, `WinkVipCrack.js` | AppPre | `dinhduyvinh09/AppPre` |
| `TrueCaller.js`, `lightroom.js`, `Kinemaster.js`, `camScanner.js` | AppPre | `dinhduyvinh09/AppPre` |
| `BeautyPlus.js`, `MeiTuXiuXiu.js`, `Snow.js` | AppPre | `dinhduyvinh09/AppPre` |
| `capcutHT.js`, `ilovepdf.js`, `mojo.js` | `andanh447/locketgold_tool` | GitHub raw |
| `PhotoshopEpress.js`, `picCollage.js`, `smaillpdf.js`, `Tokcam.js` | `andanh447/locketgold_tool` | GitHub raw |
| `PhotoRoom.js`, `ToonMe.js` | `89996462/Quantumult-X` | GitHub raw |

Script được giữ **nguyên văn** (không sửa logic) để giữ hành vi gốc; B1sTeam chỉ chịu trách nhiệm
về **cấu hình module** (pattern MITM, hostname, cách nhúng) — mọi thứ chạy 100% trên thiết bị người dùng.

## Quét an toàn (đã chạy khi vendor)

- Không script nào gọi về máy chủ lạ / telemetry / tracking.
- `youtube.response.js` có gọi `translate.google.com` — **đây là tính năng dịch phụ đề/lyrics**
  của chính script (dùng cho caption tiếng Việt). Nội dung phụ đề được gửi tới Google Translate.
  Muốn tắt: xoá/sửa khối gọi translate trong script hoặc đặt `captionLang` về `en`.
- Các URL còn lại chỉ nằm trong comment (không được gọi).

## Lưu ý

- Script MITM làm thay đổi **phản hồi API của app trên thiết bị** — không đụng tới máy chủ của app,
  không thu thập dữ liệu người dùng.
- Nếu app phía hãng sửa/xoá endpoint tương ứng → script có thể ngừng hoạt động (B1sTeam sẽ cập nhật).
- Khi B1sTeam cập nhật script, chỉ cần push file mới vào thư mục này — module tự lấy bản mới
  (script-path là raw URL có cache TTL ngắn).

© B1sTeam — b1s.id.vn
