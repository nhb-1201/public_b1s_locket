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

var _url = ($request && $request.url) ? String($request.url) : "";
var _method = String(($request && $request.method) || "GET").toUpperCase();
var _rawHeaders = ($request && $request.headers) ? $request.headers : {};

if (looksLikeLocketImageUpload(_url, _method, _rawHeaders)) {
  gate(
    function () { handleLocketUpload(_url, _rawHeaders); },
    function () { $done({}); },
    "upload-frame"
  );
} else {
  $done({});
}
