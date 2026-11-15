/**
 * B1sTeam — LocketGold (Free)
 * Cloudflare Worker — DoH endpoint with NextDNS rotation.
 *
 * Routes:
 *   GET  /health                 -> {"ok":true,"service":"b1steam-dns"}
 *   GET  /<profileId>/dns-query  -> forwarded to https://dns.nextdns.io/<profileId>
 *   GET  /fly/dns-query          -> allow-list hosts answered with the Fly.io
 *                                   MITM proxy IP, everything else is resolved
 *                                   through 1.1.1.1 / 1.0.0.1
 *
 * Both RFC 8484 wire format (`application/dns-message`) and the JSON API
 * (`application/dns-json`) are supported.
 *
 * @module index
 */

import { isWhitelisted, whitelistReason, normalizeHost } from './whitelist.js';
import {
  parseWireQuestion,
  buildWireResponse,
  buildFlyJsonAnswer,
  resolveJson,
  resolveJsonVia,
  forwardWire,
} from './resolve.js';
import { rateLimiter } from './ratelimit.js';
import { pickProfile, parsePool, DEFAULT_RATIO } from './rotator.js';

/** Service name reported by /health. */
export const SERVICE_NAME = 'b1steam-dns';

/** Default IP of the Fly.io MITM proxy. */
export const DEFAULT_FLY_IP = '137.66.53.108';

/** Default rotation ratio (80% NextDNS / 20% direct). */
export const DEFAULT_ROTATION_RATIO = DEFAULT_RATIO;

/** TTL (seconds) of the allow-list answers. */
const FLY_TTL = 60;

/**
 * Build the shared response headers.
 *
 * @param {object} [extra]
 * @returns {Record<string, string>}
 */
export function baseHeaders(extra = {}) {
  return {
    'Cache-Control': 'max-age=60',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'accept, content-type',
    'Vary': 'Accept',
    ...extra,
  };
}

/**
 * JSON response helper.
 *
 * @param {unknown} payload
 * @param {number} [status]
 * @param {object} [extraHeaders]
 * @returns {Response}
 */
export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }),
  });
}

/**
 * Best effort client IP extraction.
 *
 * @param {Request} request
 * @returns {string}
 */
export function clientIp(request) {
  const headers = request.headers;
  const cf = headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  const forwarded = headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

/**
 * Detect the wire format of the incoming request.
 *
 * @param {Request} request
 * @param {URL} url
 * @returns {"json"|"wire"}
 */
export function detectFormat(request, url) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/dns-message')) return 'wire';
  if (contentType.includes('application/dns-json')) return 'json';
  if (accept.includes('application/dns-json')) return 'json';
  if (accept.includes('application/dns-message')) return 'wire';
  if (request.method === 'POST') return 'wire';
  if (url.searchParams.get('name')) return 'json';
  return 'json';
}

/**
 * Resolve the Fly.io proxy IP from the environment.
 *
 * @param {object} env
 * @returns {string}
 */
export function flyProxyIp(env = {}) {
  const value = String(env.FLY_PROXY_IP || '').trim();
  return value || DEFAULT_FLY_IP;
}

/**
 * Rotation ratio configured for the worker.
 *
 * @param {object} env
 * @returns {number}
 */
