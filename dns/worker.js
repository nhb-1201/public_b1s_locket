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

const VERSION = "4.1.0";
const UPSTREAMS = ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query", "https://9.9.9.9/dns-query"];
const CACHE_TTL = 300; // giây — pin cache ở edge Cloudflare
const CACHE_STALE = 86400; // giây — tuổi tối đa bản stale khi upstream chết
/** true = từ chối truy vấn các domain trong BLOCKLIST */
const BLOCK_LOCKET = true;

/* ═══════════════════════════════════════════════════════════════════════════
 *  B1sTeam — Blocklist theo nhóm
 *  · anti-revoke  : chặn gốc RevenueCat (bắt buộc — app không hỏi server là mất Gold)
 *  · telemetry    : SDK đo lườ/attribution/crash — chặn để app không "rò" dữ liệu người dùng
 *  · ads-global  : mạng quảng cáo toàn cầu
 *  · ads-vn      : quảng cáo Việt Nam (app VN hay gửi người dùng sang trang nhập tạo)
 *  KHÔNG dùng wildcard — chỉ liệt kê domain cụ thể để không chặn nhầm dịch vụ.
 * ═══════════════════════════════════════════════════════════════════════════ */
const BLOCK_GROUPS = {
  "anti-revoke": [
    "revenuecat.com",
    "rc-backup.com",
    "rev.cat",
  ],
  telemetry: [
    "app-measurement.com",
    "firebaselogging-pa.googleapis.com",
    "firebaseremoteconfigrealtime.googleapis.com",
    "mixpanel.com",
    "api.mixpanel.com",
    "in.appcenter.ms",
    "amplitude.com",
    "api.amplitude.com",
    "sentry.io",
    "bugsnag.com",
    "instabug.com",
    "crashlytics.com",
    "crashlyticsreports-pa.googleapis.com",
    "firebase-settings.crashlytics.com",
    "appsflyer.com",
    "adjust.com",
    "adjust.io",
    "kochava.com",
    "datadoghq.com",
    "api.segment.io",
    "segment.io",
  ],
  "ads-global": [
    "googlesyndication.com",
    "doubleclick.net",
    "googleadservices.com",
    "admob.com",
    "adservice.google.com",
    "adsrvr.org",
    "2mdn.net",
    "adnxs.com",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "criteo.com",
    "criteo.net",
    "taboola.com",
    "outbrain.com",
    "bidswitch.net",
    "casalemedia.com",
    "adform.net",
    "smartadserver.com",
    "teads.tv",
    "yieldmo.com",
  ],
  "ads-vn": [
    "zing.vn",
    "zingme.vn",
    "fpt.vn",
    "vnexpress.net",
    "hara.vn",
    "fado.vn",
    "for88.vn",
    "for88vn.com",
  ],
};

