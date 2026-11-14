// B1sTeam - DoH Worker (multi-tenant) - TypeScript v1.3.0
// author: B1sTeam | b1s.id.vn | @b1steam
//
// Cửa vào cho thiết bị:  https://doh.b1s.id.vn/<token-32-hex>
//   <token> -> profile NextDNS riêng của user -> forward sang
//   https://dns.nextdns.io/<nextdns_profile_id>
//   Khi NextDNS bão hòa / lỗi -> FALLBACK 1.1.1.1 (Cloudflare DoH, cùng định dạng)
//   (app vẫn resolve bình thường, không REFUSED — không count quota).
//
// v1.3: blocklist O(n) → walk-suffix Set (O(labels)) + fallback 1.1.1.1 + flush tối ưu.

import type { Env, ExecutionContext, DnsProfileRow, CloudflareCacheStorage } from './types';

export const VERSION = '1.3.0';
export const BUILD_DATE = '2026-11-14';

const NEXTDNS_BASE = 'https://dns.nextdns.io';
const PUBLIC_DOH = 'https://1.1.1.1/dns-query';   // Cloudflare global DoH (cùng RFC 8484)
const CACHE_TTL = 300;      // 5 phút fresh
const CACHE_STALE = 86400;  // 24h stale-if-error
const FLUSH_INTERVAL_MS = 10_000;
const PROFILE_TTL_MS = 60_000;
const TOKEN_RE = /^[a-f0-9]{32}$/;

/** v1.3: Cách tính "block" mới — Set + label-suffix walk. O(labels) thay vì O(#blocked-entries). */

export const BLOCK_GROUPS: Record<string, string[]> = {
  telemetry: [
    'app-measurement.com','firebaselogging-pa.googleapis.com','crashlyticsreports-pa.googleapis.com',
    'crashlytics.com','appsflyer.com','appsflyersdk.com','adjust.com','adjust.io','kochava.com',
    'amplitude.com','amp-api-edge.apps.apple.com','moloco.com','datadoghq.com',
    'sentry.io','bugsnag.com','mixpanel.com','segment.io','api.segment.io',
    'instabug.com','in.appcenter.ms','firebase-settings.crashlytics.com','firebaseremoteconfigrealtime.googleapis.com',
    'app-ads-services.com','app-analytics-services.com','kochava.com',  ],
  'ads-global': [
    'googlesyndication.com','doubleclick.net','googleadservices.com','admob.com','adservice.google.com',
    'adsrvr.org','2mdn.net','adnxs.com','rubiconproject.com','pubmatic.com','openx.net',
    'criteo.com','criteo.net','taboola.com','outbrain.com','bidswitch.net','casalemedia.com',
    'adform.net','smartadserver.com','teads.tv','yieldmo.com','ads.google.com','analytics.google.com',
  ],
  'ads-vn': [
    'for88.vn','for88vn.com','hara.vn','fado.vn',
  ],
};

const NEVER_BLOCK = new Set<string>([
  'api.locketcamera.com','locketcamera.com','cdn.locketcamera.com','public.locketcamera.com',
  'api.locket.camera','locket.camera',
  'us-central1-locket-4252a.cloudfunctions.net',
  'firebaseremoteconfig.googleapis.com','firebaseremoteconfig.google.com',
  'api.revenuecat.com','api.rc-backup.com','rev.cat',
]);

// Set chứa CẢ bản thân domain CHÍNH (subdomain) — block mọi sub quá:
const BLOCKED_SET = new Set<string>();
for (const d of Object.values(BLOCK_GROUPS).flat()) {
  const clean = d.toLowerCase().replace(/\.$/, '');
  if (clean && !NEVER_BLOCK.has(clean)) BLOCKED_SET.add(clean);
}
const BLOCKED_DOMAINS = [...BLOCKED_SET];

/** O( labels ) — walk từ tld gốc lên: matches "a.ads.doubleclick.net" qua "doubleclick.net". */
function isBlocked(name: string): boolean {
  const n = String(name || '').toLowerCase().replace(/\.$/, '');
  if (!n || NEVER_BLOCK.has(n)) return false;
  const labels = n.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const suffix = labels.slice(i).join('.');
    if (NEVER_BLOCK.has(suffix)) return false;
    if (BLOCKED_SET.has(suffix)) return true;
  }
  return BLOCKED_SET.has(n);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface HeadersInit { [key: string]: string }
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
    'X-Protected-By': 'B1sTeam DNS Edge v1.3',
  };
}
function dnsJson(status: number, question: Array<{ name: string; type: number }> = [], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ Status: status, TC: false, RD: true, RA: true, AD: false, CD: false, Question: question, ...extra });
}
function questionOf(name: string, type: number | string): Array<{ name: string; type: number }> {
  return [{ name, type: typeof type === 'number' ? type : Number(type) || 1 }];
}
const TYPE_MAP: Record<string, number> = { A: 1, AAAA: 28, CNAME: 5, TXT: 16, MX: 15, NS: 2, SOA: 6, HTTPS: 65, SVCB: 64 };

