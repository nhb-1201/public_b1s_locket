'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * NextDNS API client.
 *
 * Responsibilities:
 *   - create a NextDNS account (+ profile) with the recommended security and
 *     privacy settings;
 *   - add / list / delete the rewrites that point the Locket & Firebase hosts
 *     at the Fly.io MITM proxy;
 *   - read the query usage of a profile.
 *
 * Every network call is protected by an AbortController timeout and every
 * secret is generated with node:crypto (never Math.random).
 */

const crypto = require('crypto');

/** Base URL of the NextDNS API. */
const NEXTDNS_API_BASE = 'https://api.nextdns.io';

/** Default IP of the Fly.io MITM proxy. */
const DEFAULT_FLY_IP = process.env.FLY_PROXY_IP || '137.66.53.108';

/** Timeout of every single API call (ms). */
const REQUEST_TIMEOUT_MS = 5000;

/** Domains that are rewritten towards the Fly.io MITM proxy. */
const REWRITE_DOMAINS = Object.freeze([
  'api.revenuecat.com',
  'api.rc-backup.com',
  'rev.cat',
  'firebaseremoteconfig.googleapis.com',
  'firebaseremoteconfig.google.com',
  'remoteconfig.googleapis.com',
  'api.locketcamera.com',
  'cdn.locketcamera.com',
  'public.locketcamera.com',
  'locket.camera',
  'us-central1-locket-4252a.cloudfunctions.net',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

/** Characters used by the generated password (no ambiguous symbols). */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

/**
 * Generate a strong random password.
 *
 * @param {number} [length]
 * @returns {string}
 */
function generatePassword(length = 18) {
  const size = Math.max(12, Math.floor(length));
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += PASSWORD_ALPHABET[crypto.randomInt(0, PASSWORD_ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a random mail handle.
 *
 * @returns {string}
 */
function generateMailHandle() {
  const stamp = Date.now().toString(36);
  const noise = crypto.randomBytes(4).toString('hex');
  return `b1s-${stamp}-${noise}`;
}

/**
 * Try to create a disposable mailbox through mail.tm so the NextDNS account
 * can be verified when needed.
 *
 * @returns {Promise<{ email: string, password: string }|null>}
 */
async function createTemporaryMailbox() {
  const email = process.env.NEXTDNS_EMAIL || '';
  const password = process.env.NEXTDNS_PASSWORD || '';
  if (email && password) return { email, password };

  try {
    const domainsRes = await nextDnsFetch('https://api.mail.tm/domains', {
      headers: { Accept: 'application/json' },
      timeoutMs: 2000,
    });
    if (!domainsRes.ok) return null;
    const domainsJson = await domainsRes.json();
    const domain =
      (domainsJson && domainsJson['hydra:member'] && domainsJson['hydra:member'][0] &&
        domainsJson['hydra:member'][0].domain) ||
      (Array.isArray(domainsJson) && domainsJson[0] && domainsJson[0].domain) ||
      '';
    if (!domain) return null;

    const mailPassword = generatePassword(16);
    const accountRes = await nextDnsFetch('https://api.mail.tm/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ address: `${generateMailHandle()}@${domain}`, password: mailPassword }),
      timeoutMs: 2500,
    });
    if (!accountRes.ok) return null;
    const created = await accountRes.json();
    const address = (created && created.address) || `${generateMailHandle()}@${domain}`;
    return { email: address, password: mailPassword };
  } catch (_err) {
    return null;
  }
}

/**
 * Extract the `_sid` session cookie from a response.
 *
 * Primary source is the raw `set-cookie` header, the fallback uses
 * `headers.getSetCookie()` (Node 18.14+/undici).
 *
 * @param {Response|object} res
 * @returns {string} cookie string like "_sid=abc" or an empty string
 */
function extractNextDnsSid(res) {
  if (!res || !res.headers) return '';
  const cookies = [];

  const raw = typeof res.headers.get === 'function' ? res.headers.get('set-cookie') : '';
  if (raw) cookies.push(...String(raw).split(/,(?=\s*[^;,=]+=)/));

  if (typeof res.headers.getSetCookie === 'function') {
    try {
      cookies.push(...res.headers.getSetCookie());
    } catch (_err) {
      // ignore
    }
  }

  for (const cookie of cookies) {
    const match = /(?:^|[\s;,])_?sid=([^;]+)/i.exec(String(cookie));
    if (match) return `_sid=${match[1].trim()}`;
  }
  return '';
}

/**
 * fetch() with a hard timeout.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Response>}
 */
async function nextDnsFetch(url, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...rest } = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create a NextDNS account, its profile and the allow-list rewrites.
 *
 * @param {object} [options]
 * @param {string} [options.profileName]
 * @param {string} [options.flyIp]
 * @returns {Promise<{ email: string, password: string, profile_id: string, dns_url: string, fly_ip: string, rewrites: object[] }>}
 */
async function createNextDnsAccount(options = {}) {
  const {
    profileName = 'B1sTeam LocketGold',
    flyIp = DEFAULT_FLY_IP,
  } = options || {};

  const mailbox = await createTemporaryMailbox();
  const email = mailbox ? mailbox.email : `${generateMailHandle()}@b1s.id.vn`;
  const password = mailbox ? mailbox.password : generatePassword(18);

  const signupRes = await nextDnsFetch(`${NEXTDNS_API_BASE}/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'B1sTeam-LocketGold/4.0 (+https://b1s.id.vn)',
      Origin: 'https://my.nextdns.io',
    },
    body: JSON.stringify({
      email,
      password,
      profile: {
        name: profileName,
        security: {
          threatIntelligenceFeeds: true,
          googleSafeBrowsing: true,
          cryptojacking: true,
          phishing: true,
        },
        privacy: {
          blocklists: [{ id: 'nextdns-recommended' }],
          disguisedTrackers: true,
          trackerBlocking: true,
        },
        settings: {
          logs: { enabled: true },
          performance: { ecs: true },
          stealthBrowsing: false,
        },
      },
    }),
  });

  if (!signupRes.ok) {
    const text = await signupRes.text().catch(() => '');
    throw new Error(`NextDNS sign-up thất bại (${signupRes.status}): ${text.slice(0, 200)}`);
  }

  const rawBody = await signupRes.text().catch(() => '');
  let signupData = {};
  try {
    signupData = JSON.parse(rawBody);
  } catch (_err) {
    throw new Error('NextDNS trả về body không phải JSON');
  }

  const profileId =
    signupData.id ||
    (signupData.profiles && signupData.profiles[0] && signupData.profiles[0].id) ||
    '';
  if (!profileId) throw new Error('NextDNS không trả về Profile ID');

  const sid = extractNextDnsSid(signupRes);
  const rewrites = [];

  for (const domain of REWRITE_DOMAINS) {
    try {
      const res = await nextDnsFetch(`${NEXTDNS_API_BASE}/profiles/${profileId}/rewrites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Cookie: sid,
          'User-Agent': 'B1sTeam-LocketGold/4.0 (+https://b1s.id.vn)',
        },
        body: JSON.stringify({ name: domain, answer: flyIp }),
      });
      rewrites.push({ domain, ok: res.ok, status: res.status, answer: flyIp });
    } catch (err) {
      rewrites.push({ domain, ok: false, error: (err && err.message) || 'network error', answer: flyIp });
    }
  }

  return {
    email,
    password,
    profile_id: profileId,
    dns_url: `https://dns.nextdns.io/${profileId}`,
    fly_ip: flyIp,
    rewrites,
  };
}

