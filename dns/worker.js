// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * Locket Gold DNS — B1sTeam v4.0 (1 FILE DUY NHẤT cho toàn hệ thống) · DoH Worker (Cloudflare, RFC 8484)
 * Endpoint: https://doh.b1s.id.vn/dns-query
 *
 * GỘP CHUNG DNS VỀ 1 FILE — mọi app/tính năng B1sTeam dùng chung resolver này:
 *   • Split DNS (qua profile mobileconfig / Private DNS Android):
 *       only Locket/RevenueCat/Firebase RC → qua DNS này (chặn anti-revoke)
 *   • Mọi query khác → Race 3 upstream (1.1.1.1 / 8.8.8.8 / 9.9.9.9) — upstream đầu tiên trả lời THẮNG.
 *   • Edge cache (caches.default): GET & POST (POST cache theo hash query) — hàng nghìn thiết bị
 *     truy cập vẫn chia sẻ cache, gần như 0 upstream call khi hit.
 *   • STALE-IF-ERROR: upstream chết hàng loạt → vẫn phục vụ bản cache (kể cả REFUSED của anti-revoke)
 *     → chống sập "toàn bộ DNS" khi Cloudflare/Google/Quad9 outage.
 *
 * Kiến trúc Split DNS (anti-revoke + telemetry — chặn theo yêu cầu chủ repo):
 *   • revenuecat.com / rc-backup.com / rev.cat              → REFUSED (chống thu hồi)
 *   • app-measurement.com / firebaselogging-pa.googleapis.com / mixpanel.com / api.mixpanel.com / in.appcenter.ms → REFUSED
 *   • Mọi domain khác → race upstream, cache; khi sập tất cả → trả bản cache cũ (stale-if-error).
 *
 * Hỗ trợ cả hai kiểu truy vấn DoH:
 *   • GET  ?name=<domain>&type=<type>  → application/dns-json
 *   • POST (body: application/dns-message) → application/dns-message
 *
 * B1sTeam — b1s.id.vn · Zalo 083.3399.553 · Nguyễn Hoàng Bách
 */

const VERSION = "4.0.0";
const UPSTREAMS = ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query", "https://9.9.9.9/dns-query"];
const CACHE_TTL = 300; // giây — pin cache ở edge Cloudflare
const CACHE_STALE = 86400; // giây — tuổi tối đa bản stale khi upstream chết
/** true = từ chối truy vấn các domain trong BLOCKLIST */
const BLOCK_LOCKET = true;

const BLOCKED_DOMAINS = [
  // Anti-revoke (BẮT BUỘC)
  "revenuecat.com",
  "rc-backup.com",
  "rev.cat",
  // Telemetry (theo yêu cầu chủ repo)
  "app-measurement.com",
  "firebaselogging-pa.googleapis.com",
  "mixpanel.com",
  "api.mixpanel.com",
  "in.appcenter.ms",
];

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Protected-By": "B1sTeam Edge WAF",
  };
}

const isBlocked = (name) => {
  const n = String(name || "").toLowerCase().replace(/\.$/, "");
  return BLOCKED_DOMAINS.some((d) => n === d || n.endsWith("." + d));
};

const dnsJson = (status, question = [], extra = {}) =>
  JSON.stringify({ Status: status, TC: false, RD: true, RA: true, AD: false, CD: false, Question: question, ...extra });

const QUESTION = (name, type) => [{ name, type: Number(type) || 1 }];

/* ─── Upstream race: query 1 upstream tại 1 thời điểm, trả về instance nhanh nhất ─── */
async function raceQueryJson(name, type) {
  const attempt = async (upstream) => {
    const target = new URL(upstream);
    target.searchParams.set("name", name);
    target.searchParams.set("type", String(type || "A"));
    const res = await fetch(target.toString(), {
      headers: { Accept: "application/dns-json" },
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    });
    if (!res.ok) throw new Error(`upstream ${upstream} → HTTP ${res.status}`);
    return res;
  };
  const settled = await Promise.allSettled(UPSTREAMS.map(attempt));
  const ok = settled.find((s) => s.status === "fulfilled");
  if (ok) return ok.value;
  return null;
}

async function raceQueryMessage(body) {
  const attempt = async (upstream) => {
    const res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/dns-message", Accept: "application/dns-message" },
      body,
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    });
    if (!res.ok) throw new Error(`upstream ${upstream} → HTTP ${res.status}`);
    return res;
  };
  const settled = await Promise.allSettled(UPSTREAMS.map(attempt));
  const ok = settled.find((s) => s.status === "fulfilled");
  if (ok) return ok.value;
  return null;
}

