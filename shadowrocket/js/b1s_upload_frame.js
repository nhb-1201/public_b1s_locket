// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
// file:    b1s_upload_frame.js
// version: 4.0.0
/* B1sTeam — LocketGold (Free) — B1sTeam v3.0.0 · cap nhat 2026-11-14 · module suite 4.0.0 */
var B1S_VERSION = "3.0.0";
var B1S_UPDATED = "2026-11-14";
var B1S_SUITE = "4.0.0";
/**
 * B1sTeam — LocketGold: tự vẽ khung Kawaii lên ảnh TRƯỚC khi ảnh rời máy.
 *
 * Luồng: ảnh Locket được upload lên Firebase/GCS (bucket locket-*) → script này chặn
 * request upload, gửi bytes sang worker B1sTeam (photon WASM) để crop vuông 1024 +
 * vẽ khung → thay body bằng ảnh đã có khung. Bạn bè thấy ảnh ĐÃ CÓ KHUNG ngay.
 *
 * FAIL-OPEN TUYỆT ĐỐI: không license / không body / worker lỗi / quá lớn → ảnh đi qua
 * nguyên trạng (người dùng không bao giờ mất ảnh).
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách · Zalo 083.3399.553
 */
(function () {
  'use strict';

  var B1S_VERSION = '4.0.0';
  var B1S_UPDATED = '2026-11-14';
  var B1S_SUITE = 'upload-frame';

  /* Key nhúng — backend thay placeholder "__LICENSE_KEY__" lúc sinh bản phát hành. */
  var LICENSE_KEY = '__LICENSE_KEY__';

  /* ── Cấu hình ─────────────────────────────────────────────────────────── */

  /* Pool edge Cloudflare của B1sTeam — xoay vòng, lỗi thì thử node kế tiếp. */
  var FRAME_EDGES = [
    'https://b1steam-frame-raw.nhb-120111.workers.dev',
    'https://locket-filter-frame.b1s-locket02-b1steam.workers.dev',
    'https://locket-filter-frame.b1steam-edge-03.workers.dev',
    'https://locket-filter-frame.b1steam-edge-05.workers.dev',
    'https://locket-filter-frame.beslin.workers.dev',
  ];

  var MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB — ảnh Locket sau nén ~1–2 MB
  var FRAME_FILTER_ID = 'khung_gold';        // khung Kawaii Gold (frame-12-gold)
  var FRAME_MARKER_KEY = 'b1s_frame_applied_at';
  var FRAME_MARKER_TTL_MS = 10 * 60 * 1000;  // 10 phút — tránh vẽ khung 2 lần

  function log(msg) {
    try { console.log('[b1s][' + B1S_SUITE + '] ' + msg); } catch (e) { /* bỏ qua */ }
  }

  /* ── Tiện ích ─────────────────────────────────────────────────────────── */

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function headerValue(headers, name) {
    if (!headers) return '';
    var lower = String(name).toLowerCase();
    for (var k in headers) {
      if (!hasOwn(headers, k)) continue;
      if (String(k).toLowerCase() === lower) return String(headers[k]);
    }
    return '';
  }

  /** Bytes nhị phân của request (bodyBytes trước, fallback binary string). */
  function requestBytes(req) {
    try {
      if (req && req.bodyBytes && typeof req.bodyBytes.length === 'number' && req.bodyBytes.length > 0) {
        return req.bodyBytes;
      }
    } catch (e) { /* thử tầng tiếp theo */ }
    try {
      if (req && typeof req.body === 'string' && req.body) {
        return binaryStringToBytes(req.body);
      }
    } catch (e) { /* bỏ qua */ }
    return null;
  }

  function binaryStringToBytes(str) {
    var out = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }

  var B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  /* Base64 thuần JS — Shadowrocket/JSCore KHÔNG có btoa/atob (Buffer cũng không tồn tại). */
  function bytesToB64(bytes) {
    var out = '';
    var i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64_ALPHABET.charAt((n >> 18) & 63) + B64_ALPHABET.charAt((n >> 12) & 63) +
             B64_ALPHABET.charAt((n >> 6) & 63) + B64_ALPHABET.charAt(n & 63);
    }
    var rem = bytes.length - i;
    if (rem === 2) {
      var n2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64_ALPHABET.charAt((n2 >> 18) & 63) + B64_ALPHABET.charAt((n2 >> 12) & 63) + B64_ALPHABET.charAt((n2 >> 6) & 63) + '=';
    } else if (rem === 1) {
      var n1 = bytes[i] << 16;
      out += B64_ALPHABET.charAt((n1 >> 18) & 63) + B64_ALPHABET.charAt((n1 >> 12) & 63) + '==';
    }
    return out;
  }

  function b64ToBytes(b64) {
    try {
      var clean = String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
      var pad = clean.indexOf('=');
      if (pad !== -1) clean = clean.slice(0, pad);
      var len = Math.floor((clean.length * 3) / 4);
      var out = new Uint8Array(len);
      var p = 0, i = 0;
      while (i + 3 < clean.length) {
        var n = (B64_ALPHABET.indexOf(clean.charAt(i)) << 18) | (B64_ALPHABET.indexOf(clean.charAt(i + 1)) << 12) |
                (B64_ALPHABET.indexOf(clean.charAt(i + 2)) << 6) | B64_ALPHABET.indexOf(clean.charAt(i + 3));
        out[p++] = (n >> 16) & 255;
        out[p++] = (n >> 8) & 255;
        out[p++] = n & 255;
        i += 4;
      }
      var rem = clean.length - i;
      if (rem === 3) {
        var n3 = (B64_ALPHABET.indexOf(clean.charAt(i)) << 18) | (B64_ALPHABET.indexOf(clean.charAt(i + 1)) << 12) | (B64_ALPHABET.indexOf(clean.charAt(i + 2)) << 6);
        out[p++] = (n3 >> 16) & 255;
        out[p++] = (n3 >> 8) & 255;
      } else if (rem === 2) {
        var n2 = (B64_ALPHABET.indexOf(clean.charAt(i)) << 18) | (B64_ALPHABET.indexOf(clean.charAt(i + 1)) << 12);
        out[p++] = (n2 >> 16) & 255;
      }
      return out.subarray(0, p);
    } catch (e) {
      return null;
    }
  }

  /** URL thuộc bucket Firebase/GCS của Locket? */
  function isLocketStorageUrl(url) {
    if (!url) return false;
    var u = String(url);
    if (/\/v0\/b\/locket[a-z0-9_-]*/i.test(u)) return true;                       // Firebase v0 REST
    if (/storage\.googleapis\.com\/locket[a-z0-9_-]*\//i.test(u)) return true;        // GCS trực tiếp
    if (/\/storage\/v1\/b\/locket[a-z0-9_-]*/i.test(u)) return true;                // GCS JSON API
    return false;
  }

  /** Upload ảnh Locket (PUT/POST + Content-Type ảnh)? */
  function looksLikeLocketImageUpload(url, method, headers) {
    var m = String(method || 'GET').toUpperCase();
    if (m !== 'PUT' && m !== 'POST') return false;
    if (!isLocketStorageUrl(url)) return false;
    var ct = headerValue(headers, 'content-type').toLowerCase();
    if (ct.indexOf('image/') === 0) return true;
    if (ct.indexOf('application/octet-stream') === 0 || ct.indexOf('binary/octet-stream') === 0) return true;
    if (!ct) return true; // chưa biết Content-Type (session init) — handle sẽ tự bỏ qua nếu không có bytes
    return false;
  }

  /** Đọc/ghi marker "đã vẽ khung" để không vẽ 2 lần. */
  function markerGet() {
    try {
      if (typeof $persistentStore !== 'undefined' && $persistentStore) {
        var v = $persistentStore.read(FRAME_MARKER_KEY);
        if (v !== null && v !== undefined) return Number(v) || 0;
      }
    } catch (e) { /* bỏ qua */ }
    try {
      if (typeof $prefs !== 'undefined' && $prefs) {
        if (typeof $prefs.valueForKey === 'function') {
          var v2 = $prefs.valueForKey(FRAME_MARKER_KEY);
          if (v2 !== null && v2 !== undefined) return Number(v2) || 0;
        }
        if (typeof $prefs.getItem === 'function') {
          return Number($prefs.getItem(FRAME_MARKER_KEY) || 0) || 0;
        }
      }
    } catch (e) { /* bỏ qua */ }
    return 0;
  }

  function markerSet(value) {
    /* Shadowrocket: $persistentStore.write(value, key) — KHÔNG phải (key, value). */
    var s = String(value);
    try {
      if (typeof $persistentStore !== 'undefined' && $persistentStore && typeof $persistentStore.write === 'function') {
        $persistentStore.write(s, FRAME_MARKER_KEY);
      }
    } catch (e) { /* bỏ qua */ }
    try {
      if (typeof $prefs !== 'undefined' && $prefs && typeof $prefs.setValueForKey === 'function') {
        $prefs.setValueForKey(s, FRAME_MARKER_KEY);
      }
    } catch (e) { /* bỏ qua */ }
    try {
      if (typeof $prefs !== 'undefined' && $prefs && typeof $prefs.setItem === 'function') {
        $prefs.setItem(FRAME_MARKER_KEY, s);
      }
    } catch (e) { /* bỏ qua */ }
  }

  function deviceId() {
    try {
      if (typeof $persistentStore !== 'undefined' && $persistentStore) {
        var v = $persistentStore.read('b1s_device_id');
        if (v) return String(v);
      }
    } catch (e) { /* bỏ qua */ }
    var id = 'web-' + Math.random().toString(36).slice(2, 10);
    try {
      if (typeof $persistentStore !== 'undefined' && $persistentStore && typeof $persistentStore.write === 'function') {
        $persistentStore.write(id, 'b1s_device_id');
      }
    } catch (e) { /* bỏ qua */ }
    return id;
  }

  /* ── Xử lý upload ─────────────────────────────────────────────────────── */

  function handleUpload(url, rawHeaders, req) {
    var bytes = requestBytes(req);
    if (!bytes || !bytes.length) {
      log('bỏ qua (không có bodyBytes — có thể là session init, không phải ảnh)');
      $done({});
      return;
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
      log('bỏ qua (quá lớn: ' + bytes.length + ' B)');
      $done({});
      return;
    }

    var b64 = bytesToB64(bytes);
    var dev = deviceId();
    log('xử lý ' + bytes.length + ' B → /frame-raw (khung ' + FRAME_FILTER_ID + ')');

    /* Xáo trộn thứ tự edge — phân bổ tải đều, lỗi 1 edge thì thử edge khác. */
    var order = FRAME_EDGES.slice();
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }

    function tryEdge(idx) {
      if (idx >= order.length) {
        log('cả ' + FRAME_EDGES.length + ' edge đều lỗi — passthrough ảnh gốc');
        $done({});
        return;
      }
      $httpClient.post(
        {
          url: order[idx] + '/frame-raw',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-b1s-license': LICENSE_KEY || '',
            'x-b1s-device': dev,
          },
          body: JSON.stringify({ image_base64: b64, filter_id: FRAME_FILTER_ID }),
          timeout: 25,
        },
        function (err, resp, data) {
          handleEdgeResult(idx, err, resp, data);
        }
      );
    }

    function handleEdgeResult(edgeIndex, err, resp, data) {
      try {
        if (err) {
          log('edge ' + edgeIndex + ' lỗi: ' + String(err).slice(0, 60) + ' — thử edge khác');
          tryEdge(edgeIndex + 1);
          return;
        }
        var raw = typeof data === 'string' && data ? data : (resp && typeof resp.body === 'string' ? resp.body : '');
        var parsed = JSON.parse(raw || '{}');
        if (!parsed || parsed.ok !== true || !parsed.image_base64) {
          log('edge ' + edgeIndex + ' từ chối — thử edge khác');
          tryEdge(edgeIndex + 1);
          return;
        }
        var framed = b64ToBytes(parsed.image_base64);
        if (!framed || !framed.length) { $done({}); return; }

        /* Giữ nguyên header quan trọng (authorization, x-goog-upload-*) — bỏ header
           phụ thuộc body cũ (content-length, digest, md5...). */
        var headers = {};
        for (var hk in rawHeaders) {
          if (!hasOwn(rawHeaders, hk)) continue;
          var lk = String(hk).toLowerCase();
          if (
            lk === 'content-length' || lk === 'content-md5' || lk === 'content-encoding' ||
            lk === 'digest' || lk === 'x-goog-content-md5' || lk === 'x-goog-content-sha256' ||
            lk === 'x-upload-content-length' || lk === 'x-upload-content-type' ||
            lk === 'content-type'
          ) continue;
          headers[hk] = rawHeaders[hk];
        }
        headers['Content-Type'] = 'image/png';

        markerSet(Date.now());
        log('OK — ' + framed.length + ' B (ảnh đã có khung)');
        $done({ headers: headers, bodyBytes: framed });
      } catch (e) {
        log('exception: ' + String(e).slice(0, 80) + ' — thử edge khác');
        tryEdge(edgeIndex + 1);
      }
    }

    tryEdge(0);
  }

  /* ── Entry ────────────────────────────────────────────────────────────── */

  try {
    var req = (typeof $request !== 'undefined' && $request) ? $request : {};
    var url = req.url ? String(req.url) : '';
    var method = String(req.method || 'GET').toUpperCase();
    var headers = req.headers ? req.headers : {};

    var appliedAt = markerGet();
    var alreadyFramed = appliedAt > 0 && Date.now() - appliedAt < FRAME_MARKER_TTL_MS;
    if (alreadyFramed) {
      log('ảnh đã có khung (vừa rửa ảnh) — passthrough, không vẽ lại');
      $done({});
      return;
    }

    if (!looksLikeLocketImageUpload(url, method, headers)) {
      $done({});
      return;
    }

    handleUpload(url, headers, req);
  } catch (e) {
    /* FAIL-OPEN — không bao giờ làm hỏng upload. */
    try { console.log('[b1s][' + B1S_SUITE + '] lỗi ngoài dự kiến: ' + String(e).slice(0, 120)); } catch (x) { /* bỏ qua */ }
    $done({});
  }
})();
