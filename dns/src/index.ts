// B1sTeam - DoH Worker (multi-tenant) - TypeScript
// author: B1sTeam | b1s.id.vn | @b1steam
//
// CUA VAO CHO THIET BI:  https://doh.b1s.id.vn/<token-32-hex>
//   <token> -> tra ve profile NextDNS rieng cua user (tra trong D1) -> forward sang
//   https://dns.nextdns.io/<nextdns_profile_id> (NextDNS ap dung rewrite -> tra IP proxy MITM).
//
// TAI SAO KHONG TRO THANG VAO dns.nextdns.io?
//   - De BIET user nao dang truy van (dem luong, chan khi het ha muc, chan khi can xoay vong).
//   - De chan telemetry/ads theo chinh sach cua B1sTeam.
//   - De thiet bi khong bo qua duong dan cong khai khi user bi thu hoi.

import type { Env, ExecutionContext, DnsProfileRow, CloudflareCacheStorage } from './types';

export const VERSION = '1.2.0';
export const BUILD_DATE = '2026-11-14';

/** Upstream: NextDNS cua user (mien phi 300k truy van / 30 ngay). */
const NEXTDNS_BASE = 'https://dns.nextdns.io';

/** Cache edge: 5 phut (fresh) + 24 gio (stale-if-error). */
const CACHE_TTL = 300;
const CACHE_STALE = 86400;

/** Chu ky dem truy van (ms) - moi 10 giay ghi 1 lan vao D1. */
const FLUSH_INTERVAL_MS = 10_000;

/** TTL cache trong bo nho cho profile (ms) - giam so lan doc D1. */
const PROFILE_TTL_MS = 60_000;

/** Token truy cap: 32 hex. */
const TOKEN_RE = /^[a-f0-9]{32}$/;

// ---------------------------------------------------------------------------
// Blocklist theo nhom
// ---------------------------------------------------------------------------
// Luu y QUAN TRONG: KHONG chan domain duoc rewrite ve proxy.
//   - `api.revenuecat.com` / `api.rc-backup.com`: neu chan DNS -> app khong goi duoc RevenueCat
//     -> SDK an huyen "Gold" + an UI thanh vien. Do MITM (proxy) da rewrite san entitlement
//     "Gold 2099" nen CHAN DNS chi phan tac dung.
//   - `firebaseremoteconfig.googleapis.com`: can qua proxy de ep Remote Config.
//   - `api.locketcamera.com`: can qua proxy de mo khoa tinh nang.
export const BLOCK_GROUPS: Record<string, string[]> = {
  telemetry: [
    'app-measurement.com',
    'firebase-settings.crashlytics.com',
    'firebaselogging-pa.googleapis.com',
    'firebaseremoteconfigrealtime.googleapis.com',
    'mixpanel.com',
    'api.mixpanel.com',
    'in.appcenter.ms',
    'amplitude.com',
    'api.amplitude.com',
    'sentry.io',
    'bugsnag.com',
    'instabug.com',
    'crashlytics.com',
    'crashlyticsreports-pa.googleapis.com',
    'appsflyer.com',
    'adjust.com',
    'adjust.io',
    'kochava.com',
    'datadoghq.com',
    'api.segment.io',
    'segment.io',
    'appsflyersdk.com',
    'moloco.com',
    'app-ads-services.com',
    'app-analytics-services.com',
    'amp-api-edge.apps.apple.com',
  ],
  'ads-global': [
    'googlesyndication.com',
    'doubleclick.net',
    'googleadservices.com',
    'admob.com',
    'adservice.google.com',
    'adsrvr.org',
    '2mdn.net',
    'adnxs.com',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'criteo.com',
    'criteo.net',
    'taboola.com',
    'outbrain.com',
    'bidswitch.net',
    'casalemedia.com',
    'adform.net',
    'smartadserver.com',
    'teads.tv',
    'yieldmo.com',
    'ads.google.com',
    'analytics.google.com',
  ],
  'ads-vn': [
    'for88.vn',
    'for88vn.com',
    'hara.vn',
    'fado.vn',
  ],
};

