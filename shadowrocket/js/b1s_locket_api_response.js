// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_locket_api_response.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Locket Camera API RESPONSE phase.
 *
 * MỤC TIÊU (4 việc):
 *   1. GỠ BLUR  — server trả blurred_url cho tài khoản chưa có Gold ⇒ app hiện ảnh mờ.
 *                Script đồng bộ mọi field ảnh về bản THẬT (unblurred_url / result_url…).
 *   2. GỠ PAYWALL — xoá error/errors, ép cờ requires_gold=false, is_locked=false.
 *   3. BADGE GOLD — mọi object có field "uid" (user node) được gắn badge Gold + Verified.
 *   4. ÉP HTTP 200 — lỗi paywall 400/402/403 ở endpoint KHÔNG phải feed được đổi thành 200
 *                   (feed giữ nguyên để không làm vỡ danh sách bạn bè/khoảnh khắc).
 *
 * AN TOÀN:
 *   · Body không phải JSON ⇒ giữ nguyên.
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ body gốc đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  /* Endpoint feed — KHÔNG ép 200 để tránh vỡ danh sách */
  var FEED_PATHS = ["/feed", "/moments", "/timeline", "/history", "/trending", "/friends/moments"];

  /* Field chứa URL ảnh (đồng bộ khi gỡ blur) */
  var URL_FIELDS = ["outputUrl", "output_url", "url", "imageUrl", "image_url", "result_url", "transformed_image_url"];

  /* Cờ "đã mở khoá" */
  var TRUE_KEYS = [
    "is_gold", "is_premium", "unlocked", "is_subscribed", "premium", "has_access",
    "has_ai_access", "ai_access_enabled", "can_use_ai", "allow_ai_filter",
    "can_use_filters", "can_use_filter", "can_use_gold_features",
    "can_generate_filtered_image", "can_create_filtered_image",
    "filter_access", "has_filter_access", "can_apply_filter", "can_use_ai_filter",
    "is_subscriber", "all_filters_free", "can_use_all_filters", "allow_saving_all", "allowed",
    "is_available", "is_enabled", "is_active", "subscribed", "is_paid", "has_subscription",
    "is_member", "is_pro", "is_vip", "pro_enabled", "pro_unlocked",
    "gold_enabled", "gold_unlocked", "premium_unlocked",
    "subscription_active", "membership_active", "member_active",
    "holiday_filters_enabled", "holiday_filters_free", "can_use_holiday_filters",
    "can_use_premium_features", "can_access_gold", "can_access_premium",
    "has_premium", "has_gold", "has_pro", "is_eligible", "can_render", "can_unlock",
    "is_unlocked", "camera_filters_enabled", "custom_filters_enabled",
    "all_effects_unlocked", "free_forever", "vip", "has_entitlement"
  ];

  /* Cờ "còn khoá" */
  var FALSE_KEYS = [
    "requires_gold", "requires_subscription", "is_locked", "locked", "needs_subscription",
    "is_blurred", "blurred", "needs_gold", "has_blur"
  ];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  function b1sLog(msg) {
    try { console.log("[locketgold] locket-api: " + msg); } catch (e) { /* ignore */ }
  }

  /** URL của request (dùng để biết endpoint nào). */
  function requestUrl() {
    try {
      if (typeof $request !== "undefined" && $request && $request.url) return String($request.url);
    } catch (e) { /* ignore */ }
    return "";
  }

  function isFeedEndpoint(url) {
    var u = String(url || "").toLowerCase();
    for (var i = 0; i < FEED_PATHS.length; i++) {
      if (u.indexOf(FEED_PATHS[i]) !== -1) return true;
    }
    return false;
  }

  /** Gắn badge Gold + Verified cho object có field "uid". */
  function applyGoldBadge(node) {
    node.badge = "locket_gold";
    node.badge_tier = "gold";
    node.badge_name = "Gold";
    node.is_gold = true;
    node.is_gold_badge = true;
    node.gold_badge = true;
    node.gold_badge_enabled = true;
    node.badge_gold = true;
    node.badge_enabled = true;
    node.use_gold_badge = true;
    node.verified = true;
    node.is_verified = true;
    node.verified_badge = true;
  }

  /** Quét payload: object nào có "uid" thì gắn badge Gold. */
  function badgeByUid(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 24) return 0;
    var marked = 0;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) marked += badgeByUid(node[i], d + 1);
      return marked;
    }
    var hasUid = false;
    for (var k in node) {
      if (!hasOwn(node, k)) continue;
      if (k === "uid" && node[k]) { hasUid = true; break; }
    }
    if (hasUid) { applyGoldBadge(node); marked = 1; }
    for (var k2 in node) {
      if (!hasOwn(node, k2)) continue;
      var child = node[k2];
      if (child && typeof child === "object") marked += badgeByUid(child, d + 1);
    }
    return marked;
  }

  /** Ép cờ mở khoá / gỡ cờ khoá ở mọi node con. */
  function unlockFlags(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 24) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) unlockFlags(node[i], d + 1);
      return;
    }
    for (var key in node) {
      if (!hasOwn(node, key)) continue;
      var value = node[key];
      if (value && typeof value === "object") { unlockFlags(value, d + 1); continue; }
      var lk = String(key).toLowerCase();
      if (FALSE_KEYS.indexOf(lk) !== -1) {
        node[key] = false;
      } else if (TRUE_KEYS.indexOf(lk) !== -1) {
        node[key] = true;
      }
    }
  }

  /** Đồng bộ mọi URL ảnh về bản không blur. */
  function unblur(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 24) return false;
    if (Array.isArray(node)) {
      var any = false;
      for (var i = 0; i < node.length; i++) { if (unblur(node[i], d + 1)) any = true; }
      return any;
    }
    var changed = false;
    var clearUrl = node.unblurred_url || node.unlocked_url || node.result_url || node.image_url ||
      node.transformed_image_url || node.output_url || node.outputUrl;
    if (typeof clearUrl === "string" && clearUrl.length) {
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
      if (node[k] && typeof node[k] === "object") { if (unblur(node[k], d + 1)) changed = true; }
    }
    return changed;
  }

  /** Tìm URL ảnh đầu tiên trong payload (dựng ảnh fallback khi server lỗi). */
  function findImageUrl(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 8) return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var u = findImageUrl(node[i], d + 1);
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
        var found = findImageUrl(val, d + 1);
        if (found) return found;
      }
    }
    return null;
  }

  /** Làm sạch payload lỗi paywall — giữ data thật, chỉ bỏ phần "đã khoá". */
  function cleanPaywall(obj) {
    var details = null;
    try {
      if (obj && isObject(obj.error) && obj.error.details) details = obj.error.details;
    } catch (e) { /* ignore */ }
    try { if (obj && obj.error) delete obj.error; } catch (e) { /* ignore */ }
    try { if (obj && obj.errors) delete obj.errors; } catch (e) { /* ignore */ }

    var result = (obj && isObject(obj.result)) ? obj.result : (obj.result = {});
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

    var img = findImageUrl(obj, 0);
    if (img) {
      result.outputUrl = img;
      result.output_url = img;
      result.imageUrl = img;
      result.image_url = img;
    }
    if (!obj.data || typeof obj.data !== "object") {
      obj.data = { status: 200, is_locked: false, requires_gold: false, unlocked: true, is_gold: true, is_premium: true };
    }
    obj.error = null;
    return obj;
  }

  try {
    if (typeof $done !== "function") return;

    var body = (typeof $response !== "undefined" && $response && typeof $response.body === "string")
      ? $response.body : "";
    if (!body) { $done({}); return; }

    /* Không đụng vào body nhị phân/media */
    try {
      var ct = "";
      var respHeaders = (typeof $response !== "undefined" && $response) ? $response.headers : null;
      if (respHeaders) {
        for (var h in respHeaders) {
          if (!hasOwn(respHeaders, h)) continue;
          if (String(h).toLowerCase() === "content-type") { ct = String(respHeaders[h] || "").toLowerCase(); break; }
        }
      }
      if (ct && ct.indexOf("json") === -1 && ct.indexOf("text") === -1) { $done({}); return; }
    } catch (e) { /* không đọc được header → coi như JSON */ }

    var obj = null;
    try { obj = JSON.parse(body); } catch (e) { obj = null; }
    if (!obj || typeof obj !== "object") { $done({}); return; }

    var url = requestUrl();
    var status = ((typeof $response !== "undefined" && $response) ? ($response.status || $response.statusCode) : 200) || 200;
    var changed = false;

    /* 1) Paywall 400/402/403 — chỉ ép 200 nếu KHÔNG phải endpoint feed */
    if (status === 400 || status === 402 || status === 403) {
      if (isFeedEndpoint(url)) {
        b1sLog("paywall " + status + " ở feed → giữ nguyên (không vỡ danh sách)");
      } else {
        status = 200;
        obj = cleanPaywall(obj);
        changed = true;
        b1sLog("paywall → 200 (" + url.slice(0, 80) + ")");
      }
    }

    /* 2) Gỡ blur (trước khi ép cờ, để preview_url được sửa) */
    try { if (unblur(obj, 0)) changed = true; } catch (e) { /* ignore */ }

    /* 3) Ép cờ mở khoá ở mọi node */
    try { unlockFlags(obj, 0); changed = true; } catch (e) { /* ignore */ }

    /* 4) Badge Gold cho object có "uid" */
    try {
      var marked = badgeByUid(obj, 0);
      if (marked > 0) { changed = true; b1sLog("badge Gold cho " + marked + " user node"); }
    } catch (e) { /* ignore */ }

    if (!changed) { $done({}); return; }

    $done({
      status: status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(obj)
    });
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
