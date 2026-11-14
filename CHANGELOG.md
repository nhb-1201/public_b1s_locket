# CHANGELOG — LocketGold (public_b1s_locket)

## [3.0.0 / module 7.8.0] — 2026-11-14

### Hoàn thiện triệt để — B1sTeam 100%

**UI / branding:**
- Toàn bộ tên & chữ "Aurora" xóa sạch (CA, .mobileconfig, proxy, docs) — hệ **B1sTeam**.
- `/alfretro` gỡ hoàn toàn; `.conf`, scripts, landing chỉ còn `/locketvip`.
- Landing `ios/conf.html` + `ios/module.html` thiết kế lại hoàn toàn: nền emerald đậm,
  huy hiệu sao butter `#ffd166 → #ffb703`, grid kawaii, 3 chip bước, CTA `/locketvip`.
- README được viết lại hoàn toàn: kiến trúc, security, triển khai, giới hạn, 9 mục.
- Xóa "Locket XVIP" / các tên cũ; `version.json` root = 3.0.0; `ios/version.json` = 7.8.0.

**Shadowrocket module (v7.8.0):**
- `#!name=B1sTeam — LocketGold (Free)`; homepage → `https://b1s.id.vn/locketvip`.
- Scripts `.js` tái build qua `ios/build.mjs`, output `.v7.8.0.js` (cache-busting file naming).
- CDN `raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/...` luôn đồng bộ.

**Backend:**
- `locketgold-backend` v3.3.5 (`MODULE_VERSION = "7.8.0"`) — `module/all-in-one` trả về v7.8.0
  từ CDN live (khớp). Deploy lại lên `locket.b1s.id.vn`.
- LICENSE gate: cache in-memory 6h (không spam verify), `WFH_HALO_COOLDOWN` gắn theo device id,
  device id deterministic `mitm-<hash(key)>` (không random-device mismatch).

**DoH (doh.b1s.id.vn) — optional nhưng khuyến nghị:**
- `.mobileconfig` "B1sTeam DNS — LocketGold" (ECC P-256 Root CA, iOS 14+) — sinh lại từ backend
  `b1steam_web` branch `backend` (commit `c81a4198`, B1sTeam identity 100%).
- 4 frame workers đã deploy; proxy python ở LAN + watchdog Auto-start.

**Ops:**
- Proxy Python (`proxy/python/mitm_proxy.py`) nghe 443 + 8443 (PORTS env), dual-protocol
  (TLS MITM / plain HTTP cho `/proxy.pac` + `/healthz`), `CONNECT` support (Global HTTP Proxy).
- `proxy/python/public_ip.py` — auto-detect IP động; `proxy/python/build_pac_profile.py`.
- Watchdog `Task Scheduler "B1sTeam-Proxy-Watchdog"` — health-check 600-900s ngẫu nhiên, restart nếu chết.

### Sửa lỗi

- Backend: served `.conf` cũ v7.7.2 (homepage `/alfretro`) — redeploy v3.3.5 (7.8.0).
- UUID in `mobileconfig.ts` sai định dạng (8-4-8-4-16) — sửa 8-4-4-4-12.
- `b1s.id.vn/locketgold` (worker WEBSITE var) → `/locketvip`.

## [2.0.0] — 2026-11-14

### Lỗi hệ (rollback Shadowrocket có giới hạn)

- 4 edge frame workers đã được deploy — phân tải round-robin random + failover từ upload-frame.

## [1.x] — trước đó

- Shadowrocket module v7.7.2 — 277/277 tests — production outage d70d969 (rewrite phá vỡ) + hồi phục từ `74579b2`.