/**
 * Create (or update) a single rewrite of a profile.
 *
 * @param {string} profileId
 * @param {string} sid session cookie
 * @param {string} domain
 * @param {string} answer IP the domain is rewritten to
 * @returns {Promise<{ ok: boolean, status: number, domain: string, error?: string }>}
 */
async function createRewrite(profileId, sid, domain, answer) {
  try {
    const res = await nextDnsFetch(`${NEXTDNS_API_BASE}/profiles/${profileId}/rewrites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: sid || '',
        'User-Agent': 'B1sTeam-LocketGold/4.0 (+https://b1s.id.vn)',
      },
      body: JSON.stringify({ name: domain, answer }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, domain, error: `HTTP ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true, status: res.status, domain };
  } catch (err) {
    return { ok: false, status: 0, domain, error: (err && err.message) || 'network error' };
  }
}

/**
 * List the rewrites of a profile.
 *
 * @param {string} profileId
 * @param {string} sid session cookie
 * @returns {Promise<{ ok: boolean, rewrites: object[], error?: string }>}
 */
async function listRewrites(profileId, sid) {
  try {
    const res = await nextDnsFetch(`${NEXTDNS_API_BASE}/profiles/${profileId}/rewrites`, {
      headers: {
        Accept: 'application/json',
        Cookie: sid || '',
        'User-Agent': 'B1sTeam-LocketGold/4.0 (+https://b1s.id.vn)',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, rewrites: [], error: `HTTP ${res.status}: ${text.slice(0, 160)}` };
    }
    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : (data && data.rewrites) || [];
    return { ok: true, rewrites: list };
  } catch (err) {
    return { ok: false, rewrites: [], error: (err && err.message) || 'network error' };
  }
}

/**
 * Delete a single rewrite of a profile.
 *
 * @param {string} profileId
 * @param {string} sid session cookie
 * @param {string} domain
 * @returns {Promise<{ ok: boolean, status: number, error?: string }>}
 */
async function deleteRewrite(profileId, sid, domain) {
  try {
    const res = await nextDnsFetch(
      `${NEXTDNS_API_BASE}/profiles/${profileId}/rewrites/${encodeURIComponent(domain)}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Cookie: sid || '',
          'User-Agent': 'B1sTeam-LocketGold/4.0 (+https://b1s.id.vn)',
        },
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: (err && err.message) || 'network error' };
  }
}

/**
 * Log into NextDNS and return the session cookie.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: boolean, sid: string, profileId: string, profiles: object[], error?: string }>}
 */
async function loginNextDnsSession(email, password) {
  try {
    const res = await nextDnsFetch(`${NEXTDNS_API_BASE}/accounts/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'B1sTeam-LocketGold/4.0 (+https://b1s.id.vn)',
        Origin: 'https://my.nextdns.io',
      },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      return { ok: false, sid: '', profileId: '', profiles: [], error: `Đăng nhập thất bại (${res.status})` };
    }
    const data = await res.json().catch(() => ({}));
    const profiles = (data && data.profiles) || [];
    return {
      ok: true,
      sid: extractNextDnsSid(res),
      profileId: (profiles[0] && profiles[0].id) || '',
      profiles,
    };
  } catch (err) {
    return { ok: false, sid: '', profileId: '', profiles: [], error: (err && err.message) || 'network error' };
  }
}

