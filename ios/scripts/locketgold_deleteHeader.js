// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam v3.0 — Strip Conditional/ETag headers
 * Xóa toàn bộ ETag / If-None-Match / If-Match trên request tới RevenueCat
 * để server luôn trả về bản entitlement mới nhất (không 304, không cache lỗi thời).
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var headers = (typeof $request !== "undefined" && $request && $request.headers) ? $request.headers : {};

var DROP = [
  "x-revenuecat-etag",
  "if-none-match",
  "if-match",
  "if-modified-since"
];

var cleaned = {};
for (var key in headers) {
  if (!Object.prototype.hasOwnProperty.call(headers, key)) continue;
  if (DROP.indexOf(String(key).toLowerCase()) !== -1) continue; // bỏ hẳn, không để giá trị rỗng
  cleaned[key] = headers[key];
}

$done({ headers: cleaned });
