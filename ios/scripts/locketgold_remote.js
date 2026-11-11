// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Firebase Remote Config Unlock (DEVICE-LOCKED)
 *
 * Merge toàn bộ feature flag premium vào parameters của Remote Config —
 * CHỈ KHI license hợp lệ trên đúng thiết bị này (xem locketgold_revenuecat.js).
 * Key sai/khác máy/offline quá 72h → giữ nguyên body gốc.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

var rawBody = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";

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
  return null;
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

function injectFlags(body) {
  var obj;
  try {
    obj = JSON.parse(body);
    if (!obj || typeof obj !== "object") obj = {};
  } catch (e) {
    obj = {};
  }

  if (!obj.condition || typeof obj.condition !== "object") obj.condition = {};
  if (!obj.parameters || typeof obj.parameters !== "object") obj.parameters = {};
  if (!obj.parameterGroups || typeof obj.parameterGroups !== "object") obj.parameterGroups = {};

  var premiumFlags = {
    "gold_badge_enabled": true,
    "vip_subscription_active": true,
    "unlimited_views": true,
    "unlimited_captions": true,
    "custom_widgets": true,
    "streak_recovery": true,
    "no_ads": true,
    "premium_icons": true,
    "premium_camera_themes": true,
    "locket_gold_active": true,
    "free_trial_available": true,
    "gold_tier": true
  };

  for (var flag in premiumFlags) {
    if (!Object.prototype.hasOwnProperty.call(premiumFlags, flag)) continue;
    var existing = obj.parameters[flag];
    var param = (existing && typeof existing === "object") ? existing : {};
    param.defaultValue = { value: "true" };
    obj.parameters[flag] = param;
  }

  obj.version = {
    version_number: "3.1.0",
    update_time: "2026-11-10T00:00:00Z",
    description: "LocketGold B1sTeam — device-locked"
  };

  return JSON.stringify(obj);
}

function unlock() { $done({ body: injectFlags(rawBody) }); }
function deny() { $done({ body: rawBody }); }

(function gate() {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return deny();

  if (Date.now() - lastVerifiedAt() < 259200000) return unlock();

  var id = deviceId();
  if (!id) return deny();

  // Thử lần lượt 2 endpoint — zone b1s.id.vn có thể chặn app proxy lạ (WAF),
  // workers.dev luôn trả lời trực tiếp. Cả hai verify cùng 1 license.
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
        else if (response && typeof response.body === "string") body = response.body; // tương thích ngược
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
  verifyWith("https://b1s.id.vn/api/locketgold/verify", function (okPrimary) {
    if (okPrimary) {
      markVerified();
      return unlock();
    }
    verifyWith("https://locketgold-backend.nhb-120111.workers.dev/api/v2/locketgold/verify", function (okFallback) {
      if (okFallback) {
        markVerified();
        return unlock();
      }
      return deny();
    });
  });
})();
