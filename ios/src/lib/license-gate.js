/* B1sTeam — License gate (fail-closed) — single source of truth for ALL B1sTeam scripts.
   Shadowrocket scripts must be self-contained; ios/build.mjs inlines this file.

   Nguyên tắc:
     · Key sai / thiếu / sai máy / offline > 30 ngày (chưa từng verify OK) → KHÔNG bơm gì.
     · Đã verify OK trong ≤ 7 ngày → cho chạy tiếp (không hỏi lại — tránh nghẽn).
     · Verify FAIL → cooldown 5 phút (chống verify-storm khi mạng chập chờn).
     · Đã verify OK trong ≤ 30 ngày nhưng lần này không hỏi được (mất mạng) → OFFLINE-GRACE.
     · Không uid / token / dữ liệu người dùng nào được gửi — chỉ key + device_id ẩn danh. */

/* ── Hằng thời gian (ms) ── */
var B1S_VERIFY_CACHE_MS = 604800000;    // 7 ngày  — cache "đã verify OK", không hỏi lại
var B1S_OFFLINE_GRACE_MS = 2592000000;  // 30 ngày — mở tạm khi máy chủ/mạng lỗi tạm thời
var B1S_FAIL_COOLDOWN_MS = 600000;      // 10 phút — sau khi verify FAIL (chống verify-storm)
var B1S_MEM_OK_MS = 21600000;           // 6 giờ — cache verify trong bộ nhớ script (dù $prefs hỏng vẫn không bắn liên tục)

/* ── Verify endpoints — cùng 1 license, thử lần lượt ──
   1) locket.b1s.id.vn (worker)  2) b1s.id.vn (frontend) — cả hai đều trả { valid: true }. */
var B1S_VERIFY_PRIMARY = "https://locket.b1s.id.vn/api/v2/locketgold/verify";
var B1S_VERIFY_FALLBACK = "https://b1s.id.vn/api/locketgold/verify";
var B1S_VERIFY_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/* ── prefs keys — GIỮ NGUYÊN để máy đã cài bản cũ không mất verify cache ── */
var B1S_KEY_DEVICE = "b1s_lg_device_id";
var B1S_KEY_OK_AT = "b1s_lg_ok_at";
var B1S_KEY_FAIL_AT = "b1s_lg_fail_at";

var memDeviceId = null;
var memOkAt = 0;      // mốc verify OK gần nhất (bộ nhớ)
var memFailAt = 0;    // mốc verify fail gần nhất (bộ nhớ)


/** Device id bền trên máy này (tạo 1 lần) — Shadowrocket $prefs / Loon $persistentStore / memory. */
function deviceId() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) {
      var id1 = $prefs.valueForKey(B1S_KEY_DEVICE);
      if (id1) return id1;
      id1 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $prefs.setValueForKey(id1, B1S_KEY_DEVICE);
      return id1;
    }
  } catch (e) { /* thử tầng tiếp theo */ }
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var id2 = $persistentStore.read(B1S_KEY_DEVICE);
      if (id2) return id2;
      id2 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $persistentStore.write(id2, B1S_KEY_DEVICE);
      return id2;
    }
  } catch (e) { /* thử memory */ }
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
}

function lastVerifiedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey(B1S_KEY_OK_AT) || 0);
  } catch (e) { /* bỏ qua */ }
  return 0;
}

function markVerified() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), B1S_KEY_OK_AT);
  } catch (e) { /* bỏ qua */ }
}

function noteFailed() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), B1S_KEY_FAIL_AT);
  } catch (e) { /* bỏ qua */ }
}

function lastFailedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey(B1S_KEY_FAIL_AT) || 0);
  } catch (e) { /* bỏ qua */ }
  return 0;
}

/** Máy từng verify OK ≤ 30 ngày nhưng lần này không verify được → cho mở tạm. */
function offlineGraceActive() {
  var last = lastVerifiedAt();
  return last > 0 && Date.now() - last < B1S_OFFLINE_GRACE_MS;
}

