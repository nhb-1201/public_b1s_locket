// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam â€” AI Filter Unlock + Camera Filter Gold (DEVICE-LOCKED)
 *
 * 1) REQUEST  â†’ xoÃ¡ header cache (cháº·n 304 Not Modified) + giáº£ vÃ¹ng US Ä‘á»ƒ má»Ÿ filter
 *               AI bá»‹ khoÃ¡ theo khu vá»±c (Locket chá»‰ báº­t filter thá»­ nghiá»‡m á»Ÿ US).
 * 2) RESPONSE â†’ lá»—i 402/403/400 tá»« server (paywall filter) â†’ Ä‘á»•i thÃ nh 200 "unlocked",
 *               requires_gold=false / is_locked=false.
 *
 * KHÃ”NG phone-home, KHÃ”NG gá»­i uid/username ra ngoÃ i â€” toÃ n bá»™ xá»­ lÃ½ trÃªn mÃ¡y.
 * Key sai / khÃ¡c mÃ¡y / offline (grace 30 ngày; cache 7 ngày) â†’ tráº£ nguyÃªn body gá»‘c (fail-closed).
 *
 * B1sTeam â€” b1s.id.vn Â· @b1steam Â· Nguyá»…n HoÃ ng BÃ¡ch Â· Zalo 083.3399.553
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

/* â”€â”€ License gate (giá»‘ng locketgold_profile.js) â€” fail-closed â”€â”€ */
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
        else if (response && typeof response.body === "string") body = response.body;
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
    if (okPrimary) { markVerified(); return doAllow(); }
    verifyWith("https://b1s.id.vn/api/locketgold/verify", function (okFallback) {
      if (okFallback) { markVerified(); return doAllow(); }
      if (offlineGraceActive()) { try { console.log("[locketgold] filters: OFFLINE-GRACE"); } catch (e) {} return doAllow(); }
      return doDeny();
    });
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• REQUEST â€” bá» cache + giáº£ vÃ¹ng US â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var IS_REQUEST_PHASE = (typeof $response === "undefined");

