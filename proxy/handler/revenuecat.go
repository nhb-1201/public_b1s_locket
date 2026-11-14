package handler

import (
	"encoding/json"
)

// ponytail: static production Gold subscription payload verified with Locket iOS StoreKit.
func InjectRevenueCat(body []byte) ([]byte, error) {
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		raw = make(map[string]any)
	}

	subscriber, ok := raw["subscriber"].(map[string]any)
	if !ok || subscriber == nil {
		subscriber = make(map[string]any)
	}

	subscriptions, ok := subscriber["subscriptions"].(map[string]any)
	if !ok || subscriptions == nil {
		subscriptions = make(map[string]any)
	}

	entitlements, ok := subscriber["entitlements"].(map[string]any)
	if !ok || entitlements == nil {
		entitlements = make(map[string]any)
	}

	expireDate := "9999-01-09T10:10:14Z"
	purchaseDate := "2024-01-01T00:00:00Z"

	goldSub := map[string]any{
		"auto_resume_date":           nil,
		"display_name":               "locket_1600_1y",
		"is_sandbox":                 false,
		"ownership_type":             "PURCHASED",
		"billing_issues_detected_at": nil,
		"management_url":             "https://apps.apple.com/account/subscriptions",
		"period_type":                "normal",
		"price": map[string]any{
			"amount":   399000.0,
			"currency": "VND",
		},
		"expires_date":              expireDate,
		"grace_period_expires_date": nil,
		"refunded_at":               nil,
		"unsubscribe_detected_at":   nil,
		"original_purchase_date":    purchaseDate,
		"purchase_date":             purchaseDate,
		"store":                     "app_store",
		"store_transaction_id":      "2000001108724193",
	}

	goldEntitlement := map[string]any{
		"grace_period_expires_date": nil,
		"purchase_date":             purchaseDate,
		"product_identifier":        "locket_1600_1y",
		"expires_date":              expireDate,
	}

	// Full subscriptions coverage
	subscriptions["locket_1600_1y"] = goldSub
	subscriptions["com.locket02.premium.yearly"] = goldSub
	subscriptions["locket_199_1m"] = goldSub
	subscriptions["locket.premium.yearly"] = goldSub

	// Full entitlements coverage
	entitlements["Gold"] = goldEntitlement
	entitlements["gold"] = goldEntitlement
	entitlements["pro"] = goldEntitlement
	entitlements["premium"] = goldEntitlement
	entitlements["locket_gold"] = goldEntitlement

	subscriber["subscriptions"] = subscriptions
	subscriber["entitlements"] = entitlements
	raw["subscriber"] = subscriber
	raw["Attention"] = "B1sTeam Activated (Gold Lifetime)!"

	return json.Marshal(raw)
}
