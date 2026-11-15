// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_profile_response.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Profile RESPONSE phase.
 *
 * MỤC TIÊU:
 *   Mọi payload profile của Locket (profile chính, bạn bè, chat, moments…) được ép:
 *     · badge       = "locket_gold"
 *     · is_gold     = true
 *     · verified    = true (tích xanh)
 *     · bio/subtitle = credit B1sTeam
 *   Kèm ép cờ "đã mở khoá" (requires_gold=false, is_locked=false, unlocked=true…).
 *
 * AN TOÀN:
 *   · Body không phải JSON ⇒ giữ nguyên.
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ body gốc đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  var CREDIT = "B1sTeam: Nguyễn Hoàng Bách - Zalo: 083.3399.553";

  var BIO_LIKE_KEYS = /^(bio|biography|about|about_me|subtitle|tagline|headline|status_message|status_text|profile_bio|profile_subtitle|profile_description)$/i;
  var VERIFIED_KEYS = /^(verified|is_verified|verified_badge|verified_user|badge_verified|has_verified|checkmark|has_checkmark|is_official|official|celebrity|is_celebrity|is_star|verified_check)$/i;

  var CREDIT_FIELDS = ["bio", "biography", "about", "about_me", "subtitle", "tagline", "headline",
    "status_message", "status_text", "profile_bio", "profile_subtitle", "profile_description"];

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
    "can_use_premium_features", "can_access_gold", "can_access_premium",
    "has_premium", "has_gold", "has_pro", "is_eligible", "can_render", "can_unlock",
    "is_unlocked", "camera_filters_enabled", "custom_filters_enabled",
    "all_effects_unlocked", "free_forever", "vip", "has_entitlement"
  ];

  var FALSE_KEYS = [
    "requires_gold", "requires_subscription", "is_locked", "locked", "needs_subscription",
    "is_blurred", "blurred", "needs_gold", "has_blur"
  ];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function b1sLog(msg) {
    try { console.log("[locketgold] profile-response: " + msg); } catch (e) { /* ignore */ }
  }

  /** Node này có giống hồ sơ người dùng không? */
  function looksLikeProfile(node) {
    if (!node || typeof node !== "object") return false;
    if (hasOwn(node, "badge") || hasOwn(node, "is_gold") || hasOwn(node, "badge_tier")) return true;
    return hasOwn(node, "display_name") || hasOwn(node, "username") ||
      hasOwn(node, "user_id") || hasOwn(node, "user_name");
  }

  /** Gắn badge Gold + tích xanh + credit cho 1 node hồ sơ. */
  function applyGold(node) {
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
    node.checkmark = true;
    for (var i = 0; i < CREDIT_FIELDS.length; i++) node[CREDIT_FIELDS[i]] = CREDIT;
  }

  /** Ép mọi node con về Gold + mở khoá. */
  function rewrite(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 24) return false;
    if (Array.isArray(node)) {
      var changed = false;
      for (var i = 0; i < node.length; i++) { if (rewrite(node[i], d + 1)) changed = true; }
      return changed;
    }
    var changed = false;

    for (var key in node) {
      if (!hasOwn(node, key)) continue;
      var value = node[key];
      if (value && typeof value === "object") { if (rewrite(value, d + 1)) changed = true; continue; }
      var lk = String(key).toLowerCase();
      if (FALSE_KEYS.indexOf(lk) !== -1) {
        if (node[key] !== false) { node[key] = false; changed = true; }
      } else if (TRUE_KEYS.indexOf(lk) !== -1) {
        if (node[key] !== true) { node[key] = true; changed = true; }
      } else if (VERIFIED_KEYS.test(key)) {
        if (node[key] !== true) { node[key] = true; changed = true; }
      } else if (BIO_LIKE_KEYS.test(key)) {
        if (node[key] !== CREDIT) { node[key] = CREDIT; changed = true; }
      }
    }

    if (looksLikeProfile(node)) {
      var before = JSON.stringify(node);
      applyGold(node);
      if (JSON.stringify(node) !== before) changed = true;
    }
    return changed;
  }

  try {
    if (typeof $done !== "function") return;

    var body = (typeof $response !== "undefined" && $response && typeof $response.body === "string")
      ? $response.body : "";
    if (!body) { $done({}); return; }

    /* Không đụng body nhị phân/media */
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

    var changed = false;
    try { changed = rewrite(obj, 0); } catch (e) { changed = false; }

    if (!changed) { $done({}); return; }

    b1sLog("đã ép badge locket_gold + is_gold cho payload profile");

    $done({
      status: 200,
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
