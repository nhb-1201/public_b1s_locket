// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam v3.0 — RevenueCat Unlock
 * Gắn entitlement `locket_gold` vĩnh viễn (hết hạn 9999-12-31T23:59:00Z).
 * Chỉ xử lý response body JSON; mọi lỗi parse đều fail-open (trả body gốc).
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var PURCHASE_DATE = "2024-01-01T08:30:00Z";
var EXPIRES_DATE = "9999-12-31T23:59:00Z";
var PRODUCT_ID = "com.locketgold.vip_yearly";

var body = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";

var obj;
try {
  obj = JSON.parse(body);
  if (!obj || typeof obj !== "object") obj = {};
} catch (e) {
  obj = {};
}

if (!obj.subscriber || typeof obj.subscriber !== "object") {
  obj.subscriber = {};
}

var subscriber = obj.subscriber;
subscriber.entitlements = (subscriber.entitlements && typeof subscriber.entitlements === "object") ? subscriber.entitlements : {};
subscriber.subscriptions = (subscriber.subscriptions && typeof subscriber.subscriptions === "object") ? subscriber.subscriptions : {};

var vipInfo = {
  expires_date: EXPIRES_DATE,
  original_purchase_date: PURCHASE_DATE,
  purchase_date: PURCHASE_DATE,
  ownership_type: "PURCHASED",
  store: "app_store",
  period_type: "normal",
  unsubscribe_detected_at: null,
  billing_issues_detected_at: null,
  grace_period_expires_date: null
};

// Gói đăng ký chính
subscriber.subscriptions[PRODUCT_ID] = vipInfo;

// Toàn bộ alias entitlement phổ biến của Locket (cover mọi naming)
subscriber.entitlements["locket_gold"] = vipInfo;
subscriber.entitlements[PRODUCT_ID] = vipInfo;
subscriber.entitlements["gold"] = vipInfo;

$done({ body: JSON.stringify(obj) });
