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
	// Non_subscriptions — lịch sử mua vĩnh viễn (Locket kiểm tra thêm key này)
	non_subscriptions := childObject(subscriber, "non_subscriptions")
	for _, productID := range GoldProductIDs {
		non_subscriptions[productID] = []map[string]any{
			{
				"purchase_date":           GoldPurchaseDate,
				"original_purchase_date":  GoldPurchaseDate,
				"expires_date":            GoldExpiresDate,
				"ownership_type":          "PURCHASED",
				"store":                   "app_store",
				"is_sandbox":              false,
			},
		}
	}

	// Gỡ management_url — không cho app nhảy sang trang quản lý subscription của Apple.
	subscriber["management_url"] = nil
	subscriber["first_seen"] = GoldPurchaseDate
	subscriber["original_purchase_date"] = GoldPurchaseDate
	subscriber["original_app_user_id"] = "b1steam-gold"
	subscriber["original_application_version"] = "1600"
	subscriber["original_platform"] = "ios"

	subscriber["subscriptions"] = subscriptions
	subscriber["entitlements"] = entitlements
	subscriber["non_subscriptions"] = non_subscriptions
	root["subscriber"] = subscriber
	root["Attention"] = GoldAttentionMessage
	root["attention_banner"] = map[string]any{
		"type":        "info",
		"title":       "B1sTeam — LocketGold",
		"body":        "Chúc mừng! Bạn đã nâng cấp Locket Gold vĩnh viễn — B1sTeam (b1s.id.vn · @b1steam).",
		"icon":        "https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/locket_gold.jpg",
		"dismissible": false,
		"show_once":   false,
		"version":     "4.0.0",
	}

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
