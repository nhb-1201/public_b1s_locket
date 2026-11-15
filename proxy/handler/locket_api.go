package handler

import (
	"encoding/json"
	"strings"
)

// LocketFalseFlags: các cờ bị ép `false` (xoá paywall / mo khoa).
var LocketFalseFlags = []string{
	"is_locked",
	"locked",
	"requires_gold",
	"require_gold",
	"gold_only",
	"is_gold_only",
	"paywall",
	"show_paywall",
	"blurred",
	"is_blurred",
}

// LocketTrueFlags: các cờ bị ép `true` (được xem / dùng miễn phí).
var LocketTrueFlags = []string{
	"can_view",
	"unlocked",
	"is_unlocked",
	"is_free",
	"free",
	"can_use_filter",
	"can_use_filters",
}

// LocketClearURLKeys: các key chứa URL ảnh gốc (không làm mờ).
var LocketClearURLKeys = []string{
	"unblurred_url",
	"unlocked_url",
	"original_url",
	"clear_url",
	"result_url",
	"transformed_image_url",
	"source_url",
}

// LocketBlurURLKeys: các key chứa URL ảnh làm mờ (sẽ bị thay bằng URL gốc).
var LocketBlurURLKeys = []string{
	"blurred_url",
	"blurred_image_url",
	"preview_url",
}

// feedEndpoints là các endpoint KHÔNG được đổi 400/402/403 sang 200.
//
// Danh sách bạn bè / feed phải giữ nguyên status để app không bị "vỡ" layout.
var feedEndpoints = []string{
	"getFriends",
	"getUsers",
	"fetchFriends",
	"getRecipients",
	"moments",
	"contacts",
}

// IsFeedOrFriendsEndpoint kiểm tra path có thuộc nhóm feed/bạn bè hay không.
func IsFeedOrFriendsEndpoint(path string) bool {
	p := strings.ToLower(path)
	for _, key := range feedEndpoints {
		if strings.Contains(p, strings.ToLower(key)) {
			return true
		}
	}
	return false
}

// IsChangeProfileInfo kiểm tra request đổi profile (luôn trả 200 + badge Gold).
func IsChangeProfileInfo(path string) bool {
	return strings.Contains(strings.ToLower(path), "changeprofileinfo")
}

// ChangeProfileInfoMockResponse trả JSON giả cho changeProfileInfo.
//
// App cần phản hồi 200 ngay lập tức để hiện badge Gold lên profile.
func ChangeProfileInfoMockResponse() []byte {
	return []byte(`{"ok":true,"data":{"badge":"locket_gold","badge_tier":"gold","badge_label":"B1sTeam Gold","badge_owner":"B1sTeam","show_badge":true,"is_gold":true,"has_gold":true,"gold":true,"gold_subscription":true,"has_gold_subscription":true,"tier":"gold","subscription_status":"active","success":true},"result":{"badge":"locket_gold","badge_tier":"gold","badge_label":"B1sTeam Gold","badge_owner":"B1sTeam","show_badge":true,"is_gold":true,"has_gold":true,"gold":true,"gold_subscription":true,"has_gold_subscription":true,"tier":"gold","subscription_status":"active","success":true}}`)
}

// ApplyGoldBadge gắn các trường badge Gold vào 1 object.
func ApplyGoldBadge(target map[string]any) {
	if target == nil {
		return
	}
	target["badge"] = "locket_gold"
	target["badge_tier"] = "gold"
	target["badge_label"] = "B1sTeam Gold"
	target["badge_owner"] = "B1sTeam"
	target["show_badge"] = true
	target["is_gold"] = true
	target["has_gold"] = true
	target["gold"] = true
	target["gold_subscription"] = true
	target["has_gold_subscription"] = true
	target["tier"] = "gold"
	target["subscription_status"] = "active"
}

// RewriteLocketAPI xử lý JSON từ API Locket:
//
//   - gỡ paywall / mở khoá ảnh (xoá blurred, thay URL ảnh mờ bằng URL gốc)
//   - gắn badge Gold cho mọi object có `uid`
//
// Hàm idempotent: chạy lại trên output cũng cho ra kết quả giống hệt.
func RewriteLocketAPI(body []byte) []byte {
	if len(body) == 0 {
		return body
	}
	var root any
	if err := json.Unmarshal(body, &root); err != nil {
		return body
	}

	rewriteLocketNode(root)

	cleaned, err := json.Marshal(root)
	if err != nil {
		return body
	}
	return cleaned
}

// rewriteLocketNode duyệt cây JSON và áp dụng quy tắc Gold cho từng object.
func rewriteLocketNode(node any) {
	switch v := node.(type) {
	case map[string]any:
		clearURL := findClearURL(v)

		for _, flag := range LocketFalseFlags {
			v[flag] = false
		}
		for _, flag := range LocketTrueFlags {
			v[flag] = true
		}

		if clearURL != "" {
			for _, key := range LocketBlurURLKeys {
				if _, exists := v[key]; exists {
					v[key] = clearURL
				}
			}
		}

		if _, hasUID := v["uid"]; hasUID {
			ApplyGoldBadge(v)
		}

		for _, val := range v {
			rewriteLocketNode(val)
		}
	case []any:
		for _, item := range v {
			rewriteLocketNode(item)
		}
	}
}

// findClearURL tìm URL ảnh gốc (không làm mờ) trong 1 object.
func findClearURL(obj map[string]any) string {
	for _, key := range LocketClearURLKeys {
		if s, ok := obj[key].(string); ok && strings.HasPrefix(s, "http") {
			return s
		}
	}
	return ""
}