function base64UrlToArrayBuffer(b64: string): ArrayBuffer {
  const pad = b64.length % 4;
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function readQName(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    const labels: string[] = [];
    while (offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      if (len === 0 || (len & 0xc0) === 0xc0) break;
      offset += 1;
      if (offset + len > buffer.byteLength) return null;
      labels.push(new TextDecoder().decode(new Uint8Array(buffer, offset, len)));
      offset += len;
    }
    return labels.length ? labels.join('.') : null;
  } catch { return null; }
}
function peekQuestion(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    const labels: string[] = [];
    while (offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      if (len === 0) break;
      if ((len & 0xc0) === 0xc0) { offset += 2; break; }
      offset += 1;
      if (offset + len > buffer.byteLength) break;
      labels.push(new TextDecoder().decode(new Uint8Array(buffer, offset, len)));
      offset += len;
    }
    return labels.length ? labels.join('.') : null;
  } catch { return null; }
}
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
    if (len === 0) { offset += 1; break; }
    offset += 1 + len;
  }
  return new Response(out.buffer.slice(0, offset + 4), {
    status: 200,
    headers: corsHeaders({
      'Content-Type': 'application/dns-message',
      'Cache-Control': 'no-store',
      'X-Update-Required': '1',
      ...securityHeaders(),
    }),
  });
}
function refusedJson(name: string, type: number | string): Response {
  return new Response(
    dnsJson(5, questionOf(name, type), { Comment: 'DNS profile requires renewal (B1sTeam DNS)', 'X-Update-Required': '1' }),
    { status: 200, headers: corsHeaders({ 'Content-Type': 'application/dns-json', 'Cache-Control': 'no-store', 'X-Update-Required': '1', ...securityHeaders() }) },
  );
}

// ---------------------------------------------------------------------------
// Profile cache / quota counters (D1)
// ---------------------------------------------------------------------------
export interface ResolvedProfile {
  nextdnsProfileId: string;
  status: string;
  rotationRequired: number;
  isCurrent: number;
  queryLimit: number;
  counter: number;
  cycleEnd: string | null;
}
interface CacheEntry { profile: ResolvedProfile | null; expiresAt: number }
const profileCache = new Map<string, CacheEntry>();

