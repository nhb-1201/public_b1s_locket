// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_frame_router.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";

/**
 * B1sTeam — Frame Router (RESPONSE phase cho API Locket).
 *
 * MỤC TIÊU:
 *   Danh sách khung (camera frames / photo frames / widget frames) của Locket trả về:
 *     · khung premium bị gắn cờ locked / requires_gold = true
 *     · URL ảnh nằm trên CDN của Locket (nhiều khung không tồn tại hoặc bị khoá)
 *   Script này:
 *     1) Đọc catalog khung B1sTeam từ store (b1s_frame_catalog) — nếu không có thì dùng
 *        catalog nhúng sẵn trong script (bản cache).
 *     2) Mở khoá: requires_gold = false, is_locked = false, unlocked = true, is_gold = true…
 *     3) Đổi URL ảnh sang worker B1sTeam, XOAY VÒNG 6 node:
 *          https://b1steam-frames-{1..6}.nhb-120111.workers.dev/f/:id
 *
 * AN TOÀN:
 *   · Không nhận diện được khung ⇒ giữ nguyên payload.
 *   · Lỗi bất kỳ ⇒ $done({}) ⇒ body gốc đi nguyên vẹn.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
(function () {
  "use strict";

  var KEY_CATALOG = "b1s_frame_catalog";
  var KEY_ROUND_ROBIN = "b1s_frame_rr";
  var KEY_NOTIFIED = "b1s_frame_notified_at";

  /* Worker Cloudflare phục vụ khung — xoay vòng */
  var FRAME_WORKERS = [
    "https://b1steam-frames-1.nhb-120111.workers.dev",
    "https://b1steam-frames-2.nhb-120111.workers.dev",
    "https://b1steam-frames-3.nhb-120111.workers.dev",
    "https://b1steam-frames-4.nhb-120111.workers.dev",
    "https://b1steam-frames-5.nhb-120111.workers.dev",
    "https://b1steam-frames-6.nhb-120111.workers.dev"
  ];

  /* Catalog khung B1sTeam — bản cache nhúng (đồng bộ assets/frames/catalog.json) */
  var FRAME_CATALOG = [
    { id: "frame-08-valentine", name: "Valentine", group: "seasonal", file: "frame-08-valentine.png", tags: ["valentine", "love", "heart"], premium: true },
    { id: "frame-09-christmas", name: "Christmas", group: "seasonal", file: "frame-09-christmas.png", tags: ["christmas", "xmas", "snow"], premium: true },
    { id: "frame-10-halloween", name: "Halloween", group: "seasonal", file: "frame-10-halloween.png", tags: ["halloween", "spooky", "pumpkin"], premium: true },
    { id: "frame-11-neon", name: "Neon", group: "gold", file: "frame-11-neon.png", tags: ["neon", "cyberpunk", "glow"], premium: true },
    { id: "frame-12-gold", name: "Gold", group: "gold", file: "frame-12-gold.png", tags: ["gold", "premium", "classic"], premium: true },
    { id: "frame-13-pastel", name: "Pastel", group: "kawaii", file: "frame-13-pastel.png", tags: ["pastel", "kawaii", "soft"], premium: true },
    { id: "frame-14-crayon", name: "Crayon", group: "kawaii", file: "frame-14-crayon.png", tags: ["crayon", "doodle", "kids"], premium: true },
    { id: "frame_citopia_y2k", name: "Citopia Y2K", group: "retro", file: "frame_citopia_y2k.png", tags: ["y2k", "retro", "2000s"], premium: true },
    { id: "frame_kitty_shinchan", name: "Kitty Shinchan", group: "kawaii", file: "frame_kitty_shinchan.png", tags: ["kitty", "shinchan", "anime"], premium: true },
    { id: "frame_lowg_l2k", name: "LowG L2K", group: "retro", file: "frame_lowg_l2k.png", tags: ["l2k", "retro", "street"], premium: true },
    { id: "frame_royal_gold", name: "Royal Gold", group: "gold", file: "frame_royal_gold.png", tags: ["gold", "royal", "luxury"], premium: true },
    { id: "photobooth_4cut", name: "Photobooth 4 Cut", group: "photobooth", file: "photobooth_4cut.png", tags: ["photobooth", "4cut", "sticker"], premium: true },
    { id: "photobooth_cute", name: "Photobooth Cute", group: "photobooth", file: "photobooth_cute.png", tags: ["photobooth", "cute", "sticker"], premium: true },
    { id: "cmt_locket", name: "Locket Comment", group: "widget", file: "cmt_locket.png", tags: ["widget", "comment", "banner"], premium: false }
  ];

  /* Field chứa URL ảnh của một khung */
  var URL_FIELDS = ["url", "image_url", "imageUrl", "image", "asset_url", "assetUrl", "thumbnail_url", "preview_url"];

  /* Field chứa id của một khung */
  var ID_FIELDS = ["id", "frame_id", "frameId", "uid", "name", "slug", "key"];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  function b1sLog(msg) {
    try { console.log("[locketgold] frame-router: " + msg); } catch (e) { /* ignore */ }
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

  /** Catalog: ưu tiên bản trong store, không có thì dùng bản nhúng. */
  function loadCatalog() {
    var raw = b1sGet(KEY_CATALOG);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          notifyCatalog(parsed.length);
          return parsed;
        }
      } catch (e) { /* ignore */ }
    }
    return FRAME_CATALOG;
  }

  /** Báo cho người dùng biết catalog khung đã được nạp (tối đa 1 lần / 24 giờ). */
  function notifyCatalog(count) {
    try {
      var last = Number(b1sGet(KEY_NOTIFIED) || "0");
      if (last && (Date.now() - last) < 86400000) return;
      b1sSet(KEY_NOTIFIED, String(Date.now()));
      if (typeof $notification !== "undefined" && $notification && typeof $notification.post === "function") {
        $notification.post("B1sTeam — LocketGold", "Đã nạp " + count + " khung Kawaii", "Khung premium đã được mở khoá qua worker B1sTeam.");
      }
    } catch (e) { /* ignore */ }
  }

  /** Chuẩn hoá id để so khớp (bỏ dấu gạch, chữ thường). */
  function normId(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /** Tìm entry catalog khớp id của khung trong payload. */
  function matchCatalog(catalog, rawId) {
    var n = normId(rawId);
    if (!n) return null;
    for (var i = 0; i < catalog.length; i++) {
      var e = catalog[i] || {};
      if (!e.id) continue;
      if (normId(e.id) === n) return e;
    }
    for (var j = 0; j < catalog.length; j++) {
      var e2 = catalog[j] || {};
      if (!e2.id) continue;
      var en = normId(e2.id);
      if (en.indexOf(n) !== -1 || n.indexOf(en) !== -1) return e2;
    }
    return null;
  }

  /** Bộ đếm xoay vòng ⇒ chọn node worker kế tiếp. */
  function nextWorker() {
    var cur = parseInt(b1sGet(KEY_ROUND_ROBIN) || "0", 10);
    if (isNaN(cur) || cur < 0) cur = 0;
    var host = FRAME_WORKERS[cur % FRAME_WORKERS.length];
    b1sSet(KEY_ROUND_ROBIN, String(cur + 1));
    return host;
  }

  /** Cờ "đã mở khoá" — ép về true. */
  var TRUE_KEYS = ["unlocked", "is_unlocked", "is_gold", "is_premium", "premium", "is_subscribed",
    "has_access", "can_use", "can_render", "is_available", "enabled", "active"];
  /* Cờ "còn khoá" — ép về false. */
  var FALSE_KEYS = ["requires_gold", "requires_subscription", "is_locked", "locked",
    "needs_subscription", "needs_gold", "is_purchased_only", "premium_only", "is_premium_only"];

  /** Cờ mở khoá cho 1 node khung. */
  function unlockFrame(node) {
    for (var key in node) {
      if (!hasOwn(node, key)) continue;
      var value = node[key];
      if (value && typeof value === "object") continue;
      var lk = String(key).toLowerCase();
      if (FALSE_KEYS.indexOf(lk) !== -1) node[key] = false;
      else if (TRUE_KEYS.indexOf(lk) !== -1) node[key] = true;
    }
    node.is_locked = false;
    node.locked = false;
    node.requires_gold = false;
    node.requires_subscription = false;
    node.unlocked = true;
    node.is_unlocked = true;
    node.is_gold = true;
    node.is_premium = true;
    node.premium = true;
    node.is_subscribed = true;
    node.has_access = true;
  }

  /** Node này có giống một "khung" không? (có id + có field URL ảnh) */
  function frameIdOf(node) {
    for (var i = 0; i < ID_FIELDS.length; i++) {
      var v = node[ID_FIELDS[i]];
      if (typeof v === "string" && v.length) return v;
    }
    return null;
  }

  function frameUrlField(node) {
    for (var i = 0; i < URL_FIELDS.length; i++) {
      if (hasOwn(node, URL_FIELDS[i])) {
        var v = node[URL_FIELDS[i]];
        if (typeof v === "string" && v.length) return URL_FIELDS[i];
      }
    }
    return null;
  }

  /** Duyệt payload: mọi node khung ⇒ mở khoá + đổi URL sang worker. */
  function route(node, catalog, counter, depth) {
    var d = depth || 0;
    if (!node || typeof node !== "object" || d > 24) return 0;
    if (Array.isArray(node)) {
      var sum = 0;
      for (var i = 0; i < node.length; i++) sum += route(node[i], catalog, counter, d + 1);
      return sum;
    }
    var touched = 0;

    var rawId = frameIdOf(node);
    var urlField = frameUrlField(node);
    if (rawId && urlField) {
      var entry = matchCatalog(catalog, rawId);
      var targetId = entry && entry.id ? entry.id : rawId;
      var host = nextWorker();
      counter.n++;
      var newUrl = host + "/f/" + encodeURIComponent(targetId);
      node[urlField] = newUrl;
      /* nhiều field URL cùng lúc (thumbnail/preview) → đồng bộ */
      for (var u = 0; u < URL_FIELDS.length; u++) {
        var f = URL_FIELDS[u];
        if (f === urlField) continue;
        if (hasOwn(node, f) && typeof node[f] === "string" && node[f].length) node[f] = newUrl;
      }
      unlockFrame(node);
      touched = 1;
    }

    for (var k in node) {
      if (!hasOwn(node, k)) continue;
      var child = node[k];
      if (child && typeof child === "object") touched += route(child, catalog, counter, d + 1);
    }
    return touched;
  }

  try {
    if (typeof $done !== "function") return;

    var body = (typeof $response !== "undefined" && $response && typeof $response.body === "string")
      ? $response.body : "";
    if (!body) { $done({}); return; }

    var obj = null;
    try { obj = JSON.parse(body); } catch (e) { obj = null; }
    if (!obj || typeof obj !== "object") { $done({}); return; }

    var catalog = loadCatalog();
    var counter = { n: 0 };
    var routed = route(obj, catalog, counter, 0);

    if (!routed) { $done({}); return; }

    b1sLog("đã mở khoá + đổi URL " + routed + " khung sang worker B1sTeam");

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
