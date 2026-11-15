package handler

import (
	"encoding/json"
	"time"
)

// FirebaseAttentionMessage la thông báo gắn vào response Remote Config.
const FirebaseAttentionMessage = "B1sTeam Activated (Gold Lifetime)!"

// FirebaseGoldFlags là các cờ bật Gold/VIP được ép `true` trong Remote Config.
//
// Remote Config của Firebase dùng giá trị chuỗi, nên ta ghi "true" (string).
var FirebaseGoldFlags = map[string]string{
	"vip":                  "true",
	"is_vip":               "true",
	"enable_vip":           "true",
	"is_gold":              "true",
	"enable_gold":          "true",
	"has_gold":             "true",
	"gold":                 "true",
	"gold_mode":            "true",
	"is_premium":           "true",
	"premium":              "true",
	"gold_subscription":    "true",
	"unlock_all_frames":    "true",
	"free_frames":          "true",
	"remove_paywall":       "true",
	"disable_paywall":      "true",
	"enable_photobooth":    "true",
	"enable_ai_filters":    "true",
	"camera_filter_enabled":  "true",
	"camera_filters_enabled": "true",
	"ai_filters_enabled":     "true",
	"filters_enabled":        "true",
	"feature_gates_gold":     "true",
}

// FirebaseFrameKeys là các key trong Remote Config chứa catalog frame.
var FirebaseFrameKeys = []string{"frames", "frame_catalog", "b1steam_frames"}

// InjectFirebase ép cờ Gold/VIP + merge catalog frame vào response Remote Config.
//
// catalog có thể nil (khi worker pool chưa sẵn sàng) — khi đó chỉ ép cờ.
func InjectFirebase(body []byte, catalog *FrameCatalog) ([]byte, error) {
	root, err := decodeObject(body)
	if err != nil {
		return nil, err
	}

	entries := childObject(root, "entries")

	for k, v := range FirebaseGoldFlags {
		entries[k] = v
	}

	if catalog != nil && len(catalog.Frames) > 0 {
		for _, key := range FirebaseFrameKeys {
			entries[key] = mergeFrameEntry(existingEntryString(entries, key), catalog.Frames)
		}
	}

	root["entries"] = entries

	// Cờ cấp cao (đọc nhanh từ client, không cần parse entries).
	root["vip"] = true
	root["is_gold"] = true
	root["enable_gold"] = true
	root["Attention"] = FirebaseAttentionMessage
	root["state"] = "UPDATE"
	root["templateVersion"] = time.Now().UTC().Format(time.RFC3339Nano)

	return json.Marshal(root)
}

// existingEntryString lấy giá trị chuỗi của một entry (nếu có).
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

// mergeFrameEntry gộp catalog frame của B1sTeam vào entry sẵn có.
//
// - Nếu entry cũ không phải JSON array -> thay thế hoàn toàn.
// - Nếu là JSON array -> gộp theo `id`, giữ thứ tự cũ trước, thêm frame mới sau.
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
