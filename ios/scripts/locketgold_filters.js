// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — AI Filter Unlock + Camera Filter Gold (DEVICE-LOCKED)
 *
 * 1) REQUEST  → xoá header cache (chặn 304 Not Modified) + giả vùng US để mở filter
 *               AI bị khoá theo khu vực (Locket chỉ bật filter thử nghiệm ở US).
 * 2) RESPONSE → lỗi 402/403/400 từ server (paywall filter) → đổi thành 200 "unlocked",
 *               requires_gold=false / is_locked=false.
 *
 * KHÔNG phone-home, KHÔNG gửi uid/username ra ngoài — toàn bộ xử lý trên máy.
 * Key sai / khác máy / offline > 72h → trả nguyên body gốc (fail-closed).
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

/* B1S-CDN-ARG: module mới (CDN jsDelivr) truyền "KEY|slug" qua $argument — không chứa dấu phẩy.
   Module cũ: worker vá 2 dòng placeholder ở trên — giữ tương thích ngược. */
try {
  var _rawArg = (typeof $argument !== "undefined" && $argument) ? String($argument) : "";
  var _argParts = _rawArg.split("|");
  var _argKey = (_argParts[0] || "").trim().toUpperCase();
  if (/^B1S-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(_argKey)) LICENSE_KEY = _argKey;
  var _argSlug = (_argParts[1] || "").trim().toLowerCase();
  if (typeof B1S_CONFIGS !== "undefined" && _argSlug && Object.prototype.hasOwnProperty.call(B1S_CONFIGS, _argSlug)) {
    B1S_CONFIG = B1S_CONFIGS[_argSlug];
  }
} catch (_e) { /* giữ giá trị worker chèn (module cũ) */ }

/* ── License gate (giống locketgold_profile.js) — fail-closed ── */
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
  } catch (e) { /* tiếp tục */ }
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var id2 = $persistentStore.read("b1s_lg_device_id");
      if (id2) return id2;
      id2 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $persistentStore.write(id2, "b1s_lg_device_id");
      return id2;
    }
  } catch (e) { /* tiếp tục */ }
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
}

function lastVerifiedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey("b1s_lg_ok_at") || 0);
  } catch (e) { /* bỏ qua */ }
  return 0;
}
function markVerified() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), "b1s_lg_ok_at");
  } catch (e) { /* bỏ qua */ }
}

function gate(doAllow, doDeny) {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return doDeny();
  if (Date.now() - lastVerifiedAt() < 259200000) return doAllow();
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
      return doDeny();
    });
  });
}

/* ═══════════════ REQUEST — bỏ cache + giả vùng US ═══════════════ */
var IS_REQUEST_PHASE = (typeof $response === "undefined");

/** URL media/CDN (ảnh, video) — KHÔNG được inject region params (ký URL sẽ 403 → feed trắng). */
var MEDIA_EXT = /\.(jpe?g|png|webp|heic|heif|gif|mp4|mov|m4v|avi|mkv|mp3|m4a|pdf|zip)(\?|#|$)/i;
function isMediaRequest(url) {
  if (!url) return false;
  var u = String(url).toLowerCase();
  if (MEDIA_EXT.test(u)) return true;
  var m = /^https?:\/\/([^\/]+)/.exec(u);
  var host = m ? m[1] : "";
  // CDN / bucket ảnh công khai của Locket
  if (host.indexOf("cdn.") === 0 || host.indexOf("public.") === 0 || host.indexOf("media.") === 0) return true;
  // Bucket Firebase Storage của Locket
  if (host.indexOf("firebasestorage.") !== -1) return true;
  if (host.indexOf("storage.googleapis.com") !== -1) return true;
  return false;
}

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

if (IS_REQUEST_PHASE) {
  // Media/CDN — engine không làm gì (giữ nguyên chữ ký URL)
  var _reqUrl = ($request && $request.url) ? String($request.url) : "";
  if (!isMediaRequest(_reqUrl)) {
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
  if (nextUrl && $request && _reqUrl && nextUrl !== _reqUrl) out.url = nextUrl;

  gate(
    function () { $done(out); },
    function () { $done({}); }
  );
  } else {
    $done({}); // media/CDN — giữ nguyên, không đụng vào request
  }
} else {

/* ═══════════════ RESPONSE — mở khoá paywall filter (402/403/400) ═══════════════ */
(function () {
  var body = $response.body;
  var status = $response.status || $response.statusCode || 200;

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
   * Xử lý lỗi paywall (402/403/400) — "phẫu thuật" thay vì thay toàn bộ body.
   * Lý do: nếu thay body, danh sách filter/khung trong response bị XOÁ ⇒ sheet rỗng
   * và app hiện màn hình "Mở khóa bằng Locket Gold".
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
    } catch (e) { /* bỏ qua */ }

    // GIỮ NGUYÊN toàn bộ field gốc (danh sách filter, cấu hình…) — chỉ bỏ phần lỗi.
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

  /* ── GỠ CHE MỜ ẢNH (unblur) ──────────────────────────────────────────────
     Server trả `blurred_url` khi tài khoản chưa có Gold → app hiện ảnh mờ.
     Ta chuyển mọi URL ảnh về bản THẬT (unblurred_url / result_url / image_url…)
     và xoá cờ blur. Toàn bộ xử lý cục bộ, không đổi dữ liệu trên server. */
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

      // 3) Gỡ che mờ ảnh TRƯỚC (walk sẽ set is_blurred=false → preview_url phải dò blurred trước)
      if (obj && unblur(obj, 0)) changed = true;

      // 2) Ép cờ mở khoá ở mọi node con (filter, moment, camera template…)
      if (obj) {
        var before = JSON.stringify(obj);
        walk(obj, 0);
        if (JSON.stringify(obj) !== before) changed = true;
      }

      if (!changed) { $done({}); return; }
      // Headers sạch — KHÔNG giữ Content-Length/Content-Encoding gốc (body mới khác độ dài)
      $done({ status: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(obj) });
    },
    function () { $done({}); }
  );
})();
}
