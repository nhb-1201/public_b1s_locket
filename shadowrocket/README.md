# B1sTeam — LocketGold (Free) · Bộ Shadowrocket Module

> **LocketGold (Free)** — bộ script MITM của **B1sTeam** để mở khoá tính năng Gold của app
> Locket (iOS) **ngay trên máy**, không cần jailbreak, không cần server trung gian.
> Mọi thay đổi diễn ra cục bộ trong bộ nhớ của Shadowrocket.

| | |
|---|---|
| Tác giả | **B1sTeam** — Nguyễn Hoàng Bách |
| Website | <https://b1s.id.vn/locketvip> |
| Telegram / Zalo | <https://zalo.me/0833399553> |
| Repo | <https://github.com/nhb-1201/public_b1s_locket> |
| Phiên bản bộ script | `4.0.0` |
| Ngày cập nhật | `2026-11-14` |

---

## 1. Cấu trúc thư mục

```
public_b1s_locket/shadowrocket/
├── js/                     # 11 script — MỖI script MỘT MỐI QUAN TÂM, tự chứa hoàn toàn
│   ├── b1s_revenuecat_request.js
│   ├── b1s_revenuecat_response.js
│   ├── b1s_firebase_request.js
│   ├── b1s_firebase_response.js
│   ├── b1s_locket_api_response.js
│   ├── b1s_photobooth_request.js
│   ├── b1s_photobooth_response.js
│   ├── b1s_frame_router.js
│   ├── b1s_profile_request.js
│   ├── b1s_profile_response.js
│   └── b1s_conf_header.js
├── modules/                # 5 định dạng module + 1 file include phụ cho Surge
│   ├── B1sTeam_LocketGold.sgmodule      # Shadowrocket (định dạng chính)
│   ├── B1sTeam_LocketGold.snippet       # Stash / Loon
│   ├── B1sTeam_LocketGold.plugin        # Surge
│   ├── B1sTeam_LocketGold_MITM.plugin   # file include phụ cho Surge (Header Rewrite + Host)
│   ├── B1sTeam_LocketGold.stoverride    # Shadowrocket "Script Override"
│   └── B1sTeam_LocketGold.module        # Quantumult X
├── assets/
│   └── frames/             # 14 ảnh khung + catalog.json
├── build.mjs               # build tool (Node ESM, không phụ thuộc)
└── dist/                   # OUTPUT — bản phát hành có license key nhúng (không commit)
```

> Shadowrocket **không hỗ trợ** `require`/`import` giữa các script ⇒ mỗi file trong `js/`
> là **self-contained**: có sẵn helper riêng, bọc trong IIFE, và luôn kết thúc bằng
> `$done({})` khi lỗi ⇒ **không bao giờ làm hỏng request**.

---

## 2. Từng script làm gì

### 2.1 `b1s_revenuecat_request.js` — REQUEST · RevenueCat
Gỡ sạch header cache của RevenueCat: `X-RevenueCat-ETag`, `If-None-Match`, `If-Modified-Since`.
**Vì sao:** RevenueCat trả `304 Not Modified` ⇒ body rỗng ⇒ app không thấy `subscriber` ⇒ mất Gold.

### 2.2 `b1s_revenuecat_response.js` — RESPONSE · RevenueCat
Bơm **Gold vĩnh viễn** vào JSON RevenueCat:

* `subscriber.entitlements` → `Gold`, `gold`, `locket_gold`, `locket.premium.yearly`,
  `com.locketgold.vip_yearly`, `membership`, `premium`, `pro`
* `subscriber.subscriptions` + `subscriber.non_subscriptions` → `locket_1600_1y`,
  `locket_199_1m`, `locket.premium.yearly`, `com.locket02.premium.yearly`, `locket_gold`
* `subscriber.management_url = null` (ẩn nút "Quản lý đăng ký")
* `Attention` + `attention_banner` → banner thông báo B1sTeam trong app

Tính chất: **idempotent** (mọi ngày đều là hằng số — chạy 10 lần kết quả giống nhau) và
**chịu được body rỗng/hỏng** (fallback về `{}` rồi vẫn trả payload hợp lệ).

### 2.3 `b1s_firebase_request.js` — REQUEST · Firebase Remote Config
Gỡ `x-firebase-etag`, `x-goog-if-none-match`, `if-none-match`, `if-modified-since`
⇒ Firebase luôn trả config mới, không trả 304.

### 2.4 `b1s_firebase_response.js` — RESPONSE · Firebase Remote Config
Bơm cờ RC (đúng tên flag thật của Locket):

