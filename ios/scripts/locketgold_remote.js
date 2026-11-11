// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — Firebase Remote Config Unlock (DEVICE-LOCKED) v4.0
 *
 * MỞ KHÓA TOÀN BỘ TÍNH NĂNG PREMIUM CỦA LOCKET — danh sách flag thật:
 *   · Firebase v1 fetch trả về { entries: { flag: "value", ... } } (flat, string) — v3 trở về
 *     trước script này tưởng nhầm là { parameters / parameterGroups } nên không hề đổi được flag.
 *   · Bảng FORCE_ENTRIES dưới đây map ĐÚNG tên flag thật của Locket (camera, camera_roll,
 *     camera_video_recording, camera_filter_config, feature_gates, moment_*, rollcall_*, groups,
 *     journal, widgets, uploads, friends, cache/CDN…) — KHÔNG đoán tên nữa.
 *   · feature_gates là JSON string → parse, bật "enabled" cho toàn bộ gate premium, giữ key lạ.
 *   · Entry thương hiệu bên ngoài (URL mạng xã hội, overlay của bên thứ 3) KHÔNG bơm —
 *     giữ nguyên giá trị máy chủ. Riêng popup chào mừng là bản B1sTeam (credit B1sDev · Nguyễn Hoàng Bách).
 *
 * CHỈ CHẠY KHI license hợp lệ trên đúng thiết bị (xem locketgold_revenuecat.js):
 *   key sai / máy khác / cache hết hạn → trả body gốc, không bơm flag nào.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

var rawBody = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";

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
  // Fallback in-memory khi store lỗi — KHÔNG deny cứng
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
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

/* ════════════════════════════════════════════════════════════
   BẢNG FLAG THẬT CỦA LOCKET (entries — string values)
   Nguồn: phân tích response Remote Config của app Locket.
   Giá trị KHÔNG đổi: URL ngoài / branding bên thứ 3 (app tự giữ mặc định server).
   ════════════════════════════════════════════════════════════ */
