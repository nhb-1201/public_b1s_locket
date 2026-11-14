// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — SCRIPT HỢP NHẤT cho API Locket (Profile + Filters + Vinh danh) v4.0
 *
 * ⚠ VÌ SAO GỘP LẠI (log PacketTunnel 2026-11-14 11:40):
 *   Shadowrocket chỉ chạy **MỘT script khớp đầu tiên** cho mỗi phase. Vì
 *   [locketgold_filters_response] đứng trước [locketgold_user] (profile) và [locketgold_vip],
 *   ⇒ profile.js (badge Gold + unblur + verified) và vip.js **KHÔNG BAO GIỜ CHẠY** ⇒
 *   app không mở khoá gì ("không có gì xảy ra"). Nay gộp cả 3 vào MỘT script.
 *
 *   REQUEST  : bỏ header cache + ép vùng US + forward generateFilteredImage(overlay) sang worker
 *              vẽ khung + changeProfileInfo → trả 200 Gold+Verified (trừ khi user đang LƯU bio thật).
 *   RESPONSE : inject badge Gold/Verified + credit, mở paywall filter 402/403/400, gỡ blur,
 *              ép cờ mở khoá ở mọi node, badge Gold cho thành viên vinh danh cộng đồng.
 *
 * License gate fail-closed (lib/license-gate.js) — key sai / sai máy / hết grace → trả nguyên body gốc.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js
// @b1s-include ./lib/license-gate.js
// @b1s-include ./lib/http-util.js
// @b1s-include ./lib/edge-select.js

/* Accessor an toàn: $request/$response có thể KHÔNG tồn tại (chạy script thủ công trong
   trình soạn thảo của Shadowrocket) — dùng $request trực tiếp sẽ ném ReferenceError. */
var _req = (typeof $request !== "undefined" && $request) ? $request : {};
var _resp = (typeof $response !== "undefined" && $response) ? $response : {};

/* ═══════════════════════════════════════════════════════════════
   PHẦN PROFILE — badge Gold + Verified + credit + mở khoá cờ
   ═══════════════════════════════════════════════════════════════ */
var CREDIT = "B1sTeam: Nguyễn Hoàng Bách - Zalo: 083.3399.553";

var GOLD_PROFILE = {
  badge: "gold",
  badge_tier: "gold",
  badge_name: "Gold",
  is_gold: true,
  is_gold_badge: true,
  verified: true,
  is_verified: true,
  verified_badge: true,
  checkmark: true,
  gold_badge: true,
  gold_badge_enabled: true,
  badge_gold: true,
  badge_enabled: true,
  use_gold_badge: true,
  bio: CREDIT,
  biography: CREDIT,
  about: CREDIT,
  about_me: CREDIT,
  subtitle: CREDIT,
  tagline: CREDIT,
  status_message: CREDIT,
  status_text: CREDIT,
  profile_bio: CREDIT,
  success: true,
};

var GOLD_PROFILE = {
  badge: "gold",
  badge_tier: "gold",
  badge_name: "Gold",
  is_gold: true,
  is_gold_badge: true,
  verified: true,
  is_verified: true,
  verified_badge: true,
  checkmark: true,
  gold_badge: true,
  gold_badge_enabled: true,
  badge_gold: true,
  badge_enabled: true,
  use_gold_badge: true,
  bio: CREDIT,
  biography: CREDIT,
  about: CREDIT,
  about_me: CREDIT,
  subtitle: CREDIT,
  tagline: CREDIT,
  status_message: CREDIT,
  status_text: CREDIT,
  profile_bio: CREDIT,
  success: true,
};

var VERIFIED_KEYS = /^(verified|is_verified|verified_badge|verified_user|badge_verified|has_verified|checkmark|has_checkmark|is_official|official|celebrity|is_celebrity|is_star|verified_check)$/i;

var BIO_LIKE_KEYS = /^(bio|biography|about|about_me|subtitle|tagline|headline|status_message|status_text|profile_bio|profile_subtitle|profile_description)$/i;

var CREDIT_FIELDS = ["bio", "biography", "about", "about_me", "subtitle", "tagline", "headline", "status_message", "status_text", "profile_bio", "profile_subtitle", "profile_description"];

function isBadgeKey(k) { return /badge/i.test(k); }

function isBadgeUrlKey(k) { return /_url($|_)|url$|image|icon|_src($|_)|path|asset/i.test(k); }

