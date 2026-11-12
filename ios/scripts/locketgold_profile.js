// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam â€” Profile & Badge Gold (DEVICE-LOCKED)
 *
 * 1) REQUEST changeProfileInfo  â†’ giáº£ láº­p pháº£n há»“i thÃ nh cÃ´ng Gold Badge (chá»‰ khi license há»£p lá»‡).
 * 2) RESPONSE má»i API Locket    â†’ Ã©p badge/is_gold = gold (chá»‰ khi license há»£p lá»‡).
 * Key sai/khÃ¡c mÃ¡y/offline (grace 30 ngày; cache 7 ngày) â†’ tráº£ body gá»‘c, khÃ´ng Ä‘á»¥ng gÃ¬.
 *
 * B1sTeam â€” b1s.id.vn Â· @b1steam Â· Nguyá»…n HoÃ ng BÃ¡ch
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

/* B1S-CDN-ARG: module má»›i (CDN jsDelivr) truyá»n "KEY|slug" qua $argument â€” khÃ´ng chá»©a dáº¥u pháº©y.
   Module cÅ©: worker vÃ¡ 2 dÃ²ng placeholder á»Ÿ trÃªn â€” giá»¯ tÆ°Æ¡ng thÃ­ch ngÆ°á»£c. */
try {
  var _rawArg = (typeof $argument !== "undefined" && $argument) ? String($argument) : "";
  var _argParts = _rawArg.split("|");
  var _argKey = (_argParts[0] || "").trim().toUpperCase();
  if (/^B1S-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(_argKey)) LICENSE_KEY = _argKey;
  var _argSlug = (_argParts[1] || "").trim().toLowerCase();
  if (typeof B1S_CONFIGS !== "undefined" && _argSlug && Object.prototype.hasOwnProperty.call(B1S_CONFIGS, _argSlug)) {
    B1S_CONFIG = B1S_CONFIGS[_argSlug];
  }
} catch (_e) { /* giá»¯ giÃ¡ trá»‹ worker chÃ¨n (module cÅ©) */ }

var CREDIT = "B1sTeam: Nguyá»…n HoÃ ng BÃ¡ch - Zalo: 083.3399.553";

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
  success: true
};

/* â”€â”€ License gate (giá»‘ng há»‡t locketgold_revenuecat.js) + fallback in-memory â”€â”€ */
var memDeviceId = null;
function deviceId() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) {
      var id1 = $prefs.valueForKey("b1s_lg_device_id");
      if (id1) return id1;
      id1 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $prefs.setValueForKey(id1, "b1s_lg_device_id");
      return id1;
    }
  } catch (e) { /* tiáº¿p tá»¥c */ }
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var id2 = $persistentStore.read("b1s_lg_device_id");
      if (id2) return id2;
      id2 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $persistentStore.write(id2, "b1s_lg_device_id");
      return id2;
    }
  } catch (e) { /* tiáº¿p tá»¥c */ }
  // Fallback in-memory khi store lá»—i â€” KHÃ”NG deny cá»©ng
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
}

function lastVerifiedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey("b1s_lg_ok_at") || 0);
  } catch (e) { /* bá» qua */ }
  return 0;
}
/** OFFLINE-GRACE: mÃ¡y tá»«ng verify OK trong â‰¤30 ngÃ y nhÆ°ng láº§n nÃ y verify lá»—i (máº¥t máº¡ng/mÃ¡y chá»§ táº¡m thá»i) â†’ váº«n cho má»Ÿ, trÃ¡nh "máº¥t key" giá»¯a chá»«ng. */
var OFFLINE_GRACE_MS = 2592000000;
function offlineGraceActive() {
  var last = lastVerifiedAt();
  return last > 0 && Date.now() - last < OFFLINE_GRACE_MS;
}
function markVerified() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), "b1s_lg_ok_at");
  } catch (e) { /* bá» qua */ }
}

