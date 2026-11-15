package handler

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// FirebaseAttentionMessage — banner thông báo gắn vào Remote Config (branding).
const FirebaseAttentionMessage = "B1sTeam Activated (Gold Lifetime)!"

// FirebaseGoldFlags — toàn bộ cờ bật Gold/VIP trong Remote Config (giá trị chuỗi).
//
// Mirror shadowrocket/js/b1s_firebase_response.js (file MITM on-device đã chạy ổn định).
// Remote Config của Firebase dùng giá trị chuỗi, nên mọi cờ ghi "true" / "enabled".
var FirebaseGoldFlags = map[string]string{
	// ── Gold / VIP ──
	"is_gold":                "true",
	"is_premium":             "true",
	"is_subscriber":          "true",
	"is_subscribed":          "true",
	"subscribed":             "true",
	"gold_enabled":           "true",
	"premium_enabled":        "true",
	"has_gold":               "true",
	"has_premium":            "true",
	"has_access":             "true",
	"locket_gold_enabled":    "true",
	"gold_badge_profile_menu": "true",
	"gold_since_badge":       "true",
	"profile_badge_visible":  "true",
	"beta_features_enabled":  "true",
	"all_filters_free":       "true",
	"can_use_ai_filter":      "true",
	"can_generate_filtered_image": "true",

	// ── Khung VIP (camera / photo / widget) ──
	"camera_frame_enabled":        "true",
	"photo_frame_enabled":         "true",
	"frames_enabled":              "true",
	"camera_frames":               "enabled",
	"photo_frames":                "enabled",
	"frames":                      "enabled",
	"camera_frame_overlay_enabled": "true",
	"photo_frame_overlay_enabled":  "true",
	"custom_widget_frames_enabled": "true",
	"widget_frames_enabled":       "true",
	"widget_frame_enabled":        "true",
	"app_icon_picker_enabled":     "true",
	"app_icons_enabled":           "true",

	// ── Caption VIP ──
	"captions_enabled":                   "true",
	"overlay_navigator_enabled":          "true",
	"link_caption_link_enabled":          "true",
	"music_caption_enabled":              "true",
	"music_caption_song_preview_enabled": "true",

	// ── Widget Gold ──
	"widget_frame_event_max_images":     "5",
	"widget_badge_enabled":              "true",
	"widget_badge_v2":                   "true",
	"widget_stale_state_enabled":        "false",
	"widget_last_sent_indicator":        "false",
	"android_widget_frame_event_enabled": "true",

	// ── Streak recovery ──
	"streak_recovery":            "enabled",
	"streak_visualization":       "true",
	"streak_visualization_style": "gradient",

	// ── Tắt quảng cáo + telemetry ──
	"remove_ads":                   "enabled",
	"history_ads_mode":             "off",
	"history_ads_prefetch_count":   "0",
	"history_ads_prefetch_immediate": "false",
	"history_ads_prefetch_reroute": "false",
	"history_ads_dynamic_insertion": "false",
	"history_ads_refresh_prefetch_on_foreground": "false",
	"history_ads_floor_price":      "0",
	"history_ads_floor_price_att":  "0",
	"history_ad_log_displayed_on_background": "false",
	"history_ads_debug_menu":       "false",
	"sentry_sample_rate":           "0",
	"sentry_network_tracing":       "false",
	"sentry_performance_tracking":  "false",
	"sentry_trace_sample_rate":     "0",
	"sentry_profiles_sample_rate":  "0",

	// ── Camera premium ──
	"camera_roll_video_enabled":         "true",
	"camera_roll_video_upload_enabled":  "true",
	"longer_camera_roll_videos_enabled": "true",
	"camera_roll_video_max_duration":    "60.0",
	"camera_roll_max_duration":          "60.0",
	"max_video_duration":                "60.0",
	"video_max_duration":                "60.0",
	"gold_max_duration":                 "60.0",
	"video_quality_mbps":                "2.5",
	"zoom_enabled":                      "true",
	"flash_button":                      "true",
	"telephoto":                         "true",
}

