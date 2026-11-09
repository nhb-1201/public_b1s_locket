// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam v3.0 — Firebase Remote Config Unlock
 * Merge toàn bộ feature flag premium vào parameters của Remote Config.
 * Chỉ thêm/ghi đè defaultValue của các flag liên quan Gold — không xóa key có sẵn.
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var body = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";

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

// Metadata phiên bản — giúp bản config tự mô tả trong Remote Config dashboard
obj.version = {
  version_number: "3.0.0",
  update_time: "2026-11-09T00:00:00Z",
  description: "LocketGold B1sTeam v3.0 — full features unlocked"
};

$done({ body: JSON.stringify(obj) });