async function loadProfile(env: Env, token: string): Promise<ResolvedProfile | null> {
  const hit = profileCache.get(token);
  if (hit && hit.expiresAt > Date.now()) return hit.profile;
  const db = env?.DB;
  if (!db) return null;
  const row = (await db
    .prepare(
      `SELECT p.nextdns_profile_id, p.status, p.rotation_required, p.is_current, p.query_limit,
              p.cycle_start, p.cycle_end, COALESCE(c.count, 0) AS counter
       FROM dns_profiles p
       LEFT JOIN dns_usage_counters c ON c.profile_id = p.id
       WHERE p.access_token = ? LIMIT 1`,
    ).bind(token).first()) as DnsProfileRow | null;
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

const pending = new Map<string, number>();
let flushAt = 0;
let flushPromise: Promise<void> | null = null;
function noteQuery(token: string): void { pending.set(token, (pending.get(token) || 0) + 1); }
async function flushCounters(env: Env): Promise<void> {
  const db = env?.DB;
  if (!db || pending.size === 0) return;
  const batch = [...pending.entries()];
  pending.clear();
  for (const [token, count] of batch) {
    try {
      const row = await db.prepare('SELECT id FROM dns_profiles WHERE access_token = ? LIMIT 1').bind(token).first<{ id: string }>();
      if (!row) continue;
      await db.prepare('UPDATE dns_usage_counters SET count = count + ?, updated_at = ? WHERE profile_id = ?')
        .bind(count, new Date().toISOString(), row.id).run();
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
    flushPromise = flushCounters(env).finally(() => { flushPromise = null; });
  }
  ctx.waitUntil(flushPromise);
}

// ---------------------------------------------------------------------------
// Upstream (NextDNS → fallback 1.1.1.1)
// ---------------------------------------------------------------------------
async function hashBody(body: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', body);
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fetchCf(url: string, init: RequestInit & { cf?: Record<string, unknown> }): Promise<Response> {
  return fetch(url, init as unknown as RequestInit);
}
function cacheCdn(): CloudflareCacheStorage {
  return (caches as unknown as CloudflareCacheStorage).default;
}

async function respondRemember(
  cache: CloudflareCacheStorage,
  keyReq: Request,
  staleReq: Request,
  resp: Response,
): Promise<Response> {
  try { const s = resp.clone(); s.headers.set('Cache-Control', `public, max-age=${CACHE_STALE}`); await cache.put(staleReq, s); } catch { /* noop */ }
  try { const f = resp.clone(); f.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`); await cache.put(keyReq, f); } catch { /* noop */ }
  return resp;
}
async function handleDnsMessage(
  env: Env,
  origin: string,
  profile: ResolvedProfile | null,
  body: ArrayBuffer,
): Promise<Response> {
  const cache = cacheCdn();
  const hash = await hashBody(body);
  const postKey = new Request(`${origin}/__cache_post/${hash}`, { method: 'GET' });
  const staleKey = new Request(`${origin}/__cache_post_stale/${hash}`, { method: 'GET' });

  const refuseAndCache = async (): Promise<Response> => {
    const refused = refusedDnsMessage(body);
    try {
      const copy = refused.clone(); copy.headers.set('Cache-Control', `public, max-age=${CACHE_STALE}`);
      await cache.put(postKey, copy);
    } catch { /* noop */ }
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
      headers: corsHeaders({ 'Content-Type': 'application/dns-message', 'Cache-Control': `public, max-age=${CACHE_TTL}`, 'X-Cache': 'HIT', ...securityHeaders() }),
    });
  }

  const qname = readQName(body) ?? peekQuestion(body);
  if (qname && isBlocked(qname)) return await refuseAndCache();

  // Profile hết quota / revoked / chưa current / cần xoay vòng → REFUSED (trước fetch upstream)
  // Try NextDNS; fallback 1.1.1.1 nếu NextDNS bão hòa/lỗi
  const urls = (base: string) => base === NEXTDNS_BASE
    ? `${NEXTDNS_BASE}/${profile.nextdnsProfileId}`
    : PUBLIC_DOH;

  async function attempt(base: string): Promise<Response | null> {
    try {
      const res = await fetchCf(urls(base), {
        method: 'POST',
        headers: { 'Content-Type': 'application/dns-message', Accept: 'application/dns-message' },
        body: body as unknown as BodyInit,
        signal: AbortSignal.timeout(4000),
        cf: { cacheEverything: false },
      });
      return res.ok ? res : null;
    } catch { return null; }
  }

  const upstream = ((profile && profile.nextdnsProfileId) ? await attempt(NEXTDNS_BASE) : null) ?? await attempt(PUBLIC_DOH);
  if (upstream) {
    const buf = await upstream.arrayBuffer();
    const resp = new Response(buf, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/dns-message',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Cache': 'MISS',
        ...(upstream.url?.includes('1.1.1.1') ? { 'X-DoH-Fallback': '1.1.1.1' } : {}),
        ...securityHeaders(),
      }),
    });
    try { const stale = resp.clone(); stale.headers.set('Cache-Control', `public, max-age=${CACHE_STALE}`); await cache.put(staleKey, stale); } catch { /* noop */ }
    try { await cache.put(postKey, resp.clone()); } catch { /* noop */ }
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
      headers: corsHeaders({ 'Content-Type': 'application/dns-message', 'Cache-Control': `public, max-age=${CACHE_STALE}`, 'X-Cache': 'STALE', ...securityHeaders() }),
    });
  }
  return new Response('Upstream Unavailable', { status: 502, headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }) });
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        success: true, service: 'b1steam-dns', version: VERSION, updated: BUILD_DATE,
        doh: 'https://doh.b1s.id.vn/<token>',
        policy: { blocked: BLOCKED_DOMAINS, groups: BLOCK_GROUPS, neverBlock: [...NEVER_BLOCK], upstream: NEXTDNS_BASE, fallback: PUBLIC_DOH },
        ts: new Date().toISOString(),
      }), {
        status: 200,
        headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60', ...securityHeaders() }),
      });
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...corsHeaders(), ...securityHeaders() } });

    // ── Parse: /dns-query (public) hoặc /<token>/dns-query
    const parts = url.pathname.split('/').filter(Boolean);
    const isPublic = parts.length === 0 || (parts.length === 1 && parts[0] === 'dns-query');
    let token = '';
    if (!isPublic) {
      if (parts.length === 1) token = parts[0];
      else if (parts.length === 2 && parts[1] === 'dns-query') token = parts[0];
      else return new Response('Not Found', { status: 404, headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }) });
      if (!TOKEN_RE.test(token)) return new Response('Not Found', { status: 404, headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }) });
    }

    let profile: ResolvedProfile | null = null;
    if (!isPublic) {
      profile = await loadProfile(env, token);
      if (!profile || !profile.nextdnsProfileId) return new Response('Unknown DNS profile', { status: 404, headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }) });
    }

    if (profile && (profile.rotationRequired || profile.status === 'revoked' || !profile.isCurrent)) {
      if (request.method === 'POST') {
        try { const buf = await request.arrayBuffer(); if (buf.byteLength > 0) return refusedDnsMessage(buf); } catch { /* fallthrough */ }
      }
      const name = url.searchParams.get('name') || '';
      if (name) return refusedJson(name, url.searchParams.get('type') || 'A');
      return new Response('DNS profile requires renewal (B1sTeam DNS)', {
        status: 403, headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8', 'X-Update-Required': '1' }),
      });
    }

    if (token) noteQuery(token);
    scheduleFlush(env, ctx);

    if (request.method === 'POST') {
      const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
      if (contentType !== 'application/dns-message') {
        return new Response(dnsJson(1, [], { Comment: 'Unsupported content-type; use application/dns-message' }), {
          status: 415, headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
        });
      }
      let body: ArrayBuffer;
      try {
        body = await request.arrayBuffer();
        if (body.byteLength === 0 || body.byteLength > 512) {
          return new Response(dnsJson(1, [], { Comment: 'Invalid dns-message length' }), {
            status: 400, headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
          });
        }
      } catch {
        return new Response('Bad Request', { status: 400, headers: corsHeaders({ ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' }) });
      }
      return await handleDnsMessage(env, url.origin, profile, body);
    }

    const dnsParam = url.searchParams.get('dns');
    if (dnsParam) {
      try {
        const buf = base64UrlToArrayBuffer(dnsParam);
        if (!buf || buf.byteLength === 0 || buf.byteLength > 512) {
          return new Response(dnsJson(1, [], { Comment: 'Invalid dns param' }), {
            status: 400, headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
          });
        }
        return await handleDnsMessage(env, url.origin, profile, buf);
      } catch {
        return new Response(dnsJson(1, [], { Comment: 'Invalid base64url dns param' }), {
          status: 400, headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
        });
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders({ Allow: 'GET, POST, OPTIONS', ...securityHeaders() }) });
    }

    // GET application/dns-json
    const cache = cacheCdn();
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

    const name = url.searchParams.get('name');
    const typeParam = (url.searchParams.get('type') || 'A').toUpperCase();
    const type = /^\d+$/.test(typeParam) ? Number(typeParam) : TYPE_MAP[typeParam] ?? null;
    if (!name || name.length > 253) {
      return new Response(dnsJson(1, [], { Comment: "Missing or invalid 'name'" }), {
        status: 400, headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
      });
    }
    if (type === null) {
      return new Response(dnsJson(1, [], { Comment: `Unsupported type '${typeParam}'` }), {
        status: 400, headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
      });
    }

    if (isBlocked(name)) {
      const blocked = new Response(dnsJson(5, questionOf(name, type), { Comment: 'Blocked by B1sTeam DNS policy' }), {
        status: 200, headers: corsHeaders({ 'Content-Type': 'application/dns-json', 'Cache-Control': `public, max-age=${CACHE_STALE}`, ...securityHeaders() }),
      });
      try { await cache.put(cacheKey, blocked.clone()); } catch { /* noop */ }
      return blocked;
    }

    let upstream: Response | null = null;
    for (const base of (profile?.nextdnsProfileId ? [NEXTDNS_BASE, PUBLIC_DOH] : [PUBLIC_DOH])) {
      try {
        const t = new URL(base === NEXTDNS_BASE ? `${NEXTDNS_BASE}/${profile?.nextdnsProfileId ?? ''}` : PUBLIC_DOH);
        t.searchParams.set('name', name);
        t.searchParams.set('type', String(type));
        upstream = await fetchCf(t.toString(), { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(4000) });
        if (upstream.ok) break;
      } catch { upstream = null; }
    }

    if (upstream && upstream.ok) {
      try {
        const fresh = upstream.clone(); fresh.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`); await cache.put(cacheKey, fresh);
      } catch { /* noop */ }
      try {
        const stale = upstream.clone(); stale.headers.set('Cache-Control', `public, max-age=${CACHE_STALE}`); await cache.put(staleKey, stale);
      } catch { /* noop */ }
      const out = new Response(upstream.body, upstream);
      out.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
      out.headers.set('X-Cache', 'MISS');
      return out;
    }

    const stale = await cache.match(staleKey).catch(() => undefined);
    if (stale) {
      return new Response(stale.body, {
        status: 200, headers: corsHeaders({ 'Content-Type': 'application/dns-json', 'Cache-Control': `public, max-age=${CACHE_STALE}`, 'X-Cache': 'STALE', ...securityHeaders() }),
      });
    }
    return new Response(dnsJson(2, questionOf(name, type), { Comment: 'Upstream unavailable' }), {
      status: 502, headers: corsHeaders({ 'Content-Type': 'application/dns-json', ...securityHeaders() }),
    });
  },
};
