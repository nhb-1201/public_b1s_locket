// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * LocketGold B1sTeam — "Vinh danh Cộng đồng Gold" (opt-in) v1.0
 *
 *   RESPONSE mọi API Locket → quét payload, tìm user-node có username/uid thuộc
 *   danh sách vinh danh (GET locket.b1s.id.vn/api/v2/locketgold/vip/list)
 *   → gắn badge Gold + verified cho các thành viên trong app bạn.
 *
 *   Nguyên tắc riêng tư:
 *     · KHÔNG tự động đăng ký bạn vào vinh danh — việc này do bạn chủ động làm
 *       trên b1s.id.vn/alfretro (nhập username Locket).
 *     · KHÔNG ghi gì lên server Locket, KHÔNG đụng bio/credit của người khác.
 *     · Danh sách fetch tối đa 1 lần / 12 giờ, cache bền trên máy, không chặn request.
 *
 * License gate fail-closed (lib/license-gate.js) — key sai / sai máy / hết grace → trả body gốc.
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";

// @b1s-include ./lib/cdn-arg.js
// @b1s-include ./lib/license-gate.js

var VIP_API = "https://locket.b1s.id.vn/api/v2/locketgold/vip/list";
var VIP_TTL_MS = 43200000; // 12 giờ
var VIP_STORE_AT = "b1s_vip_list_at";
var VIP_STORE_DATA = "b1s_vip_list_data";

function storeRead(k) { return b1sStoreGet(k); }
function storeWrite(k, v) { return b1sStoreSet(k, v); }

/** Đọc danh sách vinh danh đã cache { at, usernames[], uids[] }. */
function loadVip() {
  try {
    var raw = storeRead(VIP_STORE_DATA);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    var usernames = Array.isArray(data.usernames) ? data.usernames : [];
    var uids = Array.isArray(data.uids) ? data.uids : [];
    return {
      at: Number(storeRead(VIP_STORE_AT) || 0),
      usernames: usernames,
      uids: uids,
    };
  } catch (e) {
    return null;
  }
}

/** Fetch nền 1 lần / 12 giờ — KHÔNG chặn response hiện tại. */
function maybeRefreshVip() {
  var cached = loadVip();
  var at = cached ? cached.at : 0;
  if (Date.now() - at < VIP_TTL_MS) return;
  if (typeof $httpClient === "undefined" || !$httpClient) return;
  try {
    $httpClient.get(
      { url: VIP_API, headers: { Accept: "application/json", "User-Agent": "B1S-LocketGold-VIP/1.0" }, timeout: 10 },
      function (err, response, data) {
        if (err) return;
        try {
          var text = typeof data === "string" ? data : (data ? String(data) : "");
          if (!text) return;
          var j = JSON.parse(text);
          var members = [];
          if (j && j.data && Array.isArray(j.data.members)) members = j.data.members;
          else if (j && Array.isArray(j.members)) members = j.members;
          else if (Array.isArray(j)) members = j;
          var unameArr = [];
          var uidArr = [];
          for (var i = 0; i < members.length; i++) {
            var u = members[i] || {};
            var nm = String(u.username || "").toLowerCase().trim();
            if (nm && unameArr.indexOf(nm) === -1) unameArr.push(nm);
            var id = String(u.uid || "").toLowerCase().trim();
            if (id && uidArr.indexOf(id) === -1) uidArr.push(id);
          }
          storeWrite(VIP_STORE_DATA, JSON.stringify({ usernames: unameArr, uids: uidArr }));
          storeWrite(VIP_STORE_AT, String(Date.now()));
          console.log("[locketgold] vip: đồng bộ " + unameArr.length + " thành viên vinh danh");
        } catch (e) { /* body lỗi — giữ cache cũ */ }
      }
    );
  } catch (e) { /* bỏ qua */ }
}

function toSet(arr) {
  var set = {};
  for (var i = 0; i < arr.length; i++) set[arr[i]] = true;
  return set;
}

/** Gắn badge Gold cho thành viên vinh danh. */
function applyGold(node) {
  node.badge = "gold";
  node.badge_tier = "gold";
  node.badge_name = "Gold";
  node.is_gold = true;
  node.is_gold_badge = true;
  node.gold_badge = true;
  node.gold_badge_enabled = true;
  node.badge_gold = true;
  node.badge_enabled = true;
  node.use_gold_badge = true;
  node.verified = true;
  node.is_verified = true;
  node.verified_badge = true;
  // Marker cộng đồng — để hiển thị/đồng bộ vinh danh (Locket bỏ qua key lạ, an toàn)
  node.community_gold = true;
  node.locket_gold_community = true;
  node.badge_community = "gold";
}

function nodeName(node) {
  if (typeof node.username === "string") return node.username.toLowerCase().trim();
  if (typeof node.user_name === "string") return node.user_name.toLowerCase().trim();
  if (typeof node.handle === "string") return node.handle.toLowerCase().trim();
  return "";
}
function nodeId(node) {
  if (typeof node.uid === "string") return node.uid.toLowerCase().trim();
  if (typeof node.user_id === "string") return node.user_id.toLowerCase().trim();
  if (typeof node.id === "string") return node.id.toLowerCase().trim();
  return "";
}

/** Duyệt payload, tìm user-node thuộc vinh danh và gắn badge. Trả số node đã gắn. */
function walkAndBadge(node, depth, uSet, idSet, counter) {
  var d = depth || 0;
  if (!node || typeof node !== "object" || d > 24) return 0;

  if (Array.isArray(node)) {
    var sum = 0;
    for (var i = 0; i < node.length; i++) sum += walkAndBadge(node[i], d + 1, uSet, idSet, counter);
    return sum;
  }

  var marked = 0;
  var nm = nodeName(node);
  var id = nodeId(node);
  var hit = (nm && uSet[nm]) || (id && idSet[id]);
  if (hit) {
    applyGold(node);
    marked = 1;
  }

  for (var k in node) {
    if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
    var child = node[k];
    if (child && typeof child === "object") marked += walkAndBadge(child, d + 1, uSet, idSet, counter);
  }
  return marked;
}

function isJsonish(body) {
  if (!body || typeof body !== "string") return false;
  var t = body.replace(/^\s+/, "");
  var c = t.charAt(0);
  return c === "{" || c === "[";
}

function main() {
  var rawBody = (typeof $response !== "undefined" && $response && typeof $response.body === "string") ? $response.body : null;

  gate(
    function () {
      maybeRefreshVip(); // cập nhật nền, không chặn
      if (!isJsonish(rawBody)) { $done({ body: rawBody }); return; }
      var vip = loadVip();
      if (!vip || (vip.usernames.length === 0 && vip.uids.length === 0)) {
        $done({ body: rawBody });
        return;
      }
      try {
        var obj = JSON.parse(rawBody);
        var marked = walkAndBadge(obj, 0, toSet(vip.usernames), toSet(vip.uids), 0);
        if (marked > 0) console.log("[locketgold] vip: badge Gold cho " + marked + " thành viên vinh danh");
        $done({ headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(obj) });
      } catch (e) {
        $done({ body: rawBody });
      }
    },
    function () {
      $done({ body: rawBody }); // license không hợp lệ — giữ nguyên
    },
    "vip"
  );
}

main();