/** Domain duoc rewrite ve proxy -> KHONG duoc chan. */
const NEVER_BLOCK = new Set<string>([
  'api.locketcamera.com',
  'locketcamera.com',
  'cdn.locketcamera.com',
  'public.locketcamera.com',
  'api.locket.camera',
  'locket.camera',
  'us-central1-locket-4252a.cloudfunctions.net',
  'firebaseremoteconfig.googleapis.com',
  'api.revenuecat.com',
  'api.rc-backup.com',
  'rev.cat',
]);

const BLOCKED_DOMAINS = [...new Set(Object.values(BLOCK_GROUPS).flat())].filter((d) => !NEVER_BLOCK.has(d));
const BLOCKED_SET = new Set<string>(BLOCKED_DOMAINS);

function isBlocked(name: string): boolean {
  const n = String(name || '').toLowerCase().replace(/\.$/, '');
  if (!n) return false;
  if (NEVER_BLOCK.has(n)) return false;
  if (BLOCKED_SET.has(n)) return true;
  for (const d of BLOCKED_DOMAINS) {
    if (n.endsWith('.' + d)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, number> = { A: 1, AAAA: 28, CNAME: 5, TXT: 16, MX: 15, NS: 2, SOA: 6, HTTPS: 65, SVCB: 64 };

interface HeadersInit {
  [key: string]: string;
}

function corsHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    ...extra,
  };
}

function securityHeaders(): HeadersInit {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Protected-By': 'B1sTeam DNS Edge',
  };
}

interface DnsJsonExtra {
  [key: string]: unknown;
}

function dnsJson(status: number, question: Array<{ name: string; type: number }> = [], extra: DnsJsonExtra = {}): string {
  return JSON.stringify({ Status: status, TC: false, RD: true, RA: true, AD: false, CD: false, Question: question, ...extra });
}

function questionOf(name: string, type: number | string): Array<{ name: string; type: number }> {
  return [{ name, type: typeof type === 'number' ? type : Number(type) || 1 }];
}

/** base64url -> ArrayBuffer (RFC 4648 §5) */
function base64UrlToArrayBuffer(b64: string): ArrayBuffer {
  const padded = String(b64).replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const normalized = pad ? padded + '='.repeat(4 - pad) : padded;
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Doc QNAME tu dns-message (tra null neu compression pointer). */
function readQName(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    const labels: string[] = [];
    while (offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      if (len === 0) break;
      if ((len & 0xc0) === 0xc0) return null;
      offset += 1;
      if (offset + len > buffer.byteLength) return null;
      labels.push(new TextDecoder().decode(new Uint8Array(buffer, offset, len)));
      offset += len;
    }
    return labels.join('.');
  } catch {
    return null;
  }
}

/** Doc ten cau hoi "mem" hon: bo qua label khong doc duoc. */
function peekQuestion(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    const labels: string[] = [];
    while (offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      if (len === 0) break;
      if ((len & 0xc0) === 0xc0) {
        offset += 2;
        break;
      }
      offset += 1;
      if (offset + len > buffer.byteLength) break;
      labels.push(new TextDecoder().decode(new Uint8Array(buffer, offset, len)));
      offset += len;
    }
    return labels.length ? labels.join('.') : null;
  } catch {
    return null;
  }
}

/** Tra REFUSED giu nguyen transaction id + question. */
function refusedDnsMessage(queryBuffer: ArrayBuffer): Response {
  const bytes = new Uint8Array(queryBuffer);
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  const view = new DataView(out.buffer);
  const flags = view.getUint16(2);
  const rd = (flags >> 8) & 0x01;
  const opcode = (flags >> 11) & 0xf;
  view.setUint16(2, 0x8000 | (opcode << 11) | (rd << 8) | 0x0080 | 0x0005);
  view.setUint16(4, 1);
  view.setUint16(6, 0);
  view.setUint16(8, 0);
  view.setUint16(10, 0);
  let offset = 12;
  while (offset < out.length) {
    const len = view.getUint8(offset);
    if (len === 0) {
      offset += 1;
      break;
    }
    offset += 1 + len;
  }
  const questionEnd = offset + 4;
  return new Response(out.buffer.slice(0, questionEnd), {
    status: 200,
    headers: corsHeaders({
      'Content-Type': 'application/dns-message',
      'Cache-Control': 'no-store',
      'X-Update-Required': '1',
      ...securityHeaders(),
    }),
  });
}