function badgeValueFor(k) {
  var s = String(k).toLowerCase();
  if (/number|count|level|rank|order|index/.test(s)) return 1;
  if (/_name($|_)/.test(s)) return "Gold";
  return "gold"; // badge / badge_tier / badge_type / badge_color — "gold" là màu CSS hợp lệ
}

function injectBadge(node, depth) {
  if (!node || typeof node !== "object" || (depth || 0) > 24) return;

  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) injectBadge(node[i], (depth || 0) + 1);
    return;
  }

  var keys = Object.keys(node);
  for (var j = 0; j < keys.length; j++) {
    var value = node[keys[j]];
    if (value && typeof value === "object") {
      injectBadge(value, (depth || 0) + 1);
      continue;
    }
    if (/^(is_?gold(_?badge)?|badge(_tier|_name|_number)?|has_?gold|is_vip|vip_active|is_premium|premium_active)$/i.test(keys[j])) {
      var lk0 = keys[j].toLowerCase();
      node[keys[j]] = (lk0.indexOf("badge_number") !== -1)
        ? 1
        : (lk0.indexOf("badge_name") !== -1 ? "Gold" : (lk0.indexOf("badge_tier") !== -1 ? "gold" : (/^(is_|has_)/i.test(keys[j]) ? true : "gold")));
    } else if (isBadgeKey(keys[j]) && !isBadgeUrlKey(keys[j])) {
      // Toggle/badge keys server có thể trả false — ép về Gold (boolean giữ boolean, string giữ string)
      if (typeof value === "boolean" || /_enabled|_active|_visible|_on$|^use_|^show_/i.test(keys[j])) {
        node[keys[j]] = true;
      } else {
        node[keys[j]] = badgeValueFor(keys[j]);
      }
    } else if (VERIFIED_KEYS.test(keys[j])) {
      node[keys[j]] = true;
    } else if (BIO_LIKE_KEYS.test(keys[j]) && value !== CREDIT) {
      node[keys[j]] = CREDIT;
    }
  }

  var looksLikeProfile = ("badge" in node) || ("is_gold" in node) || ("badge_tier" in node) ||
    ("display_name" in node || "username" in node || "user_id" in node);
  // Ép TOÀN BỘ profile-like (bản thân + danh sách bạn bè, tin nhắn…) lên Gold + tích xanh + credit
  if (looksLikeProfile) {
    node.badge = "gold";
    node.badge_tier = "gold";
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
    for (var k = 0; k < CREDIT_FIELDS.length; k++) node[CREDIT_FIELDS[k]] = CREDIT;
  }
}

function unlockFlags(node, depth) {
  if (!node || typeof node !== "object" || (depth || 0) > 24) return;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) unlockFlags(node[i], (depth || 0) + 1);
    return;
  }
  for (var key in node) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
    var value = node[key];
    if (value && typeof value === "object") { unlockFlags(value, (depth || 0) + 1); continue; }
    var lk = String(key).toLowerCase();
    if (lk === "requires_gold" || lk === "requires_subscription" || lk === "is_locked" || lk === "locked" || lk === "needs_subscription") {
      node[key] = false;
    } else if (lk === "is_gold" || lk === "is_premium" || lk === "unlocked" || lk === "is_subscribed" || lk === "has_access") {
      node[key] = true;
    } else if (
      lk === "has_ai_access" || lk === "ai_access_enabled" || lk === "can_use_ai" || lk === "allow_ai_filter" ||
      lk === "can_use_filters" || lk === "can_use_filter" || lk === "can_use_gold_features" ||
      lk === "can_generate_filtered_image" || lk === "can_create_filtered_image" ||
      lk === "filter_access" || lk === "has_filter_access" || lk === "can_apply_filter" ||
      lk === "can_use_ai_filter" || lk === "is_subscriber" || lk === "all_filters_free" ||
      lk === "can_use_all_filters" || lk === "allow_saving_all" || lk === "allowed" ||
      lk === "is_available" || lk === "is_enabled" || lk === "is_active" ||
      lk === "subscribed" || lk === "is_paid" || lk === "has_subscription" || lk === "is_member" ||
      lk === "is_pro" || lk === "is_vip" || lk === "pro_enabled" || lk === "pro_unlocked" ||
      lk === "gold_enabled" || lk === "gold_unlocked" || lk === "premium_unlocked" ||
      lk === "subscription_active" || lk === "membership_active" || lk === "member_active" ||
      lk === "holiday_filters_enabled" || lk === "holiday_filters_free" || lk === "can_use_holiday_filters" ||
      lk === "can_use_gold_features" || lk === "can_use_premium_features" || lk === "can_access_gold" ||
      lk === "can_access_premium" || lk === "has_premium" || lk === "has_gold" || lk === "has_pro" ||
      lk === "is_eligible" || lk === "can_render" || lk === "can_unlock" || lk === "is_unlocked" ||
      lk === "camera_filters_enabled" || lk === "custom_filters_enabled" || lk === "all_effects_unlocked" ||
      lk === "free_forever" || lk === "vip" || lk === "has_entitlement"
    ) {
      node[key] = true;
    } else if (lk === "is_blurred" || lk === "blurred" || lk === "needs_gold" || lk === "has_blur") {
      node[key] = false;
    }
  }
}

