/**
 * B1sTeam — LocketGold (Free)
 * Per IP token bucket rate limiter.
 *
 * 60 queries / 10 minutes per IP. The bucket lives in a module scope Map
 * (one Map per Cloudflare isolate) and evicts stale entries lazily.
 *
 * @module ratelimit
 */

/** Number of queries allowed inside the window. */
export const DEFAULT_LIMIT = 60;

/** Length of the window (ms). */
export const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

/** Maximum number of tracked clients before a lazy eviction sweep. */
export const MAX_TRACKED_CLIENTS = 5000;

/**
 * Create a token bucket limiter.
 *
 * @param {object} [options]
 * @param {number} [options.limit]
 * @param {number} [options.windowMs]
 * @param {number} [options.maxClients]
 * @returns {{ check: (ip: string, now?: number) => { allowed: boolean, remaining: number, limit: number, resetAt: number }, reset: (ip: string) => void, size: () => number, sweep: (now?: number) => number }}
 */
export function createRateLimiter(options = {}) {
  const {
    limit = DEFAULT_LIMIT,
    windowMs = DEFAULT_WINDOW_MS,
    maxClients = MAX_TRACKED_CLIENTS,
  } = options || {};

  const buckets = new Map();

  function sweep(now = Date.now()) {
    let removed = 0;
    for (const [key, bucket] of buckets) {
      if (now - bucket.updatedAt >= windowMs) {
        buckets.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  return {
    /**
     * Consume one token for the given client.
     *
     * @param {string} ip
     * @param {number} [now]
     */
    check(ip, now = Date.now()) {
      const key = String(ip || 'unknown');
      if (buckets.size >= maxClients) sweep(now);

      const bucket = buckets.get(key) || { tokens: limit, updatedAt: now };
      const elapsed = Math.max(0, now - bucket.updatedAt);
      bucket.tokens = Math.min(limit, bucket.tokens + (elapsed / windowMs) * limit);
      bucket.updatedAt = now;

      let allowed = true;
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
      } else {
        allowed = false;
      }
      buckets.set(key, bucket);

      return {
        allowed,
        remaining: Math.max(0, Math.floor(bucket.tokens)),
        limit,
        resetAt: bucket.updatedAt + windowMs,
      };
    },

    /**
     * Forget a client.
     * @param {string} ip
     */
    reset(ip) {
      buckets.delete(String(ip || 'unknown'));
    },

    /** @returns {number} number of tracked clients */
    size() {
      return buckets.size;
    },

    /**
     * Remove the stale buckets.
     * @param {number} [now]
     * @returns {number} number of removed entries
     */
    sweep,
  };
}

/** Module scope limiter shared by every request of the isolate. */
export const rateLimiter = createRateLimiter();

export default rateLimiter;
