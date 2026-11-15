# B1sTeam — DNS Worker (`dns/`)

Cloudflare Worker làm **DoH (DNS over HTTPS)** cho LocketGold (Free), kèm cơ chế
xoay vòng NextDNS 80% / 20%. Viết bằng **JavaScript thuần + JSDoc** nên không
cần toolchain TypeScript.

## Routes

| Method     | Path                     | Mô tả                                                                 |
| ---------- | ------------------------ | --------------------------------------------------------------------- |
| GET/POST   | `/health`                | `{"ok":true,"service":"b1steam-dns"}`                                 |
| GET/POST   | `/<nextdnsProfileId>/dns-query` | Chuyển tiếp tới `https://dns.nextdns.io/<profileId>` (NextDNS riêng của user) |
| GET/POST   | `/fly/dns-query`         | Đường dẫn công khai: host trong allow-list → IP proxy Fly.io, còn lại → 1.1.1.1 / 1.0.0.1 |

### Định dạng truy vấn

Cả hai định dạng đều được hỗ trợ:

* **RFC 8484 wire format** — `Content-Type: application/dns-message` (POST body là
  bytes DNS). Worker đọc QNAME/QTYPE, dựng lại câu trả lời A record nếu host
  nằm trong allow-list, nếu không thì chuyển tiếp nguyên bytes lên 1.1.1.1.
* **JSON API** — `Accept: application/dns-json` (GET `?name=…&type=…`). Kết quả
  trả về đúng `{Status, TC, RD, RA, AD, CD, Question, Answer, Comment}`.

### Header chung

```
Cache-Control: max-age=60
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Vary: Accept
```

### Giới hạn tần suất

60 truy vấn / 10 phút / IP (token bucket trong `Map` ở module scope của isolate,
tự dọn rác theo kiểu lazy). Vượt giới hạn → **HTTP 429** kèm body JSON và
header `Retry-After: 600`.

## Allow-list

`src/whitelist.js` — host nào bị ép về proxy MITM của Fly.io:

| Loại      | Host                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Chính xác | `api.revenuecat.com`, `api.rc-backup.com`, `rev.cat`, `api.locketcamera.com`, `cdn.locketcamera.com`, `public.locketcamera.com`, `locket.camera`, `us-central1-locket-4252a.cloudfunctions.net`, `firebasestorage.googleapis.com`, `storage.googleapis.com` |
| Hậu tố   | `*.firebaseremoteconfig.googleapis.com`, `*.firebaseremoteconfig.google.com`, `*.remoteconfig.googleapis.com`                  |

> Worker **không bao giờ** trở thành open-resolver: tên miền lạ chỉ được phân
> giải qua 1.1.1.1 / 1.0.0.1.

## Cấu hình (`wrangler.toml`)

| Biến             | Mặc định                     | Ý nghĩa                                     |
| ---------------- | ---------------------------- | -------------------------------------------- |
| `FLY_PROXY_IP`   | *(đặt trong `wrangler.toml` `[vars]`)* | IP Fly.io MITM — **đặt giá trị thật vào `wrangler.toml` private, KHÔNG commit vào repo công khai** |
| `ROTATION_RATIO` | `0.8`                        | Tỉ lệ traffic dùng profile NextDNS riêng    |
| `NEXTDNS_BASE`   | `https://dns.nextdns.io`     | Base URL của NextDNS                         |
| `NEXTDNS_POOL`   | *(rỗng)*                     | Danh sách profile id, phân tách bằng dấu phẩy|

Khi `NEXTDNS_POOL` có giá trị, worker dùng hàm băm ổn định (`src/rotator.js`) để
chọn profile: cùng một client luôn nhận cùng một lựa chọn (dễ cache) nhưng cả
pool vẫn đạt ~80% lưu lượng.

## Chạy thử

```bash
cd dns
node --test "test/**/*.test.js"     # 17 test, không cần cài gói
npx wrangler dev                   # chạy local (cần wrangler)
```

```bash
curl https://doh.b1s.id.vn/health
curl -H 'accept: application/dns-json' \
  'https://doh.b1s.id.vn/fly/dns-query?name=api.revenuecat.com&type=A'
```

## Cấu trúc mã nguồn

| Tệp               | Vai trò                                              |
| ----------------- | ---------------------------------------------------- |
| `src/index.js`    | Entrypoint của worker, định tuyến và header         |
| `src/resolve.js`  | Phân giải upstream, parse/build DNS wire, cache      |
| `src/whitelist.js`| Danh sách host Locket/Firebase/RevenueCat             |
| `src/rotator.js`  | Băm ổn định + chọn profile theo tỉ lệ 80%           |
| `src/ratelimit.js`| Token bucket mỗi IP                                 |
