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

var PURCHASE_DATE = "2024-01-01T08:30:00Z";
var EXPIRES_DATE = "9999-12-31T23:59:00Z";
var PRODUCT_ID = "com.locketgold.vip_yearly";

var rawBody = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";

/* ── Device id bền trên máy này (tạo 1 lần) ── */
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
  return null;
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

  subscriber.subscriptions[PRODUCT_ID] = vipInfo;
  subscriber.entitlements["locket_gold"] = vipInfo;
  subscriber.entitlements[PRODUCT_ID] = vipInfo;
  subscriber.entitlements["gold"] = vipInfo;

  return JSON.stringify(obj);
}

function unlock() { $done({ body: injectGold(rawBody) }); }
function deny() { $done({ body: rawBody }); }

/* ── License gate: key + device phải khớp ── */
(function gate() {
  // Không có key (module chung chưa cá nhân hóa) → không bơm Gold
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return deny();

  // Cache verify gần đây (72h) — dùng offline
  if (Date.now() - lastVerifiedAt() < 259200000) return unlock();

  var id = deviceId();
  if (!id) return deny();

  if (typeof $httpClient !== "undefined" && $httpClient) {
    $httpClient.get(
      {
        url: "https://b1s.id.vn/api/locketgold/verify?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
        timeout: 10
      },
      function (err, resp) {
        if (err || !resp || !resp.body) return deny();
        try {
          var j = JSON.parse(resp.body);
          if (j && j.valid === true) {
            markVerified();
            return unlock();
          }
          return deny();
        } catch (e) {
          return deny();
        }
      }
    );
    return; // chờ callback
  }

  // Môi trường script không hỗ trợ HTTP → fail-closed
  return deny();
})();
