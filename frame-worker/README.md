# B1sTeam — Frame Worker (`locket-filter-frame`) v2.0.0

> Cloudflare Worker + WASM (`@cf-wasm/photon`) — Vẽ khung Kawaii lên ảnh của người dùng.
> 4 tài khoản — round-robin + failover từ client/proxy.

## Endpoints

| Method | Path | Tác dụng |
|---|---|---|
| `GET` | `/health` | `{"ok":true,"service":"locket-filter-frame","version":"2.0.0","edge":"<account>"}` |
| `POST` | `/apply-frame` | Áp khung lên ảnh user (bearer token `locket.b1s.id.vn`-issued) |
| `GET/HEAD` | `/assets/*` | Assets (icons/frames) — 301 sang raw repo |

## Auth (v2.0.0)

- **`x-b1s-proxy-key`** — server-side (proxy LAN dùng) — shared secret
- **`x-b1s-license` + `x-b1s-device`** — device-bound (Shadowrocket đưa qua module) — license key + device id `mitm-<hash>`, hiệu lực 60 phút

Frame worker **không chấp nhận** request thiếu auth.

## Deploy

```bash
cd frame-worker
# Account 2: cấu hình wrangler.edge.toml
wrangler deploy --env edge --config wrangler.edge.toml
# Account main (vinhsamkeit): wrangler.toml
wrangler deploy
# Sau khi deploy, đặt secret trên từng account:
wrangler secret put PROXY_SHARED_KEY
```

---
© B1sTeam — Nguyễn Hoàng Bách — b1s.id.vn — Zalo 083.3399.553