/** URL media/CDN (áº£nh, video) â€” KHÃ”NG Ä‘Æ°á»£c inject region params (kÃ½ URL sáº½ 403 â†’ feed tráº¯ng). */
var MEDIA_EXT = /\.(jpe?g|png|webp|heic|heif|gif|mp4|mov|m4v|avi|mkv|mp3|m4a|pdf|zip)(\?|#|$)/i;
function isMediaRequest(url) {
  if (!url) return false;
  var u = String(url).toLowerCase();
  if (MEDIA_EXT.test(u)) return true;
  var m = /^https?:\/\/([^\/]+)/.exec(u);
  var host = m ? m[1] : "";
  // CDN / bucket áº£nh cÃ´ng khai cá»§a Locket
  if (host.indexOf("cdn.") === 0 || host.indexOf("public.") === 0 || host.indexOf("media.") === 0) return true;
  // Bucket Firebase Storage cá»§a Locket
  if (host.indexOf("firebasestorage.") !== -1) return true;
  if (host.indexOf("storage.googleapis.com") !== -1) return true;
  return false;
}

/** Ã‰p tham sá»‘ vÃ¹ng (US) vÃ o query string â€” Locket chá»‰ má»Ÿ filter AI á»Ÿ khu vá»±c US. */
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

if (IS_REQUEST_PHASE) {
  // Media/CDN â€” engine khÃ´ng lÃ m gÃ¬ (giá»¯ nguyÃªn chá»¯ kÃ½ URL)
  var _reqUrl = ($request && $request.url) ? String($request.url) : "";
  if (!isMediaRequest(_reqUrl)) {
  var headers = {};
  var src = ($request && $request.headers) ? $request.headers : {};
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    var lk = String(k).toLowerCase();
    // Bá» header cache Ä‘á»ƒ server KHÃ”NG tráº£ 304 (304 lÃ  body rá»—ng â†’ filter khÃ´ng render)
    if (lk === "if-none-match" || lk === "if-modified-since" || lk === "x-revenuecat-etag") continue;
    headers[k] = src[k];
  }
  // Má»Ÿ filter AI bá»‹ khoÃ¡ theo vÃ¹ng (Locket chá»‰ má»Ÿ filter thá»­ nghiá»‡m á»Ÿ US)
  headers["X-App-Region"] = "US";
  headers["X-Country-Code"] = "US";
  headers["X-Device-Country"] = "US";
  headers["X-Timezone"] = "America/Los_Angeles";
  headers["Accept-Language"] = "en-US,en;q=0.9";

  var nextUrl = forceRegionParams(_reqUrl);
  var out = { headers: headers };
  if (nextUrl && $request && _reqUrl && nextUrl !== _reqUrl) out.url = nextUrl;

  gate(
    function () { $done(out); },
    function () { $done({}); }
  );
  } else {
    $done({}); // media/CDN â€” giá»¯ nguyÃªn, khÃ´ng Ä‘á»¥ng vÃ o request
  }
} else {

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• RESPONSE â€” má»Ÿ khoÃ¡ paywall filter (402/403/400) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
(function () {
  var body = $response.body;
  var status = $response.status || $response.statusCode || 200;

  /** TÃ¬m URL áº£nh Ä‘áº§u tiÃªn trong payload (Ä‘á»ƒ app váº«n hiá»‡n áº£nh khi server tráº£ lá»—i). */
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
   * Xá»­ lÃ½ lá»—i paywall (402/403/400) â€” "pháº«u thuáº­t" thay vÃ¬ thay toÃ n bá»™ body.
   * LÃ½ do: náº¿u thay body, danh sÃ¡ch filter/khung trong response bá»‹ XOÃ â‡’ sheet rá»—ng
   * vÃ  app hiá»‡n mÃ n hÃ¬nh "Má»Ÿ khÃ³a báº±ng Locket Gold".
   */
  function unlockPayload(original) {
    if (!original || typeof original !== "object") {
      return {
        result: { status: 200, is_gold: true, is_locked: false, requires_gold: false, requires_subscription: false, is_subscribed: true, unlocked: true, premium: true, is_premium: true, data: {} },
        data: { status: 200, is_locked: false, requires_gold: false, unlocked: true, is_gold: true, is_premium: true },
        error: null
      };
    }
    var details = null;
    try {
      if (original.error && original.error.details) details = original.error.details;
    } catch (e) { /* bá» qua */ }

    // GIá»® NGUYÃŠN toÃ n bá»™ field gá»‘c (danh sÃ¡ch filter, cáº¥u hÃ¬nhâ€¦) â€” chá»‰ bá» pháº§n lá»—i.
    try { if (original.error) delete original.error; } catch (e) { /* bá» qua */ }
    try { if (original.errors) delete original.errors; } catch (e) { /* bá» qua */ }

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

    // Náº¿u server tráº£ kÃ¨m URL áº£nh (má»/blur) â†’ Ä‘Æ°a lÃªn Ä‘á»ƒ app váº«n hiá»‡n áº£nh.
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

  /* â”€â”€ Gá»  CHE Má»œ áº¢NH (unblur) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     Server tráº£ `blurred_url` khi tÃ i khoáº£n chÆ°a cÃ³ Gold â†’ app hiá»‡n áº£nh má».
     Ta chuyá»ƒn má»i URL áº£nh vá» báº£n THáº¬T (unblurred_url / result_url / image_urlâ€¦)
     vÃ  xoÃ¡ cá» blur. ToÃ n bá»™ xá»­ lÃ½ cá»¥c bá»™, khÃ´ng Ä‘á»•i dá»¯ liá»‡u trÃªn server. */
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

      // 1) Lá»—i paywall (402/403/400) â†’ má»Ÿ khoÃ¡
      if (status === 402 || status === 403 || status === 400 || (obj && obj.error)) {
        status = 200;
        obj = unlockPayload(obj);
        changed = true;
      }

      // 3) Gá»¡ che má» áº£nh TRÆ¯á»šC (walk sáº½ set is_blurred=false â†’ preview_url pháº£i dÃ² blurred trÆ°á»›c)
      if (obj && unblur(obj, 0)) changed = true;

      // 2) Ã‰p cá» má»Ÿ khoÃ¡ á»Ÿ má»i node con (filter, moment, camera templateâ€¦)
      if (obj) {
        var before = JSON.stringify(obj);
        walk(obj, 0);
        if (JSON.stringify(obj) !== before) changed = true;
      }

      if (!changed) { $done({}); return; }
      // Headers sáº¡ch â€” KHÃ”NG giá»¯ Content-Length/Content-Encoding gá»‘c (body má»›i khÃ¡c Ä‘á»™ dÃ i)
      $done({ status: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(obj) });
    },
    function () { $done({}); }
  );
})();
}
