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

  var nextUrl = forceRegionParams(($request && $request.url) ? String($request.url) : "");
  var out = { headers: headers };
  if (nextUrl && $request && nextUrl !== String($request.url)) out.url = nextUrl;

  gate(
    function () { $done(out); },
    function () { $done({}); }
  );
} else {

/* ═══════════════ RESPONSE — mở khoá paywall filter (402/403/400) ═══════════════ */
(function () {
  var body = $response.body;
  var status = $response.status || $response.statusCode || 200;

  function unlockPayload(original) {
    var details = null;
    try {
      if (original && original.error && original.error.details) details = original.error.details;
    } catch (e) { /* bỏ qua */ }
    return {
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
        data: details || {}
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
      }
    }
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

      // 2) Ép cờ mở khoá ở mọi node con (filter, moment, camera template…)
      if (obj) {
        var before = JSON.stringify(obj);
        walk(obj, 0);
        if (JSON.stringify(obj) !== before) changed = true;
      }

      if (!changed) { $done({}); return; }
      $done({ status: status, body: JSON.stringify(obj) });
    },
    function () { $done({}); }
  );
})();
}
