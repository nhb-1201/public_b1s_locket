# CHANGELOG — LocketGold (public_b1s_locket)

## [3.1.0] — 2026-11-14

**DoH v1.3.0 production + repo prune (chỉ Shadowrocket + DoH + MITM + JS)**

**DoH (doh.b1s.id.vn, worker `b1steam-dns` v1.3.0):**
- Blocklist O(#entries)×endsWith → **O(labels) Set walk** (CPU fix — không còn "rate limit" false-positive khi iOS bắn nhiều query).
- **Public DoH** `/dns-query` (không token) hoạt động trở lại — blocklist + stale-if-error + 1.1.1.1 fallback (Shadowrocket `.conf` dùng `dns-server = doh.b1s.id.vn/dns-query`).
- **Fallback 1.1.1.1** (RFC 8484) khi NextDNS bão hòa/lỗi — app vẫn resolve bình thường, không REFUSED giả.
- REFUSED chỉ áp dụng khi profile hết quota/đã bị revoke — giữ nguyên logic xoay vòng.
- Stale-if-error 24h; cache fresh 5 phút; D1 counter batch 10s.
- Deployed lên production (D1 `b1steam`): worker ID `ef49acfd-6bac-4ffd-a4e9-f582b6face93`.

**Repo prune (chỉ giữ 4 thành phần shipping):**
- Xóa `proxy/` (Python MITM + Go legacy + root CA + watchdog) — Shadowrocket MITM thay thế.
- Xóa `ca/` (Root CA — Shadowrocket dùng CA máy user), `scanner/`, `tools/`.
- Xóa `ios/locketgold.conf` (legacy, trùng all-in-one).

**task scheduler**: `B1sTeam-Proxy-Watchdog` đã gỡ (proxy LAN không còn); cổng 443/8443 FREE.

## [3.0.0 / module 7.8.0] — 2026-11-14

**Hoàn thiện triệt để — B1sTeam 100%**

- README viết lại; SECURITY.md; NOTICE; edge/ + frame-worker/ READMEs.
- `/alfretro` → `/locketvip` toàn repo; module v7.8.0.
- Backend v3.3.5 (moduleVersion 7.8.0); deploy thành công.

## [2.0.0] — 2026-11-14

- 4 edge frame workers deploy — round-robin + failover.

## [1.x] — trước đó

- Shadowrocket module v7.7.2 — 277/277 tests — post-outage restore từ `74579b2`.