/** REFUSED (rcode 5) - "DNS profile cua user het ha muc / can cai lai". */
function refusedJson(name: string, type: number | string): Response {
  return new Response(
    dnsJson(5, questionOf(name, type), {
      Comment: 'DNS profile requires renewal (B1sTeam DNS)',
      'X-Update-Required': '1',
    }),
    {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/dns-json',
        'Cache-Control': 'no-store',
        'X-Update-Required': '1',
        ...securityHeaders(),
      }),
    },
  );
}

// ---------------------------------------------------------------------------
// Profile lookup (D1 + cache bo nho)
// ---------------------------------------------------------------------------

interface ProfileCacheEntry {
  profile: ResolvedProfile | null;
  expiresAt: number;
}

export interface ResolvedProfile {
  nextdnsProfileId: string;
  status: string;
  rotationRequired: number;
  isCurrent: number;
  queryLimit: number;
  counter: number;
  cycleEnd: string | null;
}

const profileCache = new Map<string, ProfileCacheEntry>();

async function loadProfile(env: Env, token: string): Promise<ResolvedProfile | null> {
  const cached = profileCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const db = env?.DB;
  if (!db) return null;

  const row = (await db
    .prepare(
      `SELECT p.nextdns_profile_id, p.status, p.rotation_required, p.is_current, p.query_limit,
              p.cycle_start, p.cycle_end,
              COALESCE(c.count, 0) AS counter
       FROM dns_profiles p
       LEFT JOIN dns_usage_counters c ON c.profile_id = p.id
       WHERE p.access_token = ? LIMIT 1`,
    )
    .bind(token)
    .first()) as DnsProfileRow | null;

  if (!row) {
    profileCache.set(token, { profile: null, expiresAt: Date.now() + 15_000 });
    return null;
  }
  const profile: ResolvedProfile = {
    nextdnsProfileId: String(row.nextdns_profile_id || ''),
    status: String(row.status || 'active'),
    rotationRequired: Number(row.rotation_required || 0),
    isCurrent: Number(row.is_current || 0),
    queryLimit: Number(row.query_limit || 300000),
    counter: Number(row.counter || 0),
    cycleEnd: row.cycle_end ? String(row.cycle_end) : null,
  };
  profileCache.set(token, { profile, expiresAt: Date.now() + PROFILE_TTL_MS });
  return profile;
}

// ---------------------------------------------------------------------------
// Dem truy van (ghi D1 theo lo, gom theo isolate)
// ---------------------------------------------------------------------------

const pending = new Map<string, number>();
let flushAt = 0;
let flushPromise: Promise<void> | null = null;

function noteQuery(token: string): void {
  pending.set(token, (pending.get(token) || 0) + 1);
}

async function flushCounters(env: Env): Promise<void> {
  const db = env?.DB;
  if (!db || pending.size === 0) return;
  const batch = [...pending.entries()];
  pending.clear();
  for (const [token, count] of batch) {
    try {
      const row = await db
        .prepare('SELECT id FROM dns_profiles WHERE access_token = ? LIMIT 1')
        .bind(token)
        .first<{ id: string }>();
      if (!row) continue;
      await db
        .prepare('UPDATE dns_usage_counters SET count = count + ?, updated_at = ? WHERE profile_id = ?')
        .bind(count, new Date().toISOString(), row.id)
        .run();
    } catch (e) {
      console.error('[dns-resolver] flush failed:', e instanceof Error ? e.message : e);
    }
  }
}

