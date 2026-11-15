// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_firebase_request.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Firebase Remote Config REQUEST phase.
 *
 * MỤC TIÊU:
 *   Firebase RC trả "304 Not Modified" khi app gửi kèm ETag.
 *   Body 304 rỗng ⇒ app dùng cache cũ ⇒ cờ Gold không được áp dụng.
 *   Script này gỡ sạch mọi header cache của Firebase:
 *     · x-firebase-etag
 *     · x-goog-if-none-match
 *     · if-none-match
 *     · if-modified-since
 *
 * AN TOÀN:
 *   · Chỉ sửa header ⇒ không làm hỏng request.
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ request đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  /* Header cache cần loại bỏ (so sánh không phân biệt hoa thường) */
  var STRIP_HEADERS = [
    "x-firebase-etag",
    "x-goog-if-none-match",
    "if-none-match",
    "if-modified-since"
  ];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function b1sLog(msg) {
    try { console.log("[locketgold] fb-request: " + msg); } catch (e) { /* ignore */ }
  }

  try {
    if (typeof $done !== "function") return;

    if (typeof $request === "undefined" || !$request) { $done({}); return; }

    var src = ($request && $request.headers) ? $request.headers : {};
    var out = {};
    var removed = 0;

    for (var k in src) {
      if (!hasOwn(src, k)) continue;
      var lk = String(k).toLowerCase();
      var skip = false;
      for (var i = 0; i < STRIP_HEADERS.length; i++) {
        if (lk === STRIP_HEADERS[i]) { skip = true; break; }
      }
      if (skip) { removed++; continue; }
      out[k] = src[k];
    }

    b1sLog("đã gỡ " + removed + " header cache (Firebase RC không còn trả 304)");
    $done({ headers: out });
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
