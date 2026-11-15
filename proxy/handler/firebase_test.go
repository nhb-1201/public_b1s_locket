package handler

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestInjectFirebaseInjectsGoldFlags(t *testing.T) {
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

	for _, key := range []string{"is_gold", "locket_gold_enabled", "captions_enabled", "streak_recovery", "remove_ads", "feature_gates", "upsell_features", "camera_video_recording", "b1s_frame_catalog", "b1s_frame_urls", "photo_frame_event", "widget_frames_config", "camera_frame_config", "feature_discovery_popup_config"} {
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
		if strings.Contains(s, "false") && key != "upsell_features" && key != "widget_stale_state_enabled" {
			// streak_recovery has "enabled" not contain "false"; upsell_features is allowed to contain false.
			t.Errorf("entry %q unexpectedly contains false: %q", key, s)
		}
	}

	if got := asString(entries["streak_recovery"]); got != "enabled" {
		t.Errorf("streak_recovery = %q", got)
	}
	if got := asString(entries["remove_ads"]); got != "enabled" {
		t.Errorf("remove_ads = %q", got)
	}

	ad := asString(entries["upsell_features"])
	if !strings.Contains(ad, `"camera_theme":false`) {
		t.Errorf("upsell_features should be all false, got %q", ad)
	}

	cat := asString(entries["b1s_frame_catalog"])
	if !strings.Contains(cat, `"frame-12-gold"`) {
		t.Errorf("b1s_frame_catalog missing gold frame: %q", cat)
	}

	popup := asString(entries["feature_discovery_popup_config"])
	if !strings.Contains(strings.ToLower(popup), "b1steam") {
		t.Errorf("popup config should mention b1steam, got %q", popup)
	}

	if got := asString(root["Attention"]); got == "" {
		t.Error("missing root attention")
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
	var root map[string]any
	if err := json.Unmarshal(out1, &root); err != nil {
		t.Fatal(err)
	}
	ents := root["subscriber"].(map[string]any)["entitlements"].(map[string]any)
	g := ents["Gold"].(map[string]any)
	if got := asString(g["product_identifier"]); got == "" {
		t.Error("missing gold product identifier")
	}
	if got := asString(g["ownership_type"]); got != "PURCHASED" {
		t.Errorf("ownership_type = %q", got)
	}

	nonSubs := root["subscriber"].(map[string]any)["non_subscriptions"].(map[string]any)
	rate := nonSubs["locket_1600_1y"].([]any)
	if len(rate) == 0 {
		t.Fatal("empty non_subscriptions")
	}
}

func asString(v any) string {
	switch s := v.(type) {
	case string:
		return s
	case []any:
		b, _ := json.Marshal(s)
		return string(b)
	default:
		b, _ := json.Marshal(s)
		return string(b)
	}
}
