// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Camera/AI Filter unlock + WebSocket passthrough (DEVICE-LOCKED) v4.1
 *
 *   1) REQUEST  → xoá header cache (chống 304) + ép vùng US (Locket chỉ mở filter
 *                 thử nghiệm ở US) + forward overlay/frame id → worker B1sTeam.
 *   2) REQUEST  → WebSocket handshake (wss_v2/group — groups realtime): KHÔNG đụng
 *                 1 byte — không ép vùng, không đổi header, không gate.
 *   3) RESPONSE → WebSocket 101 / Upgrade: passthrough; lỗi 402/403/400 (paywall
 *                 filter) → 200 "unlocked"; unblur ảnh.
 *
 * Media/CDN (ảnh, video) bỏ qua HOÀN TOÀN — engine không verify, không đổi 1 byte
 * (URL ký bị sửa → 403 → feed trắng). Upload ảnh Locket xử lý ở locketgold_upload.js.
 * Key sai / khác máy / hết grace → trả nguyên body gốc (fail-closed).
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js

// @b1s-include ./lib/license-gate.js

// @b1s-include ./lib/http-util.js
// @b1s-include ./lib/edge-select.js
/* Accessor an toàn: $request/$response có thể KHÔNG tồn tại (chạy script thủ công trong
   trình soạn thảo của Shadowrocket, hoặc engine không cấp) — dùng $request trực tiếp sẽ ném
   ReferenceError làm script chết im lặng. */
var _req = (typeof $request !== "undefined" && $request) ? $request : {};
var _resp = (typeof $response !== "undefined" && $response) ? $response : {};

var IS_REQUEST_PHASE = (typeof $response === "undefined");

/* ═══════════════ Ép tham số vùng US ═══════════════ */
/** Ép tham số vùng (US) vào query string — Locket chỉ mở filter AI ở khu vực US. */
function forceRegionParams(url) {
  if (!url) return url;
  var forced = {
    country_code: "US",
    time_zone: "America/Los_Angeles",
    language_code: "en",
  };
  var q = url.indexOf("?");
  var base = q === -1 ? url : url.slice(0, q);
  var query = q === -1 ? "" : url.slice(q + 1);
  var pairs = query.length ? query.split("&") : [];
  for (var k in forced) {
    if (!hasOwn(forced, k)) continue;
    var found = false;
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].split("=")[0] === k) {
        pairs[i] = k + "=" + encodeURIComponent(forced[k]);
        found = true;
        break;
      }
    }
    if (!found) pairs.push(k + "=" + encodeURIComponent(forced[k]));
  }
  return base + "?" + pairs.join("&");
}

/** Overlay/frame filter id (photobooth, khung…) → forward sang worker B1sTeam tự vẽ khung. */
function overlayFilterId(body) {
  try {
    if (!body || typeof body !== "string") return null;
    var o = JSON.parse(body);
    var fid = String(o.filter_id || o.filterId || o.id || o.filter || o.filterID || "").toLowerCase();
    if (!fid) return null;
    return /photobooth|photoboot|4cut|^pb_|^khung_|^frame_|sticker|cmt_locket|custom_frame|overlay|^khung/.test(fid) ? fid : null;
  } catch (e) {
    return null;
  }
}

