# B1sTeam — NextDNS client (`nextdns/`)

Bộ thư viện Node (không phụ thuộc ngoài) dùng để **tạo tài khoản NextDNS** cho
người dùng LocketGold (Free) và **xoay vòng 80% / 20%**.

## `index.js` — API client

```js
const {
  createNextDnsAccount,
  listRewrites,
  createRewrite,
  deleteRewrite,
  checkNextDnsQueryUsage,
} = require('./index');
```

### `createNextDnsAccount({ profileName, flyIp })`

1. Sinh email + mật khẩu mạnh (`node:crypto`, **không** dùng `Math.random` cho
   bí mật). Ưu tiên dùng mailbox tạm qua `mail.tm`, nếu không dùng
   `NEXTDNS_EMAIL` / `NEXTDNS_PASSWORD` từ biến môi trường.
2. `POST https://api.nextdns.io/accounts` kèm profile dùng cấu hình bảo mật +
   quyền riêng tư được NextDNS khuyến nghị (`nextdns-recommended`, chặn
   tracker, cryptojacking, Google Safe Browsing…).
3. `POST /profiles/<id>/rewrites` cho **từng domain trong allow-list**, trỏ về
   IP proxy MITM trên Fly.io.
4. Trả về:

```json
{
  "email": "…",
  "password": "…",
  "profile_id": "…",
  "dns_url": "https://dns.nextdns.io/<profile_id>",
  "fly_ip": "137.66.53.108",
  "rewrites": [{ "domain": "api.revenuecat.com", "ok": true, "status": 200 }]
}
```

### Các hàm còn lại

| Hàm                                          | Mô tả                                                          |
| -------------------------------------------- | -------------------------------------------------------------- |
| `listRewrites(profileId, sid)`               | Liệt kê rewrite của profile                                     |
| `createRewrite(profileId, sid, domain, ip)`  | Thêm (hoặc cập nhật) một rewrite                                 |
| `deleteRewrite(profileId, sid, domain)`      | Xoá một rewrite                                                 |
| `checkNextDnsQueryUsage({email,password,profileId})` | Số truy vấn / giới hạn / % / thiết bị / thời điểm truy vấn cuối |
| `loginNextDnsSession(email, password)`       | Đăng nhập, trả về cookie phiên `_sid`                            |
| `extractNextDnsSid(res)`                     | Bóc cookie `_sid` từ `set-cookie` (dự phòng: `getSetCookie()`)  |

> Mọi lệnh gọi mạng đều có `AbortController` timeout **5 giây**.

## `rotate.js` — bộ xoay vòng

```js
const { pickProfile, estimateRatio, shouldRotate } = require('./rotate');

const choice = pickProfile(profiles, {
  profileId: 'user-abc',   // định danh ổn định của user
  ratio: 0.8,              // 80% NextDNS / 20% fallback
  fallback: { id: 'fly', kind: 'fallback', dns_url: '…' },
});
// -> { id, profile, route: 'nextdns' | 'fallback', score }
```

* **Xác định (deterministic):** cùng một `profileId` luôn cho cùng một kết quả
  → phù hợp cache, không "nhảy" profile giữa các request.
* **Tỉ lệ đúng:** `estimateRatio(profiles, { samples: 20000 })` đo được tỉ lệ
  thực tế (≈ 0.80) dùng cho test.
* `shouldRotate(lastRotatedAt, now, intervalMs)` trả về `true` khi đã đủ thời
  gian xoay (chưa xoay lần nào → `true`; `intervalMs <= 0` → `false`).

Băm dùng **FNV-1a 32 bit** (ổn định giữa các lần chạy, không phụ thuộc thư viện
ngoài).

## Chạy thử

```bash
node --test "nextdns/test/**/*.test.js"
```

## Biến môi trường

| Biến                | Mặc định            | Ý nghĩa                              |
| ------------------- | ------------------- | ------------------------------------ |
| `FLY_PROXY_IP`      | `137.66.53.108`     | IP proxy MITM dùng cho rewrite       |
| `NEXTDNS_EMAIL`     | *(sinh tự động)*    | Email đăng ký NextDNS (tuỳ chọn)     |
| `NEXTDNS_PASSWORD`  | *(sinh tự động)*    | Mật khẩu NextDNS (tuỳ chọn)          |
