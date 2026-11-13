// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * B1S YOUTUBE — script MITM của B1sTeam cho YouTube (InnerTube).
 * Mục tiêu: bỏ quảng cáo trong player, ép trạng thái phát được (playabilityStatus = OK / HTML5).
 * Viết bởi B1sTeam — không phụ thuộc script của bên thứ ba.
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js

// @b1s-include ./lib/license-gate.js

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
if (!body) { $done({}); } else {
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
    function () { $done({}); },
    "youtube"
  );
}