* **Gold/VIP**: `is_gold`, `is_premium`, `is_subscriber`, `gold_enabled`, `locket_gold_enabled`…
* **Khung VIP**: `camera_frame_enabled`, `photo_frame_enabled`, `frames_enabled`, `camera_frames`…
* **Caption VIP**: `captions_enabled`, `overlay_dynamic_captions` (20+ loại caption)…
* **Widget Gold**: `widget_frame_event`, `widget_badge_enabled`, `custom_widget_frames_config`…
* **Streak recovery**: `streak_config`, `streak_recovery`, `streak_visualization`
* **Tắt quảng cáo + telemetry**: `remove_ads`, `history_ads_*`, `sentry_*`
* **`feature_gates`**: bật toàn bộ gate premium; **`upsell_features`**: tắt hết pop-up nâng cấp
* **Gộp catalog khung B1sTeam** vào `b1s_frame_catalog` / `camera_frame_config` /
  `photo_frame_event` / `widget_frame_event`

### 2.5 `b1s_locket_api_response.js` — RESPONSE · Locket Camera API
1. **Gỡ blur** — đồng bộ mọi field ảnh về bản thật (`unblurred_url` / `result_url`…).
2. **Gỡ paywall** — xoá `error`/`errors`, ép `requires_gold=false`, `is_locked=false`.
3. **Badge Gold** — mọi object có field `uid` đều được gắn `badge = locket_gold` + `verified`.
4. **Ép HTTP 200** cho lỗi `400/402/403` — *trừ* endpoint feed (giữ nguyên để không vỡ
   danh sách bạn bè / khoảnh khắc).

### 2.6 `b1s_photobooth_request.js` — REQUEST · Photobooth / Overlay
Đọc body `POST /generateFilteredImage`, bắt **URL ảnh gốc** + **id bộ lọc**, lưu vào
store của máy (`b1s_pb_photo_url`, `b1s_pb_filter_id`) để script response dùng lại.

### 2.7 `b1s_photobooth_response.js` — RESPONSE · Photobooth / Overlay
Với bộ lọc kiểu overlay/photobooth mà server trả lỗi ⇒ trả **200 kèm ảnh gốc** ⇒ app không
còn màn hình trắng / "Không thể áp dụng bộ lọc". Đồng thời dọn sạch payload lỗi.

### 2.8 `b1s_frame_router.js` — RESPONSE · Khung (frame router)
* Đọc catalog khung từ store (`b1s_frame_catalog`) — nếu không có thì dùng bản nhúng sẵn.
* Mở khoá mọi khung: `requires_gold=false`, `is_locked=false`, `unlocked=true`, `is_gold=true`…
* Đổi URL ảnh sang worker B1sTeam, **xoay vòng 6 node**:
  `https://b1steam-frames-{1..6}.workers.dev/f/:id`

### 2.9 `b1s_profile_request.js` — REQUEST · Hồ sơ
* `changeProfileInfo` **không** có bio thật ⇒ trả luôn `200` + profile Gold/Verified.
* `changeProfileInfo` **có** bio thật ⇒ passthrough (server lưu nguyên vẹn).
* Gỡ header cache cho mọi API Locket.

### 2.10 `b1s_profile_response.js` — RESPONSE · Hồ sơ
Ép mọi payload hồ sơ (của bạn, bạn bè, chat…): `badge = locket_gold`, `is_gold = true`,
`verified = true`, `bio` = credit B1sTeam, cùng bộ cờ "đã mở khoá".

### 2.11 `b1s_conf_header.js` — REQUEST · Header license
Tiện ích nhỏ gắn header `X-B1s-License` khi tìm thấy key — theo thứ tự:
key nhúng trong file (`__LICENSE_KEY__` được build thay lúc phát hành) → `$argument`
(`{"key":"…"}`, `key=…`, `B1S-XXXX-XXXX-XXXX`) → store máy (`b1s_license_key`).
Không có key ⇒ không thêm header, request đi nguyên vẹn.

---

## 3. Danh sách host MITM

| Host | Mục đích |
|---|---|
| `api.revenuecat.com` | RevenueCat — entitlement Gold |
| `*.rc-backup.com` | RevenueCat dự phòng |
| `rev.cat` | RevenueCat (rút gọn) |
| `*.firebaseremoteconfig.googleapis.com` | Firebase Remote Config |
| `*.firebaseremoteconfig.google.com` | Firebase Remote Config (domain cũ) |
| `*.remoteconfig.googleapis.com` | Firebase Remote Config (domain mới) |
| `*.locketcamera.com` | API Locket Camera |
| `locket.camera` | API Locket Camera (domain rút gọn) |
| `us-central1-locket-4252a.cloudfunctions.net` | Cloud Function của Locket |
| `*.firebasestorage.googleapis.com` | Firebase Storage (ảnh Locket) |
| `storage.googleapis.com` | Google Storage (ảnh Locket) |