/* ─── Hash cho POST cache key (base64url sha256) ─── */
async function hashBody(body) {
  const buf = await crypto.subtle.digest("SHA-256", body);
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ── Health / index
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          success: true,
          service: "locketgold-dns",
          release: "B1sTeam",
          version: VERSION,
          doh: "https://doh.b1s.id.vn/dns-query",
          policy: { blocked: BLOCKED_DOMAINS, upstreams: UPSTREAMS, staleIfError: true, singleFile: true },
          ts: new Date().toISOString(),
        }),
        { status: 200, headers: corsHeaders({ "Content-Type": "application/json; charset=utf-8", ...securityHeaders() }) },
      );
    }

    // ── CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...corsHeaders(), ...securityHeaders() } });
    }

    if (url.pathname !== "/dns-query") {
      return new Response("Not Found", { status: 404, headers: { ...corsHeaders(), ...securityHeaders(), "Content-Type": "text/plain; charset=utf-8" } });
    }

    /* ════════ POST — application/dns-message (RFC 8484 §4.2.2) ════════ */
    if (request.method === "POST") {
      const contentType = (request.headers.get("content-type") || "").split(";")[0].trim();
      if (contentType !== "application/dns-message") {
        return new Response(dnsJson(1, [], { Comment: "Unsupported content-type; use application/dns-message" }), {
          status: 415,
          headers: corsHeaders({ "Content-Type": "application/dns-json", ...securityHeaders() }),
        });
      }

      let body;
      try {
        body = await request.arrayBuffer();
        if (body.byteLength === 0 || body.byteLength > 512) {
          return new Response(dnsJson(1, [], { Comment: "Invalid dns-message length" }), {
            status: 400,
            headers: corsHeaders({ "Content-Type": "application/dns-json", ...securityHeaders() }),
          });
        }
      } catch {
        return new Response("Bad Request", { status: 400, headers: corsHeaders({ ...securityHeaders(), "Content-Type": "text/plain; charset=utf-8" }) });
      }

      const qname = readQName(body);
      if (BLOCK_LOCKET && qname && isBlocked(qname)) {
        return refusedDnsMessage(body);
      }

      // ── POST cache (synthetic key từ hash body) — chống sập cả khi Google/CF/Quad9 đồng loạt lỗi
      const cache = caches.default;
      const postKey = new Request(`https://doh.b1s.id.vn/__cache_post/${await hashBody(new Uint8Array(body))}`, { method: "GET" });
      const cached = await cache.match(postKey);
      if (cached) {
        return new Response(cached.body, {
          status: 200,
          headers: corsHeaders({ "Content-Type": "application/dns-message", "Cache-Control": `public, max-age=${CACHE_TTL}`, "X-Cache": "HIT", ...securityHeaders() }),
        });
      }

      const upstream = await raceQueryMessage(body);
      if (upstream && upstream.ok) {
        const buf = await upstream.arrayBuffer();
        const resp = new Response(buf, {
          status: 200,
          headers: corsHeaders({ "Content-Type": "application/dns-message", "Cache-Control": `public, max-age=${CACHE_TTL}`, "X-Cache": "MISS", ...securityHeaders() }),
        });
        const cachedCopy = resp.clone();
        cachedCopy.headers.set("Cache-Control", `public, max-age=${CACHE_STALE}`);
        cachedCopy.headers.set("X-Cache", "STORED");
        try { cache.put(postKey, cachedCopy); } catch { /* bỏ qua */ }
        return resp;
      }

      // ── stale-if-error: dùng bản stale nếu có (kể cả khi upstream chết hàng loạt)
      const stale = await cache.match(postKey, { ignoreMethod: false, ignoreSearch: false, ignoreVary: true }).catch(() => null);
      if (stale) {
        return new Response(stale.body, {
          status: 200,
          headers: corsHeaders({ "Content-Type": "application/dns-message", "Cache-Control": `public, max-age=${CACHE_STALE}`, "X-Cache": "STALE", ...securityHeaders() }),
        });
      }
      return new Response("Upstream Unavailable", { status: 502, headers: corsHeaders({ ...securityHeaders(), "Content-Type": "text/plain; charset=utf-8" }) });
    }

    /* ════════ GET — application/dns-json (edge-cached + race + stale-if-error) ════════ */
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { ...corsHeaders(), Allow: "GET, POST, OPTIONS", ...securityHeaders() } });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = request.method === "GET" ? await cache.match(cacheKey) : null;
    if (cached) return cached;

    const respondGet = (response) => {
      if (request.method === "GET" && response.status === 200) {
        // Trả client bản max-age=TTL ngắn, LƯU cache bản stale dài (chống sập)
        const cachedCopy = response.clone();
        cachedCopy.headers.set("Cache-Control", `public, max-age=${CACHE_STALE}`);
        cachedCopy.headers.set("X-Cache", "STORED");
        try { cache.put(cacheKey, cachedCopy); } catch { /* bỏ qua */ }
        const out = new Response(response.body, response);
        out.headers.set("X-Cache", "MISS");
        return out;
      }
      return response;
    };

    const name = url.searchParams.get("name");
    const typeParam = (url.searchParams.get("type") || "A").toUpperCase();
    const type = /^\d+$/.test(typeParam) ? Number(typeParam) : ({ A: 1, AAAA: 28, CNAME: 5, TXT: 16, MX: 15, NS: 2, SOA: 6, HTTPS: 65, SVCB: 64 }[typeParam] || null);

    if (!name || name.length > 253) {
      return new Response(dnsJson(1, [], { Comment: "Missing or invalid 'name'" }), {
        status: 400,
        headers: corsHeaders({ "Content-Type": "application/dns-json", ...securityHeaders() }),
      });
    }
    if (type === null) {
      return new Response(dnsJson(1, [], { Comment: `Unsupported type '${typeParam}'` }), {
        status: 400,
        headers: corsHeaders({ "Content-Type": "application/dns-json", ...securityHeaders() }),
      });
    }

    const question = QUESTION(name, type);

    // ── Split DNS: REFUSED các domain anti-revoke / telemetry
    if (BLOCK_LOCKET && isBlocked(name)) {
      return respondGet(new Response(dnsJson(5, question, { Comment: "Blocked by LocketGold anti-revoke policy (B1sTeam)" }), {
        status: 200, // dns-json convention: HTTP 200 + Status 5 (REFUSED)
        headers: corsHeaders({ "Content-Type": "application/dns-json", "Cache-Control": `public, max-age=${CACHE_STALE}`, ...securityHeaders() }),
      }));
    }

    const upstream = await raceQueryJson(name, type);
    if (upstream) {
      const data = await upstream.json();
      return respondGet(new Response(JSON.stringify(data), {
        status: 200,
        headers: corsHeaders({ "Content-Type": "application/dns-json", "Cache-Control": `public, max-age=${CACHE_TTL}`, ...securityHeaders() }),
      }));
    }

    // ── stale-if-error: phục vụ bản cũ nếu upstream chết hết
    const stale = await cache.match(cacheKey).catch(() => null);
    if (stale) {
      return new Response(stale.body, {
        status: 200,
        headers: corsHeaders({ "Content-Type": "application/dns-json", "Cache-Control": `public, max-age=${CACHE_STALE}`, "X-Cache": "STALE", ...securityHeaders() }),
      });
    }

    return new Response(dnsJson(2, question, { Comment: "Upstream unavailable" }), {
      status: 502,
      headers: corsHeaders({ "Content-Type": "application/dns-json", ...securityHeaders() }),
    });
  },
};