function containsBioValue(node, depth) {
  if (!node || typeof node !== "object" || (depth || 0) > 10) return false;
  for (var k in node) {
    if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
    var v = node[k];
    if (typeof v === "string" && BIO_LIKE_KEYS.test(k) && v.trim().length > 0) return true;
    if (v && typeof v === "object" && containsBioValue(v, (depth || 0) + 1)) return true;
  }
  return false;
}
/* ═══════════════════════════════════════════════════════════════
   PHẦN FILTERS — vùng US + overlay forward + mở paywall + gỡ blur
   ═══════════════════════════════════════════════════════════════ */
var IS_REQUEST_PHASE = (typeof $response === "undefined");

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

  var URL_FIELDS = ["outputUrl", "output_url", "url", "imageUrl", "image_url", "result_url", "transformed_image_url"];
/* ═══════════════════════════════════════════════════════════════
   PHẦN VINH DANH — badge Gold cho thành viên cộng đồng (opt-in)
   ═══════════════════════════════════════════════════════════════ */
function storeRead(k) { return b1sStoreGet(k); }
function storeWrite(k, v) { return b1sStoreSet(k, v); }

var VIP_API = "https://locket.b1s.id.vn/api/v2/locketgold/vip/list";
var VIP_TTL_MS = 43200000; // 12 giờ
var VIP_STORE_AT = "b1s_vip_list_at";
var VIP_STORE_DATA = "b1s_vip_list_data";

/** Đọc danh sách vinh danh đã cache { at, usernames[], uids[] }. */
function loadVip() {
  try {
    var raw = b1sStoreGet(VIP_STORE_DATA);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    var usernames = Array.isArray(data.usernames) ? data.usernames : [];
    var uids = Array.isArray(data.uids) ? data.uids : [];
    return {
      at: Number(b1sStoreGet(VIP_STORE_AT) || 0),
      usernames: usernames,
      uids: uids,
    };
  } catch (e) {
    return null;
  }
}

/** Fetch nền 1 lần / 12 giờ — KHÔNG chặn response hiện tại. */
function maybeRefreshVip() {
  var cached = loadVip();
  var at = cached ? cached.at : 0;
  if (Date.now() - at < VIP_TTL_MS) return;
  if (typeof $httpClient === "undefined" || !$httpClient) return;
  try {
    $httpClient.get(
      { url: VIP_API, headers: { Accept: "application/json", "User-Agent": "B1S-LocketGold-VIP/1.0" }, timeout: 10 },
      function (err, response, data) {
        if (err) return;
        try {
          var text = typeof data === "string" ? data : (data ? String(data) : "");
          if (!text) return;
          var j = JSON.parse(text);
          var members = [];
          if (j && j.data && Array.isArray(j.data.members)) members = j.data.members;
          else if (j && Array.isArray(j.members)) members = j.members;
          else if (Array.isArray(j)) members = j;
          var unameArr = [];
          var uidArr = [];
          for (var i = 0; i < members.length; i++) {
            var u = members[i] || {};
            var nm = String(u.username || "").toLowerCase().trim();
            if (nm && unameArr.indexOf(nm) === -1) unameArr.push(nm);
            var id = String(u.uid || "").toLowerCase().trim();
            if (id && uidArr.indexOf(id) === -1) uidArr.push(id);
          }
          b1sStoreSet(VIP_STORE_DATA, JSON.stringify({ usernames: unameArr, uids: uidArr }));
          b1sStoreSet(VIP_STORE_AT, String(Date.now()));
          console.log("[locketgold] vip: đồng bộ " + unameArr.length + " thành viên vinh danh");
        } catch (e) { /* body lỗi — giữ cache cũ */ }
      }
    );
  } catch (e) { /* bỏ qua */ }
}

function toSet(arr) {
  var set = {};
  for (var i = 0; i < arr.length; i++) set[arr[i]] = true;
  return set;
}

