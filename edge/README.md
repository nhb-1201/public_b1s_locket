# B1sTeam — Edge Gateway (`b1steam-edge`)

> 4 Cloudflare Workers (4 tài khoản phụ) — Relay minh bạch cho Shadowrocket modules.
> Zero-logging · strict allowlist · không nói chuyện với B1sTeam auth server.

## Endpoints

| Method | Path | Tác dụng |
|---|---|---|
| `GET` | `/health` | `{"ok":true,"service":"b1steam-edge","version":"1.0.0","edge":"<account>"}` |
| `GET` | `/rc` | Remote Config relay: fetch Google RC server-side, ép `state=UPDATE` + `templateVersion=Date.now()` + `cache_ttl*=0`, trả JSON |
| `GET` | `/vip/list` | Danh sách Vinh danh Gold (cache 300s ở edge) |
| `OPTIONS` | `*` | CORS preflight → 204 (origin `*`), chỉ cho phép method `GET, OPTIONS` |

Mọi path khác → `403 JSON {"error":"path_not_allowed"}`. Không tunnel → không tự do.

## Bảo mật

- TLS bắt buộc (`.workers.dev` chỉ phục vụ HTTPS).
- **Không log body**, không lưu dữ liệu, không forward custom URL.
- Allowlist cứng — routing cố định, không open proxy.

## Deploy (sau khi vào đúng CF account)

```bash
cd edge
wrangler deploy gateway.js --name b1steam-edge
```

4 account: `b1steam-edge-02/03/05/06` (cấu hình `wrangler.edge.toml` trong `frame-worker/`).

---
© B1sTeam — Nguyễn Hoàng Bách — b1s.id.vn — Zalo 083.3399.553
