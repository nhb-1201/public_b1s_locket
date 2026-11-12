# LocketGold / AlFreToU — B1sTeam

> **Mọi thứ trong repo này chạy 100% trên thiết bị của người dùng.** Không máy chủ trung gian, không thu thập dữ liệu, không telemetry.

**B1sTeam — b1s.id.vn · Nguyễn Hoàng Bách · Zalo 083.3399.553**

---

## 1. Sản phẩm: AlFreToU (All Free To Use) — 0₫, vĩnh viễn

1 key duy nhất mở khóa **toàn bộ**: LocketGold VIP (24 tính năng) + **23 App Premium**.

| Nhóm | App |
|---|---|
| Mạng xã hội | **LocketGold** (Gold VIP iOS + AI Filter Unlock) |
| Video | YouTube Premium · CapCut Pro · Alight Motion · KineMaster · Mojo Pro |
| Ảnh | PicsArt · Lightroom · Photoshop Express · PicCollage · BeautyPlus · Meitu Xiuxiu |
| AI | PhotoRoom Pro · ToonMe Pro · Wink (Meitu) |
| Âm thanh | Spotify Premium · SoundCloud Go+ |
| Camera | VSCO · SNOW Premium · TOK CAM Pro |
| PDF | Smallpdf Pro · iLovePDF Pro |
| Tiện ích | Truecaller Premium · CamScanner |

**1 module duy nhất** (b1s.id.vn → AlFreToU → Đã kích hoạt):
- Chứa script của **tất cả** app + LocketGold + **DNS chống thu hồi** (DoH B1sTeam) trong 1 file.
- **Không** phải cài từng module riêng, **không** cần hồ sơ DNS riêng.


---

## 2. Cấu trúc repo

```
ios/
  scripts/                 ← script MITM CỦA B1STEAM (tự host, có license gate — 100% tự viết)
    locketgold_revenuecat.js   ← ghi entitlement Gold vĩnh viễn vào response RevenueCat
    locketgold_remote.js       ← ép 248 entry Remote Config (feature premium + 240 caption tiếng Việt)
    locketgold_profile.js      ← badge Gold + tích xanh + mở paywall filter (402/403/400) + unblur
    locketgold_filters.js      ← AI Filter Unlock: giả vùng US + unblur ảnh + xoá cache 304 + can_use_filters
    b1s_unlock.js              ← engine MITM chung cho 21 app Premium
    b1s_youtube.js             ← YouTube InnerTube
    b1s_spotify.js             ← engine Protobuf tự viết (Spotify bootstrap)
    locketgold_deleteHeader.js ← xoá ETag/If-None-Match (không cần license gate — chỉ xoá header)
  locketgold.mobileconfig  ← hồ sơ Split DNS (iOS) — chỉ route Locket + RC + Firebase RC
  locketgold.conf          ← config Shadowrocket tĩnh (phiên bản LocketGold) — có #hostname scoping, DNS
dns/
  worker.js                ← DoH Worker: REFUSED anti-revoke + telemetry + ads global + ads VN (4 nhóm) + race 3 upstream + stale 24h
android/                   ← cấu hình Android (chỉ giữ Gold đã kích hoạt)
```

---

## 3. Luồng cài (iOS)

1. **Shadowrocket** (App Store, ~72.000₫ mua 1 lần).
2. **HTTPS解密**: ⓘ → HTTPS解密 → bật → *生成新的 CA 证书* → Cài đặt → tin cậy chứng chỉ gốc.
3. **Kích hoạt miễn phí**: vào `b1s.id.vn/alfretro` → đăng nhập → "Kích hoạt miễn phí" → nhận key `B1S-XXXX-XXXX-XXXX`.
4. **Cài module**: vào `b1s.id.vn/da-kich-hoat` → bấm **"Cài module duy nhất"** — Shadowrocket tự mở file `.module` có nhúng key của bạn.
5. **Bật Shadowrocket** → mở app → Premium hoạt động.
6. *(Tuỳ chọn)* **DNS dự phòng**: cài `locketgold.mobileconfig` — Split DNS chặn thu hồi Gold khi tắt Shadowrocket (không bắt buộc — module đã gộp DNS DoH).

---

## 4. DNS (`doh.b1s.id.vn`)

- **Chặn (REFUSED)**: `revenuecat.com` · `rc-backup.com` · `rev.cat` + telemetry (mixpanel, app-measurement…).
- **Còn lại**: race **3 upstream** (1.1.1.1 / 8.8.8.8 / 9.9.9.9) — `Promise.any`, thắng ngay (~100ms).
- **Cache**: client 5 phút; edge giữ bản **stale 24h** → khi 3 upstream cùng chết, hệ thống **không sập**.
- **Split DNS (iOS)**: profile chỉ route `locketcamera.com` · `locket.camera` · `firebaseremoteconfig.googleapis.com`.
  RevenueCat **cố tình không đi qua DNS này** để module MITM luôn nhận được phản hồi subscription.
- **Android**: Private DNS cần **DoT (853)** còn `doh.b1s.id.vn` là **DoH (443)** → không dùng được cho Private DNS. Android chỉ giữ được Gold đã kích hoạt từ iOS.

---

## 5. Script tự host (không phụ thuộc repo bên thứ 3)

- `ios/scripts/*.js` (8 file) — **100% do B1sTeam tự viết**: `b1s_unlock.js` (engine MITM chung cho 21 app), `b1s_youtube.js` (YouTube InnerTube), `b1s_spotify.js` (engine Protobuf tự viết) + 5 script LocketGold.
- Nguồn gốc + giấy phép + quét an toàn: [`ios/scripts/NOTICE.md`](ios/scripts/NOTICE.md).
- **Không còn file JS nào của repo khác** — toàn bộ script đã được rewrite sang engine của B1sTeam.
- Không script nào phone-home, không gọi `translate.google.com`, không telemetry.

---

## 6. Vận hành

| Việc | Lệnh |
|---|---|
| Deploy DNS Worker | `cd dns && node ../locketgold-backend/node_modules/wrangler/bin/wrangler.js deploy` |
| Deploy LocketGold Worker | `cd locketgold-backend && node node_modules/wrangler/bin/wrangler.js deploy` |
| Migration D1 (locketgold) | `node node_modules/wrangler/bin/wrangler.js d1 execute locketgold-db --remote --file=d1/migrations/00XX_<ten>.sql` |
| Secrets worker | `node node_modules/wrangler/bin/wrangler.js secret put <ADMIN_HOOK\|XFER_HOOK\|RESEND_API_KEY>` |
| Deploy frontend | push nhánh `main` của `b1steam_web` → Vercel tự build |
| Deploy shop backend | push nhánh `backend` của `b1steam_web` → GitHub Actions (Cloudflare Workers) |

> Lưu ý: `locketgold-backend/` **không nằm trong git** (deploy trực tiếp bằng wrangler). Nên sao lưu mã nguồn worker vào repo riêng hoặc `b1steam_web` khi có thời gian.

---

## 7. Trách nhiệm & giới hạn

- Mọi thứ **phía client**: mở khoá subscription bằng cách ghi đè phản hồi API trên máy người dùng. Không tấn công máy chủ của app, không sửa dữ liệu tài khoản.
- Nếu hãng app **vá endpoint** → tính năng tương ứng tạm ngừng cho tới khi B1sTeam cập nhật script.
- Dự án cộng đồng, **không liên kết** với Locket Labs, Inc.
- Hỗ trợ: **Zalo 083.3399.553**.

© B1sTeam — b1s.id.vn