export function rotationRatio(env = {}) {
  const raw = Number(env.ROTATION_RATIO);
  if (!Number.isFinite(raw)) return DEFAULT_ROTATION_RATIO;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Handle the public "fly" route.
 *
 * @param {Request} request
 * @param {URL} url
 * @param {object} env
 * @returns {Promise<Response>}
 */
async function handleFly(request, url, env) {
  const format = detectFormat(request, url);
  const ip = flyProxyIp(env);
  const pool = parsePool(env.NEXTDNS_POOL);
  const ratio = rotationRatio(env);
  const rotationKey = url.searchParams.get('profile') || clientIp(request);

  if (format === 'wire') {
    const bytes = new Uint8Array(await request.arrayBuffer());
    const question = parseWireQuestion(bytes);
    if (!question) {
      return jsonResponse({ error: 'Malformed DNS message', Status: 2 }, 400);
    }

    if (isWhitelisted(question.name)) {
      // A records point at the MITM proxy, every other type is NODATA so the
      // client falls back to IPv4.
      const answer = buildWireResponse({
        request: bytes,
        ip: question.type === 1 ? ip : '',
        ttl: FLY_TTL,
      });
      return new Response(answer, {
        status: 200,
        headers: baseHeaders({ 'Content-Type': 'application/dns-message' }),
      });
    }

    if (pool.length) {
      const choice = pickProfile(pool, { profileId: rotationKey, ratio });
      if (choice.route === 'nextdns') {
        const target = `${choice.profile.dns_url}/dns-query`;
        const forwarded = await forwardWire(bytes, { endpoints: [target] });
        if (forwarded) {
          return new Response(forwarded, {
            status: 200,
            headers: baseHeaders({ 'Content-Type': 'application/dns-message' }),
          });
        }
      }
    }

    const upstream = await forwardWire(bytes);
    if (!upstream) {
      return jsonResponse({ error: 'Không phân giải được tên miền', Status: 2 }, 502);
    }
    return new Response(upstream, {
      status: 200,
      headers: baseHeaders({ 'Content-Type': 'application/dns-message' }),
    });
  }

  const name = normalizeHost(url.searchParams.get('name') || '');
  const type = (url.searchParams.get('type') || 'A').toUpperCase();
  if (!name) {
    return jsonResponse({ error: 'Thiếu tham số name', Status: 2 }, 400);
  }

  if (isWhitelisted(name)) {
    return jsonResponse(buildFlyJsonAnswer(name, type, ip, FLY_TTL));
  }

  if (pool.length) {
    const choice = pickProfile(pool, { profileId: rotationKey, ratio });
    if (choice.route === 'nextdns') {
      const answer = await resolveJsonVia(choice.profile.dns_url, name, type);
      if (answer) return jsonResponse(answer);
    }
  }

  const answer = await resolveJson(name, type);
  if (!answer) {
    return jsonResponse({ error: 'Không phân giải được tên miền', Status: 2 }, 502);
  }
  return jsonResponse(answer);
}

/**
 * Handle the per user NextDNS route.
 *
 * @param {Request} request
 * @param {URL} url
 * @param {object} env
 * @param {string} profileId
 * @returns {Promise<Response>}
 */
async function handleNextDns(request, url, env, profileId) {
  const base = String(env.NEXTDNS_BASE || 'https://dns.nextdns.io').replace(/\/+$/, '');
  const target = `${base}${url.pathname}${url.search}`;

  const headers = new Headers();
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, { method: request.method, headers, body });
    const responseHeaders = baseHeaders({
      'Content-Type': upstream.headers.get('content-type') || 'application/dns-message',
    });
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (err) {
    return jsonResponse(
      { error: `Không kết nối được NextDNS: ${(err && err.message) || err}`, Status: 2 },
      502,
    );
  }
}

/**
 * Worker entrypoint.
 *
 * @param {Request} request
 * @param {object} [env]
 * @param {object} [ctx]
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request, env = {}, ctx = {}) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: baseHeaders() });
    }

    if (pathname === '/health' || pathname === '/healthz') {
      return jsonResponse({ ok: true, service: SERVICE_NAME });
    }

    const limit = rateLimiter.check(clientIp(request));
    if (!limit.allowed) {
      return jsonResponse(
        {
          error: 'Quá nhiều truy vấn DNS. Vui lòng thử lại sau.',
          limit: limit.limit,
          retry_after_seconds: 600,
        },
        429,
        { 'Retry-After': '600' },
      );
    }

    if (/^\/fly\/dns-query$/i.test(pathname)) {
      return handleFly(request, url, env);
    }

    const profileMatch = /^\/([A-Za-z0-9_-]{4,64})\/dns-query$/i.exec(pathname);
    if (profileMatch) {
      return handleNextDns(request, url, env, profileMatch[1]);
    }

    return jsonResponse({ error: 'Not found', service: SERVICE_NAME }, 404);
  },
};

export { isWhitelisted, whitelistReason, normalizeHost, pickProfile };
