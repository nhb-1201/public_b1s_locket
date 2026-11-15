'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * License key format helpers.
 *
 * Canonical shape : B1S-XXXX-XXXX-XXXX
 * Alphabet        : Crockford base32 (digits + letters, minus I, L, O, U)
 * Body            : 12 random characters -> 3 groups of 4 -> 60 bits of entropy
 *
 * Everything here is dependency free and safe to use from Node >= 18.
 */

const crypto = require('crypto');

/** Crockford base32 alphabet (no I, L, O, U). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Number of random characters inside the key body. */
const BODY_LENGTH = 12;

/** Number of dash separated groups after the "B1S" prefix. */
const GROUP_COUNT = 3;

/** Characters per group. */
const GROUP_SIZE = 4;

/** Canonical key regex. */
const KEY_REGEX =
  /^B1S-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/;

/** Body only regex (12 Crockford characters). */
const BODY_REGEX = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/;

/** Literal prefix of every B1sTeam license key. */
const KEY_PREFIX = 'B1S';

/**
 * Normalise any user supplied key into the canonical "B1S-XXXX-XXXX-XXXX" form.
 *
 * Accepts: lowercase, spaces, underscores, missing dashes and a full signed
 * license ("KEY.payload.signature" -> only the KEY part is kept).
 *
 * @param {unknown} input
 * @returns {string} canonical key or an empty string when the input is invalid
 */
function normalizeKey(input) {
  if (typeof input !== 'string') return '';
  let raw = input.trim().toUpperCase();
  if (!raw) return '';

  // A signed license carries the canonical key as its first dot separated part.
  raw = raw.split('.')[0];

  // Drop every separator (space, dash, underscore, ...).
  raw = raw.replace(/[^0-9A-Z]/g, '');

  if (!raw.startsWith(KEY_PREFIX)) return '';
  const body = raw.slice(KEY_PREFIX.length);
  if (body.length !== BODY_LENGTH || !BODY_REGEX.test(body)) return '';

  const groups = [];
  for (let i = 0; i < GROUP_COUNT; i += 1) {
    groups.push(body.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE));
  }
  return `${KEY_PREFIX}-${groups.join('-')}`;
}

/**
 * @param {unknown} input
 * @returns {boolean} true when the input normalises to a well formed key
 */
function isValidKeyFormat(input) {
  const normalized = normalizeKey(input);
  if (!normalized) return false;
  return KEY_REGEX.test(normalized);
}

/**
 * Random Crockford body (12 characters).
 * Uses crypto.randomInt so the output is cryptographically uniform.
 *
 * @returns {string}
 */
function randomKeyBody() {
  let out = '';
  for (let i = 0; i < BODY_LENGTH; i += 1) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a brand new license key.
 *
 * @returns {string} e.g. "B1S-4K7Q-HM3X-9TB2"
 */
function generateKey() {
  const body = randomKeyBody();
  const groups = [];
  for (let i = 0; i < GROUP_COUNT; i += 1) {
    groups.push(body.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE));
  }
  return `${KEY_PREFIX}-${groups.join('-')}`;
}

/**
 * Short, non secret prefix used for support lookups.
 *
 * @param {unknown} key
 * @returns {string}
 */
function keyPrefix(key) {
  const normalized = normalizeKey(key);
  return normalized ? normalized.slice(0, 8) : '';
}

/**
 * Human friendly masked key, safe to log.
 *
 * @param {unknown} key
 * @returns {string}
 */
function maskKey(key) {
  const normalized = normalizeKey(key);
  if (!normalized) return '';
  return `${normalized.slice(0, 4)}****-****-${normalized.slice(-4)}`;
}

module.exports = {
  ALPHABET,
  BODY_LENGTH,
  GROUP_COUNT,
  GROUP_SIZE,
  KEY_PREFIX,
  KEY_REGEX,
  BODY_REGEX,
  normalizeKey,
  isValidKeyFormat,
  randomKeyBody,
  generateKey,
  keyPrefix,
  maskKey,
};
