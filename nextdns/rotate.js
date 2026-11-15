'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * NextDNS rotation policy engine.
 *
 * Policy: 80% of the traffic is served by a per user NextDNS profile, the
 * remaining 20% falls back to the shared Fly.io resolver.
 *
 * The decision is *deterministic*: the same profile id always produces the
 * same choice (stable + cache friendly) while the pool as a whole still
 * reaches the requested ratio.
 */

/** Default rotation ratio (80% NextDNS / 20% direct). */
const DEFAULT_RATIO = 0.8;

/** Default rotation interval (6 hours). */
const DEFAULT_ROTATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Namespace used to salt the deterministic hash. */
const HASH_NAMESPACE = 'b1steam:locketgold:rotate';

/**
 * FNV-1a 32 bit hash (fast, stable, good enough spread for bucketing).
 *
 * @param {unknown} input
 * @returns {number} unsigned 32 bit integer
 */
function stableHash(input) {
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
function hashUnit(input) {
  return stableHash(input) / 0x100000000;
}

/**
 * Split the pool from the fallback profile.
 *
 * @param {Array<object>} profiles
 * @param {object|null} explicitFallback
 * @returns {{ pool: Array<object>, fallback: object }}
 */
function splitPool(profiles, explicitFallback) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (explicitFallback) {
    return {
      pool: list.filter((p) => p !== explicitFallback),
      fallback: explicitFallback,
    };
  }
  const marked = list.find((p) => p.kind === 'fallback' || p.is_fallback === true);
  if (marked) {
    return {
      pool: list.filter((p) => p !== marked),
      fallback: marked,
    };
  }
  return {
    pool: list,
    fallback: { id: 'fallback', kind: 'fallback', dns_url: '' },
  };
}

/**
 * Pick the profile used for a given user.
 *
 * @param {Array<object>} profiles candidate profiles
 * @param {object} [options]
 * @param {string} [options.profileId] stable user identifier
 * @param {number} [options.ratio] share of traffic that uses NextDNS (0..1)
 * @param {object|null} [options.fallback] shared/fallback profile
 * @returns {{ profile: object, route: string, score: number, id: string }}
 */
function pickProfile(profiles, options = {}) {
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
 * Estimate the real ratio of a pool by simulating synthetic users.
 *
 * @param {Array<object>} profiles
 * @param {object} [options]
 * @param {number} [options.ratio] requested ratio
 * @param {number} [options.samples] number of simulated users
 * @param {string} [options.seed] seed of the synthetic ids
 * @returns {number} measured share of traffic served by the pool (0..1)
 */
function estimateRatio(profiles, options = {}) {
  const {
    ratio = DEFAULT_RATIO,
    samples = 20000,
    seed = 'b1steam-sample',
  } = options || {};
  const total = Math.max(1, Math.floor(samples));
  const { pool, fallback } = splitPool(profiles, options.fallback || null);
  if (!pool.length) return 0;

  let hits = 0;
  for (let i = 0; i < total; i += 1) {
    const choice = pickProfile(profiles, {
      profileId: `${seed}-${i}`,
      ratio,
      fallback: options.fallback || null,
    });
    if (choice.route === 'nextdns' && choice.profile !== fallback) hits += 1;
  }
  return hits / total;
}

/**
 * Decide whether a profile must be rotated.
 *
 * @param {number|string|Date|null} lastRotatedAt
 * @param {number} [now]
 * @param {number} [intervalMs]
 * @returns {boolean}
 */
function shouldRotate(lastRotatedAt, now = Date.now(), intervalMs = DEFAULT_ROTATE_INTERVAL_MS) {
  const interval = Number(intervalMs);
  if (!Number.isFinite(interval) || interval <= 0) return false;
  if (lastRotatedAt === null || lastRotatedAt === undefined || lastRotatedAt === '') return true;
  const last = lastRotatedAt instanceof Date ? lastRotatedAt.getTime() : Number(lastRotatedAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= interval;
}

module.exports = {
  DEFAULT_RATIO,
  DEFAULT_ROTATE_INTERVAL_MS,
  HASH_NAMESPACE,
  stableHash,
  hashUnit,
  splitPool,
  pickProfile,
  estimateRatio,
  shouldRotate,
};
