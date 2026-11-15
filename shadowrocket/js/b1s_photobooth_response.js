// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_photobooth_response.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Photobooth / Overlay RESPONSE phase.
 *
 * MỤC TIÊU:
 *   Server Locket trả lỗi (400/402/403/500) cho bộ lọc khung ⇒ app hiện màn hình trắng
 *   hoặc "Không thể áp dụng bộ lọc". Script này:
 *     1) Đọc URL ảnh gốc + id bộ lọc đã lưu ở b1s_photobooth_request.js.
 *     2) Với bộ lọc overlay/photobooth ⇒ trả 200 với ảnh GỐC (app vẫn hiện ảnh).
 *     3) Dọn sạch payload lỗi (error / errors / result.error).
 *
 * AN TOÀN:
 *   · Không có ảnh gốc ⇒ giữ nguyên response.
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ body gốc đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  var KEY_PHOTO_URL = "b1s_pb_photo_url";
  var KEY_FILTER_ID = "b1s_pb_filter_id";

  /* Bộ lọc "khung" — cần dựng ảnh gốc khi server lỗi */
  var OVERLAY_RE = /photobooth|photoboot|4cut|^pb_|^khung_|^frame_|sticker|cmt_locket|custom_frame|overlay|^khung/;

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  function b1sLog(msg) {
    try { console.log("[locketgold] pb-response: " + msg); } catch (e) { /* ignore */ }
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

  /** Tìm URL ảnh đầu tiên trong payload. */
  function findImageUrl(node, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 8) return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var u = findImageUrl(node[i], d + 1);
        if (u) return u;
      }
      return null;
    }
    var preferred = ["outputUrl", "output_url", "imageUrl", "image_url", "result_url", "transformed_image_url", "unblurred_url", "url"];
    for (var p = 0; p < preferred.length; p++) {
      var v = node[preferred[p]];
      if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    }
    for (var k in node) {
      if (!hasOwn(node, k)) continue;
      var val = node[k];
      if (val && typeof val === "object") {
        var found = findImageUrl(val, d + 1);
        if (found) return found;
      }
    }
    return null;
  }

  /** Payload 200 "ảnh gốc" — app vẫn hiện ảnh dù server từ chối. */
  function buildOk(photoUrl) {
    var result = {
      status: 200,
      is_gold: true,
      is_locked: false,
      requires_gold: false,
      requires_subscription: false,
      is_subscribed: true,
      unlocked: true,
      premium: true,
      is_premium: true,
      outputUrl: photoUrl,
      output_url: photoUrl,
      imageUrl: photoUrl,
      image_url: photoUrl,
      url: photoUrl,
      data: {
        status: 200,
        outputUrl: photoUrl,
        output_url: photoUrl,
        imageUrl: photoUrl,
        image_url: photoUrl,
        url: photoUrl
      }
    };
    return {
      result: result,
      data: result.data,
      error: null
    };
  }

  try {
    if (typeof $done !== "function") return;

    var body = (typeof $response !== "undefined" && $response && typeof $response.body === "string")
      ? $response.body : "";
    if (!body) { $done({}); return; }

    var obj = null;
    try { obj = JSON.parse(body); } catch (e) { obj = null; }
    if (!obj || typeof obj !== "object") { $done({}); return; }

    var status = ((typeof $response !== "undefined" && $response) ? ($response.status || $response.statusCode) : 200) || 200;

    var filterId = String(b1sGet(KEY_FILTER_ID) || "").toLowerCase();
    var photoUrl = b1sGet(KEY_PHOTO_URL) || "";
    var isOverlay = filterId ? OVERLAY_RE.test(filterId) : false;

    var changed = false;

    /* 1) Dọn payload lỗi */
    try {
      if (obj.error) { delete obj.error; changed = true; }
      if (obj.errors) { delete obj.errors; changed = true; }
      if (isObject(obj.result)) {
        if (obj.result.error) { delete obj.result.error; changed = true; }
        if (obj.result.errors) { delete obj.result.errors; changed = true; }
        if (obj.result.status !== 200) { obj.result.status = 200; changed = true; }
        obj.result.is_gold = true;
        obj.result.is_locked = false;
        obj.result.requires_gold = false;
        obj.result.requires_subscription = false;
        obj.result.is_subscribed = true;
        obj.result.unlocked = true;
        obj.result.premium = true;
        obj.result.is_premium = true;
      }
    } catch (e) { /* ignore */ }

    /* 2) Bộ lọc overlay/photobooth bị server từ chối ⇒ trả 200 với ảnh GỐC */
    if (isOverlay && status !== 200) {
      var url = photoUrl || findImageUrl(obj, 0);
      if (url) {
        obj = buildOk(url);
        status = 200;
        changed = true;
        b1sLog("overlay '" + filterId + "' server trả " + status + " → 200 với ảnh gốc");
      }
    } else if (isOverlay && photoUrl) {
      /* Server trả 200 nhưng thiếu ảnh → gắn ảnh gốc vào */
      var result = isObject(obj.result) ? obj.result : null;
      var target = result || obj;
      if (!target.outputUrl && !target.output_url && !target.imageUrl && !target.image_url) {
        target.outputUrl = photoUrl;
        target.output_url = photoUrl;
        target.imageUrl = photoUrl;
        target.image_url = photoUrl;
        changed = true;
        b1sLog("overlay '" + filterId + "' thiếu ảnh → gắn ảnh gốc");
      }
    }

    if (!changed) { $done({}); return; }

    $done({
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(obj)
    });
  } catch (e) {
    try { $done({}); } catch (e2) { /* ignore */ }
  }
})();
