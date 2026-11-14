/**
 * B1sTeam Edge Gateway — thay thế vai trò server-side của MITM proxy (fly.io, đã retire).
 * Chạy trên 4 tài khoản Cloudflare PHỤ (không dùng account chính) — phân bổ ngẫu nhiên + failover.
 *
 * Endpoints (strict allowlist — KHÔNG phải open proxy):
 *   GET  /health    → { ok, service, version, updated, builtAt, edge }
 *   GET  /rc        → Remote Config relay: fetch Google RC server-side, ép state=UPDATE +
 *                     templateVersion=Date.now() + cache_ttl=0, trả JSON.
 *   GET  /vip/list  → relay danh sách vinh danh (cache 300s tại edge).
 *
 * BẢO MẬT & MÃ HOÁ:
 *   · TLS bắt buộc (*.workers.dev chỉ phục vụ HTTPS).
 *   · KHÔNG nhận URL tuỳ ý / không chuyển tiếp request arbitrary (upstream hard-coded).
 *   · KHÔNG log body, KHÔNG lưu dữ liệu, KHÔNG gửi license đi đâu.
 *   · Không lộ thông tin nội bộ (không header server thật, không stack).
 *
 * B1sTeam — b1s.id.vn · Nguyễn Hoàng Bách
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (method !== "GET") return json({ error: "method_not_allowed" }, 405);

    const EDGE = String(env.EDGE_NAME || "edge");
    const VERSION = String(env.EDGE_VERSION || "1.0.0");
    const UPDATED = String(env.EDGE_UPDATED || "2026-11-14");
    const BUILT_AT = String(env.EDGE_BUILT_AT || "2026-11-14T11:30:00Z");

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "b1steam-edge",
        version: VERSION,
        updated: UPDATED,
        edge: EDGE,
        builtAt: BUILT_AT,
      });
    }

    if (url.pathname === "/rc") {
      const GOOGLE_RC =
        "https://firebaseremoteconfig.googleapis.com/v1/projects/locket-4252a/namespaces/firebase:fetch?key=AIzaSyCQngaaXQIfJaH0aS2l7REgIjD7nL431So";
      try {
        const upstream = await fetch(GOOGLE_RC, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Locket/3938 CFNetwork/3896.200.61",
          },
          body: JSON.stringify({ appInstanceId: "b1steam-" + EDGE, appInstanceIdToken: "" }),
        });
        if (!upstream.ok) {
          // Google từ chối/timeout → trả baseline tối thiểu (app vẫn mở khoá qua on-device script ghi đè)
          return json({ state: "UPDATE", templateVersion: String(Date.now()), entries: {} }, 200);
        }
        const text = await upstream.text();
        let obj;
        try {
          obj = JSON.parse(text);
        } catch {
          obj = { entries: {} };
        }
        if (!obj || typeof obj !== "object" || !obj.entries || typeof obj.entries !== "object") {
          obj = { entries: {} };
        }
        obj.state = "UPDATE";
        obj.templateVersion = String(Date.now());
        obj.entries.cache_ttl_seconds = "0";
        obj.entries.client_cache_ttl_sec = "0";
        const body = JSON.stringify(obj);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=120",
            "X-B1s-Edge": EDGE,
            ...corsHeaders(),
          },
        });
      } catch {
        return json({ state: "UPDATE", templateVersion: String(Date.now()), entries: {} }, 200);
      }
    }

    if (url.pathname === "/vip/list") {
      try {
        const upstream = await fetch("https://locket.b1s.id.vn/api/v2/locketgold/vip/list", {
          headers: { Accept: "application/json" },
          cf: { cacheTtl: 300, cacheEverything: true },
        });
        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status || 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "X-B1s-Edge": EDGE,
            ...corsHeaders(),
          },
        });
      } catch {
        return json({ error: "upstream_vip_unavailable" }, 502);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(),
    },
  });
}
