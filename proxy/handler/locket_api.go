package handler

import (
	"encoding/json"
	"strings"
)

// ponytail: instant 200 response for changeProfileInfo ensures UI immediate gold badge confirmation.
func IsChangeProfileInfo(path string) bool {
	return strings.Contains(path, "changeProfileInfo")
}

func ChangeProfileInfoMockResponse() []byte {
	return []byte(`{"data":{"badge":"locket_gold","badge_tier":"gold","is_gold":true,"success":true},"result":{"badge":"locket_gold","badge_tier":"gold","is_gold":true,"success":true}}`)
}

// ponytail: recursively unblurs photos and injects gold profile flags across Locket API responses.
func RewriteLocketAPI(body []byte) []byte {
	var root any
	if err := json.Unmarshal(body, &root); err != nil {
		return body
	}

	transformNode(root)

	if m, ok := root.(map[string]any); ok {
		applyGoldBadge(m)
		if data, ok := m["data"].(map[string]any); ok {
			applyGoldBadge(data)
		}
		if res, ok := m["result"].(map[string]any); ok {
			applyGoldBadge(res)
		}
		if user, ok := m["user"].(map[string]any); ok {
			applyGoldBadge(user)
		}
	}

	cleaned, err := json.Marshal(root)
	if err != nil {
		return body
	}
	return cleaned
}

func applyGoldBadge(target map[string]any) {
	target["badge"] = "locket_gold"
	target["badge_tier"] = "gold"
	target["show_badge"] = true
	target["is_gold"] = true
	target["has_gold"] = true
	target["gold"] = true
	target["gold_subscription"] = true
	target["has_gold_subscription"] = true
	target["tier"] = "gold"
	target["subscription_status"] = "active"
}

func transformNode(node any) {
	switch v := node.(type) {
	case map[string]any:
		falseFlags := []string{
			"is_locked", "locked", "requires_gold", "require_gold",
			"gold_only", "is_gold_only", "paywall", "show_paywall",
			"blurred", "is_blurred",
		}
		for _, f := range falseFlags {
			if _, exists := v[f]; exists {
				v[f] = false
			}
		}

		trueFlags := []string{
			"can_view", "unlocked", "is_unlocked", "is_free", "free",
			"can_use_filter", "can_use_filters",
		}
		for _, t := range trueFlags {
			if _, exists := v[t]; exists {
				v[t] = true
			}
		}

		var clearURL string
		for _, k := range []string{"unblurred_url", "unlocked_url", "result_url", "transformed_image_url"} {
			if s, ok := v[k].(string); ok && strings.HasPrefix(s, "http") {
				clearURL = s
				break
			}
		}

		if clearURL != "" {
			if _, exists := v["blurred_url"]; exists {
				v["blurred_url"] = clearURL
			}
			if _, exists := v["blurred_image_url"]; exists {
				v["blurred_image_url"] = clearURL
			}
			if _, exists := v["preview_url"]; exists {
				if isBlurred, ok := v["is_blurred"].(bool); ok && isBlurred {
					v["preview_url"] = clearURL
				}
			}
		}

		if _, hasUID := v["uid"]; hasUID {
			applyGoldBadge(v)
		}

		for k, val := range v {
			if k != "badge" && k != "is_gold" {
				transformNode(val)
			}
		}

	case []any:
		for _, item := range v {
			transformNode(item)
		}
	}
}
