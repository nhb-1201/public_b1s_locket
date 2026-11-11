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
      return doAllow();
    }
    verifyWith("https://locketgold-backend.nhb-120111.workers.dev/api/v2/locketgold/verify", function (okFallback) {
      if (okFallback) {
        markVerified();
        return doAllow();
      }
      return doDeny();
    });
  });
}

/* Các key chứng thực tích xanh — ép true khi license hợp lệ (client-side view) */
var VERIFIED_KEYS = /^(verified|is_verified|verified_badge|verified_user|badge_verified|has_verified|checkmark|has_checkmark|is_official|official|celebrity|is_celebrity|is_star|verified_check)$/i;

/* Các key bio/subtitle dưới username — ép về credit B1sTeam (client-side view) */
var BIO_LIKE_KEYS = /^(bio|biography|about|about_me|subtitle|tagline|headline|status_message|status_text|profile_bio|profile_subtitle|profile_description)$/i;
var CREDIT_FIELDS = ["bio", "biography", "about", "about_me", "subtitle", "tagline", "headline", "status_message", "status_text", "profile_bio", "profile_subtitle", "profile_description"];

/** Ép mọi object trong payload về Gold Badge + credit (giữ nguyên các field khác). */
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
    node.verified = true;
    node.is_verified = true;
    node.verified_badge = true;
    for (var k = 0; k < CREDIT_FIELDS.length; k++) node[CREDIT_FIELDS[k]] = CREDIT;
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

/* Cho changeProfileInfo chứa field bio đi thẳng lên server (chủ profile muốn LƯU bio thật);
   response trả về vẫn được response-mode ép badge/credit sau đó. */
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
    console.log("[locketgold] profile: mode=request → PASSTHROUGH (bio edit — server se luu)");
    $done({}); // request đi tiếp lên server nguyên trạng
  } else {
  gate(
    function () {
      console.log("[locketgold] profile: mode=request → 200 Gold+Verified (changeProfileInfo)");
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
      console.log("[locketgold] profile: mode=request → DENY (license invalid) → passthrough");
      $done({}); // không license → để request đi tiếp bình thường
    }
  );
  }
} else {
  gate(
    function () {
      console.log("[locketgold] profile: mode=response → inject Gold+Verified badge");
      var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
      // Bỏ qua mọi response không phải JSON text — file tải về/nhị phân phải đi nguyên vẹn
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
          return $done({ body: body }); // nhị phân/media — giữ nguyên
        }
      } catch (e) { /* không đọc được header → xử lý như text */ }
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
      console.log("[locketgold] profile: mode=response → DENY (license invalid) → nguyên vẹn");
      var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
      $done({ body: body }); // không license → nguyên vẹn
    }
  );
}
