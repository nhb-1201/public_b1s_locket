// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Camera/AI Filter unlock + Region gate (DEVICE-LOCKED) v3.0
 *
 *   1) REQUEST  → xoá header cache (chống 304) + ép vùng US (Locket chỉ mở filter
 *                 thử nghiệm ở US) + forward overlay/frame id → worker B1sTeam
 *                 (locket-filter-frame — tự vẽ khung Kawaii lên ảnh, KHÔNG AI).
 *   2) RESPONSE → lỗi 402/403/400 từ server (paywall filter) → đổi thành 200 "unlocked",
 *                 requires_gold=false / is_locked=false; unblur ảnh (blurred_url → bản thật).
 *
 * Media/CDN (ảnh, video) bỏ qua HOÀN TOÀN ở cả 2 phase — engine không verify, không đổi
 * 1 byte nào (URL ký bị sửa → 403 → feed trắng).
 * Key sai / khác máy / hết grace → trả nguyên body gốc (fail-closed).
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js

// @b1s-include ./lib/license-gate.js

var IS_REQUEST_PHASE = (typeof $response === "undefined");

/* ═══════════════ REQUEST — bỏ cache + ép vùng US ═══════════════ */
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
    if (!Object.prototype.hasOwnProperty.call(forced, k)) continue;
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

if (IS_REQUEST_PHASE) {
  var _reqUrl = ($request && $request.url) ? String($request.url) : "";

  // Media/CDN — engine không làm gì (giữ nguyên chữ ký URL)
  if (isMediaUrl(_reqUrl)) { $done({}); } else {
    var headers = {};
    var src = ($request && $request.headers) ? $request.headers : {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var lk = String(k).toLowerCase();
      // Bỏ header cache để server KHÔNG trả 304 (304 là body rỗng → filter không render)
      if (lk === "if-none-match" || lk === "if-modified-since" || lk === "x-revenuecat-etag") continue;
      headers[k] = src[k];
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
          var fid = overlayFilterId($request.body);
          if (fid) {
            // Forward tới worker — KHÔNG kèm token Locket của người dùng
            var dev = "";
            try { dev = deviceId(); } catch (e) {}
            var fwd = {};
            for (var hk in headers) {
              if (!Object.prototype.hasOwnProperty.call(headers, hk)) continue;
              var lk2 = String(hk).toLowerCase();
              if (lk2 === "authorization" || lk2 === "cookie" || lk2 === "x-auth-token") continue;
              fwd[hk] = headers[hk];
            }
            fwd["x-b1s-license"] = LICENSE_KEY || "";
            fwd["x-b1s-device"] = dev;
            fwd["Content-Type"] = "application/json";
            console.log("[locketgold] filters: FORWARD fid=" + fid + " → locket-filter-frame");
            $done({ url: "https://locket-filter-frame.nhb-120111.workers.dev/apply-frame", headers: fwd, body: $request.body });
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
  // MEDIA/CDN (ảnh, video, webp…) — bỏ qua HOÀN TOÀN: không gate, không verify.
  var _mediaUrl = "";
  try { _mediaUrl = ($request && $request.url) ? String($request.url) : ""; } catch (e) {}
  if (isMediaUrl(_mediaUrl)) { $done({}); return; }

  var body = $response.body;
  var status = $response.status || $response.statusCode || 200;
  var _dbgUrl = "";
  try { _dbgUrl = ($request && $request.url) ? String($request.url) : ""; } catch (e) {}
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
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
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
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
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
        lk === "has_subscription" || lk === "is_eligible" || lk === "is_unlocked" || lk === "can_unlock" ||
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
        if (Object.prototype.hasOwnProperty.call(node, key) && node[key] !== clearUrl) { node[key] = clearUrl; changed = true; }
      }
      if (Object.prototype.hasOwnProperty.call(node, "blurred_url")) { node.blurred_url = clearUrl; changed = true; }
      if (Object.prototype.hasOwnProperty.call(node, "blurred_image_url")) { node.blurred_image_url = clearUrl; changed = true; }
      if (Object.prototype.hasOwnProperty.call(node, "preview_url") && node.is_blurred) { node.preview_url = clearUrl; changed = true; }
    }
    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
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