/** Gắn badge Gold cho thành viên vinh danh. */
function applyGold(node) {
  node.badge = "gold";
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
  // Marker cộng đồng — để hiển thị/đồng bộ vinh danh (Locket bỏ qua key lạ, an toàn)
  node.community_gold = true;
  node.locket_gold_community = true;
  node.badge_community = "gold";
}

function nodeName(node) {
  if (typeof node.username === "string") return node.username.toLowerCase().trim();
  if (typeof node.user_name === "string") return node.user_name.toLowerCase().trim();
  if (typeof node.handle === "string") return node.handle.toLowerCase().trim();
  return "";
}
function nodeId(node) {
  if (typeof node.uid === "string") return node.uid.toLowerCase().trim();
  if (typeof node.user_id === "string") return node.user_id.toLowerCase().trim();
  if (typeof node.id === "string") return node.id.toLowerCase().trim();
  return "";
}

/** Duyệt payload, tìm user-node thuộc vinh danh và gắn badge. Trả số node đã gắn. */
function walkAndBadge(node, depth, uSet, idSet, counter) {
  var d = depth || 0;
  if (!node || typeof node !== "object" || d > 24) return 0;

  if (Array.isArray(node)) {
    var sum = 0;
    for (var i = 0; i < node.length; i++) sum += walkAndBadge(node[i], d + 1, uSet, idSet, counter);
    return sum;
  }

  var marked = 0;
  var nm = nodeName(node);
  var id = nodeId(node);
  var hit = (nm && uSet[nm]) || (id && idSet[id]);
  if (hit) {
    applyGold(node);
    marked = 1;
  }

  for (var k in node) {
    if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
    var child = node[k];
    if (child && typeof child === "object") marked += walkAndBadge(child, d + 1, uSet, idSet, counter);
  }
  return marked;
}

function isJsonish(body) {
  if (!body || typeof body !== "string") return false;
  var t = body.replace(/^\s+/, "");
  var c = t.charAt(0);
  return c === "{" || c === "[";
}

/* ═══════════════════════════════════════════════════════════════
   ENTRY — 1 gate cho cả 2 phase, đúng 1 lần gọi $done
   ═══════════════════════════════════════════════════════════════ */
var LG_IS_REQUEST = (typeof $response === "undefined");

function lgRequestMain() {
  var url = _req.url ? String(_req.url) : "";
  var rawHeaders = _req.headers ? _req.headers : {};

  // WebSocket (groups realtime) — KHÔNG đụng 1 byte
  if (isWebSocketUpgrade(rawHeaders) || isWebSocketPath(url)) { $done({}); return; }
  // Media/CDN — không đụng (URL ký bị sửa → 403)
  if (isMediaUrl(url)) { $done({}); return; }

  // changeProfileInfo có bio thật → để server lưu nguyên vẹn
  var isProfileSave = url.indexOf("changeProfileInfo") !== -1;
  if (isProfileSave) {
    var passthrough = false;
    try {
      var rb = _req.body;
      var parsed = typeof rb === "string" ? JSON.parse(rb) : rb;
      if (parsed && typeof parsed === "object" && containsBioValue(parsed, 0)) passthrough = true;
    } catch (e) { passthrough = false; }
    if (passthrough) {
      console.log("[locketgold] locket: changeProfileInfo có bio thật → passthrough");
      $done({});
      return;
    }
  }

  // Header: bỏ cache (304 = body rỗng) + ép vùng US (Locket chỉ mở filter thử nghiệm ở US)
  var headers = {};
  for (var k in rawHeaders) {
    if (!hasOwn(rawHeaders, k)) continue;
    var lk = String(k).toLowerCase();
    if (lk === "if-none-match" || lk === "if-modified-since" || lk === "x-revenuecat-etag") continue;
    headers[k] = rawHeaders[k];
  }
  headers["X-App-Region"] = "US";
  headers["X-Country-Code"] = "US";
  headers["X-Device-Country"] = "US";
  headers["X-Timezone"] = "America/Los_Angeles";
  headers["Accept-Language"] = "en-US,en;q=0.9";
  var nextUrl = forceRegionParams(url);
  var out = { headers: headers };
  if (nextUrl && url && nextUrl !== url) out.url = nextUrl;

  gate(
    function () {
      // 1) changeProfileInfo (không có bio) → 200 Gold + Verified
      if (isProfileSave) {
        console.log("[locketgold] locket: changeProfileInfo → 200 Gold+Verified");
        $done({
          response: {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-store",
            },
            body: JSON.stringify({ data: GOLD_PROFILE, result: GOLD_PROFILE, success: true }),
          },
        });
        return;
      }
      // 2) generateFilteredImage + overlay/frame → forward sang worker B1sTeam (tự vẽ khung Kawaii)
      if (url.indexOf("generateFilteredImage") !== -1 && typeof _req.body === "string") {
        var fid = overlayFilterId(_req.body);
        if (fid) {
          var dev = "";
          try { dev = deviceId(); } catch (e) { /* ignore */ }
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
          try { b1sStoreSet("b1s_frame_applied_at", String(Date.now())); } catch (e) { /* ignore */ }
          console.log("[locketgold] locket: FORWARD fid=" + fid + " → locket-filter-frame");
          $done({ url: frameEdge() + "/apply-frame", headers: fwd, body: _req.body });
          return;
        }
      }
      $done(out);
    },
    function () {
      console.log("[locketgold] locket: DENY (license invalid) → request nguyên vẹn");
      $done({});
    },
    "locket"
  );
}

