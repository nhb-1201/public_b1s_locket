package handler

import "encoding/json"

// GoldExpiresDate la ngay het han "vinh vien" (nam 9999) cho entitlement.
const GoldExpiresDate = "9999-01-09T10:10:14Z"

// GoldPurchaseDate la ngay mua gia lap (fix de moi lan inject deu giong nhau).
const GoldPurchaseDate = "2024-01-01T00:00:00Z"

// GoldAttentionMessage la thong bao gan vao response RevenueCat.
const GoldAttentionMessage = "B1sTeam Activated (Gold Lifetime)!"

// GoldProductIDs la danh sach product id Locket dang kiem tra.
var GoldProductIDs = []string{
	"locket_1600_1y",
	"locket_199_1m",
	"locket.premium.yearly",
	"com.locket02.premium.yearly",
	"locket_gold_lifetime",
}

// GoldEntitlementKeys la danh sach entitlement key can mo khoa.
var GoldEntitlementKeys = []string{
	"Gold",
	"gold",
	"pro",
	"premium",
	"locket_gold",
}

// InjectRevenueCat them entitlement Gold vĩnh viễn vao response RevenueCat.
//
// Ham phai IDEMPOTENT: inject 2 lan cho cung 1 input se cho ra 2 output giống
// hệt nhau (dung de proxy chay nhiều lớp hoặc app retry).
func InjectRevenueCat(body []byte) ([]byte, error) {
	root, err := decodeObject(body)
	if err != nil {
		return nil, err
	}

	subscriber := childObject(root, "subscriber")
	subscriptions := childObject(subscriber, "subscriptions")
	entitlements := childObject(subscriber, "entitlements")

	for _, productID := range GoldProductIDs {
		subscriptions[productID] = goldSubscription(productID)
	}
	for _, key := range GoldEntitlementKeys {
		entitlements[key] = goldEntitlement(key)
	}

	subscriber["subscriptions"] = subscriptions
	subscriber["entitlements"] = entitlements
	root["subscriber"] = subscriber
	root["Attention"] = GoldAttentionMessage

	return json.Marshal(root)
}

// goldSubscription tao object subscription cho 1 product id.
func goldSubscription(productID string) map[string]any {
	return map[string]any{
		"auto_resume_date":           nil,
		"billing_issues_detected_at": nil,
		"display_name":               productID,
		"expires_date":               GoldExpiresDate,
		"grace_period_expires_date":  nil,
		"is_sandbox":                 false,
		"management_url":              "https://apps.apple.com/account/subscriptions",
		"original_purchase_date":      GoldPurchaseDate,
		"ownership_type":             "PURCHASED",
		"period_type":                "normal",
		"price": map[string]any{
			"amount":   399000,
			"currency": "VND",
		},
		"purchase_date":           GoldPurchaseDate,
		"refunded_at":             nil,
		"store":                   "app_store",
		"store_transaction_id":    "2000001108724193",
		"unsubscribe_detected_at": nil,
	}
}

// goldEntitlement tao object entitlement cho 1 entitlement key.
func goldEntitlement(key string) map[string]any {
	products := make([]string, 0, len(GoldProductIDs))
	products = append(products, GoldProductIDs...)

	return map[string]any{
		"entitlement_id":           key,
		"expires_date":             GoldExpiresDate,
		"grace_period_expires_date": nil,
		"is_sandbox":               false,
		"ownership_type":           "PURCHASED",
		"period_type":              "normal",
		"product_identifier":       GoldProductIDs[0],
		"product_identifiers":      products,
		"purchase_date":            GoldPurchaseDate,
		"store":                    "app_store",
	}
}

// decodeObject parse JSON object (tra loi neu body khong phai object hop le).
func decodeObject(body []byte) (map[string]any, error) {
	if len(body) == 0 {
		return map[string]any{}, nil
	}
	var root map[string]any
	if err := json.Unmarshal(body, &root); err != nil {
		return nil, err
	}
	if root == nil {
		root = map[string]any{}
	}
	return root, nil
}

// childObject lay (hoac tao) object con tu mot map.
func childObject(parent map[string]any, key string) map[string]any {
	if parent == nil {
		return map[string]any{}
	}
	if child, ok := parent[key].(map[string]any); ok && child != nil {
		return child
	}
	child := map[string]any{}
	parent[key] = child
	return child
}