function scheduleFlush(env: Env, ctx: ExecutionContext): void {
  const now = Date.now();
  if (now - flushAt < FLUSH_INTERVAL_MS) return;
  flushAt = now;
  if (!flushPromise) {
    flushPromise = flushCounters(env).finally(() => {
      flushPromise = null;
    });
  }
  ctx.waitUntil(flushPromise);
}

// ---------------------------------------------------------------------------
// Xu ly
// ---------------------------------------------------------------------------

/** Tra loi khi user het quyen / profile bi thu hoi -> REFUSED (bat buoc cai lai). */
function blockedResponse(name: string, type: number | string): Response {
  return refusedJson(name, type);
}

async function hashBody(body: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', body);
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Fetch to NextDNS. `cf` is a Workers-only init option, so cast at the call site. */
function fetchCf(url: string, init: RequestInit & { cf?: Record<string, unknown> }): Promise<Response> {
  return fetch(url, init as unknown as RequestInit);
}

async function raceQueryMessage(profileId: string, body: ArrayBuffer): Promise<Response | null> {
  const attempt = (url: string): Promise<Response> => {
    return fetchCf(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/dns-message', Accept: 'application/dns-message' },
      body: body as unknown as BodyInit,
      signal: AbortSignal.timeout(4000),
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    }).then((res) => {
      if (!res.ok) throw new Error(`upstream ${url} -> HTTP ${res.status}`);
      return res;
    });
  };
  const urls = [`${NEXTDNS_BASE}/${profileId}`, `${NEXTDNS_BASE}/${profileId}/dns-query`];
  try {
    return await Promise.any(urls.map((u) => attempt(u)));
  } catch {
    return null;
  }
}

async function raceQueryJson(profileId: string, name: string, type: number | string): Promise<Response | null> {
  const target = new URL(`${NEXTDNS_BASE}/${profileId}`);
  target.searchParams.set('name', name);
  target.searchParams.set('type', String(type || 'A'));
  try {
    return await fetchCf(target.toString(), {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4000),
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    }).then((res) => {
      if (!res.ok) throw new Error(`upstream -> HTTP ${res.status}`);
      return res;
    });
  } catch {
    return null;
  }
}

