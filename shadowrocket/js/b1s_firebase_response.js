// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_firebase_response.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Firebase Remote Config RESPONSE phase.
 *
 * MỤC TIÊU:
 *   Bơm cờ Remote Config của Locket để bật toàn bộ tính năng Gold:
 *     · Gold / VIP (is_gold, is_premium, is_subscriber, locket_gold_enabled…)
 *     · Khung VIP (camera_frame_enabled, photo_frame_enabled, frames_enabled…)
 *     · Caption VIP (captions_enabled, overlay_dynamic_captions…)
 *     · Widget Gold (widget_frame_event, widget_badge_enabled…)
 *     · Streak recovery (streak_config, streak_recovery)
 *     · Tắt quảng cáo + telemetry (remove_ads, history_ads_*, sentry_*)
 *   + Gộp catalog khung B1sTeam (danh sách id + URL worker xoay vòng).
 *
 * CẤU TRÚC:
 *   Firebase RC v1 trả { entries: { "flag": "value" } } — value LUÔN là chuỗi.
 *   Script hỗ trợ thêm format cũ { parameters / parameterGroups } để tương thích.
 *
 * AN TOÀN:
 *   · Body không phải JSON ⇒ trả nguyên body (app tự lấy config thật).
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ body gốc đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  /* ═══════════ Worker phục vụ khung (xoay vòng 6 node Cloudflare) ═══════════ */
  var FRAME_WORKERS = [
    "https://b1steam-frames-1.nhb-120111.workers.dev",
    "https://b1steam-frames-2.nhb-120111.workers.dev",
    "https://b1steam-frames-3.nhb-120111.workers.dev",
    "https://b1steam-frames-4.nhb-120111.workers.dev",
    "https://b1steam-frames-5.nhb-120111.workers.dev",
    "https://b1steam-frames-6.nhb-120111.workers.dev"
  ];

  /* ═══════════ Catalog khung B1sTeam (đồng bộ assets/frames/catalog.json) ═══════════ */
  var FRAME_CATALOG = [
    { id: "frame-08-valentine", name: "Valentine", group: "seasonal", file: "frame-08-valentine.png", tags: ["valentine", "love", "heart"], premium: true },
    { id: "frame-09-christmas", name: "Christmas", group: "seasonal", file: "frame-09-christmas.png", tags: ["christmas", "xmas", "snow"], premium: true },
    { id: "frame-10-halloween", name: "Halloween", group: "seasonal", file: "frame-10-halloween.png", tags: ["halloween", "spooky", "pumpkin"], premium: true },
    { id: "frame-11-neon", name: "Neon", group: "gold", file: "frame-11-neon.png", tags: ["neon", "cyberpunk", "glow"], premium: true },
    { id: "frame-12-gold", name: "Gold", group: "gold", file: "frame-12-gold.png", tags: ["gold", "premium", "classic"], premium: true },
    { id: "frame-13-pastel", name: "Pastel", group: "kawaii", file: "frame-13-pastel.png", tags: ["pastel", "kawaii", "soft"], premium: true },
    { id: "frame-14-crayon", name: "Crayon", group: "kawaii", file: "frame-14-crayon.png", tags: ["crayon", "doodle", "kids"], premium: true },
    { id: "frame_citopia_y2k", name: "Citopia Y2K", group: "retro", file: "frame_citopia_y2k.png", tags: ["y2k", "retro", "2000s"], premium: true },
    { id: "frame_kitty_shinchan", name: "Kitty Shinchan", group: "kawaii", file: "frame_kitty_shinchan.png", tags: ["kitty", "shinchan", "anime"], premium: true },
    { id: "frame_lowg_l2k", name: "LowG L2K", group: "retro", file: "frame_lowg_l2k.png", tags: ["l2k", "retro", "street"], premium: true },
    { id: "frame_royal_gold", name: "Royal Gold", group: "gold", file: "frame_royal_gold.png", tags: ["gold", "royal", "luxury"], premium: true },
    { id: "photobooth_4cut", name: "Photobooth 4 Cut", group: "photobooth", file: "photobooth_4cut.png", tags: ["photobooth", "4cut", "sticker"], premium: true },
    { id: "photobooth_cute", name: "Photobooth Cute", group: "photobooth", file: "photobooth_cute.png", tags: ["photobooth", "cute", "sticker"], premium: true },
    { id: "cmt_locket", name: "Locket Comment", group: "widget", file: "cmt_locket.png", tags: ["widget", "comment", "banner"], premium: false }
  ];

  /* ═══════════ Feature gate premium — bật "enabled" ═══════════ */
  var PREMIUM_GATES = [
    "app_icon_picker", "camera_roll", "camera_theme", "locket_views", "long_captions",
    "longer_video", "unlimited_friends", "priority_support", "profile_badge",
    "remove_ads", "video", "custom_widget_frames", "streak_recovery",
    "camera_filter", "camera_filters", "filters", "camera_filter_sheet",
    "camera_filters_sheet", "camera_filter_picker", "camera_theme_sheet",
    "camera_themes_sheet", "camera_theme_picker", "camera_themes_config",
    "camera_color", "camera_colors", "widget_frames", "widget_frame", "app_icons",
    "moment_views", "groups", "rollcall", "time_travel_rewind",
    "conversation_drafts", "chat_hyperlinks", "unsend_message", "celebrity_inbox",
    "user_data_export"
  ];

  /* ═══════════ Cờ RC của Locket (đúng tên flag thật) ═══════════ */
  var FORCE_ENTRIES = {
    /* ── Gold / VIP ── */
    "is_gold": "true",
    "is_premium": "true",
    "is_subscriber": "true",
    "is_subscribed": "true",
    "subscribed": "true",
    "gold_enabled": "true",
    "premium_enabled": "true",
    "has_gold": "true",
    "has_premium": "true",
    "has_access": "true",
    "locket_gold_enabled": "true",
    "gold_badge_profile_menu": "true",
    "gold_since_badge": "true",
    "profile_badge_visible": "true",
    "beta_features_enabled": "true",
    "all_filters_free": "true",
    "can_use_ai_filter": "true",
    "can_generate_filtered_image": "true",

    /* ── Khung VIP (camera / photo / widget) ── */
    "camera_frame_enabled": "true",
    "photo_frame_enabled": "true",
    "frames_enabled": "true",
    "camera_frames": "enabled",
    "photo_frames": "enabled",
    "frames": "enabled",
    "camera_frame_overlay_enabled": "true",
    "photo_frame_overlay_enabled": "true",
    "custom_widget_frames_enabled": "true",
    "widget_frames_enabled": "true",
    "widget_frame_enabled": "true",
    "app_icon_picker_enabled": "true",
    "app_icons_enabled": "true",

    /* ── Caption VIP ── */
    "captions_enabled": "true",
    "overlay_navigator_enabled": "true",
    "overlays_v2_config": "{\"suggestions_enabled\":true}",
    "link_caption_link_enabled": "true",
    "music_caption_enabled": "true",
    "music_caption_song_preview_enabled": "true",
    "overlay_dynamic_captions": "[\"standard\",\"poll\",\"color_palette\",\"review\",\"music\",\"location\",\"weather\",\"time\",\"streak\",\"star_sign\",\"party_time\",\"locket_count\",\"good_morning\",\"goodnight\",\"ootd\",\"miss_you\",\"custom\",\"halloween_2026\",\"quote\",\"breaking_news\"]",

    /* ── Widget Gold ── */
    "widget_frame_event_max_images": "5",
    "widget_badge_enabled": "true",
    "widget_badge_v2": "true",
    "widget_stale_state_enabled": "false",
    "widget_last_sent_indicator": "false",
    "android_widget_frame_event_enabled": "true",

    /* ── Streak recovery ── */
    "streak_recovery": "enabled",
    "streak_visualization": "true",
    "streak_visualization_style": "gradient",
    "streak_config": "{\"minimum_recovery_count\":0,\"minimum_display_count\":0,\"streak_visualization\":true,\"streak_visualization_style\":\"gradient\",\"streak_header_minimum_count\":0,\"streak_visualization_minimum_count\":2}",

    /* ── Tắt quảng cáo + telemetry ── */
    "remove_ads": "enabled",
    "history_ads_mode": "off",
    "history_ads_prefetch_count": "0",
    "history_ads_prefetch_immediate": "false",
    "history_ads_prefetch_reroute": "false",
    "history_ads_dynamic_insertion": "false",
    "history_ads_refresh_prefetch_on_foreground": "false",
    "history_ads_floor_price": "0",
    "history_ads_floor_price_att": "0",
    "history_ad_log_displayed_on_background": "false",
    "history_ads_debug_menu": "false",
    "sentry_sample_rate": "0",
    "sentry_network_tracing": "false",
    "sentry_performance_tracking": "false",
    "sentry_trace_sample_rate": "0",
    "sentry_profiles_sample_rate": "0",

    /* ── Tắt paywall ── */
    "paywall_presentation_config": "{\"uid\":\"paywall_disabled\",\"onboarding\":false,\"after_sent_moment\":false,\"on_foreground\":false,\"interval\":999999999,\"profile_banner\":false}",
    "upsell_features": "{\"app_icon_picker\":false,\"camera_roll\":false,\"camera_theme\":false,\"locket_views\":false,\"remove_ads\":false,\"custom_widget_frames\":false,\"long_captions\":false,\"longer_video\":false,\"unlimited_friends\":false,\"priority_support\":false,\"profile_badge\":false,\"streak_recovery\":false,\"video\":false}",

    /* ── Camera premium ── */
    "camera_video_recording": "{\"default\":{\"maximum_duration\":60000,\"size\":1080,\"file_type\":\"mp4\",\"video_codec\":\"h265\"},\"gold\":{\"maximum_duration\":60000,\"size\":1080,\"file_type\":\"mp4\",\"video_codec\":\"h265\"}}",
    "camera_roll_video_enabled": "true",
    "camera_roll_video_upload_enabled": "true",
    "longer_camera_roll_videos_enabled": "true",
    "camera_roll_video_max_duration": "60.0",
    "camera_roll_max_duration": "60.0",
    "max_video_duration": "60.0",
    "video_max_duration": "60.0",
    "gold_max_duration": "60.0",
    "video_quality_mbps": "2.5",
    "zoom_enabled": "true",
    "flash_button": "true",
    "telephoto": "true"
  };

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  function b1sLog(msg) {
    try { console.log("[locketgold] fb-response: " + msg); } catch (e) { /* ignore */ }
  }

  function b1sGet(key) {
    try {
      if (typeof $persistentStore !== "undefined" && $persistentStore) {
        var v = $persistentStore.read(key);
        if (v !== undefined && v !== null && v !== "") return String(v);
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof $prefs !== "undefined" && $prefs) {
        var v2 = $prefs.valueForKey(key);
        if (v2 !== undefined && v2 !== null && v2 !== "") return String(v2);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /** Hash 32-bit (FNV-1a) — chọn worker ổn định theo id khung. */
  function b1sHash32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  /** URL ảnh khung qua worker B1sTeam — chọn node theo hash(id) ⇒ ổn định. */
  function frameUrl(id) {
    var idx = parseInt(b1sHash32(String(id)).slice(0, 4), 16) % FRAME_WORKERS.length;
    return FRAME_WORKERS[idx] + "/f/" + encodeURIComponent(String(id));
  }

  /** Đọc catalog từ store (do backend đẩy vào) — thiếu thì dùng catalog nhúng. */
  function loadCatalog() {
    var raw = b1sGet("b1s_frame_catalog");
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (e) { /* ignore */ }
    }
    return FRAME_CATALOG;
  }

  /** Bật toàn bộ gate premium trong entries.feature_gates (JSON string). */
  function buildFeatureGates(raw) {
    var obj = {};
    try {
      obj = JSON.parse(raw || "{}");
      if (!isObject(obj)) obj = {};
    } catch (e) { obj = {}; }
    for (var i = 0; i < PREMIUM_GATES.length; i++) obj[PREMIUM_GATES[i]] = "enabled";
    return JSON.stringify(obj);
  }

  /** Ép mọi key "premium/gold" của format cũ về true. */
  var LEGACY_ON = /(gold|premium|vip|subscription|ads[-_]?free|no[-_]?ads|unlimited|infinite|caption|widget|streak|badge|views?|friends|album|hd_photo|premium_icon|camera_theme)/i;
  function forceLegacyParam(p) {
    if (!isObject(p)) return;
    var raw = "";
    try { raw = (p.defaultValue && typeof p.defaultValue.value === "string") ? p.defaultValue.value : ""; } catch (e) { /* ignore */ }
    if (/^-?\d+(\.\d+)?$/.test(raw)) { p.defaultValue = { value: "999999" }; return; }
    p.defaultValue = { value: "true" };
  }

  try {
    if (typeof $done !== "function") return;

    var rawBody = (typeof $response !== "undefined" && $response && typeof $response.body === "string")
      ? $response.body : "";
    if (!rawBody) { $done({}); return; }

    var obj = null;
    try { obj = JSON.parse(rawBody); } catch (e) { obj = null; }
    if (!isObject(obj)) { b1sLog("body không phải JSON → passthrough"); $done({}); return; }

    /* 1) Ép app coi config là "mới" (bỏ qua nếu templateVersion không đổi) */
    try {
      obj.state = "UPDATE";
      obj.templateVersion = String(Date.now());
    } catch (e) { /* ignore */ }

    /* 2) Format chuẩn: { entries: { flag: "value" } } */
    if (!isObject(obj.entries)) obj.entries = {};
    var entries = obj.entries;

    entries["cache_ttl_seconds"] = "0";
    entries["client_cache_ttl_sec"] = "0";

    var forced = 0;
    for (var key in FORCE_ENTRIES) {
      if (!hasOwn(FORCE_ENTRIES, key)) continue;
      entries[key] = FORCE_ENTRIES[key];
      forced++;
    }

    entries["feature_gates"] = buildFeatureGates(entries["feature_gates"]);
    entries["upsell_features"] = FORCE_ENTRIES["upsell_features"];

    /* 3) Gộp catalog khung B1sTeam */
    var catalog = loadCatalog();
    var frames = [];
    for (var i = 0; i < catalog.length; i++) {
      var f = catalog[i] || {};
      if (!f.id) continue;
      frames.push({ id: f.id, name: f.name || f.id, group: f.group || "b1s", url: frameUrl(f.id), premium: f.premium !== false });
    }

    entries["b1s_frame_catalog"] = JSON.stringify(catalog);
    entries["b1s_frame_urls"] = JSON.stringify(frames);
    entries["camera_frame_config"] = JSON.stringify({
      enabled: true,
      default: "frame-12-gold",
      placement: "above",
      frames: frames
    });
    entries["photo_frame_event"] = JSON.stringify({
      uid: "b1steam_frame_event",
      url: frameUrl("frame-14-crayon"),
      placement: "above",
      use_local_time_zone: true,
      start_at: "2020-01-01T00:00:00",
      end_at: "2099-12-31T23:59:59"
    });
    entries["widget_frame_event"] = entries["photo_frame_event"];
    entries["custom_widget_frames_config"] = JSON.stringify(frames.map(function (x) { return x.id; }));
    entries["widget_frames_config"] = JSON.stringify(frames.map(function (x) { return x.id; }));

    /* 4) Popup branding B1sTeam — campaign đổi mỗi lần fetch ⇒ popup luôn hiện */
    try {
      var pf = entries["feature_discovery_popup_config"];
      if (typeof pf === "string" && pf.length > 10) {
        var pObj = JSON.parse(pf);
        if (isObject(pObj)) {
          pObj.campaign = "b1steam_gold_" + Date.now();
          entries["feature_discovery_popup_config"] = JSON.stringify(pObj);
        }
      } else {
        entries["feature_discovery_popup_config"] = JSON.stringify({
          tag: "LOCKET GOLD",
          tag_gradient: true,
          tag_style: "gold_gradient",
          title: "B1sTeam Gold 💛",
          feature_set: [{
            title: "Locket Gold - B1sTeam",
            body: "Chúc mừng! Bạn đã nâng cấp Locket Gold thành công bởi B1sTeam — Nguyễn Hoàng Bách · b1s.id.vn · @b1steam.",
            imageURL: "https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/welcome_banner_wide.jpg"
          }],
          primary_button_title: "Xong",
          campaign: "b1steam_gold_welcome_v4",
          start_at: "2020-01-01T00:00:00",
          end_at: "2099-12-31T23:59:59",
          use_local_time_zone: true
        });
      }
    } catch (e) { /* giữ nguyên popup nếu parse lỗi */ }

    /* 5) Format cũ (parameters / parameterGroups) — tương thích dự phòng */
    try {
      if (isObject(obj.parameters)) {
        for (var p in obj.parameters) {
          if (!hasOwn(obj.parameters, p)) continue;
          if (LEGACY_ON.test(p)) forceLegacyParam(obj.parameters[p]);
        }
      }
      if (isObject(obj.parameterGroups)) {
        for (var g in obj.parameterGroups) {
          if (!hasOwn(obj.parameterGroups, g)) continue;
          var group = obj.parameterGroups[g];
          var params = (group && isObject(group)) ? group.parameters : null;
          if (!isObject(params)) continue;
          for (var p2 in params) {
            if (!hasOwn(params, p2)) continue;
            if (LEGACY_ON.test(p2)) forceLegacyParam(params[p2]);
          }
        }
      }
    } catch (e) { /* ignore */ }

    b1sLog("entries=" + Object.keys(entries).length + " (ép " + forced + ") · khung=" + frames.length);

    $done({
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(obj)
    });
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