const BLOCKED_DOMAINS = [...new Set(Object.values(BLOCK_GROUPS).flat())];

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
  // Race THẬT: trả về upstream phản hồi ĐẦU TIÊN (không đợi cả 3).
  // KHÔNG abort các request thua ngay khi resolve — sẽ hủy luôn body của response thắng (1101).
  try {
    return await Promise.any(UPSTREAMS.map((u) => attempt(u)));
  } catch {
    return null;
  }
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
  try {
    return await Promise.any(UPSTREAMS.map((u) => attempt(u)));
  } catch {
    return null;
  }
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
          policy: { blocked: BLOCKED_DOMAINS, groups: BLOCK_GROUPS, upstreams: UPSTREAMS, staleIfError: true, singleFile: true },
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
      if (BLOCK_LOCKET) {
        if (qname && isBlocked(qname)) {
          return refusedDnsMessage(body);
        }
        if (!qname) {
          // Fail-closed: không đọc được tên → KHÔNG cho lọt (tránh lách blocklist bằng compression pointer).
          const peek = peekQuestion(body);
          if (peek && isBlocked(peek)) {
            return refusedDnsMessage(body);
          }
        }
      }

      // ── POST cache (synthetic key từ hash body) — chống sập cả khi Google/CF/Quad9 đồng loạt lỗi
      const cache = caches.default;
      // Hash BỎ Transaction ID (byte 0-1) → cache key ổn định cho cùng 1 câu hỏi.
      const postKey = new Request(`https://doh.b1s.id.vn/__cache_post/${await hashBody(new Uint8Array(body).slice(2))}`, { method: "GET" });
      const staleKey = new Request(`https://doh.b1s.id.vn/__cache_post_stale/${await hashBody(new Uint8Array(body).slice(2))}`, { method: "GET" });
      const cached = await cache.match(postKey);
      if (cached) {
        // Vá lại Transaction ID của query hiện tại vào gói trả về (client đòi TXID khớp).
        const cachedBuf = await cached.arrayBuffer();
        const out = new Uint8Array(cachedBuf.byteLength);
        out.set(new Uint8Array(cachedBuf));
        out.set(new Uint8Array(body).slice(0, 2), 0);
        return new Response(out, {
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
        try { await cache.put(staleKey, cachedCopy); } catch { /* bỏ qua */ }
        return resp;
      }

      // ── stale-if-error: dùng bản stale nếu có (kể cả khi upstream chết hàng loạt)
      const stale = await cache.match(staleKey).catch(() => null);
      if (stale) {
        const staleBuf = await stale.arrayBuffer();
        const out = new Uint8Array(staleBuf.byteLength);
        out.set(new Uint8Array(staleBuf));
        out.set(new Uint8Array(body).slice(0, 2), 0);
        return new Response(out, {
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
    const staleKey = new Request(`${url.toString()}__stale`, { method: "GET" });
    const cached = request.method === "GET" ? await cache.match(cacheKey) : null;
    if (cached) {
      // Trả client bản cached với TTL ngắn (bản lưu trong cache là bản STALE 24h cho stale-if-error).
      const fresh = new Response(cached.body, cached);
      fresh.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
      return fresh;
    }

    const respondGet = async (response) => {
      if (request.method === "GET" && response.status === 200) {
        // Lưu bản STALE (24h) riêng key → dùng khi upstream chết (chống sập toàn hệ thống).
        const cachedCopy = response.clone();
        cachedCopy.headers.set("Cache-Control", `public, max-age=${CACHE_STALE}`);
        try { await cache.put(staleKey, cachedCopy); } catch { /* bỏ qua */ }
        const out = new Response(response.body, response);
        out.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
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
      return await respondGet(new Response(dnsJson(5, question, { Comment: "Blocked by LocketGold anti-revoke policy (B1sTeam)" }), {
        status: 200, // dns-json convention: HTTP 200 + Status 5 (REFUSED)
        headers: corsHeaders({ "Content-Type": "application/dns-json", "Cache-Control": `public, max-age=${CACHE_STALE}`, ...securityHeaders() }),
      }));
    }

    const upstream = await raceQueryJson(name, type);
    if (upstream) {
      const data = await upstream.json();
      return await respondGet(new Response(JSON.stringify(data), {
        status: 200,
        headers: corsHeaders({ "Content-Type": "application/dns-json", "Cache-Control": `public, max-age=${CACHE_TTL}`, ...securityHeaders() }),
      }));
    }

    // ── stale-if-error: phục vụ bản cũ (24h) nếu upstream chết hết
    const stale = await cache.match(staleKey).catch(() => null);
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
      if ((len & 0xc0) === 0xc0) return null; // compression pointer — không đọc được tên (xử lý fail-closed ở caller)
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

/**
 * Đọc tên câu hỏi "mềm" hơn readQName: bỏ qua label không đọc được (compression pointer)
 * thay vì trả null — dùng để fail-closed khi không chắc chắn query có bị chặn hay không.
 */
function peekQuestion(buffer) {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    const labels = [];
    while (offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      if (len === 0) break;
      if ((len & 0xc0) === 0xc0) {
        offset += 2; // pointer — bỏ qua phần còn lại
        break;
      }
      offset += 1;
      if (offset + len > buffer.byteLength) break;
      labels.push(new TextDecoder().decode(new Uint8Array(buffer, offset, len)));
      offset += len;
    }
    return labels.length ? labels.join(".") : null;
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
