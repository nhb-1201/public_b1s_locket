// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Firebase Remote Config Unlock (DEVICE-LOCKED) v6.0
 *
 * MỞ KHÓA TOÀN BỘ TÍNH NĂNG PREMIUM CỦA LOCKET — entries là format THẬT của app:
 *   · Firebase v1 fetch trả về { entries: { flag: "value", ... } } (flat, string).
 *   · FORCE_ENTRIES map ĐÚNG tên flag thật của Locket (camera, camera_roll, feature_gates,
 *     moment_*, rollcall_*, groups, journal, widgets, uploads, friends, cache/CDN…).
 *   · feature_gates là JSON string → parse, bật "enabled" cho toàn bộ gate premium, giữ key lạ.
 *   · Entry thương hiệu bên ngoài (URL mạng xã hội…) — giữ giá trị máy chủ; riêng popup chào mừng
 *     là bản B1sTeam (credit B1sDev · Nguyễn Hoàng Bách), campaign random MỖI LẦN fetch để popup luôn hiện.
 *
 * ⚠ BẢN SỬA 2026-11-14 (sau log PacketTunnel 10:39):
 *   Log cho thấy request RC của app bị "TLSV1_ALERT_PROTOCOL_VERSION" / treo → app KHÔNG nhận
 *   được Remote Config ⇒ toàn bộ cờ mở khoá không được áp dụng (app chạy như bản thường).
 *   Nay script chuyển sang REQUEST-PHASE SYNTHESIS: tự gọi API RC gốc qua $httpClient
 *   (ngoài đường MITM nên không dính lỗi TLS của MITM), gộp cờ B1sTeam, rồi TRẢ THẲNG cho app.
 *   · Cache trên máy 6 giờ ⇒ app mở nhanh, không gọi mạng liên tục.
 *   · Nếu gọi Google lỗi → dùng cache cũ; không có cache → trả bộ cờ B1sTeam tối thiểu.
 *   · License sai → pass-through (app tự lấy RC thật từ Google, không đứt app).
 *   · Vẫn giữ chế độ RESPONSE (đăng ký thêm ở .conf) làm lưới an toàn khi request-phase không chạy.
 *
 * License gate fail-closed (lib/license-gate.js) — key sai / sai máy / hết grace → không ép cờ.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js

/* Cache RC hợp nhất trên máy — 6 giờ (app mở nhanh, không gọi Google liên tục) */
var RC_TTL_MS = 21600000;
var RC_CACHE_KEY = "b1s_rc_payload";
var RC_CACHE_AT = "b1s_rc_cache_at";

// @b1s-include ./lib/license-gate.js

/* ══════════════════════════════════════
   BẢNG FLAG THẬT CỦA LOCKET (entries — string values)
   Nguồn: phân tích response Remote Config của app Locket.
   Giá trị KHÔNG đổi: URL ngoài / branding bên thứ 3 (app tự giữ mặc định server).
   ══════════════════════════════════════ */
// @b1s-include ./_remote_entries.fragment.js
/* Accessor an toàn: $request/$response có thể KHÔNG tồn tại (chạy script thủ công trong
   trình soạn thảo của Shadowrocket, hoặc engine không cấp) — dùng $request trực tiếp sẽ ném
   ReferenceError làm script chết im lặng. */
var _req = (typeof $request !== "undefined" && $request) ? $request : {};
var _resp = (typeof $response !== "undefined" && $response) ? $response : {};

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
var KNOWN_OFF_GATES = [];

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

  /* ÉP app coi cấu hình là "mới" — Locket bỏ qua/không áp dụng config khi templateVersion
     không đổi và cache TTL vẫn còn (chỉ hoạt động khi app tự fetch). Đây là cơ chế chuẩn
     của Firebase Remote Config v1: state + templateVersion + cache_ttl. */
  try {
    obj.state = "UPDATE";
    obj.templateVersion = String(Date.now());
  } catch (e) { /* bỏ qua */ }

  /* Format chuẩn: {"entries": {...}, "state": ...} */
  if (!obj.entries || typeof obj.entries !== "object") obj.entries = {};
  var forcedCount = 0;
  obj.entries["cache_ttl_seconds"] = "0";
  obj.entries["client_cache_ttl_sec"] = "0";
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

/* ═══════════════════════════════════════════════════════════════
   CHẾ ĐỘ: REQUEST (synthesis) — RESPONSE (lưới an toàn)
   ═══════════════════════════════════════════════════════════════ */
function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

function isResponseMode() {
  return (typeof $response !== "undefined" && $response && $response.body !== undefined);
}

/** Bóc body từ callback của $httpClient (string / object / response.body). */
function extractBody(data, response) {
  if (typeof data === "string" && data) return data;
  if (data && typeof data === "object") {
    try {
      if (typeof data.body === "string" && data.body) return data.body;
    } catch (e) { /* ignore */ }
    try { return JSON.stringify(data); } catch (e) { /* ignore */ }
  }
  try {
    if (response && typeof response.body === "string" && response.body) return response.body;
  } catch (e) { /* ignore */ }
  return null;
}

