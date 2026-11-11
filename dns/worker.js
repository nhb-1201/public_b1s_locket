// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * Locket Gold DNS — B1sTeam v3.1 · DoH Worker (Cloudflare, RFC 8484)
 * Endpoint: https://doh.b1s.id.vn/dns-query
 *
 * Kiến trúc Split DNS (anti-revoke + telemetry — bản đầy đủ theo yêu cầu chủ repo):
 *   • RevenueCat / rc-backup / rev.cat          → REFUSED (apex + mọi subdomain) — chống thu hồi
 *   • Telemetry (Mixpanel, Firebase Analytics)  → REFUSED (riêng tư)
 *   • Mọi domain khác (locketcamera, firebaseremoteconfig, …) → Cloudflare 1.1.1.1 (fallback Google 8.8.8.8)
 *
 * (2026-11-12 chủ repo yêu cầu khôi phục chặn telemetry — revert quyết định v3.3.)
 *
 * ⚠️ Chặn telemetry có thể làm app báo lỗi kết nối/analytics không gửi được (không ảnh hưởng Gold/tính năng).
 *
 * ⚠️ v3.0.0 CHẶN QUÁ TAY: firebaseremoteconfig.googleapis.com + api.locketcamera.com cũng REFUSED
 *    → app chết hoàn toàn khi bật DNS. v3.1 thu hẹp danh sách đúng chuẩn anti-revoke,
 *    giữ nguyên telemetry blocklist. KHÔNG chặn domain Apple cert/OCSP (Locket cài từ App Store).
 *
 * Hỗ trợ cả hai kiểu truy vấn DoH:
 *   • GET  ?name=<domain>&type=<type>  → application/dns-json
 *   • POST (body: application/dns-message) → forward nguyên trạng (RFC 8484 đầy đủ)
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */

const VERSION = "3.4.0";
const DEFAULT_UPSTREAM = "https://1.1.1.1/dns-query";
const FALLBACK_UPSTREAM = "https://8.8.8.8/dns-query";
const CACHE_TTL = 300; // giây — pin cache ở edge Cloudflare
/** true = từ chối truy vấn các domain trong BLOCKLIST (khuyến nghị khi dùng kèm MITM) */
const BLOCK_LOCKET = true;

