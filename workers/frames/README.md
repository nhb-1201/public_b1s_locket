# B1sTeam — Worker khung ảnh (`workers/frames`)

Sáu worker Cloudflare (`b1steam-frames-1` … `b1steam-frames-6`) phục vụ **khung
ảnh LocketGold (Free)**. Tất cả dùng chung một mã nguồn, khác nhau ở tên nên
có thể chia tải và CDN cache độc lập.

## Routes

| Method | Path       | Mô tả                                                             |
| ------ | ---------- | ----------------------------------------------------------------- |
| GET    | `/frames`  | Catalog JSON (toàn bộ khung, hỗ trợ `?group=` và `?premium=1`)    |
| GET    | `/f/:id`   | Bytes PNG của khung (từ KV/R2) hoặc PNG 1×1 trong suốt            |
| GET    | `/health`  | `{"ok":true,"worker":"b1steam-frames"}`                            |

`/f/:id` **không bao giờ trả về 5xx**: khi thiếu asset, worker trả về PNG 1×1
trong suốt kèm header `X-B1s-Frame: placeholder` để app vẫn hiển thị được.

## Catalog

`src/catalog.ts` chứa sẵn danh mục khung (id, tên tiếng Việt, nhóm, file, tag,
cờ premium) nên worker **compile độc lập** — không cần import từ thư mục
`assets/`. Khi thêm khung mới chỉ cần sửa file này.

## Deploy

```bash
cd workers
bash deploy.sh          # deploy cả 6
bash deploy.sh 2 5      # chỉ deploy b1steam-frames-2 và -5
```

Script gọi `wrangler deploy --env fN` (mỗi môi trường `f1`…`f6` trong
`frames/wrangler.toml` đặt lại `name`). Biến `WRANGLER` cho phép dùng bản
wrangler cài sẵn: `WRANGLER=wrangler bash deploy.sh`.

## Bindings (tuỳ chọn)

| Binding        | Loại   | Dùng để                                        |
| -------------- | ------ | ---------------------------------------------- |
| `FRAMES`       | KV     | Chứa PNG dạng base64 (key = id hoặc tên file)  |
| `FRAMES_BUCKET`| R2     | Chứa PNG dạng binary                           |

Cả hai đều tuỳ chọn: nếu không khai báo binding, worker vẫn chạy và luôn trả
về placeholder cho mọi khung.

## Kiểm tra nhanh

```bash
curl https://b1steam-frames-1.b1s.id.vn/health
curl https://b1steam-frames-1.b1s.id.vn/frames
curl -o frame.png https://b1steam-frames-1.b1s.id.vn/f/frame-royal-gold
```