/* ─── Đọc QNAME từ dns-message ─── */
function readQName(buffer) {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    const labels = [];
    while (offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      if (len === 0) break;
      if ((len & 0xc0) === 0xc0) return null;
      offset += 1;
      if (offset + len > buffer.byteLength) return null;
      labels.push(new TextDecoder().decode(new Uint8Array(buffer, offset, len)));
      offset += len;
    }
    return labels.join(".");
  } catch {
    return null;
  }
}

/* ─── Trả REFUSED với question gốc (giữ transaction id) ─── */
function refusedDnsMessage(queryBuffer) {
  const bytes = new Uint8Array(queryBuffer);
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  const view = new DataView(out.buffer);
  const flags = view.getUint16(2);
  const rd = (flags >> 8) & 0x01;
  const opcode = (flags >> 11) & 0xf;
  view.setUint16(2, 0x8000 | (opcode << 11) | (rd << 8) | 0x0080 | 0x0005);
  view.setUint16(4, 1); // QDCOUNT = 1
  view.setUint16(6, 0); // ANCOUNT = 0
  view.setUint16(8, 0); // NSCOUNT = 0
  view.setUint16(10, 0); // ARCOUNT = 0
  let offset = 12;
  while (offset < out.length) {
    const len = view.getUint8(offset);
    if (len === 0) { offset += 1; break; }
    offset += 1 + len;
  }
  const questionEnd = offset + 4; // QTYPE + QCLASS
  return new Response(out.slice(0, questionEnd), {
    status: 200,
    headers: corsHeaders({ "Content-Type": "application/dns-message", "Cache-Control": `public, max-age=${CACHE_STALE}`, ...securityHeaders() }),
  });
}