Ngoài MITM, module còn **REJECT** toàn bộ host quảng cáo / telemetry
(AdMob, Google Ads, AppsFlyer, Adjust, Criteo, Sentry, Amplitude, Mixpanel, Moloco,
Firebase Logging…) và **DIRECT** các host trong bảng trên (không qua proxy trung gian),
kèm `DOMAIN-SUFFIX,doh.b1s.id.vn,DIRECT` cho DoH của B1sTeam.

---

## 4. Cài đặt

### 4.1 Shadowrocket (khuyến nghị)

1. Tải module về máy hoặc mở link:
   `https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/shadowrocket/modules/B1sTeam_LocketGold.sgmodule`
2. **Shadowrocket → tab `Module` → nút `+`** → chọn **URL** → dán link module → `Download`.
   (Có thể dán luôn link sâu: `shadowrocket://add/modules?url=<link module>`)
3. Bật công tắc module **B1sTeam — LocketGold (Free)** (màu xanh).
4. **Cấu hình → (i) → `HTTPS Decryption` → BẬT** → `Generate CA` → `Install`.
5. **Cài CA**: vào *Cài đặt › Cấu hình › CA đã cài đặt* của iOS, bật *"Tin cậy đầy đủ"*
   cho CA vừa cài (bắt buộc, nếu không app sẽ báo lỗi mạng).
6. **Bật kết nối** VPN. Mở app Locket → đăng nhập lại (để app kéo entitlement mới).

> **Bước 5 rất quan trọng**: iOS chỉ tin CA khi được bật "Tin cậy đầy đủ".
> Không làm bước này ⇒ HTTPS Decryption sẽ báo lỗi ⇒ **script không bao giờ chạy**.

### 4.2 Stash / Loon

* Stash/Loon → *Subscription / Profile* → thêm **Snippet** bằng link
  `.../shadowrocket/modules/B1sTeam_LocketGold.snippet`
* Bật MITM + cài CA theo hướng dẫn của ứng dụng.

### 4.3 Surge

* Surge → *Module* → *Add Module* → link `.../shadowrocket/modules/B1sTeam_LocketGold.plugin`
  (plugin tự `#!include` file `B1sTeam_LocketGold_MITM.plugin` cho phần Header Rewrite).

### 4.4 Quantumult X

* QX → *Phục vụ → Subscription → Resource Parse* → link
  `.../shadowrocket/modules/B1sTeam_LocketGold.module`

### 4.5 Shadowrocket "Script Override" (`.stoverride`)

Dùng khi bạn đã có sẵn module/conf riêng và chỉ muốn **ghép thêm** bộ script B1sTeam:
vào *Cấu hình → Script Override* → import `B1sTeam_LocketGold.stoverride`.

---

## 5. Định dạng link cài (deep-link)

| Mục đích | Link |
|---|---|
| Module Shadowrocket (chính) | `shadowrocket://add/modules?url=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/shadowrocket/modules/B1sTeam_LocketGold.sgmodule` |
| Module Shadowrocket (có key) | `shadowrocket://add/modules?url=<link trên>&key=B1S-XXXX-XXXX-XXXX` |
| Snippet Stash/Loon | `stash://install-sub?url=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/shadowrocket/modules/B1sTeam_LocketGold.snippet` |
| Surge plugin | `surge:///install-module?url=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/shadowrocket/modules/B1sTeam_LocketGold.plugin` |
| Quantumult X module | `quantumult-x://install?url=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/shadowrocket/modules/B1sTeam_LocketGold.module` |

Trong các file module, URL script luôn có dạng:

```
https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/shadowrocket/js/<tên file>.js?key=__LICENSE_KEY__
```

và mỗi dòng script có `argument=__LICENSE_KEY__`.
Placeholder `__LICENSE_KEY__` được **backend thay lúc sinh bản phát hành** — nếu bạn cài bản
chưa thay key, script vẫn chạy bình thường nhưng **không** gửi header license.

---

## 6. Build / kiểm tra

```bash
# Build: chuẩn hoá banner + version trong js/, sinh dist/ (chưa nhúng key)
node shadowrocket/build.mjs

# Build kèm license key (bản phát hành trong dist/)
node shadowrocket/build.mjs --key=B1S-XXXX-XXXX-XXXX

# Chỉ kiểm tra — exit code khác 0 nếu có file stale hoặc lỗi cú pháp
node shadowrocket/build.mjs --check
```

