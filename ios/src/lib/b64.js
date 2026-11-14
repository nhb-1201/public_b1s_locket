/* B1sTeam — Base64 thuần JS (không phụ thuộc Buffer/atob/btoa) — dùng chung cho script cần xử lý nhị phân.
   Shadowrocket/Loon: env không có Buffer; atob/btoa không đảm bảo với dữ liệu nhị phân → tự viết. */
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function b64ToBytes(str) {
  var clean = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
  var pad = clean.indexOf("=");
  if (pad !== -1) clean = clean.slice(0, pad);
  var len = Math.floor((clean.length * 3) / 4);
  var out = new Uint8Array(len);
  var p = 0, i = 0;
  while (i + 3 < clean.length) {
    var n = (B64.indexOf(clean.charAt(i)) << 18) | (B64.indexOf(clean.charAt(i + 1)) << 12) |
            (B64.indexOf(clean.charAt(i + 2)) << 6) | B64.indexOf(clean.charAt(i + 3));
    out[p++] = (n >> 16) & 255;
    out[p++] = (n >> 8) & 255;
    out[p++] = n & 255;
    i += 4;
  }
  var rem = clean.length - i;
  if (rem === 3) {
    var n3 = (B64.indexOf(clean.charAt(i)) << 18) | (B64.indexOf(clean.charAt(i + 1)) << 12) | (B64.indexOf(clean.charAt(i + 2)) << 6);
    out[p++] = (n3 >> 16) & 255;
    out[p++] = (n3 >> 8) & 255;
  } else if (rem === 2) {
    var n2 = (B64.indexOf(clean.charAt(i)) << 18) | (B64.indexOf(clean.charAt(i + 1)) << 12);
    out[p++] = (n2 >> 16) & 255;
  }
  return out.subarray(0, p);
}

function bytesToB64(bytes) {
  var out = "";
  var i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63) + B64.charAt((n >> 6) & 63) + B64.charAt(n & 63);
  }
  var rem = bytes.length - i;
  if (rem === 2) {
    var n2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64.charAt((n2 >> 18) & 63) + B64.charAt((n2 >> 12) & 63) + B64.charAt((n2 >> 6) & 63) + "=";
  } else if (rem === 1) {
    var n1 = bytes[i] << 16;
    out += B64.charAt((n1 >> 18) & 63) + B64.charAt((n1 >> 12) & 63) + "==";
  }
  return out;
}

/** Chuỗi nhị phân (charCodeAt = byte) → Uint8Array — dùng khi $request.body chứa binary string. */
function binaryStringToBytes(s) {
  var out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
