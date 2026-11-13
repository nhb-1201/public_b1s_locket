// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Firebase Remote Config Unlock (DEVICE-LOCKED) v5.0
 *
 * MỞ KHÓA TOÀN BỘ TÍNH NĂNG PREMIUM CỦA LOCKET — entries là format THẬT của app:
 *   · Firebase v1 fetch trả về { entries: { flag: "value", ... } } (flat, string).
 *   · FORCE_ENTRIES map ĐÚNG tên flag thật của Locket (camera, camera_roll, feature_gates,
 *     moment_*, rollcall_*, groups, journal, widgets, uploads, friends, cache/CDN…).
 *   · feature_gates là JSON string → parse, bật "enabled" cho toàn bộ gate premium, giữ key lạ.
 *   · Entry thương hiệu bên ngoài (URL mạng xã hội…) — giữ giá trị máy chủ; riêng popup chào mừng
 *     là bản B1sTeam (credit B1sDev · Nguyễn Hoàng Bách), campaign random MỖI LẦN fetch để popup luôn hiện.
 *
 * License gate fail-closed (lib/license-gate.js) — key sai / sai máy / hết grace → trả nguyên body gốc.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js

var rawBody = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";

// @b1s-include ./lib/license-gate.js

/* ══════════════════════════════════════
   BẢNG FLAG THẬT CỦA LOCKET (entries — string values)
   Nguồn: phân tích response Remote Config của app Locket.
   Giá trị KHÔNG đổi: URL ngoài / branding bên thứ 3 (app tự giữ mặc định server).
   ══════════════════════════════════════ */
// @b1s-include ./_remote_entries.fragment.js

/* Các feature gate premium — Locket đọc JSON này từ entries.feature_gates */
var KNOWN_PREMIUM_GATES = [
  // Nhóm gốc
  "app_icon_picker", "camera_roll", "camera_theme", "locket_views", "long_captions",
  "longer_video", "unlimited_friends", "priority_support", "profile_badge",
  "remove_ads", "video", "custom_widget_frames", "streak_recovery",
  // Nhóm camera / filter / theme (bổ sung)
  "camera_filter", "camera_filters", "filters", "camera_filter_sheet",
  "camera_filters_sheet", "camera_filter_picker", "camera_theme_sheet",
  "camera_themes_sheet", "camera_theme_picker", "camera_themes_config",
  "camera_color", "camera_colors", "holiday_filters", "ai_filter", "ai_filters",
  "ai_camera_filter",
  // Nhóm widget / icon / view
  "widget_frames", "widget_frame", "app_icons", "moment_views", "groups",
  "rollcall", "time_travel_rewind", "conversation_drafts", "chat_hyperlinks",
  "unsend_message", "celebrity_inbox", "user_data_export",
];

/* Gate cần TẮT (Locket filter AI/holiday — không kích hoạt, tránh paywall + nut filter ẩn). */
var KNOWN_OFF_GATES = [
  "camera_filter", "camera_filters", "filters", "camera_filter_sheet", "camera_filter_picker",
  "camera_theme_sheet", "camera_themes_sheet", "camera_theme_picker",
  "holiday_filters", "ai_filter", "ai_filters", "ai_camera_filter",
];

function featureGatesJSON(raw) {
  var obj = {};
  try { obj = JSON.parse(raw || "{}"); if (!obj || typeof obj !== "object") obj = {}; } catch (e) { obj = {}; }
  var i;
  for (i = 0; i < KNOWN_PREMIUM_GATES.length; i++) obj[KNOWN_PREMIUM_GATES[i]] = "enabled";
  for (i = 0; i < KNOWN_OFF_GATES.length; i++) obj[KNOWN_OFF_GATES[i]] = "disabled";
  return JSON.stringify(obj);
}

/* ── Legacy: phòng khi app đổi sang format { parameters / parameterGroups } ── */
var FORCE_ON_LEGACY = /(gold|premium|vip|subscription|ads[-_]?free|no[-_]?ads|unlimited|infinite|caption|widget|streak|badge|views?|friends|album|hd_photo|premium_icon|camera_theme)/i;
function forceLegacyParam(p) {
  if (!p || typeof p !== "object") return;
  var raw = "";
  try { raw = (p.defaultValue && typeof p.defaultValue.value === "string") ? p.defaultValue.value : ""; } catch (e) { /* bỏ qua */ }
  if (/^-?\d+(\.\d+)?$/.test(raw)) { p.defaultValue = { value: "999999" }; return; }
  p.defaultValue = { value: "true" };
}

function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

function injectEntries(body) {
  var obj;
  try {
    obj = JSON.parse(body);
    if (!obj || typeof obj !== "object") { console.log("[locketgold] remote: body NOT JSON object → passthrough"); return null; }
  } catch (e) {
    console.log("[locketgold] remote: body NOT JSON → passthrough");
    return null;
  }

  var touched = false;

  /* Format chuẩn: {"entries": {...}, "state": ...} */
  if (!obj.entries || typeof obj.entries !== "object") obj.entries = {};
  var forcedCount = 0;
  for (var key in FORCE_ENTRIES) {
    if (!hasOwn(FORCE_ENTRIES, key)) continue;
    obj.entries[key] = FORCE_ENTRIES[key];
    forcedCount++;
    touched = true;
  }
  obj.entries["feature_gates"] = featureGatesJSON(obj.entries["feature_gates"]);
  obj.entries["upsell_features"] = FORCE_ENTRIES["upsell_features"];

  /* Popup branding hiện MỖI LẦN mở app — app coi campaign là "mới" → popup không bị dismiss.
     (Locket lưu danh sách campaign đã xem vào local storage; suffix random => popup luôn mới.) */
  try {
    var _pf = obj.entries["feature_discovery_popup_config"];
    if (typeof _pf === "string" && _pf.length > 10) {
      var _pObj = JSON.parse(_pf);
      if (_pObj && typeof _pObj === "object") {
        _pObj.campaign = "b1steam_gold_" + Date.now();
        obj.entries["feature_discovery_popup_config"] = JSON.stringify(_pObj);
      }
    }
  } catch (e) { /* giữ nguyên popup nếu parse lỗi */ }

  console.log("[locketgold] remote: entries=" + Object.keys(obj.entries).length + " (forced " + forcedCount + ") | state=" + (obj.state || "?"));

  /* Format legacy dự phòng */
  if (obj.parameters && typeof obj.parameters === "object") {
    for (var p in obj.parameters) {
      if (!hasOwn(obj.parameters, p)) continue;
      if (FORCE_ON_LEGACY.test(p)) forceLegacyParam(obj.parameters[p]);
    }
  }
  if (obj.parameterGroups && typeof obj.parameterGroups === "object") {
    for (var g in obj.parameterGroups) {
      if (!hasOwn(obj.parameterGroups, g)) continue;
      var group = obj.parameterGroups[g];
      var params = group && typeof group === "object" ? group.parameters : null;
      if (!params || typeof params !== "object") continue;
      for (var p2 in params) {
        if (!hasOwn(params, p2)) continue;
        if (FORCE_ON_LEGACY.test(p2)) forceLegacyParam(params[p2]);
      }
    }
  }

  if (!touched) return null;
  return JSON.stringify(obj);
}

function unlock() {
  var out = injectEntries(rawBody);
  $done({
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: (out === null) ? rawBody : out,
  });
}
function deny() { $done({ body: rawBody }); }

gate(
  function () { console.log("[locketgold] remote: UNLOCK"); return unlock(); },
  function () { console.log("[locketgold] remote: DENY (license invalid)"); return deny(); },
  "remote"
);