function lgResponseMain() {
  var url = _req.url ? String(_req.url) : "";
  if (isMediaUrl(url)) { $done({}); return; }
  var respHeaders = _resp.headers ? _resp.headers : {};
  var status = (_resp.status || _resp.statusCode) || 200;
  if (status === 101 || isWebSocketUpgrade(respHeaders)) { $done({}); return; }

  // AI filter bị entitlement SERVER-SIDE (431) → fail-fast để app hiện lỗi ngay, không treo vô hạn
  if (url.indexOf("/createFilter") !== -1 || url.indexOf("/generateFilteredImage") !== -1) {
    if (status !== 200) {
      console.log("[locketgold] locket: AI filter server từ chối (status=" + status + ") → fail-fast");
      $done({
        status: status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        body: JSON.stringify({ error: { message: "Entitlement required", code: "ENTITLEMENT_REQUIRED" } }),
      });
      return;
    }
  }

  gate(
    function () {
      var body = (_resp && typeof _resp.body === "string") ? _resp.body : null;
      if (!body) { $done({}); return; }
      // Không đụng file nhị phân/media
      try {
        var ct = "";
        for (var h in respHeaders) {
          if (hasOwn(respHeaders, h) && String(h).toLowerCase() === "content-type") {
            ct = String(respHeaders[h] || "").toLowerCase();
            break;
          }
        }
        if (ct && ct.indexOf("json") === -1 && ct.indexOf("text") === -1 && ct.indexOf("x-www-form-urlencoded") === -1) {
          $done({ body: body });
          return;
        }
      } catch (e) { /* không đọc được header → coi như text */ }

      var obj = null;
      try { obj = JSON.parse(body); } catch (e) { $done({ body: body }); return; }

      var changed = false;

      /* 1) PROFILE — badge Gold + Verified + credit + cờ mở khoá */
      var beforeProfile = JSON.stringify(obj);
      try {
        injectBadge(obj, 0);
        unlockFlags(obj, 0);
      } catch (e) { /* ignore */ }
      if (JSON.stringify(obj) !== beforeProfile) changed = true;

      /* 2) FILTERS — mở paywall 402/403/400 + gỡ blur + ép cờ ở mọi node */
      if (status === 402 || status === 403 || status === 400 || (obj && obj.error)) {
        status = 200;
        try { obj = unlockPayload(obj); } catch (e) { /* giữ obj */ }
        changed = true;
      }
      try { if (unblur(obj, 0)) changed = true; } catch (e) { /* ignore */ }
      try { walk(obj, 0); changed = true; } catch (e) { /* ignore */ }

      /* 3) VINH DANH — badge Gold cho thành viên cộng đồng (tự nguyện) */
      try {
        maybeRefreshVip();
        var vip = loadVip();
        if (vip && (vip.usernames.length > 0 || vip.uids.length > 0)) {
          var marked = walkAndBadge(obj, 0, toSet(vip.usernames), toSet(vip.uids), 0);
          if (marked > 0) {
            changed = true;
            console.log("[locketgold] locket: badge vinh danh cho " + marked + " thành viên");
          }
        }
      } catch (e) { /* ignore */ }

      if (!changed) { $done({}); return; }
      $done({
        status: status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        body: JSON.stringify(obj),
      });
    },
    function () {
      console.log("[locketgold] locket: DENY (license invalid) → body gốc");
      $done({ body: (_resp && typeof _resp.body === "string") ? _resp.body : null });
    },
    "locket"
  );
}

if (LG_IS_REQUEST) lgRequestMain();
else lgResponseMain();
