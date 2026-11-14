/* B1sTeam — Tiện ích HTTP dùng chung (build inline vào script). */

function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

function headerValue(headers, name) {
  if (!headers) return "";
  var lk = String(name).toLowerCase();
  for (var hk in headers) {
    if (!hasOwn(headers, hk)) continue;
    if (String(hk).toLowerCase() === lk) return String(headers[hk] || "");
  }
  return "";
}

/** WebSocket handshake (HTTP/HTTPS Upgrade) — phải giữ nguyên tuyệt đối. */
function isWebSocketUpgrade(headers) {
  if (!headers) return false;
  var upgrade = headerValue(headers, "upgrade").toLowerCase();
  if (upgrade === "websocket") return true;
  if (headerValue(headers, "sec-websocket-key")) return true;
  if (headerValue(headers, "sec-websocket-version")) return true;
  var conn = headerValue(headers, "connection").toLowerCase();
  if (conn.indexOf("upgrade") !== -1 && upgrade === "websocket") return true;
  return false;
}

/** Đường dẫn WebSocket của Locket (wss_v2/group…) — defense-in-depth khi thiếu header. */
function isWebSocketPath(url) {
  if (!url) return false;
  var u = String(url).toLowerCase();
  return u.indexOf("/wss_v2/") !== -1 || u.indexOf("/ws_v2/") !== -1 ||
         u.indexOf("/websocket") !== -1;
}
