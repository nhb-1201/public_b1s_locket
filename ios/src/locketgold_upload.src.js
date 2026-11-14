// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Auto Khung Kawaii cho ảnh upload (DEVICE-LOCKED) v1.0
 *
 * Upload ẢNH lên Firebase/GCS bucket của Locket → photon WASM (worker B1sTeam
 * locket-filter-frame/frame-raw) crop vuông 1024 + vẽ khung Kawaii Gold (frame-12-gold)
 * → thay body bằng ảnh đã khung TRƯỚC khi ảnh rời máy. Không AI, không server ngoài.
 *
 * FAIL-OPEN tuyệt đối: không license / body không có bytes / worker lỗi → ảnh đi
 * QUA NGUYÊN TRẠNG (user không bao giờ mất ảnh).
 * Request không phải upload ảnh Locket → $done({}) passthrough trong vài micro-giây.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js

// @b1s-include ./lib/license-gate.js

// @b1s-include ./lib/b64.js

// @b1s-include ./lib/http-util.js

// @b1s-include ./lib/upload-frame.js
/* Accessor an toàn: $request/$response có thể KHÔNG tồn tại (chạy script thủ công trong
   trình soạn thảo của Shadowrocket, hoặc engine không cấp) — dùng $request trực tiếp sẽ ném
   ReferenceError làm script chết im lặng. */
var _req = (typeof $request !== "undefined" && $request) ? $request : {};
var _resp = (typeof $response !== "undefined" && $response) ? $response : {};

var _url = _req.url ? String($request.url) : "";
var _method = String(_req.method || "GET").toUpperCase();
var _rawHeaders = _req.headers ? $request.headers : {};

// Guard: ảnh VỪA được "rửa ảnh" xong (generateFilteredImage → worker vẽ khung) thì KHÔNG vẽ khung lần 2 khi upload
var _framedAt = 0;
try {
  _framedAt = Number(b1sStoreGet("b1s_frame_applied_at") || 0);
} catch (e) { /* bỏ qua */ }
var _alreadyFramed = _framedAt > 0 && Date.now() - _framedAt < 600000; // 10 phút

if (_alreadyFramed) {
  console.log("[locketgold] upload: ảnh đã có khung (vừa rửa ảnh) — passthrough, không vẽ lại");
  $done({});
} else if (looksLikeLocketImageUpload(_url, _method, _rawHeaders)) {
  gate(
    function () { handleLocketUpload(_url, _rawHeaders); },
    function () { $done({}); },
    "upload-frame"
  );
} else {
  $done({});
}