const LOCKET_DOMAINS = [
  // Anti-revoke (BẮT BUỘC) — chặn FULL RevenueCat: apex + mọi subdomain
  "revenuecat.com",
  "rc-backup.com",
  "rev.cat", // short domain chính thức (errors.rev.cat…)
  // Telemetry bên thứ 3 (chủ repo yêu cầu khôi phục)
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

const isLocketDomain = (name) => {
  const n = String(name || "").toLowerCase().replace(/\.$/, "");
  return LOCKET_DOMAINS.some((d) => n === d || n.endsWith("." + d));
};

const dnsJson = (status, question = [], extra = {}) =>
  JSON.stringify({ Status: status, TC: false, RD: true, RA: true, AD: false, CD: false, Question: question, ...extra });

const QUESTION = (name, type) => [{ name, type: Number(type) || 1 }];
const TYPE_NAMES = { 1: "A", 28: "AAAA", 5: "CNAME", 16: "TXT", 15: "MX", 2: "NS", 6: "SOA", 65: "HTTPS", 64: "SVCB" };

async function queryJsonUpstream(upstream, name, type) {
  const target = new URL(upstream);
  target.searchParams.set("name", name);
  target.searchParams.set("type", String(type || "A"));
  const res = await fetch(target.toString(), {
    headers: { Accept: "application/dns-json" },
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`upstream ${upstream} → HTTP ${res.status}`);
  return res.json();
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
          split: { blocked: LOCKET_DOMAINS, defaultUpstream: DEFAULT_UPSTREAM, fallback: FALLBACK_UPSTREAM },
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

      // Đọc QNAME tối thiểu để áp dụng blocklist (offset 12, labels length/byte)
      const qname = readQName(body);
      if (BLOCK_LOCKET && qname && isLocketDomain(qname)) {
        return refusedDnsMessage(body); // REFUSED — client giữ trạng thái entitlement đã cache
      }

      try {
        const upstream = await fetch(DEFAULT_UPSTREAM, {
          method: "POST",
          headers: { "Content-Type": "application/dns-message", Accept: "application/dns-message" },
          body,
          cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
        });
        const buf = await upstream.arrayBuffer();
        return new Response(buf, {
          status: upstream.ok ? 200 : 502,
          headers: corsHeaders({
            "Content-Type": "application/dns-message",
            "Cache-Control": `public, max-age=${CACHE_TTL}`,
            ...securityHeaders(),
          }),
        });
      } catch {
        const fallback = await fetch(FALLBACK_UPSTREAM, {
          method: "POST",
          headers: { "Content-Type": "application/dns-message", Accept: "application/dns-message" },
          body,
        }).catch(() => null);
        if (fallback && fallback.ok) {
          return new Response(await fallback.arrayBuffer(), {
            status: 200,
            headers: corsHeaders({ "Content-Type": "application/dns-message", "Cache-Control": `public, max-age=${CACHE_TTL}`, ...securityHeaders() }),
          });
        }
        return new Response("Upstream Unavailable", { status: 502, headers: corsHeaders({ ...securityHeaders(), "Content-Type": "text/plain; charset=utf-8" }) });
      }
    }

    /* ════════ GET — application/dns-json (edge-cached) ════════ */
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { ...corsHeaders(), Allow: "GET, POST, OPTIONS", ...securityHeaders() } });
    }

    // ── Cache API: chỉ GET/HEAD, TTL theo Cache-Control (300s). Hit ⇒ 0 subrequest, 0 CPU đáng kể.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = request.method === "GET" ? await cache.match(cacheKey) : null;
    if (cached) return cached;

    const respondGet = (response) => {
      if (request.method === "GET" && response.status === 200) {
        response = new Response(response.body, response); // clone cho cache
        response.headers.set("X-Cache", "MISS");
        try {
          // put() không chặn response trả về user
          cache.put(cacheKey, response.clone());
        } catch { /* cache đầy/không khả dụng — bỏ qua */ }
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

    // ── Split DNS: REFUSED các domain anti-revoke / telemetry (Locket App Store vẫn chạy bình thường)
    if (BLOCK_LOCKET && isLocketDomain(name)) {
      return respondGet(new Response(dnsJson(5, question, { Comment: "Blocked by LocketGold anti-revoke policy (B1sTeam)" }), {
        status: 200, // dns-json convention: HTTP 200 + Status 5 (REFUSED)
        headers: corsHeaders({ "Content-Type": "application/dns-json", "Cache-Control": `public, max-age=${CACHE_TTL}`, ...securityHeaders() }),
      }));
    }

    // ── Upstream mặc định → fallback nếu lỗi
    let data = null;
    try {
      data = await queryJsonUpstream(DEFAULT_UPSTREAM, name, type);
    } catch {
      try {
        data = await queryJsonUpstream(FALLBACK_UPSTREAM, name, type);
      } catch {
        return new Response(dnsJson(2, question, { Comment: "Upstream unavailable" }), {
          status: 502,
          headers: corsHeaders({ "Content-Type": "application/dns-json", ...securityHeaders() }),
        });
      }
    }

    return respondGet(new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders({ "Content-Type": "application/dns-json", "Cache-Control": `public, max-age=${CACHE_TTL}`, ...securityHeaders() }),
    }));
  },
};

/* ─── Đọc QNAME từ dns-message (bỏ qua header 12 byte + EDNS) ─── */
function readQName(buffer) {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    const labels = [];
    while (offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      if (len === 0) break;
      if ((len & 0xc0) === 0xc0) return null; // compression pointer ở question — không hỗ trợ parse sâu, bỏ qua blocklist
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
  // QR=1, giữ Opcode, AA=0, TC=0, RD giữ nguyên, RA=1, Z=0, RCODE=5 (REFUSED)
  const rd = (flags >> 8) & 0x01;
  const opcode = (flags >> 11) & 0xf;
  view.setUint16(2, 0x8000 | (opcode << 11) | (rd << 8) | 0x0080 | 0x0005);
  view.setUint16(4, 1); // QDCOUNT = 1
  view.setUint16(6, 0); // ANCOUNT = 0
  view.setUint16(8, 0); // NSCOUNT = 0
  view.setUint16(10, 0); // ARCOUNT = 0
  // Cắt bớt body sau question nếu có (giả định 1 question)
  let offset = 12;
  while (offset < out.length) {
    const len = view.getUint8(offset);
    if (len === 0) { offset += 1; break; }
    offset += 1 + len;
  }
  const questionEnd = offset + 4; // QTYPE + QCLASS
  return new Response(out.slice(0, questionEnd), {
    status: 200,
    headers: corsHeaders({ "Content-Type": "application/dns-message", "Cache-Control": "public, max-age=300", ...securityHeaders() }),
  });
}
