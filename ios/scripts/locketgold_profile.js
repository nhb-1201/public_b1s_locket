// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Profile & Badge Gold (DEVICE-LOCKED)
 *
 * 1) REQUEST changeProfileInfo  → giả lập phản hồi thành công Gold Badge (chỉ khi license hợp lệ).
 * 2) RESPONSE mọi API Locket    → ép badge/is_gold = gold (chỉ khi license hợp lệ).
 * Key sai/khác máy/offline >72h → trả body gốc, không đụng gì.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

var GOLD_PROFILE = {
  badge: "gold",
  badge_tier: "gold",
  badge_name: "Gold",
  is_gold: true,
  is_gold_badge: true,
  success: true
};

/* ── License gate (giống hệt locketgold_revenuecat.js) ── */
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

function gate(doAllow, doDeny) {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return doDeny();
  if (Date.now() - lastVerifiedAt() < 259200000) return doAllow();
  var id = deviceId();
  if (!id) return doDeny();
  if (typeof $httpClient !== "undefined" && $httpClient) {
    $httpClient.get(
      {
        url: "https://b1s.id.vn/api/locketgold/verify?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
        timeout: 10
      },
      function (err, resp) {
        if (err || !resp || !resp.body) return doDeny();
        try {
          var j = JSON.parse(resp.body);
          if (j && j.valid === true) {
            markVerified();
            return doAllow();
          }
          return doDeny();
        } catch (e) {
          return doDeny();
        }
      }
    );
    return;
  }
  return doDeny();
}

/** Ép mọi object trong payload về Gold Badge (giữ nguyên các field khác). */
function injectBadge(node, depth) {
  if (!node || typeof node !== "object" || (depth || 0) > 24) return;

  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) injectBadge(node[i], (depth || 0) + 1);
    return;
  }

  var touched = false;
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
      touched = true;
    }
  }

  var looksLikeProfile = ("badge" in node) || ("is_gold" in node) || ("badge_tier" in node) ||
                         ("display_name" in node || "username" in node || "user_id" in node);
  if (looksLikeProfile && !touched) {
    node.badge = "gold";
    node.badge_tier = "gold";
    node.is_gold = true;
    node.is_gold_badge = true;
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

if (mode === "request") {
  gate(
    function () {
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
      $done({}); // không license → để request đi tiếp bình thường
    }
  );
} else {
  gate(
    function () {
      var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
      if (body) {
        try {
          var obj = JSON.parse(body);
          injectBadge(obj, 0);
          body = JSON.stringify(obj);
        } catch (e) { /* body không phải JSON hợp lệ — giữ nguyên */ }
      }
      $done({ body: body });
    },
    function () {
      var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
      $done({ body: body }); // không license → nguyên vẹn
    }
  );
}
