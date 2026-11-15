/**
 * B1sTeam — LocketGold (Free)
 * NextDNS profile rotation (80% NextDNS / 20% direct).
 *
 * The decision is deterministic: the same identifier always resolves to the
 * same profile (stable + cache friendly) while the pool as a whole reaches the
 * requested ratio.
 *
 * @module rotator
 */

/** Default ratio: 80% of the traffic uses NextDNS. */
export const DEFAULT_RATIO = 0.8;

/** Namespace used to salt the deterministic hash. */
export const HASH_NAMESPACE = 'b1steam:locketgold:rotate';

/**
 * FNV-1a 32 bit hash.
 *
 * @param {unknown} input
 * @returns {number} unsigned 32 bit integer
 */
export function stableHash(input) {
  const text = String(input == null ? '' : input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Map a string into the [0, 1) range.
 *
 * @param {unknown} input
 * @returns {number}
 */
export function hashUnit(input) {
  return stableHash(input) / 0x100000000;
}

/**
 * Split the pool from the fallback profile.
 *
 * @param {Array<object>} profiles
 * @param {object|null} explicitFallback
 * @returns {{ pool: Array<object>, fallback: object }}
 */
export function splitPool(profiles, explicitFallback) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (explicitFallback) {
    return { pool: list.filter((item) => item !== explicitFallback), fallback: explicitFallback };
  }
  const marked = list.find((item) => item.kind === 'fallback' || item.is_fallback === true);
  if (marked) {
    return { pool: list.filter((item) => item !== marked), fallback: marked };
  }
  return { pool: list, fallback: { id: 'fallback', kind: 'fallback', dns_url: '' } };
}

/**
 * Pick the profile used for a given identifier.
 *
 * @param {Array<object>} profiles candidate profiles
 * @param {object} [options]
 * @param {string} [options.profileId]
 * @param {number} [options.ratio]
 * @param {object|null} [options.fallback]
 * @returns {{ profile: object, route: string, score: number, id: string }}
 */
export function pickProfile(profiles, options = {}) {
  const { profileId = '', ratio = DEFAULT_RATIO, fallback = null } = options || {};
  const boundedRatio = Math.min(1, Math.max(0, Number(ratio)));
  const { pool, fallback: fallbackProfile } = splitPool(profiles, fallback);

  const score = hashUnit(`${HASH_NAMESPACE}:${profileId}`);

  if (!pool.length || score >= boundedRatio) {
    return { ...fallbackProfile, profile: fallbackProfile, route: 'fallback', score };
  }

  const index = stableHash(`${HASH_NAMESPACE}:pool:${profileId}`) % pool.length;
  const chosen = pool[index];
  return { ...chosen, profile: chosen, route: 'nextdns', score };
}

/**
 * Parse the `NEXTDNS_POOL` environment variable (comma separated ids).
 *
 * @param {string|undefined} raw
 * @returns {Array<object>}
 */
export function parsePool(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => ({ id, kind: 'nextdns', dns_url: `https://dns.nextdns.io/${id}` }));
}
