# B1sTeam — Scanner (`scanner/`)

Bộ quét tĩnh cho cây thư mục repo: tìm **IP cứng** và **domain cứng**
bị quên trong mã nguồn, giúp phát hiện endpoint sót lại trước khi
phát hành.

## Dùng

```bash
node scanner/index.js                     # quét thư mục repo
node scanner/index.js --dir=./proxy/handler
node scanner/index.js --dns               # phân giải từng domain
node scanner/index.js --json              # xuất JSON cho CI
node scanner/index.js --self-check        # chạy assertion nội bộ
```

## Kết quả

```
=== B1sTeam · Scanner ===
Thư mục : D:\...\public_b1s_locket
Tệp đã quét : 12
IP cứng : đặt qua biến môi trường `FLY_PROXY_IP` (không công bố trong repo)
Domain : 7
 - api.revenuecat.com
 - api.rc-backup.com
 ...
```

Ở chế độ `--json`, output gồm `root`, `files`, `ips`, `domains`, `occurrences`
(và `resolved` khi kèm `--dns`).

## Quy tắc

| Loại      | Regex                                                                   |
| --------- | ----------------------------------------------------------------------- |
| IP        | IPv4 hợp lệ (bỏ qua `0.0.0.0`, `127.0.0.1`, `255.255.255.255`)          |
| Domain URL| host trong `http://` / `https://`                                        |
| Domain rule| `DOMAIN`, `DOMAIN-SUFFIX`, `hostname`, `Host`                             |

Phần mở rộng được quét: `js, mjs, cjs, module, sgmodule, plugin, stoverride,
snippet, conf, txt, json, yaml, yml, plist, xml, html`. Các thư mục
`node_modules`, `.git`, `dist`, `build` bị bỏ qua.

## API

```js
const { findEndpointsInText, scanDir, selfCheck } = require('./scanner');

findEndpointsInText('const ip = "1.2.3.4";', 'a.js');
// -> { ips: ['1.2.3.4'], domains: [], occurrences: [ { type, value, file, line } ] }

scanDir('./');
// -> { ips: [], domains: [], occurrences: [], files: 0, root: '…' }

selfCheck();  // -> { ok: true, checks: 8 }
```

## Chạy thử

```bash
node --test "scanner/test/**/*.test.js"
node scanner/index.js --self-check
```