var FORCE_ENTRIES = {
  /* ── Badge & beta ── */
  "profile_badge_visible": "true",
  "beta_features_enabled": "true",

  /* ── Captions ── */
  "captions_enabled": "true",
  "overlay_dynamic_captions": "[\"standard\",\"poll\",\"color_palette\",\"review\",\"music\",\"location\",\"weather\",\"time\",\"streak\",\"star_sign\",\"party_time\",\"locket_count\",\"good_morning\",\"goodnight\",\"ootd\",\"miss_you\",\"custom\",\"halloween_2026\"]",
  "overlay_navigator_enabled": "true",
  "overlays_v2_config": "{\"suggestions_enabled\":true}",
  "link_caption_link_enabled": "true",
  "music_caption_enabled": "true",
  "music_caption_song_preview_enabled": "true",
  "unsend_message_enabled": "true",
  "lunar_new_year_app_icon_enabled": "true",
  "year_of_the_horse_icon_enabled": "true",

  /* ── Paywall: tắt hẳn (đã premium) ── */
  "paywall_presentation_config": "{\"uid\":\"paywall_disabled\",\"onboarding\":false,\"after_sent_moment\":false,\"on_foreground\":false,\"interval\":999999999,\"profile_banner\":false}",
  "feature_discovery_popup_config": "{\"tag\":\"LOCKET GOLD\",\"tag_gradient\":true,\"tag_style\":\"gold_gradient\",\"title\":\"B1sTeam đã nâng Locket Gold\",\"feature_set\":[{\"title\":\"Locket Gold — Bản nâng cấp B1sTeam\",\"body\":\"Kích hoạt thành công bởi B1sDev · Nguyễn Hoàng Bách · b1s.id.vn · @b1steam\",\"imageURL\":\"https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/welcome_banner_wide.jpg\"}],\"primary_button_title\":\"Xong\",\"campaign\":\"b1steam_gold_welcome_v1\",\"start_at\":\"2020-01-01T00:00:00\",\"end_at\":\"3000-12-31T23:59:59\",\"use_local_time_zone\":true}",
  "upsell_features": "{\"app_icon_picker\":true,\"camera_roll\":true,\"camera_theme\":true,\"locket_views\":true,\"remove_ads\":true,\"custom_widget_frames\":true}",

  /* ── Ads & telemetry: TẮT ── */
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

  /* ── Camera: premium ── */
  "camera": "{\"gold_max_duration\":30,\"goldMaxDuration\":30,\"max_duration\":30,\"maxDuration\":30,\"ultra_wide\":true,\"ultraWide\":true,\"volume_button\":true,\"volumeButton\":true,\"flash_button\":true,\"telephoto\":true,\"srgb\":true,\"lanczos\":true,\"quality_mbps\":0.9,\"qualityMbps\":0.9}",
  "camera_roll": "{\"gold_max_duration\":30,\"goldMaxDuration\":30,\"video_max_duration\":30,\"videoMaxDuration\":30,\"max_duration\":30,\"maxDuration\":30,\"trim_max_duration\":30,\"trimMaxDuration\":30,\"camera_roll_max_duration\":30,\"quality_mbps\":0.9,\"qualityMbps\":0.9,\"flash_button\":true}",
  "live_photos": "{\"capture\":true,\"viewing\":true,\"catch_up\":true,\"widget_looping_mode\":\"never\"}",
  "camera_filter_config": "{\"allows_custom_filters\":true,\"show_filter_button\":true,\"sheet_enabled\":true,\"open_sheet_immediately\":true,\"sheet_filters\":[{\"title\":{\"en\":\"Goofy\"},\"filter_ids\":[\"okay_wig\",\"influencer\",\"looks_maxxing\",\"toothless\",\"bye_brows\"]},{\"title\":{\"en\":\"Looks\"},\"filter_ids\":[\"bowling_ball\",\"blonde_bleached\",\"beard\",\"bob_cut\",\"buns\",\"tatted\",\"mohawk\",\"braces\",\"bye_brows\"]},{\"title\":{\"en\":\"Celebrate\"},\"filter_ids\":[\"slimed\",\"princess\",\"disco_lights\",\"cash_money\",\"happy_birthday\"]},{\"title\":{\"en\":\"Cute\"},\"filter_ids\":[\"cutesy\",\"sticker_face\",\"flower_crown\",\"love_bug\"]},{\"title\":{\"en\":\"Costumes\"},\"filter_ids\":[\"wedding\",\"cowboy_cowgirl\",\"giraffe\",\"clown\"]},{\"title\":{\"en\":\"Holidays\"},\"filter_ids\":[\"easter_bunney_cutout\",\"easter_chick_cutout\",\"bearded\",\"leprechaun\",\"lucky_face\",\"sweet_hearts\",\"elf_cutout\",\"santa_cutout\",\"frosty\"]}],\"picker_filters\":[\"okay_wig\",\"influencer\",\"looks_maxxing\",\"toothless\",\"bye_brows\",\"bowling_ball\",\"blonde_bleached\",\"beard\",\"bob_cut\",\"buns\",\"tatted\",\"mohawk\",\"braces\",\"slimed\",\"princess\",\"disco_lights\",\"cash_money\",\"happy_birthday\",\"cutesy\",\"sticker_face\",\"flower_crown\",\"love_bug\",\"wedding\",\"cowboy_cowgirl\",\"giraffe\",\"clown\",\"easter_bunney_cutout\",\"easter_chick_cutout\",\"bearded\",\"leprechaun\",\"lucky_face\",\"sweet_hearts\",\"elf_cutout\",\"santa_cutout\",\"frosty\"]}",
  "camera_roll_preview_enabled": "true",
  "camera_video_recording": "{\"default\":{\"maximum_duration\":30000,\"size\":1080,\"file_type\":\"mp4\",\"video_codec\":\"h265\"},\"gold\":{\"maximum_duration\":60000,\"size\":1080,\"file_type\":\"mp4\",\"video_codec\":\"h265\"}}",
  "android_camera_video_recording": "{\"default\":{\"maximum_duration\":30000,\"size\":1080,\"file_type\":\"mp4\",\"video_codec\":\"h265\"},\"gold\":{\"maximum_duration\":60000,\"size\":1080,\"file_type\":\"mp4\",\"video_codec\":\"h265\"}}",
  "camera_roll_video_enabled": "true",
  "camera_roll_video_upload_enabled": "true",
  "internal_camera_roll_video_upload_enabled": "true",
  "longer_camera_roll_videos_enabled": "true",
  "camera_roll_video_max_duration": "60.0",
  "camera_roll_max_duration": "60.0",
  "camera_roll_duration": "60.0",
  "max_video_duration": "60.0",
  "video_max_duration": "60.0",
  "video_trim_max_duration": "60.0",
  "trim_max_duration": "60.0",
  "gold_max_duration": "60.0",
  "goldMaxDuration": "60.0",
  "photo_quality_balance": "quality",
  "android_photo_quality_balance": "quality",
  "video_quality_mbps": "2.5",
  "video_sound_enabled": "true",
  "microphone_enabled": "true",
  "camera_microphone_enabled": "true",
  "audio_session_deactivation_enabled": "true",
  "zoom_enabled": "true",

  /* ── Upload: chất lượng cao nhất ── */
  "upload_main": "true",
  "upload_main_image_quality": "1.0",
  "upload_main_image_size": "2560",
  "upload_thumbnail_image_quality": "1.0",
  "upload_thumbnail_image_size": "2048",
  "upload_use_webp_thumbnail": "true",
  "android_upload_use_webp_thumbnail": "true",

  /* ── Bạn bè: không giới hạn ── */
  "max_friends_count": "999999",
  "signup_max_friends_count": "999999",
  "celebrity_inbox_limit": "999999",
  "soft_friend_limit_threshold_count": "999999",
  "friend_limit_mode": "0",
  "friend_limit_geo_override": "{\"experiments\":{},\"area_code_overrides\":{}}",
  "friends_sheet_locket_count_config": "{\"items\":[{\"threshold\":0,\"icon_name\":\"heart\"},{\"threshold\":1,\"icon_name\":\"heart.fill\"},{\"threshold\":10,\"emoji\":\"🤍\"},{\"threshold\":100,\"emoji\":\"💛\"},{\"threshold\":500,\"emoji\":\"❤️‍🔥\"},{\"threshold\":1000,\"emoji\":\"🌟🫶🌟\"},{\"threshold\":2000,\"emoji\":\"✨💟✨\"},{\"threshold\":5000,\"emoji\":\"⚡️😵‍💫⚡\"},{\"threshold\":10000,\"emoji\":\"✨⚡️😱⚡✨\"}]}",
  "friend_locket_count_config": "{\"items\":[{\"threshold\":0,\"icon_name\":\"heart\"},{\"threshold\":1,\"icon_name\":\"heart.fill\"},{\"threshold\":10,\"emoji\":\"🤍\"},{\"threshold\":100,\"emoji\":\"💛\"},{\"threshold\":500,\"emoji\":\"❤️‍🔥\"},{\"threshold\":1000,\"emoji\":\"✨💗✨\"},{\"threshold\":2000,\"emoji\":\"✨️⭐️✨\"},{\"threshold\":5000,\"emoji\":\"✨💎✨\"},{\"threshold\":10000,\"emoji\":\"✨🔐💛✨\"}]}",
  "new_friends_monitoring_enabled": "true",
  "improved_friend_suggestions": "true",
  "show_friend_suggestions_by_default": "true",
  "emoji_friend_suggestions": "true",
  "prompt_contact_permissions_on_search": "true",
  "populate_phone_numbers_from_suggest_friends": "true",
  "hide_friends_enabled": "true",
  "hide_skip_contacts": "true",
  "show_all_contacts": "true",
  "show_invite_suggestions": "true",
  "signup_allow_skip_add_friends": "true",
  "show_friend_limit_on_cam": "false",
  "show_no_friends_bottom_sheet": "false",
  "hide_invite_links": "false",

  /* ── Streak / Recovery ── */
  "streak_config": "{\"minimum_recovery_count\":0,\"minimum_display_count\":0}",

  /* ── Moment views & reactions (Gold) ── */
  "moment_views_enabled": "true",
  "moment_views_v2": "true",
  "record_moment_views": "true",
  "notify_moment_views": "true",
  "get_moment_views_as_cloud_function": "true",
  "moment_reactions_v2": "true",
  "chat_reactions_enabled": "true",
  "conversation_reactions": "true",
  "typing_indicators_enabled": "true",
  "reply_prototype_enabled": "true",
  "messages_integration": "true",
  "conversations_enabled": "true",
  "fetch_moments_in_conversation": "true",
  "hide_chat_button": "false",
  "groups_enabled": "true",
  "send_to_self_only_mode": "always_enabled",
  "time_travel_rewind_v2_enabled": "true",
  "calendar_delete_moment_enabled": "true",
  "calendar_rewind_enabled": "false",
  "locket_yearbook_story_sharing_encouraged": "true",

  /* ── Rollcall (tag bạn bè trong ảnh) ── */
  "rollcall_enabled": "true",
  "rollcall_comment_actions": "true",
  "rollcall_profile_button": "true",
  "rollcall_prompt_export_after_share": "true",
  "rollcall_confirm_skip_tagging": "false",
  "rollcall_tap_to_tag_enabled": "false",

  /* ── Widget & Live Activity ── */
  "widget_frame_event": "{\"uid\":\"midautumn_2026\",\"url\":\"https://i.ibb.co/1Yt1Dzzy/Shin-chan-1.png\",\"use_local_time_zone\":true,\"placement\":\"below\",\"start_at\":\"2020-01-01T00:00:00\",\"end_at\":\"2099-12-31T23:59:59\"}",
  "widget_frame_event_max_images": "5",
  "android_widget_frame_event_enabled": "true",
  "widget_badge_enabled": "true",
  "widget_badge_v2": "true",
  "widget_stale_state_enabled": "false",
  "widget_last_sent_indicator": "false",
  "widget_sync_token_reload_mode": "clearTokenNever",
  "live_activity_onboarding": "true",
  "live_activity_onboarding_variant": "friending",
  "register_live_activity_push_to_start_token": "true",
  "live_activity_remove_stale_start_token": "true",
  "notification_preferences_live_activities": "true",
  "notification_preferences": "true",
  "notification_reply_body_visible": "true",
  "prompt_notification_permissions_after_friending": "true",

  /* ── Activity bar & journal ── */
  "activity_bar_enabled": "true",
  "journal_activity_bar_enabled": "true",
  "journal_settings": "{\"debug_menu_enabled\":false,\"focus_animation\":true,\"compact_header\":true,\"friends_button\":true,\"reverse_scroll_direction\":false,\"streak_visualization\":true,\"streak_visualization_style\":\"gradient\",\"streak_header_minimum_count\":0,\"streak_visualization_minimum_count\":2,\"overlay_indicators\":{\"location\":true,\"music\":true,\"static_content\":true,\"weather\":true}}",
  "qr_code_config": "{\"profile_enabled\":true,\"scanning_enabled\":true}",

  /* ── Ảnh đại diện & profile ── */
  "custom_profile_pics": "true",
  "profile_menu_v2_enabled": "true",

  /* ── CDN/cache. KHÔNG force cdn_domain_replacements / storage_bucket: v4.0 rewrite
     firebasestorage→cdn.locketcamera.com làm hỏng upload (ảnh & video). Server tự cấp. ── */
  "image_cache_max_age_sec": "157680000",
  "image_cache_max_size": "400000000",
  "history_cache_age_days": "1000",
  "user_cache_max_age_sec": "691200",
  "friends_cache_max_age_sec": "2592000",
  "image_fetch_cache": "true",
  "image_cache_use_shared": "true",
  "use_doc_dir_for_image_cache": "true",
  "efficient_history_cache_invalidation": "true",
  "timestamp_based_history_fetches": "true",
  "get_latest_moment_v2": "true",
  "fetch_users_from_cloud_function": "true",
  "refresh_interval": "60",
  "firestore_refresh_v2": "true",
  "firestore_refresh_v3": "true",
  "keychain_access_retries": "true",
  "blocked_users_cached_sync_enabled": "true",

  /* ── Cộng đồng & hỗ trợ ── */
  "join_testflight_enabled": "true",
  "safety_center": "true",
  "help_center": "true",
  "support_v2": "true",
  "privacy_choices_setting": "true",
  "request_att_permission": "true",
  "invite_link_preview_variant": "4",
  "share_history_config": "{\"prompt_enabled\":false,\"fetching_enabled\":true}",
  "share_history_prompt_enabled": "false",
  "use_thumbnails_for_sharing": "true",
  "use_thumbnails_in_timeline": "true",
  "persist_onboarding_step": "true",
  "onboarding_contact_permission_step": "true"
};