/**
 * Read the query usage of a profile.
 *
 * @param {object} options
 * @param {string} options.email
 * @param {string} options.password
 * @param {string} [options.profileId]
 * @returns {Promise<object>}
 */
async function checkNextDnsQueryUsage(options = {}) {
  const { email = '', password = '', profileId = '' } = options || {};

  const session = await loginNextDnsSession(email, password);
  if (!session.ok) return session;

  const target = profileId || session.profileId;
  if (!target) {
    return { ok: false, error: 'Không tìm thấy Profile ID trên tài khoản NextDNS' };
  }

  try {
    const res = await nextDnsFetch(`${NEXTDNS_API_BASE}/profiles/${target}/analytics/status`, {
      headers: {
        Accept: 'application/json',
        Cookie: session.sid,
        'User-Agent': 'B1sTeam-LocketGold/4.0 (+https://b1s.id.vn)',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Analytics lỗi (${res.status}): ${text.slice(0, 160)}` };
    }

    const stats = (await res.json()) || {};
    const queries = Number(stats.queries || stats.queriesCount || 0);
    const limit = Number(stats.queriesLimit || 300000);
    const percent = limit > 0 ? Math.min(100, Math.round((queries / limit) * 100)) : 0;

    return {
      ok: true,
      profileId: target,
      queries,
      limit,
      percent,
      devices: stats.devices || [],
      is_active: (Array.isArray(stats.devices) && stats.devices.length > 0) || queries > 0,
      last_query_at: stats.lastQueryAt || null,
      last_query_ago_minutes: stats.lastQueryAt
        ? Math.round((Date.now() - new Date(stats.lastQueryAt).getTime()) / 60000)
        : null,
    };
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'network error' };
  }
}

module.exports = {
  NEXTDNS_API_BASE,
  DEFAULT_FLY_IP,
  REQUEST_TIMEOUT_MS,
  REWRITE_DOMAINS,
  generatePassword,
  generateMailHandle,
  createTemporaryMailbox,
  extractNextDnsSid,
  nextDnsFetch,
  createNextDnsAccount,
  createRewrite,
  listRewrites,
  deleteRewrite,
  loginNextDnsSession,
  checkNextDnsQueryUsage,
};
