/* Accessor an toàn: $request/$response có thể KHÔNG tồn tại (chạy script thủ công trong
   trình soạn thảo của Shadowrocket, hoặc engine không cấp) — dùng $request trực tiếp sẽ ném
   ReferenceError làm script chết im lặng. */
var _req = (typeof $request !== "undefined" && $request) ? $request : {};
var _resp = (typeof $response !== "undefined" && $response) ? $response : {};
/* B1sTeam — Upload ảnh Locket → vẽ khung Kawaii (lib dùng chung — build inline).
   Yêu cầu file nguồn đã include: lib/http-util.js (hasOwn/headerValue), lib/b64.js
   (bytesToB64/b64ToBytes/binaryStringToBytes) và lib/license-gate.js (deviceId). */

var FRAME_RAW_URL = "https://locket-filter-frame.nhb-120111.workers.dev/frame-raw";
var MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB — ảnh Locket sau nén ~1–2 MB

/** URL thuộc bucket Firebase/GCS của Locket? */
function isLocketStorageUrl(url) {
  if (!url) return false;
  var u = String(url);
  // Firebase Storage (v0 REST): POST/PUT /v0/b/<bucket>/o?uploadType=resumable — bucket chứa "locket"
  if (/\/v0\/b\/locket[a-z0-9_-]*/i.test(u)) return true;
  // GCS trực tiếp: storage.googleapis.com/locket-img/...
  if (/storage\.googleapis\.com\/locket[a-z0-9_-]*\//i.test(u)) return true;
  // GCS JSON API: /storage/v1/b/locket-img/o?uploadType=media
  if (/\/storage\/v1\/b\/locket[a-z0-9_-]*/i.test(u)) return true;
  return false;
}

/** Upload ảnh Locket (PUT/POST + Content-Type ảnh, bucket locket-*)? */
function looksLikeLocketImageUpload(url, method, headers) {
  var m = String(method || "GET").toUpperCase();
  if (m !== "PUT" && m !== "POST") return false;
  if (!isLocketStorageUrl(url)) return false;
  var ct = headerValue(headers, "content-type").toLowerCase();
  if (ct.indexOf("image/") === 0) return true;
  // Firebase resumable PUT đôi khi gửi application/octet-stream
  if (ct.indexOf("application/octet-stream") === 0 || ct.indexOf("binary/octet-stream") === 0) return true;
  // Chưa biết Content-Type (session init không có bytes — handleLocketUpload sẽ bỏ qua)
  if (!ct) return true;
  return false;
}

/** Bytes nhị phân của upload (Shadowrocket bodyBytes; fallback binary string; không có → null). */
function requestBytes() {
  try {
    if ($request && $request.bodyBytes && typeof $request.bodyBytes.length === "number" && $request.bodyBytes.length > 0) {
      return _req.bodyBytes;
    }
  } catch (e) { /* thử tầng tiếp theo */ }
  if (typeof $request !== "undefined" && $request && typeof $request.body === "string" && $request.body) {
    try {
      return binaryStringToBytes(_req.body);
    } catch (e) { /* bỏ qua */ }
  }
  return null;
}

/**
 * Upload ảnh Locket → worker B1sTeam vẽ khung Kawaii → thay body bằng ảnh đã khung.
 * FAIL-OPEN tuyệt đối: worker chết / ảnh lỗi / quá lớn → ảnh đi QUA NGUYÊN TRẠNG.
 * Giữ nguyên: authorization, x-goog-upload-command, x-goog-upload-offset (Firebase resumable cần).
 */
function handleLocketUpload(url, rawHeaders) {
  var bytes = requestBytes();
  if (!bytes || !bytes.length) {
    console.log("[locketgold] upload: bỏ qua (không có bodyBytes — có thể là session init, không phải ảnh)");
    $done({});
    return;
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    console.log("[locketgold] upload: bỏ qua (quá lớn: " + bytes.length + " B)");
    $done({});
    return;
  }
  var b64 = bytesToB64(bytes);
  var dev = "";
  try { dev = deviceId(); } catch (e) {}
  console.log("[locketgold] upload: xử lý " + bytes.length + " B → /frame-raw (khung Kawaii Gold)");
  $httpClient.post({
    url: FRAME_RAW_URL,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-b1s-license": LICENSE_KEY || "",
      "x-b1s-device": dev,
    },
    body: JSON.stringify({ image_base64: b64, filter_id: "khung_gold" }),
    timeout: 25,
  }, function (err, resp, data) {
    try {
      if (err) { console.log("[locketgold] upload: worker lỗi: " + String(err).slice(0, 80)); $done({}); return; }
      var raw = (typeof data === "string" && data) ? data : (resp && typeof resp.body === "string" ? resp.body : "");
      var j = JSON.parse(raw || "{}");
      if (!j || j.ok !== true || !j.image_base64) {
        console.log("[locketgold] upload: worker từ chối — passthrough ảnh gốc");
        $done({});
        return;
      }
      var framed = b64ToBytes(j.image_base64);
      if (!framed || !framed.length) { $done({}); return; }
      var headers = {};
      for (var hk in rawHeaders) {
        if (!hasOwn(rawHeaders, hk)) continue;
        var lk = String(hk).toLowerCase();
        // Xóa độ dài/toàn vẹn — body mới hoàn toàn khác
        if (lk === "content-length" || lk === "content-md5" || lk === "content-encoding" ||
            lk === "digest" || lk === "x-goog-content-md5" || lk === "x-goog-content-sha256" ||
            lk === "x-upload-content-length" || lk === "x-upload-content-type" ||
            lk === "content-type") continue;
        headers[hk] = rawHeaders[hk];
      }
      headers["Content-Type"] = "image/png";
      console.log("[locketgold] upload: OK — " + framed.length + " B (ảnh đã có khung Kawaii Gold)");
      $done({ headers: headers, bodyBytes: framed });
    } catch (e2) {
      console.log("[locketgold] upload: exception: " + String(e2).slice(0, 80));
      $done({}); // fail-open — ảnh đi nguyên trạng
    }
  });
}
