// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * B1S SPOTIFY — script MITM của B1sTeam cho Spotify (iOS).
 * ───────────────────────────────────────────────────────────────────────────────
 * Tự viết từ đầu (KHÔNG dùng protobufjs / script của bên thứ ba):
 *   1) Engine Protobuf tối giản: đọc/ghi wire-format (varint, 64-bit, length-delimited,
 *      32-bit), dựng cây message, áp rule theo "chữ ký" field, ghi lại bytes.
 *   2) JSON "customize" (user-customization-service) → ép gói premium.
 *   3) JSON "pathfinder"/"token" → ép nhãn premium.
 *
 * Rule Protobuf (cấu hình trong B1S_CONFIG, do worker chèn):
 *   {
 *     "protoRules": [
 *       { "has": [1, 2], "minVarint": 8, "set": { "8": 1, "9": 0, "10": 0, "11": 1,
 *                                                 "12": 0, "13": 1, "14": 1, "15": 1 },
 *         "onlyExisting": true }
 *     ],
 *     "jsonPatches": { "product": "premium", "subscription.plan": "premium" },
 *     "jsonTemplate": null
 *   }
 *
 * Nguyên tắc B1sTeam: không phone-home, không telemetry, không gửi dữ liệu người dùng đi đâu.
 * License gate fail-closed (key sai / offline > 72h → trả nguyên body gốc).
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";
var B1S_CONFIG = { "__B1S_CONFIG__": 1 };
var B1S_CONFIGS = {"spotify-premium":{"protoRules":[{"has":[1,2],"minVarint":8,"set":{"8":1,"9":0,"10":0,"11":1,"12":0,"13":1,"14":1,"15":1},"onlyExisting":true}],"jsonPatches":{"product":"premium","plan":"premium","subscription.plan":"premium","subscription.product":"premium","isPremium":true,"hasPremium":true,"shuffle":true,"onDemand":true,"ads":false,"ad":false},"urlRules":[{"match":"com:443","replace":["com:443","com"]},{"match":"platform=iphone","replace":["platform=iphone","platform=ipad"]}]}};

/* B1S-CDN-ARG: module mới (CDN jsDelivr) truyền "KEY|slug" qua $argument — không chứa dấu phẩy.
   Module cũ: worker vá 2 dòng placeholder ở trên — giữ tương thích ngược. */
try {
  var _rawArg = (typeof $argument !== "undefined" && $argument) ? String($argument) : "";
  var _argParts = _rawArg.split("|");
  var _argKey = (_argParts[0] || "").trim().toUpperCase();
  if (/^B1S-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(_argKey)) LICENSE_KEY = _argKey;
  var _argSlug = (_argParts[1] || "").trim().toLowerCase();
  if (typeof B1S_CONFIGS !== "undefined" && _argSlug && Object.prototype.hasOwnProperty.call(B1S_CONFIGS, _argSlug)) {
    B1S_CONFIG = B1S_CONFIGS[_argSlug];
  }
} catch (_e) { /* giữ giá trị worker chèn (module cũ) */ }

/* ═══════════════════════ License gate (fail-closed) ═══════════════════════ */
var memDeviceId = null;

function deviceId() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) {
      var id1 = $prefs.valueForKey("b1s_lg_device_id");
      if (id1) return id1;
      id1 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $prefs.setValueForKey(id1, "b1s_lg_device_id");
      return id1;
    }
  } catch (e) { /* tiếp tục */ }
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var id2 = $persistentStore.read("b1s_lg_device_id");
      if (id2) return id2;
      id2 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $persistentStore.write(id2, "b1s_lg_device_id");
      return id2;
    }
  } catch (e) { /* tiếp tục */ }
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
}

function lastVerifiedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey("b1s_lg_ok_at") || 0);
  } catch (e) { /* bỏ qua */ }
  return 0;
}

function markVerified() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), "b1s_lg_ok_at");
  } catch (e) { /* bỏ qua */ }
}

function gate(doAllow, doDeny) {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return doDeny();
  if (Date.now() - lastVerifiedAt() < 259200000) return doAllow(); // 72h
  var id = deviceId();
  if (!id) return doDeny();
  if (typeof $httpClient === "undefined" || !$httpClient) return doDeny();
  $httpClient.get(
    {
      url: "https://locket.b1s.id.vn/api/v2/locketgold/verify?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" },
      timeout: 10,
    },
    function (err, response, data) {
      if (err) return doDeny();
      var body = "";
      if (typeof data === "string") body = data;
      else if (typeof data !== "undefined" && data !== null) {
        try { body = String(data); } catch (e) { return doDeny(); }
      } else if (response && typeof response.body === "string") body = response.body;
      if (!body) return doDeny();
      try {
        var j = JSON.parse(body);
        return (j && j.valid === true) ? (markVerified(), doAllow()) : doDeny();
      } catch (e) {
        return doDeny();
      }
    }
  );
}