function gate(doAllow, doDeny) {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return doDeny();
  if (Date.now() - lastVerifiedAt() < 604800000) return doAllow();
  var id = deviceId();
  if (!id) return doDeny();
  // Thá»­ láº§n lÆ°á»£t 2 endpoint â€” zone b1s.id.vn cÃ³ thá»ƒ cháº·n app proxy láº¡ (WAF),
  // workers.dev luÃ´n tráº£ lá»i trá»±c tiáº¿p. Cáº£ hai verify cÃ¹ng 1 license.
  function verifyWith(base, onDone) {
    if (typeof $httpClient === "undefined" || !$httpClient) return onDone(false);
    $httpClient.get(
      {
        url: base + "?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
        timeout: 10
      },
      function (err, response, data) {
        if (err) return onDone(false);
        var body = "";
        if (typeof data === "string") body = data;
        else if (typeof data !== "undefined" && data !== null) { try { body = String(data); } catch (e) { return onDone(false); } }
        else if (response && typeof response.body === "string") body = response.body; // tÆ°Æ¡ng thÃ­ch ngÆ°á»£c
        if (!body) return onDone(false);
        try {
          var j = JSON.parse(body);
          return onDone(Boolean(j && j.valid === true));
        } catch (e) {
          return onDone(false);
        }
      }
    );
  }
  verifyWith("https://locket.b1s.id.vn/api/v2/locketgold/verify", function (okPrimary) {
    if (okPrimary) {
      markVerified();
      return doAllow();
    }
    verifyWith("https://b1s.id.vn/api/locketgold/verify", function (okFallback) {
      if (okFallback) {
        markVerified();
        return doAllow();
      }
      if (offlineGraceActive()) { try { console.log("[locketgold] profile: OFFLINE-GRACE"); } catch (e) {} return doAllow(); }
      return doDeny();
    });
  });
}

/* CÃ¡c key chá»©ng thá»±c tÃ­ch xanh â€” Ã©p true khi license há»£p lá»‡ (client-side view) */
var VERIFIED_KEYS = /^(verified|is_verified|verified_badge|verified_user|badge_verified|has_verified|checkmark|has_checkmark|is_official|official|celebrity|is_celebrity|is_star|verified_check)$/i;

/* CÃ¡c key bio/subtitle dÆ°á»›i username â€” Ã©p vá» credit B1sTeam (client-side view) */
var BIO_LIKE_KEYS = /^(bio|biography|about|about_me|subtitle|tagline|headline|status_message|status_text|profile_bio|profile_subtitle|profile_description)$/i;
var CREDIT_FIELDS = ["bio", "biography", "about", "about_me", "subtitle", "tagline", "headline", "status_message", "status_text", "profile_bio", "profile_subtitle", "profile_description"];

/* Má»ŒI key chá»©a "badge" (trá»« key url/icon/path) â€” Ã©p Gold; giá»¯ sá»‘/string Ä‘Ãºng kiá»ƒu */
function isBadgeKey(k) { return /badge/i.test(k); }
function isBadgeUrlKey(k) { return /_url($|_)|url$|image|icon|_src($|_)|path|asset/i.test(k); }
function badgeValueFor(k) {
  var s = String(k).toLowerCase();
  if (/number|count|level|rank|order|index/.test(s)) return 1;
  if (/_name($|_)/.test(s)) return "Gold";
  return "gold"; // badge / badge_tier / badge_type / badge_color â€” "gold" lÃ  mÃ u CSS há»£p lá»‡
}

/** Ã‰p má»i object trong payload vá» Gold Badge + credit (giá»¯ nguyÃªn cÃ¡c field khÃ¡c). */
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
      node[keys[j]] = (keys[j].toLowerCase().indexOf("badge_number") !== -1 || keys[j].toLowerCase().indexOf("badge_name") !== -1 || keys[j].toLowerCase().indexOf("badge_tier") !== -1)
        ? (keys[j].toLowerCase().indexOf("badge_number") !== -1 ? 1 : (keys[j].toLowerCase().indexOf("badge_name") !== -1 ? "Gold" : "gold"))
        : (/^(is_|has_)/i.test(keys[j]) ? true : "gold");
    } else if (isBadgeKey(keys[j]) && !isBadgeUrlKey(keys[j])) {
      // Toggle/badge keys server cÃ³ thá»ƒ tráº£ false â€” Ã©p vá» Gold (boolean giá»¯ boolean, string giá»¯ string)
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
  // Ã‰p TOÃ€N Bá»˜ profile-like (báº£n thÃ¢n + danh sÃ¡ch báº¡n bÃ¨, tin nháº¯nâ€¦) lÃªn Gold + tÃ­ch xanh + credit
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

/** Ã‰p cá» "Ä‘Ã£ má»Ÿ khoÃ¡" á»Ÿ má»i node (filter, moment, camera template) â€” requires_gold=false, is_locked=false. */
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
      lk === "can_use_all_filters" || lk === "allow_saving_all" || lk === "allowed"
    ) {
      node[key] = true;
    } else if (lk === "is_blurred" || lk === "blurred" || lk === "needs_gold" || lk === "has_blur") {
      node[key] = false;
    }
  }
}