/* Các feature gate premium — Locket đọc JSON này từ entries.feature_gates */
var KNOWN_PREMIUM_GATES = [
  "app_icon_picker", "camera_roll", "camera_theme", "locket_views", "long_captions",
  "longer_video", "unlimited_friends", "priority_support", "profile_badge",
  "remove_ads", "video", "custom_widget_frames", "streak_recovery"
];

function featureGatesJSON(raw) {
  var obj = {};
  try { obj = JSON.parse(raw || "{}"); if (!obj || typeof obj !== "object") obj = {}; } catch (e) { obj = {}; }
  for (var i = 0; i < KNOWN_PREMIUM_GATES.length; i++) obj[KNOWN_PREMIUM_GATES[i]] = "enabled";
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
  console.log("[locketgold] remote: body len=" + (body || "").length + " | entries=" + Object.keys(obj.entries).length + " (forced " + forcedCount + ") | state=" + (obj.state || "?") + " | feature_gates=" + (obj.entries.feature_gates ? "yes" : "no"));

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
  $done({ body: (out === null) ? rawBody : out });
}
function deny() { $done({ body: rawBody }); }

(function gate() {
  console.log("[locketgold] remote: fired | key=" + (LICENSE_KEY ? "embedded" : "none") + " len=" + String(LICENSE_KEY || "").length);
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) { console.log("[locketgold] remote: DENY (bad key)"); return deny(); }

  // Pattern URL đã giới hạn đúng project Locket — KHÔNG gate theo UA
  // (Firebase iOS SDK có thể gọi với UA không chứa "locket" → trước đây deny nhầm, flags trả về bản free).
  try {
    var ua = (typeof $request !== "undefined" && $request && $request.headers)
      ? String($request.headers["user-agent"] || $request.headers["User-Agent"] || "")
      : "";
    console.log("[locketgold] remote: UA = \"" + ua.slice(0, 90) + "\"");
  } catch (e) { /* bỏ qua */ }

  console.log("[locketgold] remote: gate | cache=" + (Date.now() - lastVerifiedAt() < 259200000 ? "HIT" : "MISS"));
  if (Date.now() - lastVerifiedAt() < 259200000) { console.log("[locketgold] remote: UNLOCK via cache"); return unlock(); }

  var id = deviceId();
  if (!id) { console.log("[locketgold] remote: DENY (no device id)"); return deny(); }

  // Thử lần lượt 2 endpoint — zone b1s.id.vn có thể chặn app proxy lạ (WAF),
  // workers.dev luôn trả lời trực tiếp. Cả hai verify cùng 1 license.
  // ⚠️ Shadowrocket/Loon API: callback(errormsg, response, data) — data chính là body (String).
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
    console.log("[locketgold] remote: verify b1s.id.vn = " + okPrimary);
    if (okPrimary) {
      markVerified();
      console.log("[locketgold] remote: UNLOCK (primary)");
      return unlock();
    }
    verifyWith("https://locketgold-backend.nhb-120111.workers.dev/api/v2/locketgold/verify", function (okFallback) {
      console.log("[locketgold] remote: verify workers.dev = " + okFallback);
      if (okFallback) {
        markVerified();
        console.log("[locketgold] remote: UNLOCK (fallback)");
        return unlock();
      }
      console.log("[locketgold] remote: DENY (verify failed)");
      return deny();
    });
  });
})();
