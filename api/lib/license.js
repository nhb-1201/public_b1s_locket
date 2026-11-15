'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * License issuing / verification.
 *
 * A signed license looks like:
 *
 *     B1S-XXXX-XXXX-XXXX.<base64url(payload)>.<base64url(HMAC-SHA256(payload, SECRET))>
 *
 * payload = { key, device, plan, exp }
 *
 * The signature is compared in constant time so a wrong signature never leaks
 * how many leading characters were guessed correctly.
 */

const crypto = require('crypto');
const { normalizeKey, isValidKeyFormat, generateKey } = require('./keys');

/** Reason codes returned by {@link verifyLicenseKey}. */
const LICENSE_REASONS = Object.freeze({
  OK: 'ok',
  MISSING: 'missing',
  MALFORMED: 'malformed',
  BAD_FORMAT: 'bad_format',
  BAD_SIGNATURE: 'bad_signature',
  KEY_MISMATCH: 'key_mismatch',
  EXPIRED: 'expired',
  DEVICE_MISMATCH: 'device_mismatch',
  REVOKED: 'revoked',
  NOT_REGISTERED: 'not_registered',
  FORMAT_ONLY: 'format_only',
  SIGNED: 'signed',
  REGISTERED: 'registered',
});

/**
 * @param {string|Buffer} input
 * @returns {string} base64url representation
 */
function toBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

/**
 * Sign a base64url payload.
 *
 * @param {string} payloadB64
 * @param {string} secret
 * @returns {string} base64url signature
 */
function signPayload(payloadB64, secret) {
  return crypto
    .createHmac('sha256', String(secret == null ? '' : secret))
    .update(String(payloadB64))
    .digest('base64url');
}

/**
 * Constant time string comparison.
 * Both sides are hashed first so the comparison always happens on 32 byte
 * buffers (timingSafeEqual throws on length mismatch).
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function constantTimeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const hb = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Split a signed license into its three parts.
 *
 * @param {unknown} value
 * @returns {{ key: string, payloadB64: string, signature: string, signed: boolean }}
 */
function splitLicense(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { key: '', payloadB64: '', signature: '', signed: false };
  const parts = raw.split('.');
  const key = normalizeKey(parts[0] || '');
  const signed = parts.length >= 3;
  return {
    key,
    payloadB64: signed ? parts[1] || '' : '',
    signature: signed ? parts.slice(2).join('.') : '',
    signed,
  };
}

/**
 * Issue a license key + its signed payload.
 *
 * @param {object} [options]
 * @param {string} [options.device] device id the license is bound to
 * @param {string} [options.plan] plan name (free, pro, ...)
 * @param {number} [options.expiresInMs] lifetime in ms (0 = never expires)
 * @param {string} [options.secret] HMAC secret
 * @param {string} [options.key] reuse an existing key instead of generating one
 * @returns {{ key: string, license: string, payload: object, payloadB64: string, signature: string }}
 */
function issueLicenseKey(options = {}) {
  const {
    device = '',
    plan = 'free',
    expiresInMs = 0,
    secret = '',
    key = '',
  } = options || {};

  const finalKey = normalizeKey(key) || generateKey();
  const lifetime = Number(expiresInMs);
  // 0 (or omitted) means no expiry, a negative value means already expired.
  const exp = Number.isFinite(lifetime) && lifetime !== 0 ? Date.now() + Math.floor(lifetime) : 0;
  const payload = {
    key: finalKey,
    device: String(device || ''),
    plan: String(plan || 'free'),
    exp,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadB64, secret);
  return {
    key: finalKey,
    license: `${finalKey}.${payloadB64}.${signature}`,
    payload,
    payloadB64,
    signature,
  };
}

/**
 * Verify a signed license.
 *
 * @param {unknown} license signed license string
 * @param {string} secret HMAC secret
 * @param {object} [options]
 * @param {string} [options.device] when set the license must be bound to it
 * @param {number} [options.now] current timestamp (ms)
 * @returns {{ ok: boolean, reason: string, payload: object|null }}
 */
