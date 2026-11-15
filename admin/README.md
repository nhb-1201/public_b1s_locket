# B1sTeam — Bảng quản trị (`admin/`)

Bảng quản trị LocketGold (Free): giao diện tĩnh (không cần build, không dùng
CDN) + các endpoint quản trị.

```
admin/
├─ public/index.html   # giao diện (dark + gold, tiếng Việt)
├─ api/                # endpoint quản trị
│  ├─ auth.js          # đăng nhập / kiểm tra phiên / đăng xuất
│  ├─ accounts.js      # danh sách + xoá tài khoản NextDNS
│  ├─ rotate.js        # tỉ lệ xoay vòng 80% + xoay profile
│  └─ usage.js         # lượt truy vấn của một profile
└─ lib/auth.js         # ký & kiểm tra session token (HMAC-SHA256)
```

## Endpoint

| Method | URL                            | Mô tả                                             |
| ------ | ------------------------------ | ------------------------------------------------- |
| POST   | `/api/auth`                     | `{ password, remember }` → `{ ok, token, expiresAt }` |
| GET    | `/api/auth`                     | Kiểm tra token hiện tại                            |
| DELETE | `/api/auth`                     | Đăng xuất (xoá cookie)                            |
| GET    | `/api/accounts`                 | Danh sách tài khoản NextDNS                        |
| DELETE | `/api/accounts?profile_id=…`    | Xoá tài khoản                                      |
| GET    | `/api/rotate`                   | Tỉ lệ xoay vòng hiện tại                          |
| POST   | `/api/rotate`                   | `{ ratio }` đặt tỉ lệ · `{ profile_id }` xoay profile (cập nhật lại rewrite) |
| GET    | `/api/usage?profile_id=…`       | Lượt truy vấn của profile                          |

Mọi endpoint (trừ `POST /api/auth`) đều cần header
`Authorization: Bearer <token>` (hoặc cookie `b1s_admin_token`).

## Bảo mật

* Mật khẩu nằm trong biến môi trường `ADMIN_PASSWORD`. **Nếu không cấu hình,
  mọi lần đăng nhập đều thất bại** (fail-closed).
* Session token: `base64url(JSON{exp, remember, nonce}).base64url(HMAC-SHA256(...))`,
  so sánh chữ ký bằng `crypto.timingSafeEqual` (dùng hash SHA-256 hai bên để
  không lộ độ dài).
* Thời hạn: **1 ngày** mặc định, **30 ngày** khi chọn "Ghi nhớ đăng nhập".
* Token được lưu trong `sessionStorage` của trình duyệt (đóng tab là mất).
* Giao diện **không** dùng `innerHTML` với dữ liệu từ server — mọi giá trị
  được chèn bằng `textContent`.
* Cookie phiên: `HttpOnly; SameSite=Strict; Path=/`.

## Giao diện

* Cổng đăng nhập (mật khẩu + "ghi nhớ").
* Thẻ số liệu: số tài khoản, tổng truy vấn, tỉ lệ xoay vòng, trạng thái API.
* Công tắc bật/tắt chính sách "xoay vòng 80%".
* Lưới thẻ tài khoản NextDNS: profile id, email, DNS URL, số truy vấn, nút
  **Xoay / Usage / Xoá**.
* Khu liên kết tải cho người dùng (module / conf / mobileconfig) kèm ô nhập
  license key.
* Bảng trạng thái dịch vụ, tự làm mới mỗi 15 giây.

## Chạy thử

```bash
# chạy song song với API ở cổng khác
cd api && npx vercel dev
```

Cấu hình `ADMIN_PASSWORD` và (khuyến nghị) `ADMIN_SECRET` trước khi deploy.