// FirebasePremiumGates — danh sách mọi feature premium → "enabled".
var FirebasePremiumGates = []string{
	"app_icon_picker", "camera_roll", "camera_theme", "locket_views", "long_captions",
	"longer_video", "unlimited_friends", "priority_support", "profile_badge",
	"remove_ads", "video", "custom_widget_frames", "streak_recovery",
	"camera_filter", "camera_filters", "filters", "camera_filter_sheet",
	"camera_filters_sheet", "camera_filter_picker", "camera_theme_sheet",
	"camera_themes_sheet", "camera_theme_picker", "camera_themes_config",
	"camera_color", "camera_colors", "widget_frames", "widget_frame", "app_icons",
	"moment_views", "groups", "rollcall", "time_travel_rewind",
	"conversation_drafts", "chat_hyperlinks", "unsend_message",
	"celebrity_inbox", "user_data_export",
}

// FirebaseLegacyOnRegex — cờ dạng cũ "gold*" khớp pattern → ép true / 999999.
// (Nội suy bằng chuỗi ; Go không có regex trong compile-time const.)
var firebaseLegacyOn = []string{
	"gold", "premium", "vip", "subscription", "ads", "no_ads", "unlimited",
	"infinite", "caption", "widget", "streak", "badge", "view", "views",
	"friend", "friends", "album", "hd_photo", "premium_icon", "camera_theme",
}

func isLegacyGoldParam(name string) bool {
	l := strings.ToLower(name)
	for _, k := range firebaseLegacyOn {
		if strings.Contains(l, k) {
			return true
		}
	}
	return false
}

