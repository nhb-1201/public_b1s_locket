// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * B1S UNLOCK ENGINE v3 — script MITM tổng quát của B1sTeam cho toàn bộ App Premium.
 * ───────────────────────────────────────────────────────────────────────────────
 * Một file duy nhất do B1sTeam viết. Cấu hình app được CHỌN THEO SLUG qua $argument
 * ("KEY|slug"), hoặc worker vá 2 dòng placeholder cho module cũ (tương thích ngược):
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
 *   · License gate fail-closed (xem lib/license-gate.js): key sai / offline quá hạn → trả nguyên body gốc.
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";
var B1S_CONFIG = { "__B1S_CONFIG__": 1 };

// @b1s-include ./_b1s_unlock_configs.fragment.js

// @b1s-include ./lib/cdn-arg.js

var FAR_FUTURE = "2099-12-31T23:59:59Z";
var FAR_FUTURE_MS = 4102444800000; // 2100-01-01
var PAST = "2024-01-01T00:00:00Z";

// @b1s-include ./lib/license-gate.js

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

/** Deep-merge object (mảng bị THAY THẾ, không nối). */
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

/**
 * RevenueCat: bật entitlement + giả product "đã mua" (vĩnh viễn).
 * Bật TẤT CẢ entitlement/subscription đang có sẵn trong response (không cần đoán tên)
 * + thêm các tên được cấu hình để app tự nhận ra gói.
 * B1sTeam: "Thành viên kể từ hôm nay" — ghi đè purchase/first_seen thành NGÀY HIỆN TẠI (động).
 */
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
    cur.ownership_type = "PURCHASED";
    cur.store = "app_store";
    cur.period_type = "normal";
    cur.is_sandbox = false;
    cur.unsubscribe_detected_at = null;
    cur.billing_issues_detected_at = null;
    cur.grace_period_expires_date = null;
    if (!cur.product_identifier) cur.product_identifier = name;
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
    s.period_type = "normal";
    s.display_name = pid;
    s.auto_resume_date = null;
    s.refunded_at = null;
    s.billing_issues_detected_at = null;
    s.unsubscribe_detected_at = null;
    s.grace_period_expires_date = null;
    subs[pid] = s;
    non[pid] = {
      purchase_date: s.purchase_date,
      original_purchase_date: s.original_purchase_date,
      expires_date: far,
      ownership_type: "PURCHASED",
      store: "app_store",
      is_sandbox: false,
    };
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

  // ── Badge "Thành viên kể từ …" đọc các field này → ghi ĐÈ thành hôm nay (động).
  var TODAY = new Date().toISOString();
  try { if (isObject(sub)) sub.first_seen = TODAY; } catch (e) {}
  try { if (isObject(sub)) sub.original_purchase_date = TODAY; } catch (e) {}
  var _k;
  for (_k in ents) {
    if (!Object.prototype.hasOwnProperty.call(ents, _k)) continue;
    if (!isObject(ents[_k])) continue;
    ents[_k].purchase_date = TODAY;
    ents[_k].original_purchase_date = TODAY;
  }
  for (_k in subs) {
    if (!Object.prototype.hasOwnProperty.call(subs, _k)) continue;
    if (!isObject(subs[_k])) continue;
    subs[_k].purchase_date = TODAY;
    subs[_k].original_purchase_date = TODAY;
  }
  for (_k in non) {
    if (!Object.prototype.hasOwnProperty.call(non, _k)) continue;
    if (!isObject(non[_k])) continue;
    non[_k].purchase_date = TODAY;
    non[_k].original_purchase_date = TODAY;
  }

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

/**
 * Tổng hợp payload subscriber "đang trả phí" HOÀN CHỈNH — dùng khi server trả rỗng/lỗi/thiếu cấu trúc.
 * Trả về object 200-OK giống hệt RevenueCat với tài khoản đã mua vĩnh viễn.
 */
function synthesizeSubscriberResponse(cfg) {
  var s = { subscriber: {} };
  try {
    var sub = s.subscriber;
    sub.original_app_user_id = "b1steam-gold-1";
    sub.original_application_version = "1600";
    sub.original_platform = "ios";
    sub.original_purchase_date = PAST;
    sub.first_seen = PAST;
    sub.entitlements = {};
    sub.subscriptions = {};
    sub.non_subscriptions = {};
    sub.management_url = null;
    var names = (cfg && cfg.entitlements) || [];
    for (var i = 0; i < names.length; i++) sub.entitlements[names[i]] = null;
    var prods = (cfg && cfg.products) || [];
    for (var p = 0; p < prods.length; p++) sub.subscriptions[prods[p]] = null;
    applyRevenueCat(s, cfg);
  } catch (e) { /* fallback tối thiểu — vẫn trả object hợp lệ */ }
  return s;
}

/** Response Gold hoàn chỉnh cho các nhánh bail của revenuecat mode. */
function respondRevenueCatGold(cfg) {
  var s = synthesizeSubscriberResponse(cfg);
  $done({
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(s),
  });
}


function applyResponsePhase() {
  var body = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";
  var cfg = resolveConfig();
  var mode = cfg.mode || "merge";
  var status = ($response && ($response.status || $response.statusCode)) || 200;
  var isRc = mode === "revenuecat";

  if (!body || typeof body !== "string") {
    if (isRc) { respondRevenueCatGold(cfg); return; }
    $done({}); return;
  }

  try {
    if (mode === "replace") {
      var tpl = cfg.template;
      if (!isObject(tpl)) { $done({}); return; }
      $done({ status: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(tpl) });
      return;
    }

    var obj = JSON.parse(body);

    // RevenueCat: server trả rỗng/lỗi/thiếu cấu trúc subscriber → TỔNG HỢP payload Gold đầy đủ
    if (isRc) {
      var hasStructure = isObject(obj) && isObject(obj.subscriber) &&
        (isObject(obj.subscriber.entitlements) || isObject(obj.subscriber.subscriptions));
      var hasErr = obj && obj.error && !hasStructure;
      if (status !== 200 || hasErr || !hasStructure) {
        var synth = synthesizeSubscriberResponse(cfg);
        // Giữ lại dữ liệu server nếu có (id, first_seen, entitlements…) rồi cho applyRevenueCat nâng lên Gold
        try {
          if (isObject(obj) && isObject(obj.subscriber)) {
            for (var k in obj.subscriber) {
              if (Object.prototype.hasOwnProperty.call(obj.subscriber, k)) {
                synth.subscriber[k] = obj.subscriber[k];
              }
            }
          }
          applyRevenueCat(synth, cfg);
        } catch (e2) { /* synthesized vẫn hợp lệ */ }
        $done({
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
          body: JSON.stringify(synth),
        });
        return;
      }
    }

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
    $done({ status: isRc ? 200 : status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(obj) });
  } catch (e) {
    if (isRc) { respondRevenueCatGold(cfg); return; }
    $done({});
  }
}

/* ═══════════════════════ Entry point ═══════════════════════ */
var IS_REQUEST_PHASE = (typeof $response === "undefined");

if (IS_REQUEST_PHASE) {
  gate(
    function () { applyRequestPhase(); },
    function () { $done({}); },
    "unlock"
  );
} else {
  gate(
    function () { applyResponsePhase(); },
    function () { $done({}); },
    "unlock"
  );
}
