// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_profile_request.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Profile REQUEST phase.
 *
 * MỤC TIÊU:
 *   1) changeProfileInfo (lưu hồ sơ) — nếu body KHÔNG chứa bio thật thì trả luôn
 *      200 + profile Gold/Verified (app đổi tên / đổi ảnh không bị lỗi paywall).
 *      Nếu body CÓ bio thật ⇒ passthrough để server lưu nguyên vẹn.
 *   2) Gỡ header cache (if-none-match / if-modified-since) cho mọi API Locket.
 *
 * AN TOÀN:
 *   · Request không bị sửa ngoài phần header cache.
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ request đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  var CREDIT = "B1sTeam: Nguyễn Hoàng Bách - Zalo: 083.3399.553";

  /* Profile Gold trả về khi app lưu hồ sơ */
  var GOLD_PROFILE = {
    badge: "locket_gold",
    badge_tier: "gold",
    badge_name: "Gold",
    is_gold: true,
    is_gold_badge: true,
    gold_badge: true,
    gold_badge_enabled: true,
    badge_gold: true,
    badge_enabled: true,
    use_gold_badge: true,
    verified: true,
    is_verified: true,
    verified_badge: true,
    checkmark: true,
    bio: CREDIT,
    biography: CREDIT,
    about: CREDIT,
    about_me: CREDIT,
    subtitle: CREDIT,
    tagline: CREDIT,
    status_message: CREDIT,
    status_text: CREDIT,
    profile_bio: CREDIT,
    success: true
  };

  /* Field "bio" — nếu có giá trị ⇒ người dùng đang LƯU bio thật */
  var BIO_LIKE_KEYS = /^(bio|biography|about|about_me|subtitle|tagline|headline|status_message|status_text|profile_bio|profile_subtitle|profile_description)$/i;

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function b1sLog(msg) {
    try { console.log("[locketgold] profile-request: " + msg); } catch (e) { /* ignore */ }
  }

  /** Body có chứa bio thật không? */
  function containsBioValue(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 10) return false;
    for (var k in node) {
      if (!hasOwn(node, k)) continue;
      var v = node[k];
      if (typeof v === "string" && BIO_LIKE_KEYS.test(k) && v.trim().length > 0) return true;
      if (v && typeof v === "object" && containsBioValue(v, d + 1)) return true;
    }
    return false;
  }

  try {
    if (typeof $done !== "function") return;

    if (typeof $request === "undefined" || !$request) { $done({}); return; }

    var url = $request.url ? String($request.url) : "";
    var src = ($request && $request.headers) ? $request.headers : {};
    var headers = {};
    for (var k in src) {
      if (!hasOwn(src, k)) continue;
      var lk = String(k).toLowerCase();
      if (lk === "if-none-match" || lk === "if-modified-since") continue;
      headers[k] = src[k];
    }

    /* 1) Lưu hồ sơ */
    if (url.indexOf("changeProfileInfo") !== -1) {
      var passthrough = false;
      try {
        var rb = $request.body;
        var parsed = (typeof rb === "string") ? JSON.parse(rb) : rb;
        if (parsed && typeof parsed === "object" && containsBioValue(parsed, 0)) passthrough = true;
      } catch (e) { passthrough = false; }

      if (passthrough) {
        b1sLog("changeProfileInfo có bio thật → passthrough (server lưu nguyên vẹn)");
        $done({ headers: headers });
        return;
      }

      b1sLog("changeProfileInfo → 200 Gold + Verified");
      $done({
        headers: headers,
        response: {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
          },
          body: JSON.stringify({ data: GOLD_PROFILE, result: GOLD_PROFILE, success: true })
        }
      });
      return;
    }

    /* 2) Còn lại — chỉ gỡ header cache */
    $done({ headers: headers });
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
