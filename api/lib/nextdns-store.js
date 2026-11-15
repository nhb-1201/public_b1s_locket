'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Storage adapter for NextDNS accounts and license keys.
 *
 * Backend priority chain:
 *   1. Cloudflare D1 REST  (D1_API_TOKEN + D1_DATABASE_ID [+ D1_ACCOUNT_ID])
 *   2. Supabase REST       (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   3. In-memory Map       (development / tests fallback)
 *
 * The adapter never throws because of a missing backend: it degrades to the
 * in-memory store so every endpoint keeps working.
 */

const crypto = require('crypto');

const NEXTDNS_TABLE = 'nextdns_accounts';
const LICENSE_TABLE = 'license_keys';

/** In-memory fallback store (module scope => survives hot reloads in dev). */
const memory = {
  nextdns: new Map(),
  licenses: new Map(),
};

/** Cached backend name, refreshed when the environment changes. */
let cachedBackend = null;
let cachedSignature = '';

/**
 * @returns {{ d1: boolean, supabase: boolean, memory: boolean }}
 */
function backendFlags() {
  const d1 = Boolean(process.env.D1_API_TOKEN && process.env.D1_DATABASE_ID);
  const supabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { d1, supabase, memory: !d1 && !supabase };
}

/**
 * Name of the active backend: "d1" | "supabase" | "memory".
 * @returns {string}
 */
function getStoreBackend() {
  const flags = backendFlags();
  const signature = `${flags.d1}:${flags.supabase}`;
  if (cachedBackend && cachedSignature === signature) return cachedBackend;
  cachedSignature = signature;
  cachedBackend = flags.d1 ? 'd1' : flags.supabase ? 'supabase' : 'memory';
  return cachedBackend;
}

/**
 * @returns {string} D1 account id or an empty string
 */
function d1AccountId() {
  return String(process.env.D1_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
}

/**
 * Run a statement against the Cloudflare D1 REST API.
 *
 * @param {string} sql
 * @param {unknown[]} [params]
 * @returns {Promise<Array<object>>}
 */
async function d1Query(sql, params = []) {
  const accountId = d1AccountId();
  const databaseId = String(process.env.D1_DATABASE_ID || '').trim();
  const token = String(process.env.D1_API_TOKEN || '').trim();
  if (!accountId || !databaseId || !token) throw new Error('D1 REST chưa được cấu hình');

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`D1 REST lỗi ${res.status}: ${text.slice(0, 200)}`);
    const json = JSON.parse(text);
    if (!json.success) throw new Error('D1 REST trả về success=false');
    const chunk = Array.isArray(json.result) ? json.result[0] : null;
    return chunk && Array.isArray(chunk.results) ? chunk.results : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Supabase REST helpers.
 *
 * @param {string} table
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object|string} [options.body]
 * @param {string} [options.query]
 * @param {string} [options.prefer]
 * @returns {Promise<Array<object>>}
 */
async function supabaseRequest(table, options = {}) {
  const { method = 'GET', body = null, query = '', prefer = '' } = options;
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const url = `${base}/rest/v1/${table}${query ? `?${query}` : ''}`;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  if (body !== null) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase REST lỗi ${res.status}: ${text.slice(0, 200)}`);
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_err) {
      return [];
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalise a stored row (rewrites may be a JSON string or an array).
 *
 * @param {object|null} row
 * @returns {object|null}
 */
function normalizeRow(row) {
  if (!row) return null;
  const out = { ...row };
  if (typeof out.rewrites === 'string') {
    try {
      out.rewrites = JSON.parse(out.rewrites);
    } catch (_err) {
      out.rewrites = [];
    }
  }
  if (!Array.isArray(out.rewrites)) out.rewrites = out.rewrites ? [out.rewrites] : [];
  if (typeof out.is_active === 'string') out.is_active = out.is_active !== '0' && out.is_active !== 'false';
  if (typeof out.query_count === 'string') out.query_count = Number(out.query_count) || 0;
  return out;
}

/**
 * @param {object} account
 * @returns {object} normalized account row
 */
function normalizeAccount(account = {}) {
  const now = new Date().toISOString();
  return {
    id: account.id || crypto.randomUUID(),
    profile_id: String(account.profile_id || '').trim(),
    profile_name: String(account.profile_name || account.name || '').trim(),
    email: String(account.email || '').trim(),
    password: String(account.password || ''),
    dns_url: String(account.dns_url || '').trim(),
    fly_ip: String(account.fly_ip || '').trim(),
    rewrites: JSON.stringify(Array.isArray(account.rewrites) ? account.rewrites : []),
    query_count: Number(account.query_count) || 0,
    is_active: account.is_active === false ? 0 : 1,
    created_at: account.created_at || now,
    updated_at: now,
  };
}

/**
 * Persist a NextDNS account (insert or update by profile_id).
 *
 * @param {object} account
 * @returns {Promise<object>} the stored row
 */
async function saveNextDnsAccount(account) {
  const row = normalizeAccount(account);
  if (!row.profile_id) throw new Error('profile_id là bắt buộc');

  const backend = getStoreBackend();
  if (backend === 'd1') {
    await d1Query(
      `insert into ${NEXTDNS_TABLE}
         (id, profile_id, profile_name, email, password, dns_url, fly_ip, rewrites, query_count, is_active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(profile_id) do update set
         profile_name = excluded.profile_name,
         email        = excluded.email,
         password     = excluded.password,
         dns_url      = excluded.dns_url,
         fly_ip       = excluded.fly_ip,
         rewrites     = excluded.rewrites,
         query_count  = excluded.query_count,
         is_active    = excluded.is_active,
         updated_at   = excluded.updated_at`,
      [
        row.id,
        row.profile_id,
        row.profile_name,
        row.email,
        row.password,
        row.dns_url,
        row.fly_ip,
        row.rewrites,
        row.query_count,
        row.is_active,
        row.created_at,
        row.updated_at,
      ],
    );
    return row;
  }

  if (backend === 'supabase') {
    const [result] = await supabaseRequest(NEXTDNS_TABLE, {
      method: 'POST',
      body: row,
      query: 'on_conflict=profile_id',
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    return normalizeRow(result) || row;
  }

  memory.nextdns.set(row.profile_id, row);
  return row;
}

/**
 * List every stored NextDNS account (newest first).
 *
 * @returns {Promise<object[]>}
 */
async function listNextDnsAccounts() {
  const backend = getStoreBackend();
  if (backend === 'd1') {
    const rows = await d1Query(
      `select * from ${NEXTDNS_TABLE} order by created_at desc`,
    );
    return rows.map(normalizeRow).filter(Boolean);
  }
  if (backend === 'supabase') {
    const rows = await supabaseRequest(NEXTDNS_TABLE, {
      query: 'select=*&order=created_at.desc',
    });
    return rows.map(normalizeRow).filter(Boolean);
  }
  return Array.from(memory.nextdns.values())
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(normalizeRow);
}

/**
 * Find a single account by profile id.
 *
 * @param {string} profileId
 * @returns {Promise<object|null>}
 */
async function getNextDnsAccount(profileId) {
  const id = String(profileId || '').trim();
  if (!id) return null;
  const backend = getStoreBackend();
  if (backend === 'd1') {
    const rows = await d1Query(`select * from ${NEXTDNS_TABLE} where profile_id = ? limit 1`, [id]);
    return normalizeRow(rows[0]);
  }
  if (backend === 'supabase') {
    const rows = await supabaseRequest(NEXTDNS_TABLE, {
      query: `select=*&profile_id=eq.${encodeURIComponent(id)}&limit=1`,
    });
    return normalizeRow(rows[0]);
  }
  return normalizeRow(memory.nextdns.get(id) || null);
}

/**
 * Patch an existing account.
 *
 * @param {string} profileId
 * @param {object} patch
 * @returns {Promise<object|null>}
 */
async function updateNextDnsAccount(profileId, patch = {}) {
  const id = String(profileId || '').trim();
  if (!id) return null;
  const allowed = [
    'profile_name',
    'email',
    'password',
    'dns_url',
    'fly_ip',
    'rewrites',
    'query_count',
    'is_active',
  ];
  const fields = [];
  const values = [];
  for (const field of allowed) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    let value = patch[field];
    if (field === 'rewrites') value = JSON.stringify(Array.isArray(value) ? value : []);
    if (field === 'is_active') value = value ? 1 : 0;
    fields.push(`${field} = ?`);
    values.push(value);
  }
  if (!fields.length) return getNextDnsAccount(id);

  const updatedAt = new Date().toISOString();
  fields.push('updated_at = ?');
  values.push(updatedAt);

  const backend = getStoreBackend();
  if (backend === 'd1') {
    await d1Query(`update ${NEXTDNS_TABLE} set ${fields.join(', ')} where profile_id = ?`, [
      ...values,
      id,
    ]);
    return getNextDnsAccount(id);
  }
  if (backend === 'supabase') {
    const body = {};
    for (const field of allowed) {
      if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
      let value = patch[field];
      if (field === 'rewrites') value = JSON.stringify(Array.isArray(value) ? value : []);
      if (field === 'is_active') value = value ? 1 : 0;
      body[field] = value;
    }
    body.updated_at = updatedAt;
    await supabaseRequest(NEXTDNS_TABLE, {
      method: 'PATCH',
      body,
      query: `profile_id=eq.${encodeURIComponent(id)}`,
      prefer: 'return=minimal',
    });
    return getNextDnsAccount(id);
  }

  const current = memory.nextdns.get(id);
  if (!current) return null;
  const next = { ...current };
  for (const field of allowed) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    let value = patch[field];
    if (field === 'rewrites') value = JSON.stringify(Array.isArray(value) ? value : []);
    if (field === 'is_active') value = value ? 1 : 0;
    next[field] = value;
  }
  next.updated_at = updatedAt;
  memory.nextdns.set(id, next);
  return normalizeRow(next);
}

/**
 * Delete an account.
 *
 * @param {string} profileId
 * @returns {Promise<boolean>} true when a row was removed
 */
async function deleteNextDnsAccount(profileId) {
  const id = String(profileId || '').trim();
  if (!id) return false;
  const backend = getStoreBackend();
  if (backend === 'd1') {
    const rows = await d1Query(`delete from ${NEXTDNS_TABLE} where profile_id = ? returning profile_id`, [id]);
    return rows.length > 0;
  }
  if (backend === 'supabase') {
    const rows = await supabaseRequest(NEXTDNS_TABLE, {
      method: 'DELETE',
      query: `profile_id=eq.${encodeURIComponent(id)}`,
      prefer: 'return=representation',
    });
    return rows.length > 0;
  }
  return memory.nextdns.delete(id);
}

/**
 * Update the query counter of an account.
 *
 * @param {string} profileId
 * @param {number} queryCount
 * @returns {Promise<object|null>}
 */
async function updateQueryUsage(profileId, queryCount) {
  const id = String(profileId || '').trim();
  if (!id) return null;
  return updateNextDnsAccount(id, { query_count: Number(queryCount) || 0 });
}

/**
 * Register a license key.
 *
 * @param {object} record { key_hash, key_prefix, plan, device_id, expires_at }
 * @returns {Promise<object>}
 */
async function saveLicenseKey(record = {}) {
  const row = {
    id: record.id || crypto.randomUUID(),
    key_hash: String(record.key_hash || '').trim(),
    key_prefix: String(record.key_prefix || '').trim(),
    plan: String(record.plan || 'free'),
    device_id: record.device_id == null ? '' : String(record.device_id),
    issued_at: record.issued_at || new Date().toISOString(),
    expires_at: record.expires_at || null,
    revoked_at: record.revoked_at || null,
    usage_count: Number(record.usage_count) || 0,
    created_at: record.created_at || new Date().toISOString(),
  };
  if (!row.key_hash) throw new Error('key_hash là bắt buộc');

  const backend = getStoreBackend();
  if (backend === 'd1') {
    await d1Query(
      `insert into ${LICENSE_TABLE}
         (id, key_hash, key_prefix, plan, device_id, issued_at, expires_at, revoked_at, usage_count, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(key_hash) do update set
         plan       = excluded.plan,
         device_id  = excluded.device_id,
         expires_at = excluded.expires_at,
         revoked_at = excluded.revoked_at`,
      [
        row.id,
        row.key_hash,
        row.key_prefix,
        row.plan,
        row.device_id,
        row.issued_at,
        row.expires_at,
        row.revoked_at,
        row.usage_count,
        row.created_at,
      ],
    );
    return row;
  }
  if (backend === 'supabase') {
    const [result] = await supabaseRequest(LICENSE_TABLE, {
      method: 'POST',
      body: row,
      query: 'on_conflict=key_hash',
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    return result || row;
  }
  memory.licenses.set(row.key_hash, row);
  return row;
}

/**
 * Find a license by its sha256 hash.
 *
 * @param {string} keyHash
 * @returns {Promise<object|null>}
 */
async function findLicenseKey(keyHash) {
  const hash = String(keyHash || '').trim();
  if (!hash) return null;
  const backend = getStoreBackend();
  if (backend === 'd1') {
    const rows = await d1Query(`select * from ${LICENSE_TABLE} where key_hash = ? limit 1`, [hash]);
    return rows[0] || null;
  }
  if (backend === 'supabase') {
    const rows = await supabaseRequest(LICENSE_TABLE, {
      query: `select=*&key_hash=eq.${encodeURIComponent(hash)}&limit=1`,
    });
    return rows[0] || null;
  }
  return memory.licenses.get(hash) || null;
}

/**
 * List every registered license.
 *
 * @returns {Promise<object[]>}
 */
async function listLicenseKeys() {
  const backend = getStoreBackend();
  if (backend === 'd1') {
    return d1Query(`select * from ${LICENSE_TABLE} order by created_at desc`);
  }
  if (backend === 'supabase') {
    return supabaseRequest(LICENSE_TABLE, { query: 'select=*&order=created_at.desc' });
  }
  return Array.from(memory.licenses.values());
}

/**
 * Revoke a license.
 *
 * @param {string} keyHash
 * @returns {Promise<boolean>}
 */
async function revokeLicenseKey(keyHash) {
  const hash = String(keyHash || '').trim();
  if (!hash) return false;
  const backend = getStoreBackend();
  const revokedAt = new Date().toISOString();
  if (backend === 'd1') {
    const rows = await d1Query(
      `update ${LICENSE_TABLE} set revoked_at = ? where key_hash = ? returning key_hash`,
      [revokedAt, hash],
    );
    return rows.length > 0;
  }
  if (backend === 'supabase') {
    const rows = await supabaseRequest(LICENSE_TABLE, {
      method: 'PATCH',
      body: { revoked_at: revokedAt },
      query: `key_hash=eq.${encodeURIComponent(hash)}`,
      prefer: 'return=representation',
    });
    return rows.length > 0;
  }
  const current = memory.licenses.get(hash);
  if (!current) return false;
  current.revoked_at = revokedAt;
  memory.licenses.set(hash, current);
  return true;
}

/**
 * Reset the in-memory fallback (used by tests).
 */
function resetMemoryStore() {
  memory.nextdns.clear();
  memory.licenses.clear();
}

module.exports = {
  NEXTDNS_TABLE,
  LICENSE_TABLE,
  backendFlags,
  getStoreBackend,
  d1Query,
  supabaseRequest,
  saveNextDnsAccount,
  listNextDnsAccounts,
  getNextDnsAccount,
  updateNextDnsAccount,
  deleteNextDnsAccount,
  updateQueryUsage,
  saveLicenseKey,
  findLicenseKey,
  listLicenseKeys,
  revokeLicenseKey,
  resetMemoryStore,
};
