# B1sTeam — API serverless (`api/`)

Các handler serverless kiểu Vercel, viết bằng **Node thuần, không phụ thuộc
ngoài**. Mọi handler đều có CORS, `Cache-Control: no-store`, bọc `try/catch` và
trả về JSON khi lỗi.

## Danh sách endpoint

| Method | URL                                                        | Trả về                                              |
| ------ | ---------------------------------------------------------- | --------------------------------------------------- |
| GET    | `/api/generate-profile?key=B1S-XXXX-XXXX-XXXX`             | File `.mobileconfig` (Root CA + DoH)                 |
| POST   | `/api/nextdns-create`                                      | Tạo tài khoản NextDNS, trả về DNS URL                |
| GET    | `/api/nextdns-usage?profile_id=…`                          | Số truy vấn đã dùng của profile                       |
| GET    | `/api/health`                                              | `{"ok":true,"service":"b1steam-api","version":"8.0.0","time":"…"}` |

Alias ngắn (khai báo trong `vercel.json`): `/api/profile`.

### Header của endpoint tải file

```
Content-Type: application/x-apple-aspen-config    (mobileconfig)
Cache-Control: no-store
Content-Disposition: attachment; filename="B1sTeam-LocketGold.mobileconfig"
```

Key không hợp lệ → **HTTP 401** với body `{"success":false,"error":"…","reason":"…"}`.

## Thư viện nội bộ (`api/lib/`)

| Tệp                 | Vai trò                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `keys.js`            | Định dạng `B1S-XXXX-XXXX-XXXX` (Crockford base32, bỏ I/L/O/U) + chuẩn hoá + sinh key |
| `license.js`         | Phát hành / xác minh license (HMAC-SHA256, so sánh thời gian hằng số)          |
| `mobileconfig.js`    | Bộ sinh plist XML (payload Root CA + payload DoH)                                |
| `nextdns-store.js`   | Adapter lưu trữ: Cloudflare D1 REST → Supabase REST → bộ nhớ tạm               |
| `http.js`            | Tiện ích HTTP dùng chung (CORS, JSON, parse body, bọc lỗi)                       |

## License key

* Định dạng: `B1S-XXXX-XXXX-XXXX`, 12 ký tự ngẫu nhiên trong bảng chữ cái
  Crockford base32 (không có `I`, `L`, `O`, `U`).
* License đã ký có dạng `KEY.<payload>.<chữ ký>`:
  `payload = base64url(JSON{key, device, plan, exp})`,
  `chữ ký = base64url(HMAC-SHA256(payload, SECRET))`.
* `verifyLicenseKey(license, secret, { device })` trả về `{ ok, reason, payload }`
  với các mã lý do: `ok`, `missing`, `malformed`, `bad_format`, `bad_signature`,
  `key_mismatch`, `expired`, `device_mismatch`.

### Chính sách kiểm tra key

| Tình huống                                       | Kết quả                                       |
| ------------------------------------------------ | --------------------------------------------- |
| License có chữ ký                                | Xác minh bằng HMAC (bắt buộc đúng)            |
| Key thô, có trong bảng `license_keys`            | Được chấp nhận (trừ khi đã thu hồi/hết hạn)   |
| Key thô, không có trong store, `LICENSE_STRICT=true` | Từ chối (`not_registered`)                 |
| Key thô, không có trong store, mặc định          | Chấp nhận theo định dạng (`format_only`)       |

> Khi triển khai production **nên** đặt `LICENSE_SECRET` + `LICENSE_STRICT=true`
> và dùng license đã ký.

## Biến môi trường

| Biến                          | Mặc định                | Ý nghĩa                                              |
| ----------------------------- | ----------------------- | ---------------------------------------------------- |
| `LICENSE_SECRET`              | *(rỗng)*                | Secret HMAC ký license                               |
| `LICENSE_STRICT`              | `false`                 | Bắt buộc key phải hợp lệ trong store                |
| `ROOT_CA_CRT_B64`             | *(rỗng)*                | Root CA (base64 DER) dùng cho hồ sơ `.mobileconfig`   |
| `ROOT_CA_PATH`                | *(rỗng)*                | Đường dẫn tới file CA thay cho `ca/root-ca.crt`      |
| `DOH_URL`                     | `https://doh.b1s.id.vn/fly/dns-query` | URL DoH ghi vào hồ sơ         |
| `FLY_PROXY_IP`                | *(đặt qua `wrangler secret`)* | IP proxy MITM — **không commit vào repo** |
| `FLY_DOH_URL`                 | `https://doh.b1s.id.vn/fly/dns-query` | URL DoH dùng cho nhánh fallback |
| `D1_API_TOKEN` + `D1_DATABASE_ID` (+ `D1_ACCOUNT_ID`) | *(rỗng)* | Bật backend Cloudflare D1 REST |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`      | *(rỗng)*                | Bật backend Supabase REST            |

### Nguồn tài liệu gốc

* Hồ sơ: `api/generate-profile.js` + `api/lib/mobileconfig.js` (sinh plist XML).
* Root CA: `ca/root-ca.crt` (PEM) → `ca/root-ca.der` → `api/lib/placeholder-root-ca.pem`.

## Chạy thử

```bash
node --test "tests/**/*.test.js"
```