/** Bỏ campaign cũ để popup B1sTeam luôn hiện (app coi campaign mới = chưa xem). */
function restampCampaign(jsonStr) {
  try {
    var o = JSON.parse(jsonStr);
    var pf = o && o.entries && o.entries["feature_discovery_popup_config"];
    if (typeof pf === "string" && pf.length > 10) {
      var p = JSON.parse(pf);
      if (p && typeof p === "object") {
        p.campaign = "b1steam_gold_" + Date.now();
        o.entries["feature_discovery_popup_config"] = JSON.stringify(p);
        return JSON.stringify(o);
      }
    }
  } catch (e) { /* giữ nguyên */ }
  return jsonStr;
}

/** Bộ cờ tối thiểu khi không lấy được RC gốc (offline / Google lỗi). */
function baselineBody() {
  var merged = injectEntries(JSON.stringify({ entries: {} }));
  return merged || JSON.stringify({ entries: {} });
}

function serveLocal(bodyStr) {
  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-B1s-Remote": "synth",
      },
      body: bodyStr,
    },
  });
}

/** Gọi API RC gốc (ngoài MITM) để lấy config thật rồi gộp cờ B1sTeam. */
function fetchUpstream(onDone) {
  if (typeof $httpClient === "undefined" || !$httpClient) return onDone(null);
  var headers = {};
  try {
    var h = _req.headers ? $request.headers : {};
    for (var k in h) {
      if (!hasOwn(h, k)) continue;
      var lk = String(k).toLowerCase();
      if (lk === "host" || lk === "connection" || lk === "content-length" ||
          lk === "accept-encoding" || lk === "proxy-connection" || lk === "te") continue;
      headers[k] = h[k];
    }
  } catch (e) { /* dùng header rỗng */ }
  var url = "";
  var method = "GET";
  var body = null;
  try {
    url = String($request.url || "");
    method = String($request.method || "GET").toUpperCase();
    if ($request.body !== undefined && $request.body !== null) body = String($request.body);
  } catch (e) { /* ignore */ }
  if (!url) return onDone(null);

  var cb = function (err, response, data) {
    if (err) return onDone(null);
    var raw = extractBody(data, response);
    if (!raw) return onDone(null);
    onDone(raw);
  };

  try {
    if (method === "POST" && typeof $httpClient.post === "function") {
      $httpClient.post({ url: url, headers: headers, body: body || "", timeout: 12 }, cb);
    } else {
      $httpClient.get({ url: url, headers: headers, timeout: 12 }, cb);
    }
  } catch (e) {
    try { onDone(null); } catch (e2) { /* ignore */ }
  }
}

function serveRequestPhase() {
  var cached = b1sStoreGet(RC_CACHE_KEY);
  var at = Number(b1sStoreGet(RC_CACHE_AT) || 0);
  var fresh = cached && at > 0 && (Date.now() - at) < RC_TTL_MS;

  if (fresh) {
    console.log("[locketgold] remote: synthesis từ cache (" + Math.round((Date.now() - at) / 60000) + "p)");
    return serveLocal(restampCampaign(cached));
  }

  fetchUpstream(function (raw) {
    if (raw) {
      var merged = injectEntries(raw);
      var out = merged === null ? raw : merged;
      out = restampCampaign(out);
      b1sStoreSet(RC_CACHE_KEY, out);
      b1sStoreSet(RC_CACHE_AT, String(Date.now()));
      console.log("[locketgold] remote: synthesis từ RC gốc (đã lưu cache 6h)");
      return serveLocal(out);
    }
    if (cached) {
      console.log("[locketgold] remote: RC gốc lỗi → dùng cache cũ");
      return serveLocal(restampCampaign(cached));
    }
    console.log("[locketgold] remote: RC gốc lỗi & không cache → trả bộ cờ B1sTeam tối thiểu");
    return serveLocal(restampCampaign(baselineBody()));
  });
}

function serveResponsePhase() {
  var rawBody = (typeof $response !== "undefined" && $response && typeof $response.body === "string") ? $response.body : "";
  var out = injectEntries(rawBody);
  $done({
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: (out === null) ? rawBody : out,
  });
}

gate(
  function () {
    if (isResponseMode()) {
      console.log("[locketgold] remote: UNLOCK (response mode)");
      return serveResponsePhase();
    }
    console.log("[locketgold] remote: UNLOCK (request synthesis)");
    return serveRequestPhase();
  },
  function () {
    if (isResponseMode()) {
      console.log("[locketgold] remote: DENY (license invalid) — giữ body gốc");
      var raw = (typeof $response !== "undefined" && $response && typeof $response.body === "string") ? $response.body : "";
      return $done({ body: raw });
    }
    console.log("[locketgold] remote: DENY (license invalid) — pass-through");
    return $done({}); // app tự lấy RC thật từ Google
  },
  "remote"
);
