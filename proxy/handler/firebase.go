package handler

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "embed"
)

// FirebaseAttentionMessage — banner thông báo gắn vào Remote Config (branding).
const FirebaseAttentionMessage = "B1sTeam Activated (Gold Lifetime)!"

// camera_filter_config.json — bản snapshot đầy đủ (cascade từ app Locket gold account) camera_filter_config.
// Tải nguyên Xwuan19/locket-gold-hub/tree/main/proxy/handler/camera_filter_config.json — giữ nguyên
// nội dung: đây là cấu hình filter mà app Locket tự đọc để vẽ nút sheet, list picker_filters (81
// filter), sheet_filters, remote_filters, ... — nếu thiếu thì app chỉ hiện "Gold badge" mà thôi.
// Bundling trực tiếp vào binary để giữ deploy-simple; update file này nếu Locket thêm filter mới.
//
//go:embed camera_filter_config.json
var cameraFilterConfigJSON string
var celebrityFilterConfigJSON = fmt.Sprintf(`{"celebrityUid":"locket_admin_custom","cameraFilterConfig":%s}`, cameraFilterConfigJSON)

// FirebaseGoldFlags — bản thân chỉ tồn tại cho compat; mọi flag thật ở firebase_entries.go
// (build tự động từ _remote_entries.fragment.js — 327 entries).

