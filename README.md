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

**1 file `.conf` duy nhất** (b1s.id.vn → AlFreToU → Đã kích hoạt):
- Tích hợp sẵn toàn bộ: script của **tất cả** app + LocketGold + **DNS chống thu hồi** (DoH B1sTeam) trong 1 file.
- Shadowrocket import làm **cấu hình chính** — **không** cài thêm module nào, **không** hồ sơ DNS riêng.
- (Phương án dự phòng: `ios/locketgold.sgmodule` — Shadowrocket **module**, gộp y hệt bằng `%APPEND%`.)


---

## 2. Cấu trúc repo

```
ios/
  src/                      ← NGUỒN script (sửa ở đây)
    lib/                      ← thư viện dùng chung (license gate + $argument) — 1 nguồn chân lý
      license-gate.js           ← deviceId / verify (7 ngày cache · 30 ngày grace · cooldown 5 phút) · isMediaUrl
      cdn-arg.js                ← đọc $argument "KEY|slug" (module cũ: worker vá placeholder)
    *.src.js                  ← mã nguồn từng script
    _b1s_unlock_configs.fragment.js  ← bảng cấu hình B1S_CONFIGS (dữ liệu)
    _remote_entries.fragment.js      ← bảng FORCE_ENTRIES Remote Config (dữ liệu)
  build.mjs                 ← node ios/build.mjs — inline lib → scripts/ + sinh .sgmodule từ .conf
  scripts/                  ← OUTPUT (GENERATED — không sửa tay) — script MITM CỦA B1STEAM (tự host)
    b1s_unlock.js              ← engine MITM chung (21 App Premium): merge / replace / revenuecat
    b1s_youtube.js             ← YouTube InnerTube
    b1s_spotify.js             ← engine Protobuf tự viết (Spotify bootstrap)
    locketgold_remote.js       ← ép Firebase Remote Config (~196 entries premium)
    locketgold_profile.js      ← badge Gold + tích xanh + paywall filter (402/403/400) + unblur
    locketgold_filters.js      ← ép vùng US + unblur + xoá cache 304 + forward overlay → worker khung Kawaii
    locketgold_deleteHeader.js ← xoá ETag/If-None-Match (chỉ xoá header)
  alfretro-allinone.conf    ← cấu hình Shadowrocket All-In-One (nguồn chân lý cho .conf + .sgmodule)
  locketgold.sgmodule       ← Shadowrocket MODULE (GENERATED — %APPEND% ở [MITM])
  locketgold.mobileconfig   ← hồ sơ Split DNS (iOS) — chỉ route Locket + RC + Firebase RC
  locketgold.conf           ← config Shadowrocket tĩnh (phiên bản LocketGold)
dns/
  worker.js                ← DoH Worker v7.0: telemetry + ads global + ads VN (3 nhóm) + race 3 upstream + stale 24h
android/                   ← cấu hình Android (chỉ giữ Gold đã kích hoạt)
```

---

## 3. Luồng cài (iOS)

1. **Shadowrocket** (App Store, ~72.000₫ mua 1 lần).
2. **HTTPS解密**: ⓘ → HTTPS解密 → bật → *生成新的 CA 证书* → Cài đặt → tin cậy chứng chỉ gốc.
3. **Kích hoạt miễn phí**: vào `b1s.id.vn/alfretro` → đăng nhập → "Kích hoạt miễn phí" → nhận key `B1S-XXXX-XXXX-XXXX`.
4. **Cài .conf**: vào `b1s.id.vn/da-kich-hoat` → bấm **"Tải file .conf về máy"** — Shadowrocket tự nhận `alfretro-<tail>.conf` (key nhúng sẵn, đã gồm toàn bộ script + DNS).
   *(Nếu .conf lỗi trên máy → bấm "Cài module (dự phòng)" ngay bên dưới — module `ios/locketgold.sgmodule` gộp y hệt.)*
5. **Bật Shadowrocket** → mở app → Premium hoạt động.
6. *(Tuỳ chọn)* **DNS dự phòng**: cài `locketgold.mobileconfig` — Split DNS khi tắt Shadowrocket (không bắt buộc — .conf đã gộp DNS DoH).

---

## 4. DNS (`doh.b1s.id.vn`)

- **Chặn (REFUSED)**: telemetry/attribution/crash SDK (mixpanel, app-measurement, sentry…) + mạng quảng cáo global + redirect cờ bạc/lừa đảo VN. **KHÔNG chặn RevenueCat** — đo thực tế: RC không resolve được → RC SDK ẩn huy hiệu Gold + UI membership. Việc chống thu hồi do MITM (`b1s_unlock.js`) đảm nhiệm: RC response luôn bị rewrite thành "Gold 2099" nên entitlement không thể bị thu hồi.
- **Không chặn**: `vnexpress.net`, `fpt.vn`, `zing.vn` — báo chí/nhà mạng thật (bản cũ chặn nhầm, đã gỡ ở v7.0).
- **Còn lại**: race **3 upstream** (1.1.1.1 / 8.8.8.8 / 9.9.9.9) — `Promise.any`, thắng ngay (~100ms).
- **Cache**: client 5 phút; edge giữ bản **stale 24h** → khi 3 upstream cùng chết, hệ thống **không sập**.
- **Split DNS (iOS)**: profile chỉ route `locketcamera.com` · `locket.camera` · `firebaseremoteconfig.googleapis.com`.
  RevenueCat **cố tình không đi qua DNS này** để module MITM luôn nhận được phản hồi subscription.
- **Android**: Private DNS cần **DoT (853)** còn `doh.b1s.id.vn` là **DoH (443)** → không dùng được cho Private DNS. Android chỉ giữ được Gold đã kích hoạt từ iOS.

---

## 5. Script tự host (không phụ thuộc repo bên thứ 3)

- `ios/scripts/*.js` (7 file) — **100% do B1sTeam tự viết**: `b1s_unlock.js` (engine MITM chung cho 21 app), `b1s_youtube.js` (YouTube InnerTube), `b1s_spotify.js` (engine Protobuf tự viết) + 4 script LocketGold.
- **Build**: sửa `ios/src/**` → `node ios/build.mjs` (inline `lib/` → `scripts/`, sinh `locketgold.sgmodule` từ `alfretro-allinone.conf`). Kiểm tra đồng bộ: `node ios/build.mjs --check`.
- Nguồn gốc + giấy phép + quét an toàn: [`ios/scripts/NOTICE.md`](ios/scripts/NOTICE.md).
- **Không còn file JS nào của repo khác** — toàn bộ script đã được rewrite sang engine của B1sTeam.
- Không script nào phone-home, không gọi `translate.google.com`, không telemetry.

---

## 6. Vận hành

| Việc | Lệnh |
|---|---|
| Build scripts + module | `node ios/build.mjs` (kiểm tra: `--check`) |
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
