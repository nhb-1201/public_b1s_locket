/* B1sTeam — License gate (fail-closed) — single source of truth cho MỌI script B1sTeam.
   Shadowrocket scripts phải self-contained; ios/build.mjs inline file này.

   NGUYÊN TẮC:
     A) Key sai / thiếu / sai máy / offline > 30 ngày (chưa từng verify OK) → KHÔNG bám.
     B) Đã verify OK trong 7 ngày → chạy tiếp (không hỏi lại, không gọi mạng).
     C) Verify FAIL → cooldown 10 phút (chống verify-storm khi mạng chập chờn).
     D) Đã verify OK trong 30 ngày nhưng lần này không hỏi được (mất mạng) → OFFLINE-GRACE.
     E) Không gửi uid / token / dữ liệu người dùng đi đâu — chỉ key + device_id đã ẩn danh.

   ⚠ BẢN SỬA 2026-11-14 (sau log PacketTunnel):
     Shadowrocket KHÔNG có `$prefs` (đó là Quantumult X) — chỉ có `$persistentStore`.
     Bản cũ đọc/ghi cache + cooldown + device id qua $prefs ⇒ trên Shadowrocket KHÔNG BAO GIỜ
     lưu được ⇒ mỗi request đều gọi verify (2 host) ⇒ 64 lần/10 phút ⇒ 429 ⇒ fail-closed ⇒
     "không hiện gì". Nay dùng store đa-API ($persistentStore → $prefs → $storage) + device id
     ổn định (salt lưu được → id theo máy; lưu không được → id tất định theo key) để:
       · cache 7 ngày + cooldown 10 phút thật sự hoạt động ⇒ hết bão verify;
       · device id không bao giờ đổi mỗi lần chạy ⇒ không còn device_mismatch vô lý.
*/

/* ═══════════ Thời gian (ms) ═══════════ */
var B1S_VERIFY_CACHE_MS = 604800000;    // 7 ngày — cache "đã verify OK"
var B1S_OFFLINE_GRACE_MS = 2592000000;  // 30 ngày — mất tạm khi máy chủ/mạng lỗi tạm thời
var B1S_FAIL_COOLDOWN_MS = 600000;      // 10 phút — sau khi verify FAIL
var B1S_MEM_OK_MS = 21600000;           // 6 giờ — cache verify trong bộ nhớ script

/* ═══════════ Verify endpoints (2 host, độc lập) ═══════════ */
var B1S_VERIFY_PRIMARY = "https://locket.b1s.id.vn/api/v2/locketgold/verify";
var B1S_VERIFY_FALLBACK = "https://b1s.id.vn/api/locketgold/verify";
var B1S_VERIFY_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/* ═══════════ Prefs keys ═══════════ */
var B1S_KEY_DEVICE = "b1s_lg_device_id";
var B1S_KEY_SALT = "b1s_lg_salt";
var B1S_KEY_OK_AT = "b1s_lg_ok_at";
var B1S_KEY_FAIL_AT = "b1s_lg_fail_at";
var B1S_KEY_FAIL_DEV = "b1s_lg_fail_dev"; // device id lúc fail — id đổi ⇒ thử lại ngay

var memDeviceId = null;
var memOkAt = 0;      // mốc verify OK gần nhất (bộ nhớ)
var memFailAt = 0;    // mốc verify fail gần nhất (bộ nhớ)

/* ═══════════════════════════════════════════════════════════════
   STORE ĐA-API — $persistentStore (Shadowrocket/Surge/Loon) → $prefs (QX) → $storage
   Trả "" / null khi chưa có; set trả true nếu ghi được ít nhất 1 nơi.
   ═══════════════════════════════════════════════════════════════ */
function b1sStoreGet(key) {
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var v = $persistentStore.read(key);
      if (v !== undefined && v !== null && v !== "") return String(v);
    }
  } catch (e) { /* bỏ qua */ }
  try {
    if (typeof $prefs !== "undefined" && $prefs) {
      var v2 = $prefs.valueForKey(key);
      if (v2 !== undefined && v2 !== null && v2 !== "") return String(v2);
    }
  } catch (e) { /* bỏ qua */ }
  try {
    if (typeof $storage !== "undefined" && $storage) {
      var v3 = $storage.read(key);
      if (v3 !== undefined && v3 !== null && v3 !== "") return String(v3);
    }
  } catch (e) { /* bỏ qua */ }
  return null;
}

function b1sStoreSet(key, value) {
  var ok = false;
  var s = String(value);
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      $persistentStore.write(s, key);
      ok = true;
    }
  } catch (e) { /* bỏ qua */ }
  try {
    if (typeof $prefs !== "undefined" && $prefs) {
      $prefs.setValueForKey(s, key);
      ok = true;
    }
  } catch (e) { /* bỏ qua */ }
  try {
    if (typeof $storage !== "undefined" && $storage) {
      $storage.write(s, key);
      ok = true;
    }
  } catch (e) { /* bỏ qua */ }
  return ok;
}