/* ═══════════════════════ Base64 (thuần JS — không phụ thuộc Buffer/atob) ═══════════════════════ */
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

/* ═══════════════════════ Protobuf engine (tự viết) ═══════════════════════ */
function readVarint(bytes, pos) {
  var result = 0, shift = 0, b = 0;
  while (pos < bytes.length) {
    b = bytes[pos++];
    result += (b & 127) * Math.pow(2, shift);
    if (!(b & 128)) break;
    shift += 7;
    if (shift > 63) break;
  }
  return { value: result, pos: pos };
}

function encodeVarint(value) {
  var out = [];
  var v = value;
  while (v > 127) {
    out.push((v % 128) + 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}

/** Parse 1 message → mảng field { f: số hiệu, w: wire type, v: giá trị } | null nếu lỗi. */
function parseMessage(bytes) {
  var fields = [];
  var pos = 0;
  while (pos < bytes.length) {
    var t = readVarint(bytes, pos);
    pos = t.pos;
    var field = Math.floor(t.value / 8);
    var wire = t.value % 8;
    if (field <= 0) return null;
    if (wire === 0) {
      var v0 = readVarint(bytes, pos);
      if (v0.pos <= pos) return null;
      pos = v0.pos;
      fields.push({ f: field, w: 0, v: v0.value });
    } else if (wire === 1) {
      if (pos + 8 > bytes.length) return null;
      fields.push({ f: field, w: 1, v: bytes.subarray(pos, pos + 8) });
      pos += 8;
    } else if (wire === 2) {
      var l = readVarint(bytes, pos);
      pos = l.pos;
      var len = l.value;
      if (pos + len > bytes.length) return null;
      fields.push({ f: field, w: 2, v: bytes.subarray(pos, pos + len) });
      pos += len;
    } else if (wire === 5) {
      if (pos + 4 > bytes.length) return null;
      fields.push({ f: field, w: 5, v: bytes.subarray(pos, pos + 4) });
      pos += 4;
    } else {
      return null;
    }
  }
  return fields;
}

function serializeMessage(fields) {
  var out = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var tag = encodeVarint(f.f * 8 + f.w);
    for (var t = 0; t < tag.length; t++) out.push(tag[t]);
    if (f.w === 0) {
      var enc = encodeVarint(f.v);
      for (var e = 0; e < enc.length; e++) out.push(enc[e]);
    } else if (f.w === 2) {
      var lenEnc = encodeVarint(f.v.length);
      for (var l = 0; l < lenEnc.length; l++) out.push(lenEnc[l]);
      for (var b = 0; b < f.v.length; b++) out.push(f.v[b]);
    } else {
      for (var k = 0; k < f.v.length; k++) out.push(f.v[k]);
    }
  }
  return new Uint8Array(out);
}

/** Node = { fields: [...], children: Map(fieldNumber -> childNode) } */
function buildTree(fields, depth) {
  var node = { fields: fields, children: [] };
  if ((depth || 0) > 6) return node;
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.w !== 2 || !f.v || f.v.length === 0) continue;
    var child = parseMessage(f.v);
    if (!child || !child.length) continue;
    node.children.push(buildTree(child, (depth || 0) + 1));
  }
  return node;
}

function hasField(node, num) {
  for (var i = 0; i < node.fields.length; i++) if (node.fields[i].f === num) return true;
  return false;
}

function countVarintAtLeast(node, num) {
  var c = 0;
  for (var i = 0; i < node.fields.length; i++) {
    if (node.fields[i].w === 0 && node.fields[i].f >= num) c++;
  }
  return c;
}

