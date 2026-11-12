// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * B1S YOUTUBE — script MITM của B1sTeam cho YouTube (InnerTube).
 * Mục tiêu: bỏ quảng cáo trong player, ép trạng thái phát được (premium/background play),
 * và ép caption/lyrics khi có. Viết bởi B1sTeam — không phụ thuộc script của bên thứ ba.
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
var FAR_FUTURE = "2099-12-31T23:59:59Z";

/* ───────────────── License gate (fail-closed) ───────────────── */
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
  } catch (e) {}
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var id2 = $persistentStore.read("b1s_lg_device_id");
      if (id2) return id2;
      id2 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $persistentStore.write(id2, "b1s_lg_device_id");
      return id2;
    }
  } catch (e) {}
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
}
function lastVerifiedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey("b1s_lg_ok_at") || 0);
  } catch (e) {}
  return 0;
}
/** OFFLINE-GRACE: máy từng verify OK trong ≤30 ngày nhưng lần này verify lỗi (mất mạng/máy chủ tạm thời) → vẫn cho mở, tránh "mất key" giữa chừng. */
var OFFLINE_GRACE_MS = 2592000000;
function offlineGraceActive() {
  var last = lastVerifiedAt();
  return last > 0 && Date.now() - last < OFFLINE_GRACE_MS;
}
function markVerified() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), "b1s_lg_ok_at");
  } catch (e) {}
}
function gate(allow, deny) {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) { noteFailed(); return deny(); }
  if (Date.now() - lastVerifiedAt() < 604800000) return allow();
  var _failAt = 0;
  try { if (typeof $prefs !== "undefined" && $prefs) _failAt = Number($prefs.valueForKey("b1s_lg_fail_at") || 0); } catch (e) {}
  if (_failAt > 0 && (Date.now() - _failAt) < 300000) { try { console.log("[b1syoutube] verify cooldown 5p (sau khi FAIL)"); } catch (e) {} return deny(); }
  function noteFailed() { try { if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), "b1s_lg_fail_at"); } catch (e) {} }
  var id = deviceId();
  if (!id) { noteFailed(); return deny(); }
  function verifyWith(base, onDone) {
    if (typeof $httpClient === "undefined" || !$httpClient) return onDone(false);
    $httpClient.get(
      {
        url: base + "?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" },
        timeout: 10,
      },
      function (err, response, data) {
        if (err) return onDone(false);
        var body = "";
        if (typeof data === "string") body = data;
        else if (typeof data !== "undefined" && data !== null) {
          try { body = String(data); } catch (e) { return onDone(false); }
        } else if (response && typeof response.body === "string") body = response.body;
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
  verifyWith("https://locket.b1s.id.vn/api/locketgold/verify", function (okPrimary) {
    if (okPrimary) { markVerified(); return allow(); }
    verifyWith("https://locket.b1s.id.vn/api/v2/locketgold/verify", function (okFallback) {
      if (okFallback) { markVerified(); return allow(); }
      if (offlineGraceActive()) { try { console.log("[b1syoutube] OFFLINE-GRACE"); } catch (e) {} return allow(); }
      noteFailed(); return deny();
    });
  });
}

/* ───────────────── Scrub YouTube payload ───────────────── */
var AD_KEYS = [
  "adPlacements",
  "playerAds",
  "adSlotRenderer",
  "adBreakHeartbeatParams",
  "adParams",
  "adParamsForFlags",
  "adBreakParams",
  "playerAdParams",
  "ads",
  "adRenderers",
  "inlineAdRenderer",
  "promotedVideoRenderer",
  "displayAdRenderer",
  "linearAds",
  "nonLinearAds",
  "companionAds",
  "bannerAds",
  "promoVideoRenderer",
];

function isObject(v) { return v && typeof v === "object" && !Array.isArray(v); }

function scrub(node, depth) {
  if (!node || typeof node !== "object" || (depth || 0) > 14) return;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) scrub(node[i], (depth || 0) + 1);
    return;
  }
  for (var k = 0; k < AD_KEYS.length; k++) {
    var key = AD_KEYS[k];
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      if (Array.isArray(node[key])) node[key] = [];
      else if (key === "adParams" || key === "adBreakHeartbeatParams" || key === "adParamsForFlags" || key === "adBreakParams" || key === "playerAdParams") {
        node[key] = "";
      } else {
        delete node[key];
      }
    }
  }
  // playerResponse lồng nhau (dạng chuỗi JSON)
  if (typeof node.playerResponse === "string") {
    try {
      var pr = JSON.parse(node.playerResponse);
      scrub(pr, (depth || 0) + 1);
      node.playerResponse = JSON.stringify(pr);
    } catch (e) { /* bỏ qua */ }
  }
  // Ép trạng thái phát được (premium → không bị chặn "Video unavailable")
  if (isObject(node.playabilityStatus)) {
    node.playabilityStatus.status = "OK";
    node.playabilityStatus.reason = null;
    if (node.playabilityStatus.errorScreen) delete node.playabilityStatus.errorScreen;
    if (node.playabilityStatus.playbackTracking) node.playabilityStatus.playbackTracking.videostatsPlaybackUrl = node.playabilityStatus.playbackTracking.videostatsPlaybackUrl || "";
  }
  // Gói premium trong player
  if (isObject(node.playbackContext)) {
    node.playbackContext.contentPlaybackContext.html5Preference = "HTML5_PREF_WANTS";
    if (isObject(node.playbackContext.contentPlaybackContext)) {
      node.playbackContext.contentPlaybackContext.signatureTimestamp = node.playbackContext.contentPlaybackContext.signatureTimestamp || 0;
    }
  }
  for (var key2 in node) {
    if (!Object.prototype.hasOwnProperty.call(node, key2)) continue;
    if (node[key2] && typeof node[key2] === "object") scrub(node[key2], (depth || 0) + 1);
  }
}

/* ───────────────── Main ───────────────── */
var body = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";
if (!body) { $done({}); }
else {
  gate(
    function () {
      try {
        var obj = JSON.parse(body);
        scrub(obj, 0);
        $done({ body: JSON.stringify(obj) });
      } catch (e) {
        $done({});
      }
    },
    function () {
      $done({});
    }
  );
}
