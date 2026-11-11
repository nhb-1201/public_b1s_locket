// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — RevenueCat Unlock (DEVICE-LOCKED)
 *
 * Gắn với ĐÚNG 1 thiết bị:
 *   · Script chỉ bơm entitlement locket_gold khi:
 *       1. Module được cá nhân hóa bởi bạn (license key nhúng lúc bạn cài), VÀ
 *       2. Thiết bị hiện tại gọi /verify thành công (khớp license_key + device_id).
 *   · Device id lưu bền trong app (Shadowrocket: $prefs; Loon/QuantumultX: $persistentStore)
 *     → không trùng giữa các máy → không ám ảnh chéo.
 *   · Cache "đã verify OK" 72 giờ để dùng offline; hết cache hoặc key sai/khác máy → trả body gốc (không Gold).
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

// Giữ đúng để worker /script/* thay thế bằng key thật (của bạn — đừng chia sẻ)
var LICENSE_KEY = "__LICENSE_KEY__";

// Entitlement mà app Locket đọc là "Gold" (capture thật 2026-04: entitlements.Gold, product_identifier locket_1600_1y).
// Giữ thêm các biến thể cũ (locket_gold / gold / com.locketgold.vip_yearly) để tương thích mọi bản app.
var PURCHASE_DATE = "2005-01-09T10:10:14Z";
var EXPIRES_DATE = "9999-12-31T23:59:59Z";
var PRODUCT_ID = "locket_1600_1y";
var PRODUCT_ID_MONTHLY = "locket_199_1m";

var rawBody = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";

/* ── Device id bền trên máy này (tạo 1 lần) ── */
var memDeviceId = null;
function deviceId() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) {
      var id1 = $prefs.valueForKey("b1s_lg_device_id");
      if (id1) return id1;
      id1 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $prefs.setValueForKey(id1, "b1s_lg_device_id");
      return id1;
    }
  } catch (e) { /* tiếp tục */ }
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var id2 = $persistentStore.read("b1s_lg_device_id");
      if (id2) return id2;
      id2 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $persistentStore.write(id2, "b1s_lg_device_id");
      return id2;
    }
  } catch (e) { /* tiếp tục */ }
  // Fallback in-memory khi store lỗi — KHÔNG deny cứng
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
}

function lastVerifiedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey("b1s_lg_ok_at") || 0);
  } catch (e) { /* bỏ qua */ }
  return 0;
}
function markVerified() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), "b1s_lg_ok_at");
  } catch (e) { /* bỏ qua */ }
}

function injectGold(body) {
  var obj;
  try {
    obj = JSON.parse(body);
    if (!obj || typeof obj !== "object") obj = {};
  } catch (e) {
    obj = {};
  }

  if (!obj.subscriber || typeof obj.subscriber !== "object") obj.subscriber = {};
  var subscriber = obj.subscriber;
  subscriber.entitlements = (subscriber.entitlements && typeof subscriber.entitlements === "object") ? subscriber.entitlements : {};
  subscriber.subscriptions = (subscriber.subscriptions && typeof subscriber.subscriptions === "object") ? subscriber.subscriptions : {};

  var entitlementInfo = {
    expires_date: EXPIRES_DATE,
    original_purchase_date: PURCHASE_DATE,
    purchase_date: PURCHASE_DATE,
    product_identifier: PRODUCT_ID,
    ownership_type: "PURCHASED",
    store: "app_store",
    period_type: "normal",
    is_sandbox: false,
    unsubscribe_detected_at: null,
    billing_issues_detected_at: null,
    grace_period_expires_date: null
  };

  var subscriptionInfo = {
    expires_date: EXPIRES_DATE,
    original_purchase_date: PURCHASE_DATE,
    purchase_date: PURCHASE_DATE,
    ownership_type: "PURCHASED",
    store: "app_store",
    period_type: "normal",
    is_sandbox: false,
    display_name: PRODUCT_ID,
    auto_resume_date: null,
    refunded_at: null,
    management_url: "https://apps.apple.com/account/subscriptions",
    unsubscribe_detected_at: null,
    billing_issues_detected_at: null,
    grace_period_expires_date: null
  };

  subscriber.subscriptions[PRODUCT_ID] = subscriptionInfo;
  subscriber.subscriptions[PRODUCT_ID_MONTHLY] = subscriptionInfo;

  // "Gold" (capitalized) = key thật app Locket đọc; các biến thể còn lại cho bản app khác
  var ENTITLEMENTS = ["Gold", "locket_gold", "gold", PRODUCT_ID, "locket.premium.yearly", "com.locketgold.vip_yearly"];
  for (var i = 0; i < ENTITLEMENTS.length; i++) {
    subscriber.entitlements[ENTITLEMENTS[i]] = entitlementInfo;
  }

  return JSON.stringify(obj);
}

function unlock() { $done({ body: injectGold(rawBody) }); }
function deny() { $done({ body: rawBody }); }

/* ── License gate: key + device phải khớp ── */
(function gate() {
  console.log("[locketgold] revenuecat: fired | key len=" + String(LICENSE_KEY || "").length);
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) { console.log("[locketgold] revenuecat: DENY (bad key)"); return deny(); }

  console.log("[locketgold] revenuecat: gate | cache=" + (Date.now() - lastVerifiedAt() < 259200000 ? "HIT" : "MISS"));
  if (Date.now() - lastVerifiedAt() < 259200000) { console.log("[locketgold] revenuecat: UNLOCK via cache"); return unlock(); }

  var id = deviceId();
  if (!id) { console.log("[locketgold] revenuecat: DENY (no device id)"); return deny(); }

  // Thử lần lượt 2 endpoint — zone b1s.id.vn có thể chặn app proxy lạ (WAF),
  // workers.dev luôn trả lời trực tiếp. Cả hai verify cùng 1 license.
  // ⚠️ Shadowrocket/Loon API: callback(errormsg, response, data) — data chính là body (String).
  function verifyWith(base, onDone) {
    if (typeof $httpClient === "undefined" || !$httpClient) return onDone(false);
    $httpClient.get(
      {
        url: base + "?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
        timeout: 10
      },
      function (err, response, data) {
        if (err) return onDone(false);
        var body = "";
        if (typeof data === "string") body = data;
        else if (typeof data !== "undefined" && data !== null) { try { body = String(data); } catch (e) { return onDone(false); } }
        else if (response && typeof response.body === "string") body = response.body; // tương thích ngược
        if (!body) return onDone(false);
        try {
          var j = JSON.parse(body);
          return onDone(Boolean(j && j.valid === true));
        } catch (e) {
          return onDone(false);
        }
      }
    );
  }
  verifyWith("https://b1s.id.vn/api/locketgold/verify", function (okPrimary) {
    console.log("[locketgold] revenuecat: verify b1s.id.vn = " + okPrimary);
    if (okPrimary) {
      markVerified();
      console.log("[locketgold] revenuecat: UNLOCK (primary) — Gold sẽ được bơm");
      return unlock();
    }
    verifyWith("https://locketgold-backend.nhb-120111.workers.dev/api/v2/locketgold/verify", function (okFallback) {
      console.log("[locketgold] revenuecat: verify workers.dev = " + okFallback);
      if (okFallback) {
        markVerified();
        console.log("[locketgold] revenuecat: UNLOCK (fallback) — Gold sẽ được bơm");
        return unlock();
      }
      console.log("[locketgold] revenuecat: DENY (verify failed)");
      return deny();
    });
  });
})();
