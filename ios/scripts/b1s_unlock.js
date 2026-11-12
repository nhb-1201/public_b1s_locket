// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * B1S UNLOCK ENGINE v2 — script MITM tổng quát của B1sTeam cho toàn bộ App Premium.
 * ───────────────────────────────────────────────────────────────────────────────
 * Một file duy nhất do B1sTeam viết, điều khiển bằng cấu hình do worker chèn vào
 * (worker thay đúng dòng `var B1S_CONFIG = { "__B1S_CONFIG__" };`):
 *
 *   var B1S_CONFIG = {
 *     "app":    "vsco",                        // slug app (chỉ để log)
 *     "mode":   "merge" | "replace" | "revenuecat",
 *     "patches": { "data.is_vip": true },      // (merge) set theo đường dẫn "a.b.0.c"
 *     "merge":   { "data": { "vip": true } },  // (merge) deep-merge object
 *     "template": { ... },                     // (replace) thay toàn bộ body
 *     "entitlements": ["pro"],                 // (revenuecat) entitlement cần bật
 *     "products":   ["video.mojo.pro.yearly"],// (revenuecat) product_id cần "đã mua"
 *     "urlRules":  [{ "match": "host", "set": { "country_code": "US" } }],
 *     "headers":   { "X-App-Region": "US" },
 *     "deleteHeaders": ["if-none-match"]
 *   };
 *
 * Nguyên tắc B1sTeam:
 *   · KHÔNG gửi dữ liệu người dùng đi đâu — mọi thay đổi diễn ra cục bộ trên máy.
 *   · License gate fail-closed: key sai / offline > 72h → trả nguyên body gốc.
 *   · Không gọi translate.google.com, không telemetry, không phone-home.
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";
var B1S_CONFIG = { "__B1S_CONFIG__": 1 };

var FAR_FUTURE = "2099-12-31T23:59:59Z";
var FAR_FUTURE_MS = 4102444800000; // 2100-01-01
var PAST = "2024-01-01T00:00:00Z";

/* ═══════════════════════ License gate (fail-closed) ═══════════════════════ */
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