var url = (typeof $request !== "undefined" && $request && $request.url) ? $request.url : "";
var mode = "response";
if (typeof $argument !== "undefined" && $argument) {
  try {
    var args = typeof $argument === "string" ? JSON.parse($argument) : $argument;
    if (args === "request" || args === "response") mode = args;
    else if (args && (args.mode === "request" || args.mode === "response")) mode = args.mode;
  } catch (e) {
    if (String($argument).indexOf("request") !== -1) mode = "request";
  }
} else if (url.indexOf("changeProfileInfo") !== -1 && typeof $response === "undefined") {
  mode = "request";
}

/* Cho changeProfileInfo chá»©a field bio Ä‘i tháº³ng lÃªn server (chá»§ profile muá»‘n LÆ¯U bio tháº­t);
   response tráº£ vá» váº«n Ä‘Æ°á»£c response-mode Ã©p badge/credit sau Ä‘Ã³. */
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

if (mode === "request") {
  var passthrough = false;
  try {
    var rb = (typeof $request !== "undefined" && $request && $request.body) ? $request.body : null;
    var parsedBody = typeof rb === "string" ? JSON.parse(rb) : rb;
    if (parsedBody && typeof parsedBody === "object" && containsBioValue(parsedBody, 0)) passthrough = true;
  } catch (e) {
    passthrough = false;
  }
  if (passthrough) {
    console.log("[locketgold] profile: mode=request â†’ PASSTHROUGH (bio edit â€” server se luu)");
    $done({}); // request Ä‘i tiáº¿p lÃªn server nguyÃªn tráº¡ng
  } else {
  gate(
    function () {
      console.log("[locketgold] profile: mode=request â†’ 200 Gold+Verified (changeProfileInfo)");
      $done({
        response: {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
          },
          body: JSON.stringify({
            data: GOLD_PROFILE,
            result: GOLD_PROFILE,
            success: true
          })
        }
      });
    },
    function () {
      console.log("[locketgold] profile: mode=request â†’ DENY (license invalid) â†’ passthrough");
      $done({}); // khÃ´ng license â†’ Ä‘á»ƒ request Ä‘i tiáº¿p bÃ¬nh thÆ°á»ng
    }
  );
  }
} else {
  gate(
    function () {
      console.log("[locketgold] profile: mode=response â†’ inject Gold+Verified badge");
      var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
      // Bá» qua má»i response khÃ´ng pháº£i JSON text â€” file táº£i vá»/nhá»‹ phÃ¢n pháº£i Ä‘i nguyÃªn váº¹n
      try {
        var ct = "";
        if ($response && $response.headers) {
          for (var h in $response.headers) {
            if (Object.prototype.hasOwnProperty.call($response.headers, h) && String(h).toLowerCase() === "content-type") {
              ct = String($response.headers[h] || "").toLowerCase();
              break;
            }
          }
        }
        if (ct && ct.indexOf("json") === -1 && ct.indexOf("text") === -1 && ct.indexOf("x-www-form-urlencoded") === -1) {
          return $done({ body: body }); // nhá»‹ phÃ¢n/media â€” giá»¯ nguyÃªn
        }
      } catch (e) { /* khÃ´ng Ä‘á»c Ä‘Æ°á»£c header â†’ xá»­ lÃ½ nhÆ° text */ }
      if (body) {
        try {
          var obj = JSON.parse(body);
          injectBadge(obj, 0);
          // â”€â”€ Má»ž KHOÃ PAYWALL FILTER (402/403/400) â€” filter AI/Camera bá»‹ khoÃ¡ theo vÃ¹ng hoáº·c theo gÃ³i
          var rstatus = ($response && ($response.status || $response.statusCode)) || 200;
          if (rstatus === 402 || rstatus === 403 || rstatus === 400 || (obj && obj.error)) {
            var details = (obj && obj.error && obj.error.details) ? obj.error.details : {};
            obj = {
              result: {
                status: 200,
                is_gold: true,
                is_locked: false,
                requires_gold: false,
                requires_subscription: false,
                is_subscribed: true,
                unlocked: true,
                premium: true,
                is_premium: true,
                data: details
              },
              data: {
                status: 200,
                is_locked: false,
                requires_gold: false,
                unlocked: true,
                is_gold: true,
                is_premium: true
              },
              error: null
            };
            injectBadge(obj, 0);
            body = JSON.stringify(obj);
            $done({ status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: body });
            return;
          }
          unlockFlags(obj, 0);
          body = JSON.stringify(obj);
        } catch (e) { /* body khÃ´ng pháº£i JSON há»£p lá»‡ â€” giá»¯ nguyÃªn */ }
      }
      $done({ headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: body });
    },
    function () {
      console.log("[locketgold] profile: mode=response â†’ DENY (license invalid) â†’ nguyÃªn váº¹n");
      var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
      $done({ body: body }); // khÃ´ng license â†’ nguyÃªn váº¹n
    }
  );
}