/* ═══════════ Hash 32-bit (FNV-1a) — device id tất định khi không lưu được salt ═══════════ */
function b1sHash32(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

function b1sRandomHex(len) {
  var s = "";
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/**
 * Device id TẤT ĐỊNH theo license key — giống nhau trên MỌI script và MỌI lần cài đặt.
 *   id = "mitm-" + FNV1a32(license_key)
 * Không dùng storage ⇒ không bao giờ đổi, không bao giờ lệch giữa các script.
 * Backend: id "mitm-*" được coi là họ của key đó (khoá theo key/tài khoản, đổi máy không cần gỡ).
 */
function deviceId() {
  if (memDeviceId) return memDeviceId;
  memDeviceId = "mitm-" + b1sHash32(String(LICENSE_KEY || ""));
  return memDeviceId;
}

function lastVerifiedAt() {
  var v = b1sStoreGet(B1S_KEY_OK_AT);
  return v ? Number(v) || 0 : 0;
}

function markVerified() {
  b1sStoreSet(B1S_KEY_OK_AT, String(Date.now()));
  memOkAt = Date.now();
}

function noteFailed() {
  b1sStoreSet(B1S_KEY_FAIL_AT, String(Date.now()));
  try { b1sStoreSet(B1S_KEY_FAIL_DEV, deviceId()); } catch (e) { /* ignore */ }
}

function lastFailedAt() {
  var v = b1sStoreGet(B1S_KEY_FAIL_AT);
  return v ? Number(v) || 0 : 0;
}

/** Device id đã fail gần nhất (rỗng = chưa có) */
function lastFailedDevice() {
  var v = b1sStoreGet(B1S_KEY_FAIL_DEV);
  return v ? String(v) : "";
}

/** Máy đã từng verify OK < 30 ngày nhưng lần này không hỏi được → cho mạy tiếp. */
function offlineGraceActive() {
  var last = lastVerifiedAt();
  return last > 0 && Date.now() - last < B1S_OFFLINE_GRACE_MS;
}

/** Key dùng được (không phải placeholder, đủ dài). */
function licenseKeyUsable() {
  return !!LICENSE_KEY && LICENSE_KEY.indexOf("__LICENSE_KEY__") !== 0 && LICENSE_KEY.length >= 8;
}

/** Gọi 1 endpoint verify. cb(bool). */
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

/**
 * Fail-closed gate.
 *   allow() — license hợp lệ (hoặc cache/grace còn hiệu lực) → KHÔNG gọi mạng khi cache còn.
 *   deny()  — key sai/sai máy/verify fail hết grace → trả nguyên body gốc.
 *   tag:    tiền tố log, vd "remote" → log "[locketgold] remote: …".
 */
function gate(allow, deny, tag) {
  var T = tag || "b1s";
  if (!licenseKeyUsable()) { noteFailed(); return deny(); }

  if (Date.now() - lastVerifiedAt() < B1S_VERIFY_CACHE_MS) return allow(); // cache 7 ngày
  if (Date.now() - memOkAt < B1S_MEM_OK_MS) return allow();               // cache 6 giờ trong bộ nhớ

  var id = deviceId();
  var failedAt = Math.max(lastFailedAt(), memFailAt);
  var failedDev = lastFailedDevice();
  // Cooldown CHỈ áp cho đúng device id đã fail. Id đổi (client mới / cài lại app) → thử lại ngay,
  // tránh việc "fail của bản cũ" khoá luôn bản mới ⇒ app không mở khoá gì trong 10 phút.
  // Cooldown CHỈ có hiệu lực cho ĐÚNG device id đã fail. Marker của bản cũ (không ghi fail_dev)
  // hoặc id khác (client mới / cài lại app) → thử verify ngay, không chờ.
  var cooldownApplies = failedAt > 0 && Date.now() - failedAt < B1S_FAIL_COOLDOWN_MS &&
    !!failedDev && failedDev === id;
  if (cooldownApplies) {
    try { console.log("[locketgold] " + T + ": verify cooldown 10p (sau khi FAIL)"); } catch (e) {}
    return deny();
  }
  if (failedAt > 0 && !cooldownApplies) {
    try { console.log("[locketgold] " + T + ": device id đổi → thử verify lại (bỏ cooldown)"); } catch (e) {}
  }
  if (!id) { noteFailed(); return deny(); }

  verifyWith(B1S_VERIFY_PRIMARY, id, function (okPrimary) {
    if (okPrimary) { markVerified(); return allow(); }
    verifyWith(B1S_VERIFY_FALLBACK, id, function (okFallback) {
      if (okFallback) { markVerified(); return allow(); }
      try { console.log("[locketgold] " + T + ": verify FAIL (device=" + id.slice(0, 12) + "…)"); } catch (e) {}
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

/* ═══════════ Media/CDN bypass — KHÔNG ép region/header, KHÔNG chạy gate nặng ═══════════ */
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
