package handler

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestInjectFirebaseInjectsFullUnlock(t *testing.T) {
	body := []byte(`{"entries":{"is_gold":"false","streak_recovery":"disabled"}}`)
	out, err := InjectFirebase(body, &FrameCatalog{Frames: []Frame{{ID: "frame-12-gold", Name: "Gold", Group: "gold", File: "frame-12-gold.png", WorkerPath: "/f/frame-12-gold", Premium: true}}}, []string{"https://b1steam-frames-1.workers.dev", "https://b1steam-frames-2.workers.dev"})
	if err != nil {
		t.Fatal(err)
	}
	var root map[string]any
	if err := json.Unmarshal(out, &root); err != nil {
		t.Fatal(err)
	}
	entries, ok := root["entries"].(map[string]any)
	if !ok {
		t.Fatal("missing entries map")
	}

	for _, key := range []string{
		"is_gold",
		"locket_gold_enabled",
		"captions_enabled",
		"streak_recovery",
		"remove_ads",
		"feature_gates",
		"upsell_features",
		"camera_video_recording",
		"camera",
		"camera_filter_config",
		"microphone_enabled",
		"camera_microphone_enabled",
		"video_sound_enabled",
		"can_use_ai_filter",
		"can_generate_filtered_image",
		"all_filters_free",
		"camera_filters_enabled",
		"b1s_frame_catalog",
		"b1s_frame_urls",
		"photo_frame_event",
		"widget_frames_config",
		"camera_frame_config",
		"feature_discovery_popup_config",
		"streak_config",
		"camera_theme_config",
		"cdn_domain_replacements",
		"country_code",
		"is_subscriber",
		"is_us_user",
	} {
		v, present := entries[key]
		if !present {
			t.Errorf("missing entry %q", key)
			continue
		}
		s := asString(v)
		if s == "" {
			t.Errorf("entry %q empty", key)
			continue
		}
		if s == "false" && key != "upsell_features" && key != "widget_stale_state_enabled" && key != "widget_last_sent_indicator" && !strings.HasPrefix(key, "history_") && !strings.HasPrefix(key, "sentry_") && !strings.HasPrefix(key, "require_gold") && !strings.HasPrefix(key, "camera_filter_requires") && !strings.HasPrefix(key, "filter_requires") && !strings.HasPrefix(key, "filtered_image_require") && !strings.HasPrefix(key, "filters_require") && !strings.HasPrefix(key, "ai_filter_require") && !strings.HasPrefix(key, "ai_filters_require") && !strings.HasPrefix(key, "filter_gold_only") && !strings.HasPrefix(key, "filters_gold_only") && !strings.HasPrefix(key, "camera_filter_gold_only") && !strings.HasPrefix(key, "holiday_filters_gold_only") && !strings.HasPrefix(key, "ai_filter_gold_only") && !strings.HasPrefix(key, "holiday_effects_gate") && !strings.HasPrefix(key, "photos_of_you_gate") && !strings.HasPrefix(key, "share_history") && !strings.HasPrefix(key, "hide_friends") && !strings.HasPrefix(key, "show_friends") && !strings.HasPrefix(key, "show_no_friends") && !strings.HasPrefix(key, "show_friend_limit") && !strings.HasPrefix(key, "android_subscribe") {
			t.Errorf("entry %q unexpectedly 'false' — needed unlock path", key)
		}
	}

	if got := asString(entries["streak_recovery"]); got != "enabled" {
		t.Errorf("streak_recovery = %q", got)
	}
	if got := asString(entries["remove_ads"]); got != "enabled" {
		t.Errorf("remove_ads = %q", got)
	}
	if got := asString(entries["microphone_enabled"]); got != "true" {
		t.Errorf("microphone_enabled = %q", got)
	}
	cat := asString(entries["b1s_frame_catalog"])
	if !strings.Contains(cat, "frame-12-gold") {
		t.Errorf("b1s_frame_catalog missing gold frame: %q", cat)
	}
	popup := asString(entries["feature_discovery_popup_config"])
	if !strings.Contains(strings.ToLower(popup), "b1steam") {
		t.Errorf("popup mention b1steam, got %q", popup)
	}

	// camera JSON must have gold_max_duration=60
	cameraJSON := asString(entries["camera"])
	if !strings.Contains(cameraJSON, `"goldMaxDuration":60`) {
		t.Errorf("camera JSON missing goldMaxDuration=60: %q", cameraJSON)
	}
	// camera_filter_config JSON must have allowsCustomFilters=true and 81 picker filters
	cfc := asString(entries["camera_filter_config"])
	if !strings.Contains(cfc, `"allowsCustomFilters":true`) && !strings.Contains(cfc, `"allowsCustomFilters": true`) {
		t.Errorf("camera_filter_config missing allowsCustomFilters: %s", cfc[:200])
	}
	if !strings.Contains(cfc, `"pickerFilters"`) {
		t.Errorf("camera_filter_config missing pickerFilters: %s", cfc[:200])
	}
	if !strings.Contains(cfc, `"b1s_locketvip_shin_chan_ngay_nghi_khung_long_xanh"`) {
		t.Errorf("camera_filter_config missing frame b1s_locketvip_shin_chan_ngay_nghi_khung_long_xanh: %s", cfc[:300])
	}
	celebrity := asString(entries["celebrity_filter_config"])
	if !strings.Contains(celebrity, `"celebrityUid":"locket_admin_custom"`) {
		t.Errorf("celebrity_filter_config at celebrityUid missing: %s", celebrity[:200])
	}
	// feature_gates must enable the extra VIP gates
	fg := asString(entries["feature_gates"])
	for _, g := range []string{"can_record_60s_video", "can_upload_60s_video", "ai_filters", "video_trimmer", "likeness", "ai_likeness", "face_filters", "ai_styles", "avatars"} {
		if !strings.Contains(fg, g+`":"enabled"`) {
			t.Errorf("feature_gates missing gate %q in %q", g, fg)
		}
	}
}

func TestInjectRevenueCatIdempotent(t *testing.T) {
	in := []byte(`{"subscriber":{"entitlements":{},"subscriptions":{}}}`)
	out1, err := InjectRevenueCat(in)
	if err != nil {
		t.Fatal(err)
	}
	out2, err := InjectRevenueCat(out1)
	if err != nil {
		t.Fatal(err)
	}
	if string(out1) != string(out2) {
		t.Fatal("not idempotent")
	}
}

func asString(v any) string {
	switch s := v.(type) {
	case string:
		return s
	case []any:
		b, _ := json.Marshal(s)
		return string(b)
	case map[string]any:
		b, _ := json.Marshal(s)
		return string(b)
	default:
		b, _ := json.Marshal(s)
		return string(b)
	}
}
