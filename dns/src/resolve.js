/**
 * B1sTeam — LocketGold (Free)
 * Upstream resolution + answer cache.
 *
 * Two wire formats are supported:
 *   - RFC 8484 wire format (`application/dns-message`)
 *   - the JSON API (`application/dns-json`)
 *
 * The worker is never an open resolver: unknown names are resolved through
 * 1.1.1.1 / 1.0.0.1 only, and the allow-list hosts are answered locally.
 *
 * @module resolve
 */

/** JSON capable upstream resolvers (Cloudflare 1.1.1.1 / 1.0.0.1). */
export const UPSTREAM_JSON_ENDPOINTS = Object.freeze([
  'https://1.1.1.1/dns-query',
  'https://1.0.0.1/dns-query',
]);

/** Wire format capable upstream resolvers. */
export const UPSTREAM_WIRE_ENDPOINTS = Object.freeze([
  'https://1.1.1.1/dns-query',
  'https://1.0.0.1/dns-query',
]);

/** Default TTL of the cached answers (seconds). */
export const DEFAULT_TTL_SECONDS = 60;

/** Default TTL of the cache entries (ms). */
export const CACHE_TTL_MS = DEFAULT_TTL_SECONDS * 1000;

/** Maximum number of cached entries. */
export const CACHE_MAX_ENTRIES = 512;

/** Timeout of a single upstream call (ms). */
export const UPSTREAM_TIMEOUT_MS = 4000;

/** In-memory answer cache (module scope => one per Cloudflare isolate). */
const cache = new Map();

/**
 * Read a cached value.
 *
 * @param {string} key
 * @param {number} [now]
 * @returns {*|null}
 */
export function cacheGet(key, now = Date.now()) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= now) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

/**
 * Store a value in the cache (lazy eviction of expired + oldest entries).
 *
 * @param {string} key
 * @param {*} value
 * @param {number} [ttlMs]
 * @param {number} [now]
 */
export function cacheSet(key, value, ttlMs = CACHE_TTL_MS, now = Date.now()) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    for (const [entryKey, entry] of cache) {
      if (entry.expires <= now) cache.delete(entryKey);
    }
    while (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
  }
  cache.set(key, { value, expires: now + ttlMs });
}

/**
 * @returns {{ size: number, max: number }}
 */
export function cacheStats() {
  return { size: cache.size, max: CACHE_MAX_ENTRIES };
}

/** Drop every cached answer. */
export function clearCache() {
  cache.clear();
}

/**
 * Parse the question section of a DNS wire format message.
 *
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{ id: number, flags: number, opcode: number, rd: boolean, name: string, type: number, classCode: number, questionEnd: number }|null}
 */
export function parseWireQuestion(input) {
  if (!input) return null;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 12) return null;

  const id = (bytes[0] << 8) | bytes[1];
  const flags = (bytes[2] << 8) | bytes[3];
  const qdcount = (bytes[4] << 8) | bytes[5];
  if (qdcount < 1) return null;

  let offset = 12;
  const labels = [];
  let guard = 0;
  while (offset < bytes.length && guard < 128) {
    guard += 1;
    const length = bytes[offset];
    if (length === 0) {
      offset += 1;
      break;
    }
    if ((length & 0xc0) === 0xc0) {
      offset += 2;
      break;
    }
    offset += 1;
    labels.push(String.fromCharCode(...bytes.slice(offset, offset + length)));
    offset += length;
  }

  const name = labels.join('.').toLowerCase();
  const type = offset + 1 < bytes.length ? (bytes[offset] << 8) | bytes[offset + 1] : 0;
  const classCode = offset + 3 < bytes.length ? (bytes[offset + 2] << 8) | bytes[offset + 3] : 0;

  return {
    id,
    flags,
    opcode: (flags >> 11) & 0x0f,
    rd: Boolean(flags & 0x0100),
    name,
    type,
    classCode,
    questionEnd: Math.min(bytes.length, offset + 4),
  };
}

/**
 * Convert an IPv4 string into 4 bytes.
 *
 * @param {string} ip
 * @returns {number[]}
 */
export function ipv4ToBytes(ip) {
  const parts = String(ip || '').split('.');
  if (parts.length !== 4) return [0, 0, 0, 0];
  return parts.map((part) => {
    const value = Number(part);
    return Number.isFinite(value) && value >= 0 && value <= 255 ? value : 0;
  });
}

/**
 * Build a DNS answer (A record) for an incoming query.
 *
 * When `ip` is empty a NODATA response (no answer record) is produced.
 *
 * @param {object} options
 * @param {Uint8Array} options.request the original query bytes
 * @param {string} options.ip the IPv4 answer
 * @param {number} [options.ttl]
 * @returns {Uint8Array}
 */
