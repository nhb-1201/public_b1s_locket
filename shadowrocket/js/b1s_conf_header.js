// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_conf_header.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — License header helper (REQUEST phase).
 *
 * MỤC TIÊU:
 *   Gắn header "X-B1s-License" vào request khi tìm thấy license key.
 *   Key lấy theo thứ tự ưu tiên:
 *     1. Biến LICENSE_KEY nhúng trong file (placeholder __LICENSE_KEY__ được build
 *        thay bằng key thật lúc sinh bản phát hành).
 *     2. $argument — dạng JSON {"key":"…"}, "key=…", "B1S-XXXX-XXXX-XXXX" hoặc
 *        "B1S-XXXX-XXXX-XXXX|slug".
 *     3. Store của máy (b1s_license_key) — nhớ key đã dùng.
 *
 *   Nếu KHÔNG có key hợp lệ ⇒ KHÔNG thêm header ⇒ request đi nguyên vẹn.
 *
 * AN TOÀN:
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ request không bị hỏng.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  /* Key nhúng — build script thay placeholder "__LICENSE_KEY__" bằng key thật */
  var LICENSE_KEY = "__LICENSE_KEY__";

  var KEY_STORE = "b1s_license_key";

  /* Định dạng key chuẩn của B1sTeam */
  var KEY_STRICT = /^B1S-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  /* Dạng key lỏng (chữ số/ký tự an toàn) — chấp nhận thêm cho tương thích */
  var KEY_LOOSE = /^[A-Z0-9][A-Z0-9-]{7,63}$/;

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function b1sLog(msg) {
    try { console.log("[locketgold] conf-header: " + msg); } catch (e) { /* ignore */ }
  }

  function b1sGet(key) {
    try {
      if (typeof $persistentStore !== "undefined" && $persistentStore) {
        var v = $persistentStore.read(key);
        if (v !== undefined && v !== null && v !== "") return String(v);
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof $prefs !== "undefined" && $prefs) {
        var v2 = $prefs.valueForKey(key);
        if (v2 !== undefined && v2 !== null && v2 !== "") return String(v2);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function b1sSet(key, value) {
    try {
      if (typeof $persistentStore !== "undefined" && $persistentStore) {
        $persistentStore.write(String(value), key);
        return true;
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof $prefs !== "undefined" && $prefs) {
        $prefs.setValueForKey(String(value), key);
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  /** Key dùng được? (không phải placeholder, đủ dài, ký tự hợp lệ) */
  function usableKey(k) {
    if (!k) return false;
    var s = String(k).trim();
    if (!s) return false;
    if (s.indexOf("__LICENSE_KEY__") === 0) return false;
    if (s.indexOf("__") === 0) return false;
    if (s.length < 8) return false;
    return KEY_STRICT.test(s) || KEY_LOOSE.test(s);
  }

  /** Bóc key ra khỏi $argument (nhiều dạng). */
  function keyFromArgument(arg) {
    if (!arg) return "";
    var raw = String(arg);

    /* JSON */
    try {
      var j = JSON.parse(raw);
      if (j && typeof j === "object") {
        if (typeof j.key === "string") return j.key.trim();
        if (typeof j.license === "string") return j.license.trim();
        if (typeof j.license_key === "string") return j.license_key.trim();
      }
    } catch (e) { /* không phải JSON */ }

    /* "key=B1S-..." */
    var m = /(?:^|[?&|])(?:key|license|license_key)=([^&|]+)/i.exec(raw);
    if (m) return decodeURIComponent(m[1]).trim();

    /* "B1S-XXXX-XXXX-XXXX" hoặc "B1S-XXXX-XXXX-XXXX|slug" */
    var parts = raw.split("|");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (KEY_STRICT.test(p)) return p;
    }
    return "";
  }

  /** Key cuối cùng: nhúng → argument → store. */
  function resolveKey() {
    if (usableKey(LICENSE_KEY)) return String(LICENSE_KEY).trim();

    var arg = "";
    try {
      if (typeof $argument !== "undefined" && $argument) arg = String($argument);
    } catch (e) { arg = ""; }
    var fromArg = keyFromArgument(arg);
    if (usableKey(fromArg)) return fromArg;

    var fromStore = b1sGet(KEY_STORE);
    if (usableKey(fromStore)) return String(fromStore).trim();

    return "";
  }

  try {
    if (typeof $done !== "function") return;

    if (typeof $request === "undefined" || !$request) { $done({}); return; }

    var key = resolveKey();
    if (!key) {
      b1sLog("không có license key → không thêm header");
      $done({});
      return;
    }

    /* Nhớ key để các lần sau không phải truyền lại */
    try { if (!b1sGet(KEY_STORE)) b1sSet(KEY_STORE, key); } catch (e) { /* ignore */ }

    var src = ($request && $request.headers) ? $request.headers : {};
    var headers = {};
    for (var k in src) {
      if (!hasOwn(src, k)) continue;
      headers[k] = src[k];
    }
    headers["X-B1s-License"] = key;

    b1sLog("đã gắn X-B1s-License");
    $done({ headers: headers });
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
