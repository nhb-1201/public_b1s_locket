// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam v3.0 — Profile & Badge Gold
 * 1) REQUEST changeProfileInfo  → giả lập phản hồi thành công badge gold ngay tại chỗ.
 * 2) RESPONSE mọi API Locket    → đệ quy toàn bộ payload, ép badge/is_gold = gold.
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var GOLD_PROFILE = {
  badge: "gold",
  badge_tier: "gold",
  badge_name: "Gold",
  is_gold: true,
  is_gold_badge: true,
  success: true
};

/** Ép đệ quy mọi object trong payload về Gold Badge (giữ nguyên các field khác). */
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
    // Các key liên quan tới badge/gold ở bất kỳ cấp nào → ép về Gold
    if (/^(is_?gold(_?badge)?|badge(_tier|_name|_number)?|has_?gold|is_vip|vip_active|is_premium|premium_active)$/i.test(keys[j])) {
      node[keys[j]] = (keys[j].toLowerCase().indexOf("badge_number") !== -1 || keys[j].toLowerCase().indexOf("badge_name") !== -1 || keys[j].toLowerCase().indexOf("badge_tier") !== -1)
        ? (keys[j].toLowerCase().indexOf("badge_number") !== -1 ? 1 : (keys[j].toLowerCase().indexOf("badge_name") !== -1 ? "Gold" : "gold"))
        : (/^(is_|has_)/i.test(keys[j]) ? true : "gold");
      touched = true;
    }
  }

  // Nếu node trông giống một "profile object" → ép đầy đủ
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
} else {
  var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
  if (body) {
    try {
      var obj = JSON.parse(body);
      injectBadge(obj, 0);
      body = JSON.stringify(obj);
    } catch (e) { /* body không phải JSON hợp lệ → giữ nguyên */ }
  }
  $done({ body: body });
}