/** Áp rule lên node (đệ quy) — trả về true nếu có thay đổi. */
function applyRules(node, rules) {
  var changed = false;
  for (var r = 0; r < rules.length; r++) {
    var rule = rules[r];
    if (!rule) continue;
    var has = rule.has || [];
    var ok = true;
    for (var h = 0; h < has.length; h++) {
      if (!hasField(node, has[h])) { ok = false; break; }
    }
    if (!ok) continue;
    if (rule.minVarint && countVarintAtLeast(node, rule.minVarint) < 1) continue;
    var set = rule.set || {};
    for (var num in set) {
      if (!Object.prototype.hasOwnProperty.call(set, num)) continue;
      var fieldNo = parseInt(num, 10);
      var found = false;
      for (var i = 0; i < node.fields.length; i++) {
        if (node.fields[i].f === fieldNo && node.fields[i].w === 0) {
          if (node.fields[i].v !== set[num]) {
            node.fields[i].v = set[num];
            changed = true;
          }
          found = true;
          break;
        }
      }
      if (!found && !rule.onlyExisting) {
        node.fields.push({ f: fieldNo, w: 0, v: set[num] });
        changed = true;
      }
    }
  }
  for (var c = 0; c < node.children.length; c++) {
    if (applyRules(node.children[c], rules)) changed = true;
  }
  return changed;
}

/** Ghi lại cây → bytes (giữ nguyên field chưa đổi). */
function serializeTree(node) {
  for (var c = 0; c < node.children.length; c++) {
    var child = node.children[c];
    var bytes = serializeTree(child);
    // tìm field cha tương ứng (thứ tự children khớp thứ tự field length-delimited parse được)
    var idx = 0;
    for (var i = 0; i < node.fields.length; i++) {
      if (node.fields[i].w !== 2 || !node.fields[i].v || node.fields[i].v.length === 0) continue;
      var probe = parseMessage(node.fields[i].v);
      if (!probe || !probe.length) continue;
      if (idx === c) { node.fields[i].v = bytes; break; }
      idx++;
    }
  }
  return serializeMessage(node.fields);
}

/* ═══════════════════════ JSON patch ═══════════════════════ */
function setPath(root, path, value) {
  var parts = String(path).split(".");
  var node = root;
  for (var i = 0; i < parts.length - 1; i++) {
    var key = parts[i];
    if (!node || typeof node !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(node, key)) node[key] = {};
    node = node[key];
  }
  if (!node || typeof node !== "object") return false;
  node[parts[parts.length - 1]] = value;
  return true;
}

/* ═══════════════════════ Entry point ═══════════════════════ */
var IS_REQUEST_PHASE = (typeof $response === "undefined");

/** URL rules cho request phase (vd: đổi platform=iphone → ipad, bỏ ":443"). */
function applyUrlRules(url) {
  var rules = B1S_CONFIG.urlRules || [];
  if (!rules.length || !url) return url;
  var out = url;
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (!r || !r.match) continue;
    if (out.indexOf(String(r.match)) === -1) continue;
    if (r.replace && r.replace.length >= 2) {
      out = out.split(String(r.replace[0])).join(String(r.replace[1]));
    }
  }
  return out;
}

if (IS_REQUEST_PHASE) {
  gate(
    function () {
      var url = ($request && $request.url) ? String($request.url) : "";
      var next = applyUrlRules(url);
      $done(next && next !== url ? { url: next } : {});
    },
    function () { $done({}); }
  );
} else {
  var body = (typeof $response !== "undefined" && $response && $response.body) ? String($response.body) : "";
  if (!body) { $done({}); }
  else {
    gate(
      function () {
        var isJson = body.charAt(0) === "{" || body.charAt(0) === "[";
        try {
          if (isJson) {
            var obj = JSON.parse(body);
            var patches = B1S_CONFIG.jsonPatches || {};
            var changed = false;
            for (var p in patches) {
              if (!Object.prototype.hasOwnProperty.call(patches, p)) continue;
              if (setPath(obj, p, patches[p])) changed = true;
            }
            if (B1S_CONFIG.jsonTemplate) {
              obj = B1S_CONFIG.jsonTemplate;
              changed = true;
            }
            if (!changed) { $done({}); return; }
            $done({ body: JSON.stringify(obj) });
            return;
          }

          // Body nhị phân (protobuf) — Shadowrocket trả base64
          var bytes = b64ToBytes(body);
          if (!bytes.length) { $done({}); return; }
          var fields = parseMessage(bytes);
          if (!fields) { $done({}); return; }
          var tree = buildTree(fields, 0);
          var rules = B1S_CONFIG.protoRules || [];
          var dirty = applyRules(tree, rules);
          if (!dirty) { $done({}); return; }
          $done({ body: bytesToB64(serializeTree(tree)) });
        } catch (e) {
          $done({});
        }
      },
      function () { $done({}); }
    );
  }
}