async function handleDnsMessage(
  _env: Env,
  _ctx: ExecutionContext,
  origin: string,
  profile: ResolvedProfile,
  _token: string,
  body: ArrayBuffer,
): Promise<Response> {
  const cache = (caches as unknown as CloudflareCacheStorage).default;
  const hash = await hashBody(body.slice(2));
  const postKey = new Request(`${origin}/__cache_post/${hash}`, { method: 'GET' });
  const staleKey = new Request(`${origin}/__cache_post_stale/${hash}`, { method: 'GET' });

  const refuseAndCache = async (): Promise<Response> => {
    const refused = refusedDnsMessage(body);
    try {
      const copy = refused.clone();
      copy.headers.set('Cache-Control', `public, max-age=${CACHE_STALE}`);
      await cache.put(postKey, copy);
    } catch {
      /* ignore */
    }
    return refused;
  };

  const cached = await cache.match(postKey);
  if (cached) {
    const cachedBuf = await cached.arrayBuffer();
    const out = new Uint8Array(cachedBuf.byteLength);
    out.set(new Uint8Array(cachedBuf));
    out.set(new Uint8Array(body).slice(0, 2), 0);
    return new Response(out.buffer, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/dns-message',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Cache': 'HIT',
        ...securityHeaders(),
      }),
    });
  }

  const qname = readQName(body);
  if (qname && isBlocked(qname)) return await refuseAndCache();
  if (!qname) {
    const peek = peekQuestion(body);
    if (peek && isBlocked(peek)) return await refuseAndCache();
  }

  const upstream = await raceQueryMessage(profile.nextdnsProfileId, body);
  if (upstream && upstream.ok) {
    const buf = await upstream.arrayBuffer();
    const resp = new Response(buf, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/dns-message',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Cache': 'MISS',
        ...securityHeaders(),
      }),
    });
    try {
      const staleCopy = resp.clone();
      staleCopy.headers.set('Cache-Control', `public, max-age=${CACHE_STALE}`);
      await cache.put(staleKey, staleCopy);
    } catch {
      /* ignore */
    }
    try {
      const freshCopy = resp.clone();
      freshCopy.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
      await cache.put(postKey, freshCopy);
    } catch {
      /* ignore */
    }
    return resp;
  }

  const stale = await cache.match(staleKey).catch(() => undefined);
  if (stale) {
    const staleBuf = await stale.arrayBuffer();
    const out = new Uint8Array(staleBuf.byteLength);
    out.set(new Uint8Array(staleBuf));
    out.set(new Uint8Array(body).slice(0, 2), 0);
    return new Response(out.buffer, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/dns-message',
        'Cache-Control': `public, max-age=${CACHE_STALE}`,
        'X-Cache': 'STALE',
        ...securityHeaders(),
      }),
    });
  }

  return new Response('Upstream Unavailable', {
    status: 502,
    headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }),
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ── Health / policy
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          success: true,
          service: 'b1steam-dns',
          version: VERSION,
          updated: BUILD_DATE,
          doh: 'https://doh.b1s.id.vn/<token>',
          policy: {
            blocked: BLOCKED_DOMAINS,
            groups: BLOCK_GROUPS,
            neverBlock: [...NEVER_BLOCK],
            upstream: NEXTDNS_BASE,
            staleIfError: true,
          },
          ts: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: corsHeaders({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=60',
            ...securityHeaders(),
          }),
        },
      );
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders(), ...securityHeaders() } });
    }

    // ── Parse token: /<token> hoac /<token>/dns-query
    const parts = url.pathname.split('/').filter(Boolean);
    let token = '';
    if (parts.length === 1) token = parts[0];
    else if (parts.length === 2 && parts[1] === 'dns-query') token = parts[0];
    else {
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }),
      });
    }

    if (!TOKEN_RE.test(token)) {
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }),
      });
    }

    const profile = await loadProfile(env, token);
    if (!profile || !profile.nextdnsProfileId) {
      return new Response('Unknown DNS profile', {
        status: 404,
        headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }),
      });
    }

    // ── Enforce: profile bi thu hoi / can xoay vong -> chan ngay
    const used = profile.counter + (pending.get(token) || 0);
    const overQuota = profile.queryLimit > 0 && used >= profile.queryLimit;
    if (profile.rotationRequired || profile.status === 'revoked' || !profile.isCurrent || overQuota) {
      // POST application/dns-message -> tra REFUSED dung wire format (iOS DoH se tat resolve).
      if (request.method === 'POST') {
        try {
          const buf = await request.arrayBuffer();
          if (buf.byteLength > 0) return refusedDnsMessage(buf);
        } catch {
          /* fall through */
        }
      }
      const name = url.searchParams.get('name') || '';
      if (name) return blockedResponse(name, url.searchParams.get('type') || 'A');
      return new Response('DNS profile requires renewal (B1sTeam DNS)', {
        status: 403,
        headers: corsHeaders({
          ...securityHeaders(),
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Update-Required': '1',
        }),
      });
    }

    // ── Dem truy van
    noteQuery(token);
    scheduleFlush(env, ctx);

    // ── POST application/dns-message
    if (request.method === 'POST') {
      const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
      if (contentType !== 'application/dns-message') {
        return new Response(dnsJson(1, [], { Comment: 'Unsupported content-type; use application/dns-message' }), {
          status: 415,
          headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
        });
      }
      let body: ArrayBuffer;
      try {
        body = await request.arrayBuffer();
        if (body.byteLength === 0 || body.byteLength > 512) {
          return new Response(dnsJson(1, [], { Comment: 'Invalid dns-message length' }), {
            status: 400,
            headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
          });
        }
      } catch {
        return new Response('Bad Request', {
          status: 400,
          headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }),
        });
      }
      return await handleDnsMessage(env, ctx, url.origin, profile, token, body);
    }

    // ── GET ?dns=<base64url> (RFC 8484)
    const dnsParam = url.searchParams.get('dns');
    if (dnsParam) {
      try {
        const buf = base64UrlToArrayBuffer(dnsParam);
        if (!buf || buf.byteLength === 0 || buf.byteLength > 512) {
          return new Response(dnsJson(1, [], { Comment: 'Invalid dns param' }), {
            status: 400,
            headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
          });
        }
        return await handleDnsMessage(env, ctx, url.origin, profile, token, buf);
      } catch {
        return new Response(dnsJson(1, [], { Comment: 'Invalid base64url dns param' }), {
          status: 400,
          headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
        });
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders({ Allow: 'GET, POST, OPTIONS', ...securityHeaders() }),
      });
    }

    // ── GET application/dns-json
    const cache = (caches as unknown as CloudflareCacheStorage).default;
    const cacheUrl = new URL(url.toString());
    cacheUrl.searchParams.set('v', VERSION);
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
    const staleKey = new Request(`${cacheUrl.toString()}&__stale=1`, { method: 'GET' });
    const cached = request.method === 'GET' ? await cache.match(cacheKey) : undefined;
    if (cached) {
      const fresh = new Response(cached.body, cached);
      fresh.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
      fresh.headers.set('X-Cache', 'HIT');
      return fresh;
    }

    const respondGet = async (response: Response): Promise<Response> => {
      if (request.method === 'GET' && response.status === 200) {
        try {
          const staleCopy = response.clone();
          staleCopy.headers.set('Cache-Control', `public, max-age=${CACHE_STALE}`);
          await cache.put(staleKey, staleCopy);
        } catch {
          /* ignore */
        }
        try {
          const freshCopy = response.clone();
          freshCopy.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
          await cache.put(cacheKey, freshCopy);
        } catch {
          /* ignore */
        }
        const out = new Response(response.body, response);
        out.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
        out.headers.set('X-Cache', 'MISS');
        return out;
      }
      return response;
    };

    const name = url.searchParams.get('name');
    const typeParam = (url.searchParams.get('type') || 'A').toUpperCase();
    const type = /^\d+$/.test(typeParam) ? Number(typeParam) : TYPE_MAP[typeParam] ?? null;

    if (!name || name.length > 253) {
      return new Response(dnsJson(1, [], { Comment: "Missing or invalid 'name'" }), {
        status: 400,
        headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
      });
    }
    if (type === null) {
      return new Response(dnsJson(1, [], { Comment: `Unsupported type '${typeParam}'` }), {
        status: 400,
        headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
      });
    }

    if (isBlocked(name)) {
      return await respondGet(
        new Response(dnsJson(5, questionOf(name, type), { Comment: 'Blocked by B1sTeam DNS policy' }), {
          status: 200,
          headers: corsHeaders({
            'Content-Type': 'application/dns-json',
            'Cache-Control': `public, max-age=${CACHE_STALE}`,
            ...securityHeaders(),
          }),
        }),
      );
    }

    const upstream = await raceQueryJson(profile.nextdnsProfileId, name, type);
    if (upstream) {
      const data = await upstream.text();
      return await respondGet(
        new Response(data, {
          status: 200,
          headers: corsHeaders({
            'Content-Type': 'application/dns-json',
            'Cache-Control': `public, max-age=${CACHE_TTL}`,
            ...securityHeaders(),
          }),
        }),
      );
    }

    const stale = await cache.match(staleKey).catch(() => undefined);
    if (stale) {
      return new Response(stale.body, {
        status: 200,
        headers: corsHeaders({
          'Content-Type': 'application/dns-json',
          'Cache-Control': `public, max-age=${CACHE_STALE}`,
          'X-Cache': 'STALE',
          ...securityHeaders(),
        }),
      });
    }

    return new Response(dnsJson(2, questionOf(name, type), { Comment: 'Upstream unavailable' }), {
      status: 502,
      headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
    });
  },
};
