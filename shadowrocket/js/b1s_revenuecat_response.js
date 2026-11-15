// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_revenuecat_response.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — RevenueCat RESPONSE phase — bơm Gold vĩnh viễn.
 *
 * MỤC TIÊU:
 *   Chèn entitlement + subscription "đã mua" vào JSON của RevenueCat để app Locket
 *   tự nhận ra gói Gold (huy hiệu, camera 60s, caption VIP, khung premium…).
 *
 *   · subscriber.entitlements  — Gold / gold / locket_gold / premium / pro / membership …
 *   · subscriber.subscriptions  — locket_1600_1y / locket_199_1m / locket.premium.yearly …
 *   · subscriber.non_subscriptions — bản sao lịch sử mua
 *   · Attention                — banner thông báo B1sTeam (app hiển thị trong app)
 *
 * YÊU CẦU KỸ THUẬT:
 *   · IDEMPOTENT — chạy nhiều lần cho ra CÙNG một kết quả (mọi ngày đều là hằng số).
 *   · Body KHÔNG phải JSON ⇒ dùng {} rồi vẫn trả payload hợp lệ (không làm app đứt).
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ body gốc đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  var FAR_FUTURE = "2099-12-31T23:59:59Z";
  var PAST = "2024-01-01T00:00:00Z";

  /* Entitlement Locket thật (đồng bộ B1sTeam ios/src/_b1s_unlock_configs.fragment.js) */
  var ENTITLEMENTS = [
    "Gold", "gold", "locket_gold", "locket.premium.yearly",
    "com.locketgold.vip_yearly", "membership", "premium", "pro"
  ];

  /* Product id Locket thật */
  var PRODUCTS = [
    "locket_1600_1y", "locket_199_1m", "locket.premium.yearly",
    "com.locket02.premium.yearly", "locket_gold"
  ];

  var ATTENTION_TEXT = "LocketGold (Free) — B1sTeam: Gold vĩnh viễn đã kích hoạt. b1s.id.vn · @b1steam";

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  function b1sLog(msg) {
    try { console.log("[locketgold] rc-response: " + msg); } catch (e) { /* ignore */ }
  }

  /** Bật 1 entitlement (idempotent — mọi field gán giá trị hằng). */
  function activateEntitlement(ents, name) {
    var cur = isObject(ents[name]) ? ents[name] : {};
    cur.expires_date = FAR_FUTURE;
    cur.expiration_date = FAR_FUTURE;
    cur.purchase_date = PAST;
    cur.original_purchase_date = PAST;
    cur.is_active = true;
    cur.active = true;
    cur.ownership_type = "PURCHASED";
    cur.store = "app_store";
    cur.period_type = "normal";
    cur.is_sandbox = false;
    cur.unsubscribe_detected_at = null;
    cur.billing_issues_detected_at = null;
    cur.grace_period_expires_date = null;
    cur.product_identifier = name;
    ents[name] = cur;
  }

  /** Bật 1 subscription + non_subscription (idempotent). */
  function activateProduct(subs, non, pid) {
    var s = isObject(subs[pid]) ? subs[pid] : {};
    s.ownership_type = "PURCHASED";
    s.store = "app_store";
    s.is_sandbox = false;
    s.expires_date = FAR_FUTURE;
    s.purchase_date = PAST;
    s.original_purchase_date = PAST;
    s.period_type = "normal";
    s.display_name = pid;
    s.auto_resume_date = null;
    s.refunded_at = null;
    s.billing_issues_detected_at = null;
    s.unsubscribe_detected_at = null;
    s.grace_period_expires_date = null;
    if (!isObject(s.price)) s.price = { amount: 0, currency: "VND" };
    subs[pid] = s;

    non[pid] = {
      purchase_date: PAST,
      original_purchase_date: PAST,
      expires_date: FAR_FUTURE,
      ownership_type: "PURCHASED",
      store: "app_store",
      is_sandbox: false
    };
  }

  try {
    if (typeof $done !== "function") return;

    /* ── Đọc body (JSON string hoặc object) — body hỏng ⇒ {} ── */
    var obj = {};
    try {
      var raw = (typeof $response !== "undefined" && $response) ? $response.body : null;
      if (typeof raw === "string" && raw.length) {
        obj = JSON.parse(raw);
      } else if (isObject(raw)) {
        obj = raw;
      }
      if (!isObject(obj)) obj = {};
    } catch (e) {
      obj = {};
    }

    var sub = isObject(obj.subscriber) ? obj.subscriber : (obj.subscriber = {});
    var ents = isObject(sub.entitlements) ? sub.entitlements : (sub.entitlements = {});
    var subs = isObject(sub.subscriptions) ? sub.subscriptions : (sub.subscriptions = {});
    var non = isObject(sub.non_subscriptions) ? sub.non_subscriptions : (sub.non_subscriptions = {});

    /* 1) Bật TẤT CẢ entitlement/subscription đã có sẵn trong response */
    var existing;
    for (existing in ents) {
      if (!hasOwn(ents, existing)) continue;
      activateEntitlement(ents, existing);
    }
    for (existing in subs) {
      if (!hasOwn(subs, existing)) continue;
      activateProduct(subs, non, existing);
    }

    /* 2) Bật các tên Locket dùng thật (server chưa trả cũng vẫn có) */
    var i;
    for (i = 0; i < ENTITLEMENTS.length; i++) activateEntitlement(ents, ENTITLEMENTS[i]);
    for (i = 0; i < PRODUCTS.length; i++) activateProduct(subs, non, PRODUCTS[i]);

    /* 3) Dọn "Manage subscription" + dấu vết lỗi (app không hiện paywall) */
    sub.management_url = null;
    try { delete sub.management_url_cached; } catch (e) { /* ignore */ }
    if (isObject(obj.error)) obj.error = null;
    if (isObject(obj.errors)) obj.errors = null;

    /* 4) first_seen / original_purchase_date — chỉ điền khi thiếu (idempotent) */
    if (!sub.first_seen) sub.first_seen = PAST;
    if (!sub.original_purchase_date) sub.original_purchase_date = PAST;
    if (!sub.original_app_user_id) sub.original_app_user_id = "b1steam-gold";
    if (!sub.original_application_version) sub.original_application_version = "1600";
    if (!sub.original_platform) sub.original_platform = "ios";

    /* 5) Banner Attention của B1sTeam */
    obj.Attention = ATTENTION_TEXT;
    obj.attention_banner = {
      type: "info",
      title: "B1sTeam — LocketGold",
      body: "Chúc mừng! Gold vĩnh viễn đã kích hoạt trên máy của bạn (B1sTeam — b1s.id.vn · @b1steam).",
      icon: "https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/locket_gold.jpg",
      dismissible: false,
      show_once: false,
      version: B1S_VERSION,
      updated: B1S_UPDATED
    };

    b1sLog("Gold vĩnh viễn: " + ENTITLEMENTS.length + " entitlement · " + PRODUCTS.length + " product");

    $done({
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(obj)
    });
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