function gate(doAllow, doDeny) {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return doDeny();
  if (Date.now() - lastVerifiedAt() < 259200000) return doAllow(); // 72h cache
  var id = deviceId();
  if (!id) return doDeny();

  function verifyWith(base, onDone) {
    if (typeof $httpClient === "undefined" || !$httpClient) return onDone(false);
    $httpClient.get(
      {
        url: base + "?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        },
        timeout: 10,
      },
      function (err, response, data) {
        if (err) return onDone(false);
        var body = "";
        if (typeof data === "string") body = data;
        else if (typeof data !== "undefined" && data !== null) {
          try { body = String(data); } catch (e) { return onDone(false); }
        } else if (response && typeof response.body === "string") body = response.body;
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

  verifyWith("https://locket.b1s.id.vn/api/v2/locketgold/verify", function (ok) {
    if (ok) { markVerified(); return doAllow(); }
    return doDeny();
  });
}

/* ═══════════════════════ Helpers ═══════════════════════ */
function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

/** Set giá trị theo đường dẫn "a.b.0.c"; "*" = áp dụng cho mọi phần tử mảng. */
function setPath(root, path, value) {
  var parts = String(path).split(".");
  var node = root;
  for (var i = 0; i < parts.length - 1; i++) {
    var key = parts[i];
    var nextKey = parts[i + 1];
    if (Array.isArray(node)) {
      if (key === "*") {
        for (var a = 0; a < node.length; a++) setPath(node[a], parts.slice(i + 1).join("."), value);
        return true;
      }
      var idx = parseInt(key, 10);
      if (isNaN(idx) || idx < 0 || idx >= node.length) return false;
      node = node[idx];
      continue;
    }
    if (!isObject(node)) return false;
    if (!Object.prototype.hasOwnProperty.call(node, key)) {
      node[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    node = node[key];
  }
  var last = parts[parts.length - 1];
  if (Array.isArray(node)) {
    if (last === "*") {
      for (var b = 0; b < node.length; b++) node[b] = value;
      return true;
    }
    var li = parseInt(last, 10);
    if (isNaN(li) || li < 0 || li >= node.length) return false;
    node[li] = value;
    return true;
  }
  if (!isObject(node)) return false;
  node[last] = value;
  return true;
}

/** Deep-merge object (mảng bị thay thế, không nối). */
function deepMerge(target, src) {
  if (!isObject(src)) return target;
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    var v = src[k];
    if (isObject(v)) {
      if (!isObject(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

/** RevenueCat: bật entitlement + giả product "đã mua" (vĩnh viễn).
 *  B1sTeam: bật TẤT CẢ entitlement/subscription đang có sẵn trong response (không cần đoán
 *  tên product) + thêm các tên được cấu hình để app tự nhận ra gói. */
function applyRevenueCat(obj, cfg) {
  if (!isObject(obj)) return false;
  var sub = isObject(obj.subscriber) ? obj.subscriber : null;
  if (!sub) return false;
  var far = cfg.farFuture || FAR_FUTURE;
  var ents = isObject(sub.entitlements) ? sub.entitlements : (sub.entitlements = {});
  var subs = isObject(sub.subscriptions) ? sub.subscriptions : (sub.subscriptions = {});
  var non = isObject(sub.non_subscriptions) ? sub.non_subscriptions : (sub.non_subscriptions = {});

  function activateEntitlement(name) {
    var cur = isObject(ents[name]) ? ents[name] : {};
    cur.expires_date = far;
    cur.expiration_date = far;
    if (!cur.purchase_date) cur.purchase_date = PAST;
    if (!cur.original_purchase_date) cur.original_purchase_date = PAST;
    cur.is_active = true;
    cur.active = true;
    ents[name] = cur;
  }
  function activateProduct(pid) {
    var s = isObject(subs[pid]) ? subs[pid] : {};
    s.ownership_type = "PURCHASED";
    s.store = "app_store";
    s.is_sandbox = false;
    s.expires_date = far;
    if (!s.purchase_date) s.purchase_date = PAST;
    if (!s.original_purchase_date) s.original_purchase_date = PAST;
    s.billing_issues_detected_at = null;
    s.unsubscribe_detected_at = null;
    subs[pid] = s;
    non[pid] = { purchase_date: s.purchase_date, original_purchase_date: s.original_purchase_date, expires_date: far };
  }

  // 1) Bật mọi entitlement đang có trong response
  for (var existing in ents) {
    if (!Object.prototype.hasOwnProperty.call(ents, existing)) continue;
    activateEntitlement(existing);
  }
  // 2) Bật mọi subscription đang có trong response
  for (var exSub in subs) {
    if (!Object.prototype.hasOwnProperty.call(subs, exSub)) continue;
    activateProduct(exSub);
  }
  // 3) Thêm các tên được cấu hình (app tự nhận gói dù server chưa trả về)
  var list = cfg.entitlements || [];
  for (var i = 0; i < list.length; i++) activateEntitlement(list[i]);
  var products = cfg.products || [];
  for (var j = 0; j < products.length; j++) activateProduct(products[j]);

  sub.management_url = null;
  return true;
}

/** Ép mọi key khớp regex → giá trị cố định (đệ quy toàn payload). */
function applyForce(node, rules, depth) {
  if (!node || typeof node !== "object" || (depth || 0) > 12) return false;
  var changed = false;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      if (applyForce(node[i], rules, (depth || 0) + 1)) changed = true;
    }
    return changed;
  }
  for (var key in node) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
    var value = node[key];
    if (value && typeof value === "object") {
      if (applyForce(value, rules, (depth || 0) + 1)) changed = true;
      continue;
    }
    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r];
      if (!rule || !rule.pattern) continue;
      var re;
      try { re = new RegExp(rule.pattern, "i"); } catch (e) { continue; }
      if (!re.test(String(key))) continue;
      var target = rule.value;
      if (rule.untilFar && typeof target === "number") target = FAR_FUTURE_MS;
      if (value !== target) { node[key] = target; changed = true; }
      break;
    }
  }
  return changed;
}

/* ═══════════════════════ REQUEST phase ═══════════════════════ */
function applyUrlRules(url) {
  var rules = B1S_CONFIG.urlRules || [];
  if (!rules.length || !url) return url;
  var out = url;
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (!r) continue;
    var match = String(r.match || "");
    if (!match || out.indexOf(match) === -1) continue;
    if (r.replace) {
      out = out.split(String(r.replace[0])).join(String(r.replace[1]));
    }
    if (r.set && isObject(r.set)) {
      var qIdx = out.indexOf("?");
      var base = qIdx === -1 ? out : out.slice(0, qIdx);
      var query = qIdx === -1 ? "" : out.slice(qIdx + 1);
      var pairs = query.length ? query.split("&") : [];
      for (var k in r.set) {
        if (!Object.prototype.hasOwnProperty.call(r.set, k)) continue;
        var found = false;
        for (var p = 0; p < pairs.length; p++) {
          if (pairs[p].split("=")[0] === k) {
            pairs[p] = k + "=" + encodeURIComponent(String(r.set[k]));
            found = true;
            break;
          }
        }
        if (!found) pairs.push(k + "=" + encodeURIComponent(String(r.set[k])));
      }
      out = base + (pairs.length ? "?" + pairs.join("&") : "");
    }
  }
  return out;
}

function applyRequestPhase() {
  var result = {};
  var url = ($request && $request.url) ? String($request.url) : "";
  var newUrl = applyUrlRules(url);
  if (newUrl && newUrl !== url) result.url = newUrl;

  var headers = {};
  var src = ($request && $request.headers) ? $request.headers : {};
  var del = B1S_CONFIG.deleteHeaders || [];
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    var lk = String(k).toLowerCase();
    var skip = false;
    for (var d = 0; d < del.length; d++) {
      if (String(del[d]).toLowerCase() === lk) { skip = true; break; }
    }
    if (skip) continue;
    headers[k] = src[k];
  }
  var setH = B1S_CONFIG.headers || {};
  for (var h in setH) {
    if (!Object.prototype.hasOwnProperty.call(setH, h)) continue;
    headers[h] = setH[h];
  }
  result.headers = headers;
  $done(result);
}

/* ═══════════════════════ RESPONSE phase ═══════════════════════ */

/** Chọn cấu hình hiệu lực: variant đầu tiên có "match" nằm trong URL, không thì dùng config gốc. */
function resolveConfig() {
  var variants = B1S_CONFIG.variants || [];
  if (variants.length) {
    var url = ($request && $request.url) ? String($request.url) : "";
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (!v || !v.match) continue;
      if (url.indexOf(String(v.match)) !== -1) {
        // Variant kế thừa các field chung của config gốc
        var merged = {};
        for (var k in B1S_CONFIG) {
          if (!Object.prototype.hasOwnProperty.call(B1S_CONFIG, k)) continue;
          if (k === "variants") continue;
          merged[k] = B1S_CONFIG[k];
        }
        for (var kv in v) {
          if (!Object.prototype.hasOwnProperty.call(v, kv)) continue;
          merged[kv] = v[kv];
        }
        return merged;
      }
    }
  }
  return B1S_CONFIG;
}

function applyResponsePhase() {
  var body = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";
  if (!body || typeof body !== "string") { $done({}); return; }

  var cfg = resolveConfig();
  var mode = cfg.mode || "merge";
  var status = ($response && ($response.status || $response.statusCode)) || 200;

  try {
    if (mode === "replace") {
      var tpl = cfg.template;
      if (!isObject(tpl)) { $done({}); return; }
      $done({ status: status, body: JSON.stringify(tpl) });
      return;
    }

    var obj = JSON.parse(body);
    var changed = false;

    if (mode === "revenuecat") {
      if (applyRevenueCat(obj, cfg)) changed = true;
    }

    var patches = cfg.patches || {};
    for (var p in patches) {
      if (!Object.prototype.hasOwnProperty.call(patches, p)) continue;
      if (setPath(obj, p, patches[p])) changed = true;
    }

    if (cfg.merge) {
      deepMerge(obj, cfg.merge);
      changed = true;
    }

    if (cfg.force && cfg.force.length) {
      if (applyForce(obj, cfg.force, 0)) changed = true;
    }

    if (!changed) { $done({}); return; }
    $done({ status: status, body: JSON.stringify(obj) });
  } catch (e) {
    $done({});
  }
}

/* ═══════════════════════ Entry point ═══════════════════════ */
var IS_REQUEST_PHASE = (typeof $response === "undefined");

if (IS_REQUEST_PHASE) {
  gate(
    function () { applyRequestPhase(); },
    function () { $done({}); }
  );
} else {
  gate(
    function () { applyResponsePhase(); },
    function () { $done({}); }
  );
}