* `build.mjs` đọc version từ `public_b1s_locket/version.json` (nguồn sự thật duy nhất).
* Banner version + banner tác giả được **chèn idempotent & deterministic** (không có
  timestamp ⇒ chạy lại cho ra đúng file cũ, byte-for-byte).
* Mọi `js/*.js` được kiểm tra cú pháp bằng `node:vm` (tương đương `node --check`).
* `dist/` là thư mục output — **không commit** (đã có `shadowrocket/.gitignore`).

---

## 7. Khắc phục sự cố

### ❌ "Vẫn không thấy Gold"

1. **Bật đúng HTTPS Decryption.** *Cấu hình → (i) → HTTPS Decryption → BẬT*.
2. **Tin cậy CA.** *Cài đặt › Cài đặt › CA được cài đặt* → bật *"Tin cậy đầy đủ"*.
   Không bật ⇒ mọi request MITM bị chặn ⇒ script không chạy.
3. **Kiểm tra log script**: Shadowrocket → *Script* → chạy tay `b1s_revenuecat_response.js`
   hoặc xem log `PacketTunnel`. Tìm dòng `[locketgold] rc-response: …` — nếu có ⇒ script
   đã chạy; nếu không có ⇒ request không đi qua MITM (kiểm tra lại host trong `[MITM]`).
4. **Xoá cache app**: tắt hẳn Locket, xoá app rồi cài lại, đăng nhập lại (app cache
   entitlement cũ ở local storage).
5. **304 là thủ phạm phổ biến nhất**: nếu log không hiện gì, kiểm tra
   `b1s_revenuecat_request.js` / `b1s_firebase_request.js` đã được tải về (Script → mục
   script phải có dấu ✓). Nếu script tải lỗi → kiểm tra mạng / GitHub raw bị chặn.
6. **Script chỉ chạy MỘT script khớp đầu tiên cho mỗi phase** — nếu bạn tự thêm script
   khác vào module, hãy đặt nó **sau** các script B1sTeam trong `[Script]`.

### ❌ Quay video / filter bị lỗi hoặc treo
* Kiểm tra `b1s_photobooth_request.js` đã bật `requires-body=true`.
* Nếu dùng app đã cài từ lâu: vào *Script* → xoá cache script (biểu tượng rác) rồi tải lại.

### ❌ Không thấy khung (frame) trong app
* Khung lấy từ worker `b1steam-frames-{1..6}.workers.dev` ⇒ cần mạng tới Cloudflare Workers.
* Module đã có rule `DOMAIN-SUFFIX,b1steam-frames-N.workers.dev,DIRECT` — nếu bạn dùng
  rule-set khác, hãy thêm lại các rule này.

### ❌ "Không phân giải được hostname"
* Bạn đã bật MITM nhưng **chưa** bật `HTTPS Decryption` (phần này tách riêng).
* Hoặc host chưa nằm trong danh sách `[MITM]` của module.

### ❌ Module tải về nhưng script báo lỗi cú pháp
* Chạy `node shadowrocket/build.mjs --check` để xác nhận `js/*.js` hợp lệ.
* Shadowrocket dùng JSCore ⇒ mọi script ở đây chỉ dùng ES5-ish (`var`, không `let/const`,
  không arrow function, không template literal).

---

## 8. Ghi chú bảo mật & trách nhiệm

* Script **chỉ chạy trên máy của bạn**, không gửi dữ liệu người dùng (tài khoản, ảnh, tin
  nhắn) đi đâu. Chỉ có header `X-B1s-License` (license key của chính bạn) được gửi kèm
  request tới Locket.
* Khung ảnh được tải từ worker của B1sTeam (`b1steam-frames-*.workers.dev`).
* Việc dùng công cụ để mở khoá tính năng trả phí của ứng dụng khác **có thể vi phạm điều
  khoản sử dụng** của nhà phát hành. Bạn tự chịu trách nhiệm với mọi hậu quả; B1sTeam chỉ
  cung cấp công cụ **để nghiên cứu/khắc phục tính năng trên thiết bị của chính mình**.
* B1sTeam **không** thu thập, lưu trữ hay phân tích dữ liệu người dùng của bất kỳ ứng dụng
  nào.

---

## 9. Giấy phép

MIT — xem [`../LICENSE.md`](../LICENSE.md) của repo `public_b1s_locket`.
Mọi script trong `shadowrocket/js/` là mã **do B1sTeam tự viết**.

<div align="center">

**B1sTeam** · Nguyễn Hoàng Bách · [b1s.id.vn](https://b1s.id.vn/locketvip) · [@b1steam](https://zalo.me/0833399553)

</div>