function verifyLicenseKey(license, secret, options = {}) {
  const { device = '', now = Date.now() } = options || {};

  if (typeof license !== 'string' || !license.trim()) {
    return { ok: false, reason: LICENSE_REASONS.MISSING, payload: null };
  }

  const parts = license.trim().split('.');
  if (parts.length < 3 || !parts[1] || !parts[2]) {
    return { ok: false, reason: LICENSE_REASONS.MALFORMED, payload: null };
  }

  const [keyPart, payloadB64, signature] = parts;
  const key = normalizeKey(keyPart);
  if (!key) {
    return { ok: false, reason: LICENSE_REASONS.BAD_FORMAT, payload: null };
  }

  const expected = signPayload(payloadB64, secret);
  if (!constantTimeEqual(signature, expected)) {
    return { ok: false, reason: LICENSE_REASONS.BAD_SIGNATURE, payload: null };
  }

  let payload = null;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (_err) {
    return { ok: false, reason: LICENSE_REASONS.MALFORMED, payload: null };
  }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: LICENSE_REASONS.MALFORMED, payload: null };
  }
  if (normalizeKey(payload.key || '') !== key) {
    return { ok: false, reason: LICENSE_REASONS.KEY_MISMATCH, payload: null };
  }

  const exp = Number(payload.exp) || 0;
  if (exp > 0 && exp <= now) {
    return { ok: false, reason: LICENSE_REASONS.EXPIRED, payload };
  }

  if (device && String(payload.device || '') !== String(device)) {
    return { ok: false, reason: LICENSE_REASONS.DEVICE_MISMATCH, payload };
  }

  return { ok: true, reason: LICENSE_REASONS.OK, payload };
}

/**
 * Authorize a raw `?key=` value (synchronous).
 *
 * - signed licenses are verified cryptographically;
 * - plain keys are validated against an already resolved store `record`;
 * - when no record is available the key is accepted in "format only" mode
 *   (unless `strict` is enabled).
 *
 * @param {unknown} value
 * @param {object} [options]
 * @param {string} [options.secret]
 * @param {string} [options.device]
 * @param {boolean} [options.strict]
 * @param {object|null} [options.record] license row already loaded from the store
 * @returns {{ ok: boolean, reason: string, payload: object|null, key: string }}
 */
function authorizeLicense(value, options = {}) {
  const { secret = '', device = '', strict = false, record = null } = options || {};
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return { ok: false, reason: LICENSE_REASONS.MISSING, payload: null, key: '' };
  }

  const key = normalizeKey(raw);
  if (!key) {
    return { ok: false, reason: LICENSE_REASONS.BAD_FORMAT, payload: null, key: '' };
  }

  if (raw.split('.').length >= 3) {
    const result = verifyLicenseKey(raw, secret, { device });
    if (!result.ok) return { ...result, key };
    return { ok: true, reason: LICENSE_REASONS.SIGNED, payload: result.payload, key };
  }

  if (record) {
    if (record.revoked_at) {
      return { ok: false, reason: LICENSE_REASONS.REVOKED, payload: null, key };
    }
    const exp = record.expires_at ? Date.parse(record.expires_at) : 0;
    if (exp && exp <= Date.now()) {
      return { ok: false, reason: LICENSE_REASONS.EXPIRED, payload: null, key };
    }
    return {
      ok: true,
      reason: LICENSE_REASONS.REGISTERED,
      payload: {
        key,
        plan: record.plan || 'free',
        device: record.device_id || '',
        exp,
      },
      key,
    };
  }

  if (strict) {
    return { ok: false, reason: LICENSE_REASONS.NOT_REGISTERED, payload: null, key };
  }

  return {
    ok: true,
    reason: LICENSE_REASONS.FORMAT_ONLY,
    payload: { key, plan: 'free', device: '', exp: 0 },
    key,
  };
}

/**
 * Async variant of {@link authorizeLicense}: resolves the license row through
 * the store before applying the rules.
 *
 * @param {unknown} value
 * @param {object} [options]
 * @param {string} [options.secret]
 * @param {string} [options.device]
 * @param {boolean} [options.strict]
 * @param {(key: string) => Promise<object|null>} [options.lookup]
 * @returns {Promise<{ ok: boolean, reason: string, payload: object|null, key: string }>}
 */
async function authorizeLicenseAsync(value, options = {}) {
  const { lookup = null } = options || {};
  let record = null;
  if (typeof lookup === 'function') {
    const key = normalizeKey(value);
    if (key) {
      try {
        record = await lookup(key);
      } catch (_err) {
        record = null;
      }
    }
  }
  return authorizeLicense(value, { ...options, record });
}

/**
 * Hash a device id so raw device ids never hit the database.
 *
 * @param {unknown} deviceId
 * @returns {string} sha256 hex digest
 */
function hashDevice(deviceId) {
  const value = String(deviceId == null ? '' : deviceId).trim();
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Hash a license key (sha256 hex) so the raw key never hits the database.
 *
 * @param {unknown} key
 * @returns {string} sha256 hex digest
 */
function hashLicenseKey(key) {
  const value = String(key == null ? '' : key).trim();
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Quick format check re-exported for convenience.
 * @param {unknown} key
 */
function isValidKey(key) {
  return isValidKeyFormat(key);
}

module.exports = {
  LICENSE_REASONS,
  toBase64Url,
  signPayload,
  constantTimeEqual,
  splitLicense,
  issueLicenseKey,
  verifyLicenseKey,
  authorizeLicense,
  authorizeLicenseAsync,
  hashDevice,
  hashLicenseKey,
  isValidKey,
};
