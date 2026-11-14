# UPSTREAM-ASSETS — Kho lưu trữ assets bên thứ 3 (Xwuan19/locket-gold-hub)

> Nguồn: clone đầy đủ (322 file) của **https://github.com/Xwuan19/locket-gold-hub** (nhánh `main`, 2026-11-14).
> Mục đích: lưu trữ toàn bộ ảnh/font/icon liên quan tới hệ thống Locket Gold — không bỏ sót.
> Không có bất kỳ tệp code của upstream nào được đưa vào thư mục này.

## 1. Thư mục này chứa gì

| Thư mục | Số lượng | Nội dung |
|---|---|---|
| `images/` | 91 file (~4.2 MB) | Ảnh marketing / icons / UI của sản phẩm (Locket-brand): hearts, locket-tile, gold-pill, weather, lock-wallpaper, og-index, favicon… Chỉ giữ 1 bản (bản `public/images`), vì `admin/public/images` giống hệt byte-for-byte. |
| `fonts/`  | 21 file (OFL) | Fredoka · Inter · Nunito · Manrope (tiếng Latin/Hebrew/Cyrillic/Việt — Google Fonts, SIL OFL 1.1) |

Danh sách đầy đủ 112 file: xem [`UPSTREAM-ASSETS-FILES.txt`](UPSTREAM-ASSETS-FILES.txt).

## 2. Bỏ qua (không được phép re-publish)

| Loại | Số lượng | Lý do |
|---|---|---|
| `SF-Pro-Rounded-*.woff2` (5 file) | 5 | **Apple Inc.** — Apple SF license cấm re-publish dưới mọi hình thức (không phải OFL, không được phân phối tự do). B1sTeam dùng font riêng trong `b1steam_web`. |
| Code của upstream (worker, admin panel, marketing site, supabase migrations, shadowrocket/) | — | Toàn bộ stack cũ (Shadowrocket/MITM/Supabase) đã được thay thế bằng hệ DNS thuần + NextDNS per-account; code không được sao chép vào repo này. Repo chỉ giữ lại **assets (ảnh/font/icon)**. |

## 3. Provenance / bản quyền

- Khung Kawaii (01–07), khung 08–14, icons + `locket_gold.jpg` — những assets **đã sẵn trong repo** tại `assets/frames/`,
  `assets/images/kawaii/`, `assets/icon-*`, `assets/locket_gold.jpg`. Bản trong thư mục này là bản lưu trữ thêm từ upstream
  (byte-identical với bản đang dùng).
- Ảnh marketing Locket-brand (hearts, tile, i-heart-locket…) — tác phẩm của tác giả dự án gốc, đã được lớp fork công khai
  phát tán. B1sTeam không nhận quyền tác giả; thư mục này chỉ lưu trữ phục vụ vận hành và đối chiếu, không tuyên bố là của B1sTeam.
- Fonts OFL: Fredoka, Inter, Nunito, Manrope — SIL Open Font License 1.1 (giữ nguyên licensing upstream).
- Logo / icon Locket là thương hiệu của Locket Labs, Inc. — dự án cộng đồng, không liên kết với Locket Labs, Inc.

## 4. Cách dùng

- Hệ thống tự phục vụ các asset này qua raw CDN của repo (GitHub → `https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/...`).
- Không cần build step; `assets/upstream-archive/` là kho tĩnh — thêm file mới chỉ cần commit.