/** Key còn dùng được? (không phải placeholder, đủ dài) */
function licenseKeyUsable() {
  return !!LICENSE_KEY && LICENSE_KEY.indexOf("__LICENSE_KEY__") !== 0 && LICENSE_KEY.length >= 8;
}

/** Gọi verify 1 endpoint. cb(bool). Shadowrocket/Loon: callback(err, response, data) — data thường là body (string). */
function verifyWith(base, deviceIdValue, onDone) {
  if (typeof $httpClient === "undefined" || !$httpClient) return onDone(false);
  $httpClient.get(
    {
      url: base + "?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(deviceIdValue),
      headers: { Accept: "application/json", "User-Agent": B1S_VERIFY_UA },
      timeout: 10,
    },
    function (err, response, data) {
      if (err) return onDone(false);
      var body = "";
      if (typeof data === "string") body = data;
      else if (typeof data !== "undefined" && data !== null) {
        try { body = String(data); } catch (e) { return onDone(false); }
      } else if (response && typeof response.body === "string") body = response.body; // tương thích ngược
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

/**
 * Fail-closed gate.
 *   allow() được gọi khi license hợp lệ (hoặc cache/grace còn hiệu lực) — KHÔNG gọi network khi cache còn.
 *   deny()  được gọi khi key sai/máy khác/verify fail và hết grace → script trả nguyên body gốc.
 *   tag:    tiền tố log, vd "remote" → log "[locketgold] remote: …".
 */
function gate(allow, deny, tag) {
  var T = tag || "b1s";
  if (!licenseKeyUsable()) { noteFailed(); return deny(); }

  if (Date.now() - lastVerifiedAt() < B1S_VERIFY_CACHE_MS) return allow();
  if (Date.now() - memOkAt < B1S_MEM_OK_MS) return allow(); // cache 6 giờ bộ nhớ // cache 7 ngày

  var failedAt = Math.max(lastFailedAt(), memFailAt);
  if (failedAt > 0 && Date.now() - failedAt < B1S_FAIL_COOLDOWN_MS) {
    try { console.log("[locketgold] " + T + ": verify cooldown 5p (sau khi FAIL)"); } catch (e) {}
    return deny();
  }

  var id = deviceId();
  if (!id) { noteFailed(); return deny(); }

  verifyWith(B1S_VERIFY_PRIMARY, id, function (okPrimary) {
    if (okPrimary) { markVerified(); memOkAt = Date.now(); return allow(); }
    verifyWith(B1S_VERIFY_FALLBACK, id, function (okFallback) {
      if (okFallback) { markVerified(); memOkAt = Date.now(); return allow(); }
      if (offlineGraceActive()) {
        try { console.log("[locketgold] " + T + ": OFFLINE-GRACE"); } catch (e) {}
        return allow();
      }
      noteFailed();
      memFailAt = Date.now();
      return deny();
    });
  });
}

/* ── Media/CDN bypass — KHÔNG được inject region/header hoặc chạy gate nặng ──
   URL ký (signed) bị sửa query → 403/404 → feed trắng ảnh. */
var B1S_MEDIA_EXT = /\.(jpe?g|png|webp|heic|heif|gif|svg|mp4|mov|m4v|avi|mkv|mp3|m4a|pdf|zip)(\?|#|$)/i;

function isMediaUrl(url) {
  if (!url) return false;
  var u = String(url).toLowerCase();
  if (B1S_MEDIA_EXT.test(u)) return true;
  var m = /^https?:\/\/([^/]+)/.exec(u);
  var host = m ? m[1] : "";
  if (host.indexOf("cdn.") === 0 || host.indexOf("public.") === 0 || host.indexOf("media.") === 0) return true;
  if (host.indexOf("firebasestorage.") !== -1) return true;
  if (host.indexOf("storage.googleapis.com") !== -1) return true;
  return false;
}