export function buildWireResponse(options = {}) {
  const { request, ip = '0.0.0.0', ttl = DEFAULT_TTL_SECONDS } = options || {};
  const query = request instanceof Uint8Array ? request : new Uint8Array(request || 0);
  const question = parseWireQuestion(query);
  const hasAnswer = Boolean(ip);

  const header = new Uint8Array(12);
  const id = question ? question.id : 0;
  header[0] = (id >> 8) & 0xff;
  header[1] = id & 0xff;

  const opcode = question ? question.opcode : 0;
  const rd = question ? question.rd : true;
  let flags = 0x8000; // QR
  flags |= (opcode & 0x0f) << 11;
  if (rd) flags |= 0x0100;
  flags |= 0x0080; // RA
  header[2] = (flags >> 8) & 0xff;
  header[3] = flags & 0xff;
  header[4] = 0;
  header[5] = 1; // QDCOUNT
  header[6] = 0;
  header[7] = hasAnswer ? 1 : 0; // ANCOUNT

  const questionBytes = question ? query.slice(12, question.questionEnd) : new Uint8Array(0);
  const answer = new Uint8Array(12 + questionBytes.length + (hasAnswer ? 16 : 0));
  answer.set(header, 0);
  answer.set(questionBytes, 12);
  if (!hasAnswer) return answer;

  let offset = 12 + questionBytes.length;
  answer[offset] = 0xc0; // pointer to the question name
  answer[offset + 1] = 0x0c;
  answer[offset + 2] = 0x00;
  answer[offset + 3] = 0x01; // TYPE A
  answer[offset + 4] = 0x00;
  answer[offset + 5] = 0x01; // CLASS IN
  answer[offset + 6] = (ttl >> 24) & 0xff;
  answer[offset + 7] = (ttl >> 16) & 0xff;
  answer[offset + 8] = (ttl >> 8) & 0xff;
  answer[offset + 9] = ttl & 0xff;
  answer[offset + 10] = 0x00;
  answer[offset + 11] = 0x04; // RDLENGTH
  const ipBytes = ipv4ToBytes(ip);
  answer[offset + 12] = ipBytes[0];
  answer[offset + 13] = ipBytes[1];
  answer[offset + 14] = ipBytes[2];
  answer[offset + 15] = ipBytes[3];

  return answer;
}

/**
 * Normalise a JSON answer coming from an upstream resolver.
 *
 * @param {object} data
 * @param {string} [name]
 * @param {string} [type]
 * @returns {{ Status: number, TC: boolean, RD: boolean, RA: boolean, AD: boolean, CD: boolean, Question: object[], Answer: object[], Comment: string }}
 */
export function normalizeJsonAnswer(data, name = '', type = 'A') {
  const source = data || {};
  const question =
    Array.isArray(source.Question) && source.Question.length
      ? source.Question
      : name
        ? [{ name, type }]
        : [];
  return {
    Status: Number(source.Status || 0),
    TC: Boolean(source.TC),
    RD: Boolean(source.RD),
    RA: Boolean(source.RA),
    AD: Boolean(source.AD),
    CD: Boolean(source.CD),
    Question: question,
    Answer: Array.isArray(source.Answer) ? source.Answer : [],
    Comment: source.Comment || '',
  };
}

/**
 * Build a JSON answer that points at the Fly.io MITM proxy.
 *
 * @param {string} name
 * @param {string} type
 * @param {string} ip
 * @param {number} [ttl]
 * @returns {object}
 */
export function buildFlyJsonAnswer(name, type = 'A', ip = '0.0.0.0', ttl = DEFAULT_TTL_SECONDS) {
  const answer = {
    Status: 0,
    TC: false,
    RD: true,
    RA: true,
    AD: false,
    CD: false,
    Question: [{ name, type }],
    Answer: [],
    Comment: 'B1sTeam LocketGold - allow-list host',
  };
  if (type === 'A' || type === 'ANY') {
    answer.Answer.push({ name, type: 'A', TTL: ttl, data: ip });
  }
  return answer;
}

/**
 * fetch() with a timeout.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Response>}
 */
async function timedFetch(url, options = {}) {
  const { timeoutMs = UPSTREAM_TIMEOUT_MS, ...rest } = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a name through the JSON API of 1.1.1.1 / 1.0.0.1.
 *
 * @param {string} name
 * @param {string} [type]
 * @param {object} [options]
 * @returns {Promise<object|null>}
 */
export async function resolveJson(name, type = 'A', options = {}) {
  const { endpoints = UPSTREAM_JSON_ENDPOINTS, useCache = true } = options || {};
  const cacheKey = `json:${String(type).toUpperCase()}:${String(name).toLowerCase()}`;

  if (useCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
      const res = await timedFetch(url, {
        headers: { Accept: 'application/dns-json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const answer = normalizeJsonAnswer(data, name, type);
      if (useCache) cacheSet(cacheKey, answer);
      return answer;
    } catch (_err) {
      // try the next resolver
    }
  }
  return null;
}

/**
 * Resolve a name through the JSON API of an arbitrary DoH server
 * (used by the NextDNS rotation).
 *
 * @param {string} baseUrl e.g. "https://dns.nextdns.io/abc123"
 * @param {string} name
 * @param {string} [type]
 * @param {object} [options]
 * @returns {Promise<object|null>}
 */
export async function resolveJsonVia(baseUrl, name, type = 'A', options = {}) {
  const { useCache = true } = options || {};
  const cacheKey = `via:${baseUrl}:${String(type).toUpperCase()}:${String(name).toLowerCase()}`;
  if (useCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }
  try {
    const url = `${String(baseUrl).replace(/\/+$/, '')}/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
    const res = await timedFetch(url, { headers: { Accept: 'application/dns-json' } });
    if (!res.ok) return null;
    const answer = normalizeJsonAnswer(await res.json(), name, type);
    if (useCache) cacheSet(cacheKey, answer);
    return answer;
  } catch (_err) {
    return null;
  }
}

/**
 * Forward a raw DNS message to an upstream resolver.
 *
 * @param {Uint8Array} bytes
 * @param {object} [options]
 * @returns {Promise<Uint8Array|null>}
 */
export async function forwardWire(bytes, options = {}) {
  const { endpoints = UPSTREAM_WIRE_ENDPOINTS } = options || {};
  for (const endpoint of endpoints) {
    try {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/dns-message', Accept: 'application/dns-message' },
        body: bytes,
      });
      if (!res.ok) continue;
      return new Uint8Array(await res.arrayBuffer());
    } catch (_err) {
      // try the next resolver
    }
  }
  return null;
}