/* ═══════════════ REQUEST ═══════════════ */
if (IS_REQUEST_PHASE) {
  var _reqUrl = _req.url ? String($request.url) : "";
  var _rawHeaders = _req.headers ? $request.headers : {};

  // 1) WebSocket handshake (wss_v2/group — groups realtime) — KHÔNG đụng 1 byte
  if (isWebSocketUpgrade(_rawHeaders) || isWebSocketPath(_reqUrl)) {
    console.log("[locketgold] filters: WebSocket passthrough (group realtime)");
    $done({});
  }
  // 2) Media/CDN — không đụng vào request (URL ký bị sửa → 403)
  else if (isMediaUrl(_reqUrl)) {
    $done({});
  }
  // 3) Còn lại — xoá header cache + ép vùng US + overlay forward
  else {
    var headers = {};
    for (var k in _rawHeaders) {
      if (!hasOwn(_rawHeaders, k)) continue;
      var lk = String(k).toLowerCase();
      // Bỏ header cache để server KHÔNG trả 304 (304 là body rỗng → filter không render)
      if (lk === "if-none-match" || lk === "if-modified-since" || lk === "x-revenuecat-etag") continue;
      headers[k] = _rawHeaders[k];
    }
    // Mở filter AI bị khoá theo vùng (Locket chỉ mở filter thử nghiệm ở US)
    headers["X-App-Region"] = "US";
    headers["X-Country-Code"] = "US";
    headers["X-Device-Country"] = "US";
    headers["X-Timezone"] = "America/Los_Angeles";
    headers["Accept-Language"] = "en-US,en;q=0.9";

    var nextUrl = forceRegionParams(_reqUrl);
    var out = { headers: headers };
    if (nextUrl && _reqUrl && nextUrl !== _reqUrl) out.url = nextUrl;

    gate(
      function () {
        // generateFilteredImage + overlay/frame id → forward sang worker B1sTeam (tự vẽ khung Kawaii)
        if (_reqUrl.indexOf("generateFilteredImage") !== -1 && $request && typeof $request.body === "string") {
          var fid = overlayFilterId(_req.body);
          if (fid) {
            // Forward tới worker — KHÔNG kèm token Locket của người dùng
            var dev = "";
            try { dev = deviceId(); } catch (e) {}
            var fwd = {};
            for (var hk in headers) {
              if (!hasOwn(headers, hk)) continue;
              var lk2 = String(hk).toLowerCase();
              if (lk2 === "authorization" || lk2 === "cookie" || lk2 === "x-auth-token") continue;
              fwd[hk] = headers[hk];
            }
            fwd["x-b1s-license"] = LICENSE_KEY || "";
            fwd["x-b1s-device"] = dev;
            fwd["Content-Type"] = "application/json";
            // Đánh dấu ảnh đã được khung (App upload ngay sau khi rửa ảnh → upload-frame không vẽ lại)
            try { b1sStoreSet("b1s_frame_applied_at", String(Date.now())); } catch (e) {}
            console.log("[locketgold] filters: FORWARD fid=" + fid + " → locket-filter-frame");
            $done({ url: frameEdge() + "/apply-frame", headers: fwd, body: _req.body });
            return;
          }
        }
        $done(out);
      },
      function () { $done({}); },
      "filters"
    );
  }
} else {

/* ═══════════════ RESPONSE — mở khoá paywall filter (402/403/400) ═══════════════ */
(function () {
  // WebSocket handshake / 101 Switching Protocols — không đọc body, không đụng
  var _respHeaders = _resp.headers ? $response.headers : {};
  var _status = (_resp.status || _resp.statusCode) || 200;
  if (_status === 101 || isWebSocketUpgrade(_respHeaders)) { $done({}); return; }

  // MEDIA/CDN (ảnh, video, webp…) — bỏ qua HOÀN TOÀN: không gate, không verify.
  var _mediaUrl = "";
  try { _mediaUrl = _req.url ? String($request.url) : ""; } catch (e) {}
  if (isMediaUrl(_mediaUrl)) { $done({}); return; }

  var body = $response.body;
  var status = _status;
  var _dbgUrl = "";
  try { _dbgUrl = _req.url ? String($request.url) : ""; } catch (e) {}
  if (_dbgUrl.indexOf("generateFilteredImage") !== -1) {
    console.log("[locketgold] filters: url=" + _dbgUrl.slice(0, 80) + " | status=" + status);
  }

  /** Tìm URL ảnh đầu tiên trong payload (để app vẫn hiện ảnh khi server trả lỗi). */
  function findImageUrl(node, depth) {
    if (!node || typeof node !== "object" || (depth || 0) > 8) return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var u = findImageUrl(node[i], (depth || 0) + 1);
        if (u) return u;
      }
      return null;
    }
    var preferred = ["outputUrl", "output_url", "imageUrl", "image_url", "result_url", "transformed_image_url", "unblurred_url", "url"];
    for (var p = 0; p < preferred.length; p++) {
      var v = node[preferred[p]];
      if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    }
    for (var k in node) {
      if (!hasOwn(node, k)) continue;
      var val = node[k];
      if (val && typeof val === "object") {
        var found = findImageUrl(val, (depth || 0) + 1);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Xử lý lỗi paywall (402/403/400) — "phẫu thuật" thay vì thay toàn bộ body:
   * giữ nguyên danh sách filter/khung (app không mất dữ liệu), chỉ bỏ phần lỗi.
   */
  function unlockPayload(original) {
    if (!original || typeof original !== "object") {
      return {
        result: { status: 200, is_gold: true, is_locked: false, requires_gold: false, requires_subscription: false, is_subscribed: true, unlocked: true, premium: true, is_premium: true, data: {} },
        data: { status: 200, is_locked: false, requires_gold: false, unlocked: true, is_gold: true, is_premium: true },
        error: null,
      };
    }
    var details = null;
    try {
      if (original.error && original.error.details) details = original.error.details;
    } catch (e) { /* bỏ qua */ }

    try { if (original.error) delete original.error; } catch (e) { /* bỏ qua */ }
    try { if (original.errors) delete original.errors; } catch (e) { /* bỏ qua */ }

    var result = original.result && typeof original.result === "object" ? original.result : (original.result = {});
    result.status = 200;
    result.is_gold = true;
    result.is_locked = false;
    result.requires_gold = false;
    result.requires_subscription = false;
    result.is_subscribed = true;
    result.unlocked = true;
    result.premium = true;
    result.is_premium = true;
    if (details) result.data = details;

    // Nếu server trả kèm URL ảnh (mờ/blur) → đưa lên để app vẫn hiện ảnh.
    var img = findImageUrl(original, 0);
    if (img) {
      result.outputUrl = img;
      result.output_url = img;
      result.imageUrl = img;
      result.image_url = img;
    }
    if (!original.data || typeof original.data !== "object") {
      original.data = { status: 200, is_locked: false, requires_gold: false, unlocked: true, is_gold: true, is_premium: true };
    }
    original.error = null;
    return original;
  }

  /** Ép cờ "mở khoá" ở mọi node con (filter, moment, camera template…). */
  function walk(node, depth) {
    if (!node || typeof node !== "object" || (depth || 0) > 12) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walk(node[i], (depth || 0) + 1);
      return;
    }
    for (var key in node) {
      if (!hasOwn(node, key)) continue;
      var value = node[key];
      if (value && typeof value === "object") { walk(value, (depth || 0) + 1); continue; }
      var lk = String(key).toLowerCase();
      if (lk === "requires_gold" || lk === "requires_subscription" || lk === "is_locked" || lk === "locked" || lk === "needs_subscription") {
        node[key] = false;
      } else if (lk === "is_gold" || lk === "is_premium" || lk === "unlocked" || lk === "is_subscribed" || lk === "premium" || lk === "has_access") {
        node[key] = true;
      } else if (
        lk === "has_ai_access" || lk === "ai_access_enabled" || lk === "can_use_ai" || lk === "allow_ai_filter" ||
        lk === "can_use_filters" || lk === "can_use_filter" || lk === "can_use_gold_features" ||
        lk === "subscribed" || lk === "is_paid" || lk === "has_subscription" || lk === "is_member" ||
        lk === "is_pro" || lk === "is_vip" || lk === "gold_enabled" || lk === "gold_unlocked" ||
        lk === "premium_unlocked" || lk === "subscription_active" || lk === "membership_active" ||
        lk === "holiday_filters_enabled" || lk === "holiday_filters_free" || lk === "can_use_holiday_filters" ||
        lk === "can_use_premium_features" || lk === "has_premium" || lk === "has_gold" || lk === "has_pro" ||
        lk === "is_eligible" || lk === "is_unlocked" || lk === "can_unlock" ||
        lk === "camera_filters_enabled" || lk === "custom_filters_enabled" || lk === "all_effects_unlocked" ||
        lk === "can_access_gold" || lk === "can_access_premium" || lk === "has_entitlement" || lk === "vip" ||
        lk === "can_generate_filtered_image" || lk === "can_create_filtered_image" ||
        lk === "filter_access" || lk === "has_filter_access" || lk === "can_apply_filter" ||
        lk === "can_use_ai_filter" || lk === "is_subscriber" || lk === "all_filters_free" ||
        lk === "can_use_all_filters" || lk === "allow_saving_all" || lk === "allowed"
      ) {
        node[key] = true;
      } else if (lk === "is_blurred" || lk === "blurred" || lk === "needs_gold" || lk === "has_blur") {
        node[key] = false;
      }
    }
  }

  /* ── GỠ CHE MỜ ẢNH (unblur) ──
     Server trả blurred_url khi tài khoản chưa có Gold → app hiện ảnh mờ.
     Ta chuyển mọi URL ảnh về bản THẬT (unblurred_url / result_url / image_url…). */
  var URL_FIELDS = ["outputUrl", "output_url", "url", "imageUrl", "image_url", "result_url", "transformed_image_url"];
  function unblur(node, depth) {
    if (!node || typeof node !== "object" || (depth || 0) > 12) return false;
    if (Array.isArray(node)) {
      var any = false;
      for (var i = 0; i < node.length; i++) { if (unblur(node[i], (depth || 0) + 1)) any = true; }
      return any;
    }
    var changed = false;
    var clearUrl = node.unblurred_url || node.unlocked_url || node.result_url || node.image_url ||
      node.transformed_image_url || node.output_url || node.outputUrl;
    if (clearUrl && typeof clearUrl === "string") {
      for (var f = 0; f < URL_FIELDS.length; f++) {
        var key = URL_FIELDS[f];
        if (hasOwn(node, key) && node[key] !== clearUrl) { node[key] = clearUrl; changed = true; }
      }
      if (hasOwn(node, "blurred_url")) { node.blurred_url = clearUrl; changed = true; }
      if (hasOwn(node, "blurred_image_url")) { node.blurred_image_url = clearUrl; changed = true; }
      if (hasOwn(node, "preview_url") && node.is_blurred) { node.preview_url = clearUrl; changed = true; }
    }
    for (var k in node) {
      if (!hasOwn(node, k)) continue;
      if (node[k] && typeof node[k] === "object") { if (unblur(node[k], (depth || 0) + 1)) changed = true; }
    }
    return changed;
  }

  gate(
    function () {
      if (!body || typeof body !== "string") { $done({}); return; }
      var obj = null;
      try { obj = JSON.parse(body); } catch (e) { $done({}); return; }

      var changed = false;

      // 1) Lỗi paywall (402/403/400) → mở khoá
      if (status === 402 || status === 403 || status === 400 || (obj && obj.error)) {
        status = 200;
        obj = unlockPayload(obj);
        changed = true;
      }

      // 2) Gỡ che mờ TRƯỚC (walk sẽ set is_blurred=false → preview_url phải dò blurred trước)
      if (obj && unblur(obj, 0)) changed = true;

      // 3) Ép cờ mở khoá ở mọi node con
      if (obj) {
        var before = JSON.stringify(obj);
        walk(obj, 0);
        if (JSON.stringify(obj) !== before) changed = true;
      }

      if (!changed) { $done({}); return; }
      // Headers sạch — KHÔNG giữ Content-Length/Content-Encoding gốc (body mới khác độ dài)
      $done({ status: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(obj) });
    },
    function () { $done({}); },
    "filters"
  );
})();
}