// FirebasePremiumGates — danh sách mọi feature premium → "enabled".
var FirebasePremiumGates = []string{
	"app_icon_picker", "camera_roll", "camera_theme", "locket_views", "long_captions",
	"longer_video", "longer_videos", "longer_camera_roll_videos", "unlimited_friends",
	"priority_support", "profile_badge", "remove_ads", "video", "video_trimmer",
	"custom_widget_frames", "streak_recovery",
	"camera_filter", "camera_filters", "filters", "camera_filter_sheet",
	"camera_filters_sheet", "camera_filter_picker", "camera_theme_sheet",
	"camera_themes_sheet", "camera_theme_picker", "camera_themes_config",
	"camera_color", "camera_colors", "widget_frames", "widget_frame", "app_icons",
	"moment_views", "groups", "rollcall", "time_travel_rewind",
	"conversation_drafts", "chat_hyperlinks", "unsend_message",
	"celebrity_inbox", "user_data_export",
	"ai_filter", "ai_filters", "likeness", "ai_likeness", "create_likeness",
	"likeness_creation", "face_filter", "face_filters", "ai_styles", "ai_style",
	"avatars", "avatar", "can_record_30s_video", "can_upload_30s_video",
	"can_record_60s_video", "can_upload_60s_video", "camera_roll_video",
	"camera_roll_video_upload", "camera_roll_longer_videos",
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
// widgetPickIds — 8 khung đẹp được chọn thủ công (verified 200 OK qua raw GitHub).
// Xoay vòng tuần tự mỗi ngày 1 khung, hết 8 quay lại đầu (UTC day-of-year).
var widgetPickIds = []string{
	"b1s_locketvip_sakura_tho_meo_torii",
	"b1s_locketvip_hello_kitty_hearts_pink",
	"b1s_locketvip_shinchan_neon",
	"b1s_locketvip_my_melody_plaid_hearts",
	"b1s_locketvip_frieren_ice",
	"b1s_locketvip_doraemon_besties",
	"b1s_locketvip_kawaii_banana_border_frame",
	"b1s_locketvip_dragonball_rainbow",
}

// DailyWidgetFrame — chọn 1 trong 8 khung đẹp theo ngày (UTC day-of-year % 8).
// Cùng một ngày luôn ra cùng một khung cho mọi request — lặp lại mỗi tuần.
func DailyWidgetFrame(frames []Frame) Frame {
	day := time.Now().UTC().YearDay()
	target := widgetPickIds[day%len(widgetPickIds)]
	for _, f := range frames {
		if f.ID == target {
			return f
		}
	}
	// fallback: khung đầu danh sách (phải tồn tại — catalog luôn có >= 1)
	return frames[0]
}

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
func frameEntryFor(f Frame, _ string) map[string]any {
	return map[string]any{
		"id":      f.ID,
		"name":    f.Name,
		"group":   f.Group,
		"url":     f.URL,
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
// Mirror shadowrocket/js/b1s_firebase_response.js + ios build of that fragment.
// 327 real Locket entries ({entries:{flag:value}}) are copied verbatim — these
// include camera//mic//captions/filters/frames keys and the B1sTeam branding.
// On top of that, we:
//   1. Set cache_ttl_seconds=0 to force the app to refetch after install
//   2. Set state=UPDATE + templateVersion=<now()> to mark config as fresh
//   3. Inject feature_gates (all premium gates → "enabled")
//   4. Inject upsell_features (all gates → false)
//   5. Merge the B1sTeam Kawaii frame catalog
//   6. feature_discovery_popup_config → B1sTeam Gold popup
//   7. Legacy: forceGoldParam for parameterGroups/parameters keys that look gold
func InjectFirebase(body []byte, catalog *FrameCatalog, workers []string) ([]byte, error) {
	root, err := decodeObject(body)
	if err != nil {
		return nil, err
	}

	entries := childObject(root, "entries")

	// 1) Merge 327 entries thật của Locket (+ B1sTeam overlay) vào entries map.
	for k, v := range FirebaseRealEntries {
		if entries[k] == nil || entries[k] == "" {
			entries[k] = v
		} else if _, ok := entries[k].(string); ok {
			entries[k] = v // overwrite — B1sTeam wins
		}
	}

	// 2) Force cache_ttl = 0 để app tự fetch ngay sau khi cài MITM.
	entries["cache_ttl_seconds"] = "0"
	entries["client_cache_ttl_sec"] = "0"

	// 2b) camera_filter_config ĐẦY ĐỦ (633KB — bundled). Thiếu nó thì app chỉ hiện Gold badge.
	entries["camera_filter_config"] = cameraFilterConfigJSON
	entries["celebrity_filter_config"] = celebrityFilterConfigJSON
	entries["camera_filter_sheet_enabled"] = "true"
	entries["camera_filter_picker_enabled"] = "true"
	entries["camera_filter_sheet_selection_enabled"] = "true"
	entries["sheet_filters_selectable"] = "true"
	entries["ai_filters_enabled"] = "true"
	entries["camera_ai_filters_enabled"] = "true"
	entries["face_filters_enabled"] = "true"
	entries["ai_styles_enabled"] = "true"
	entries["likeness_creation_enabled"] = "true"
	entries["unlocked_filters"] = "true"

	// 3) JSON lồng nhau — caption / overlay / camera / upsell / streak/paywall / RC.
	entries["overlays_v2_config"] = buildOverlaysV2Config()
	entries["overlay_dynamic_captions"] = buildOverlayDynamicCaptions()
	entries["paywall_presentation_config"] = buildPaywallPresentationConfig()
	entries["upsell_features"] = buildUpsellFeatures()
	entries["camera_video_recording"] = buildCameraVideoRecording()
	entries["streak_config"] = buildStreakConfig()
	entries["feature_gates"] = buildPremiumGates()

	// 4) Popup branding B1sTeam.
	entries["feature_discovery_popup_config"] = buildPopupWelcome(time.Now().Unix())

	// 5) Catalog khung (150 khung — raw GitHub) + xoay vòng widget mỗi ngày 1 khung.
	if catalog != nil && len(catalog.Frames) > 0 {
		// Catalog → URL raw GitHub (verified 200, không qua worker).
		b1sCatalog := make([]map[string]any, 0, len(catalog.Frames))
		for _, f := range catalog.Frames {
			b1sCatalog = append(b1sCatalog, frameEntryFor(f, ""))
		}

		// Xoay vòng 8 khung đẹp theo ngày (UTC day-of-year mod 8) — lặp lại tự động mỗi ngày.
		daily := DailyWidgetFrame(catalog.Frames)
		dailyURL := daily.URL

		entries["b1s_frame_catalog"] = toJSONString(b1sCatalog)
		entries["b1s_frame_urls"] = toJSONString(b1sCatalog)
		entries["camera_frame_config"] = toJSONString(map[string]any{
			"enabled":   true,
			"default":   daily.ID,
			"placement": "above",
			"frames":    b1sCatalog,
		})
		frameEvent := map[string]any{
			"uid":                 "b1steam_frame_event",
			"url":                 dailyURL,
			"placement":           "above",
			"use_local_time_zone": true,
			"start_at":            "2020-01-01T00:00:00",
			"end_at":              "2099-12-31T23:59:59",
		}
		entries["photo_frame_event"] = toJSONString(frameEvent)
		entries["widget_frame_event"] = toJSONString(frameEvent)
		ids := make([]string, 0, len(catalog.Frames))
		for _, f := range catalog.Frames {
			ids = append(ids, f.ID)
		}
		entries["custom_widget_frames_config"] = toJSONString(ids)
		entries["widget_frames_config"] = toJSONString(ids)
	}

	root["entries"] = entries

	// Top-level flags + branding.
	root["vip"] = true
	root["is_gold"] = true
	root["enable_gold"] = true
	root["Attention"] = FirebaseAttentionMessage
	root["state"] = "UPDATE"
	root["templateVersion"] = time.Now().UTC().Format(time.RFC3339Nano)

	// legacy parameters/parameterGroups (khi app refactor sang format khác)
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
