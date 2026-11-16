/**
 * B1sTeam — LocketGold (Free)
 * Allow-list of the Locket / Firebase / RevenueCat hosts.
 *
 * Every host listed here is answered with the Fly.io MITM proxy IP so the
 * MITM proxy (Phương Thức 1 — DNS) can intercept the traffic on the wire.
 *
 * @module whitelist
 */

/** Hosts that always resolve to the Fly.io proxy. */
export const EXACT_HOSTS = Object.freeze([
  'api.revenuecat.com',
  'api.rc-backup.com',
  'rev.cat',
  'api.locketcamera.com',
  'cdn.locketcamera.com',
  'public.locketcamera.com',
  'locket.camera',
  'us-central1-locket-4252a.cloudfunctions.net',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

/** Suffix patterns (`*.example.com`), the apex host is included as well. */
export const SUFFIX_HOSTS = Object.freeze([
  '.firebaseremoteconfig.googleapis.com',
  '.firebaseremoteconfig.google.com',
  '.remoteconfig.googleapis.com',
]);

/** Flat list of every allowed host/pattern. */
export const WHITELIST = Object.freeze([
  ...EXACT_HOSTS,
  ...SUFFIX_HOSTS.map((suffix) => `*${suffix}`),
]);

/**
 * Normalise a host name: lowercase, no trailing dot, no port, no brackets.
 *
 * @param {unknown} host
 * @returns {string}
 */
export function normalizeHost(host) {
  let value = String(host == null ? '' : host).trim().toLowerCase();
  if (!value) return '';
  if (value.startsWith('[') && value.includes(']')) {
    value = value.slice(value.indexOf(']') + 1);
  }
  const colon = value.lastIndexOf(':');
  if (colon > -1 && value.indexOf(':') === colon) value = value.slice(0, colon);
  while (value.endsWith('.')) value = value.slice(0, -1);
  return value;
}

/**
 * Check whether a host belongs to the allow-list.
 *
 * @param {unknown} host
 * @returns {boolean}
 */
export function isWhitelisted(host) {
  return whitelistReason(host) !== null;
}

/**
 * Explain why a host is (or is not) allowed.
 *
 * @param {unknown} host
 * @returns {string|null} "exact" | "suffix" | null
 */
export function whitelistReason(host) {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  if (EXACT_HOSTS.includes(normalized)) return 'exact';
  for (const suffix of SUFFIX_HOSTS) {
    if (normalized === suffix.slice(1)) return 'suffix';
    if (normalized.endsWith(suffix)) return 'suffix';
  }
  return null;
}
