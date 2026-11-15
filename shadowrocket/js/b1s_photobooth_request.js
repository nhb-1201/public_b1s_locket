// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_photobooth_request.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Photobooth / Overlay REQUEST phase.
 *
 * MỤC TIÊU:
 *   Khi app Locket chọn bộ lọc khung (photobooth, 4cut, khung B1sTeam…) và bấm chụp,
 *   app POST /generateFilteredImage với body chứa:
 *     · URL ảnh gốc (input_url / image_url / photo_url …)
 *     · id bộ lọc (filter_id / filterId / id …)
 *   Script này BẮT QUERY ĐƯỢC 2 giá trị đó lưu vào store của máy,
 *   để script RESPONSE (b1s_photobooth_response.js) dựng lại ảnh gốc khi server lỗi.
 *
 *   ⇒ Người dùng không còn thấy màn hình trắng / "Không thể áp dụng bộ lọc".
 *
 * AN TOÀN:
 *   · Request KHÔNG bị sửa ⇒ app vẫn chụp ảnh bình thường.
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ request đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  var KEY_PHOTO_URL = "b1s_pb_photo_url";
  var KEY_FILTER_ID = "b1s_pb_filter_id";
  var KEY_AT = "b1s_pb_at";
  var KEY_URL = "b1s_pb_request_url";

  /* Field chứa URL ảnh gốc trong body generateFilteredImage */
  var URL_FIELDS = ["input_url", "inputUrl", "image_url", "imageUrl", "photo_url", "photoUrl", "source_url", "url"];

  /* Field chứa id bộ lọc */
  var ID_FIELDS = ["filter_id", "filterId", "filterID", "filter", "id", "overlay_id", "overlayId", "frame_id", "frameId"];

  /* Bộ lọc "khung" — cần dựng ảnh gốc khi server lỗi */
  var OVERLAY_RE = /photobooth|photoboot|4cut|^pb_|^khung_|^frame_|sticker|cmt_locket|custom_frame|overlay|^khung/;

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  function b1sLog(msg) {
    try { console.log("[locketgold] pb-request: " + msg); } catch (e) { /* ignore */ }
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

  /** Bắt URL ảnh đầu tiên trong body (kể cả khi nằm trong object lồng). */
  function pickUrl(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 6) return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var u = pickUrl(node[i], d + 1);
        if (u) return u;
      }
      return null;
    }
    for (var i2 = 0; i2 < URL_FIELDS.length; i2++) {
      var v = node[URL_FIELDS[i2]];
      if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    }
    for (var k in node) {
      if (!hasOwn(node, k)) continue;
      var child = node[k];
      if (child && typeof child === "object") {
        var found = pickUrl(child, d + 1);
        if (found) return found;
      }
    }
    return null;
  }

  /** Bắt id bộ lọc. */
  function pickFilterId(node) {
    if (!isObject(node)) return null;
    for (var i = 0; i < ID_FIELDS.length; i++) {
      var v = node[ID_FIELDS[i]];
      if (typeof v === "string" && v.length) return v.toLowerCase();
      if (typeof v === "number") return String(v);
    }
    return null;
  }

  try {
    if (typeof $done !== "function") return;

    if (typeof $request === "undefined" || !$request) { $done({}); return; }

    var url = $request.url ? String($request.url) : "";
    if (url.indexOf("generateFilteredImage") === -1) { $done({}); return; }

    var rawBody = ($request && typeof $request.body === "string") ? $request.body : "";
    if (!rawBody) { $done({}); return; }

    var parsed = null;
    try { parsed = JSON.parse(rawBody); } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== "object") { $done({}); return; }

    var filterId = pickFilterId(parsed);
    var photoUrl = pickUrl(parsed, 0);

    if (filterId) b1sSet(KEY_FILTER_ID, filterId);
    if (photoUrl) b1sSet(KEY_PHOTO_URL, photoUrl);
    b1sSet(KEY_AT, String(Date.now()));
    b1sSet(KEY_URL, url);

    b1sLog("fid=" + (filterId || "?") + " · ảnh=" + (photoUrl ? "có" : "không") +
      (filterId && OVERLAY_RE.test(filterId) ? " (overlay/photobooth)" : ""));

    $done({});
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