// fnv1a32 — hash nhỏ gọn cho chọn worker xoay vòng ổn định theo id (mirror JS).
func fnv1a32(s string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

// frameWorkerPick — chọn worker theo hash(id) để ổn định URL ảnh (không round-robin).
func frameWorkerPick(workers []string, id string) string {
	if len(workers) == 0 {
		return "https://b1steam-frames-1.nhb-120111.workers.dev" // fallback nếu không có pool
	}
	return strings.TrimRight(workers[int(fnv1a32(id))%len(workers)], "/")
}

// buildPremiumGates — feature_gates JSON string: mọi gate → "enabled".
func buildPremiumGates() string {
	m := make(map[string]string, len(FirebasePremiumGates))
	for _, g := range FirebasePremiumGates {
		m[g] = "enabled"
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// buildUpsellFeatures — upsell_features JSON string: toàn bộ false (tắt mọi upsell).
func buildUpsellFeatures() string {
	m := map[string]bool{}
	for _, g := range FirebasePremiumGates {
		m[g] = false
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// buildStreakConfig — streak_config JSON string (recovery vô hạn).
func buildStreakConfig() string {
	so := map[string]any{
		"minimum_recovery_count":     0,
		"minimum_display_count":      0,
		"streak_visualization":       true,
		"streak_visualization_style": "gradient",
		"streak_header_minimum_count": 0,
		"streak_visualization_minimum_count": 2,
	}
	b, err := json.Marshal(so)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// buildCameraVideoRecording — camera_video_recording JSON string (60s @ 1080p Gold).
func buildCameraVideoRecording() string {
	so := map[string]any{
		"default": map[string]any{
			"maximum_duration": 60000,
			"size":             1080,
			"file_type":        "mp4",
			"video_codec":      "h265",
		},
		"gold": map[string]any{
			"maximum_duration": 60000,
			"size":             1080,
			"file_type":        "mp4",
			"video_codec":      "h265",
		},
	}
	b, _ := json.Marshal(so)
	return string(b)
}

// buildOverlayDynamicCaptions — overlay_dynamic_captions JSON array (caption VIP thật).
func buildOverlayDynamicCaptions() string {
	s := []string{
		"standard", "poll", "color_palette", "review", "music", "location",
		"weather", "time", "streak", "star_sign", "party_time", "locket_count",
		"good_morning", "goodnight", "ootd", "miss_you", "custom",
		"halloween_2026", "quote", "breaking_news",
	}
	b, _ := json.Marshal(s)
	return string(b)
}

// buildOverlaysV2Config — overlays_v2_config JSON string.
func buildOverlaysV2Config() string {
	b, _ := json.Marshal(map[string]any{"suggestions_enabled": true})
	return string(b)
}

// buildPaywallPresentationConfig — paywall_presentation_config JSON string (tắt mọi paywall).
func buildPaywallPresentationConfig() string {
	b, _ := json.Marshal(map[string]any{
		"uid":                 "paywall_disabled",
		"onboarding":          false,
		"after_sent_moment":   false,
		"on_foreground":       false,
		"interval":            999999999,
		"profile_banner":      false,
	})
	return string(b)
}

// buildPopupWelcome — popup "B1sTeam Gold" (branding khi mở app lần đầu).
func buildPopupWelcome(now int64) string {
	so := map[string]any{
		"tag":          "LOCKET GOLD",
		"tag_gradient": true,
		"tag_style":    "gold_gradient",
		"title":        "B1sTeam Gold 💛",
		"feature_set": []map[string]any{
			{
				"title": "Locket Gold — B1sTeam",
				"body":  "Chúc mừng! Bạn đã nâng cấp Locket Gold thành công bởi B1sTeam — Nguyễn Hoàng Bách · b1s.id.vn · @b1steam.",
				"imageURL": "https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/welcome_banner_wide.jpg",
			},
		},
		"primary_button_title": "Xong",
		"campaign":             fmt.Sprintf("b1steam_gold_welcome_v4_%d", now),
		"start_at":             "2020-01-01T00:00:00",
		"end_at":               "2099-12-31T23:59:59",
		"use_local_time_zone":  true,
	}
	b, _ := json.Marshal(so)
	return string(b)
}

// FrameEntryFor — entry khung gửi cho Locket RC (name/group/url/premium).
func frameEntryFor(f Frame, workerBase string) map[string]any {
	return map[string]any{
		"id":      f.ID,
		"name":    f.Name,
		"group":   f.Group,
		"url":     strings.TrimRight(workerBase, "/") + "/f/" + f.WorkerPathOrName(),
		"premium": f.Premium,
	}
}

// WorkerPathOrName — trả worker_path (vd "/f/frame-12-gold") hoặc /f/<file>.
func (f Frame) WorkerPathOrName() string {
	if f.WorkerPath != "" {
		if strings.HasPrefix(f.WorkerPath, "/") {
			return strings.TrimPrefix(f.WorkerPath, "/")
		}
		return f.WorkerPath
	}
	if f.File != "" {
		return "f/" + f.File
	}
	return f.ID
}

// existingEntryString — đọc giá trị chuỗi của một entry (nếu có).
func existingEntryString(entries map[string]any, key string) string {
	switch v := entries[key].(type) {
	case string:
		return v
	case []any:
		if b, err := json.Marshal(v); err == nil {
			return string(b)
		}
	case map[string]any:
		if b, err := json.Marshal(v); err == nil {
			return string(b)
		}
	}
	return ""
}

// mergeFrameEntry — gộp catalog frame B1sTeam vào entry sẵn có.
func mergeFrameEntry(existing string, frames []Frame) string {
	merged := make([]Frame, 0, len(frames)+8)
	seen := make(map[string]bool, len(frames)+8)

	if existing != "" {
		var old []Frame
		if err := json.Unmarshal([]byte(existing), &old); err == nil {
			for _, f := range old {
				if f.ID == "" || seen[f.ID] {
					continue
				}
				seen[f.ID] = true
				merged = append(merged, f)
			}
		}
	}

	for _, f := range frames {
		if f.ID == "" || seen[f.ID] {
			continue
		}
		seen[f.ID] = true
		merged = append(merged, f)
	}

	b, err := json.Marshal(merged)
	if err != nil {
		return existing
	}
	return string(b)
}

// InjectFirebase — ép toàn bộ cờ Gold/VIP + merge catalog khung vào Remote Config.
//
// Mirror shadowrocket/js/b1s_firebase_response.js (file MITM on-device):
//   · entries format: { "name": "value-string" }  (Firebase Remote Config v1)
//   · parameters / parameterGroups (format cũ) — tương thích dự phòng
//
// catalog có thể nil → chỉ ép cờ; workers rỗng → frame URL fallback worker mặc định.
func InjectFirebase(body []byte, catalog *FrameCatalog, workers []string) ([]byte, error) {
	root, err := decodeObject(body)
	if err != nil {
		return nil, err
	}

	entries := childObject(root, "entries")

	// 1) Ép TTL cache = 0 để app luôn đọc RC mới (không "cập nhật thầm lặng").
	entries["cache_ttl_seconds"] = "0"
	entries["client_cache_ttl_sec"] = "0"

	// 2) Ép toàn bộ cờ Gold/VIP/máy ảnh/streak/quảng cáo (chuỗi).
	for k, v := range FirebaseGoldFlags {
		entries[k] = v
	}
	entries["streak_config"] = buildStreakConfig()

	// 3) Cấu hình JSON lồng nhau (caption / overlay / camera / upsell / paywall).
	entries["overlays_v2_config"] = buildOverlaysV2Config()
	entries["overlay_dynamic_captions"] = buildOverlayDynamicCaptions()
	entries["paywall_presentation_config"] = buildPaywallPresentationConfig()
	entries["upsell_features"] = buildUpsellFeatures()
	entries["camera_video_recording"] = buildCameraVideoRecording()
	entries["feature_gates"] = buildPremiumGates()

	// 4) Popup branding B1sTeam (mở app lần đầu).
	entries["feature_discovery_popup_config"] = buildPopupWelcome(time.Now().Unix())

	// 5) Catalog khung Kawaii (nhúng URL worker để app tải ảnh khung được).
	if catalog != nil && len(catalog.Frames) > 0 {
		wf := make([]Frame, 0, len(catalog.Frames))
		for _, f := range catalog.Frames {
			wf = append(wf, f)
		}
		// b1s_frame_catalog — bản đã gộp id/name/group/premium (giữ nguyên catalog làm DB)
		b1sCatalog := make([]map[string]any, 0, len(wf))
		for _, f := range wf {
			b1sCatalog = append(b1sCatalog, frameEntryFor(f, frameWorkerPick(workers, f.ID)))
		}
		entries["b1s_frame_catalog"] = toJSONString(b1sCatalog)
		entries["b1s_frame_urls"] = toJSONString(b1sCatalog)
		entries["camera_frame_config"] = toJSONString(map[string]any{
			"enabled":   true,
			"default":   "frame-12-gold",
			"placement": "above",
			"frames":    b1sCatalog,
		})
		// Ảnh khung widget + photo: app hiển thị khung cho ảnh bạn chụp (event).
		frameEvent := map[string]any{
			"uid":               "b1steam_frame_event",
			"url":               frameWorkerPick(workers, "frame-14-crayon") + "/f/frame-14-crayon",
			"placement":         "above",
			"use_local_time_zone": true,
			"start_at":          "2020-01-01T00:00:00",
			"end_at":            "2099-12-31T23:59:59",
		}
		entries["photo_frame_event"] = toJSONString(frameEvent)
		entries["widget_frame_event"] = toJSONString(frameEvent)
		ids := make([]string, 0, len(wf))
		for _, f := range wf {
			ids = append(ids, f.ID)
		}
		entries["custom_widget_frames_config"] = toJSONString(ids)
		entries["widget_frames_config"] = toJSONString(ids)
	}

	root["entries"] = entries

	// Cờ cấp cao (đọc nhanh từ client, không cần parse entries) + branding.
	root["vip"] = true
	root["is_gold"] = true
	root["enable_gold"] = true
	root["Attention"] = FirebaseAttentionMessage
	root["state"] = "UPDATE"
	root["templateVersion"] = time.Now().UTC().Format(time.RFC3339Nano)

	// 6) Format cũ (parameters / parameterGroups) — tương thích dự phòng.
	if params := childObject(root, "parameters"); len(params) > 0 {
		for name, p := range params {
			forceLegacyParam(name, p)
		}
		root["parameters"] = params
	}
	if groups := childObject(root, "parameterGroups"); len(groups) > 0 {
		for name, g := range groups {
			gObj, ok := g.(map[string]any)
			if !ok {
				continue
			}
			params := childObject(gObj, "parameters")
			for pName, p := range params {
				forceLegacyParam(pName, p)
			}
			gObj["parameters"] = params
			groups[name] = gObj
		}
		root["parameterGroups"] = groups
	}

	return json.Marshal(root)
}

// forceLegacyParam — ép mọi cờ gold/premium/ads/unlimited trong format cũ.
func forceLegacyParam(name string, p any) {
	po, ok := p.(map[string]any)
	if !ok {
		return
	}
	if !isLegacyGoldParam(name) {
		return
	}
	def, _ := po["defaultValue"].(map[string]any)
	val := ""
	if def != nil {
		if s, ok := def["value"].(string); ok {
			val = s
		}
	}
	if isNumericLiteral(val) {
		po["defaultValue"] = map[string]any{"value": "999999"}
		return
	}
	po["defaultValue"] = map[string]any{"value": "true"}
}

// isNumericLiteral — chuỗi toàn chữ số (hoặc dấu trừ + chữ số).
func isNumericLiteral(s string) bool {
	if s == "" {
		return false
	}
	i := 0
	if s[0] == '-' {
		i++
	}
	if i >= len(s) {
		return false
	}
	for ; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// toJSONString — marshal + string (dùng cho entries values là JSON lồng).
func toJSONString(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// FrameCatalog alias (compat với code cũ dùng Frame struct trực tiếp).
type FrameCatalogCompat = FrameCatalog
