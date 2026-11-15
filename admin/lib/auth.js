'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Admin authentication.
 *
 * The session token is a stateless HMAC-SHA256 signed payload:
 *
 *     base64url(JSON{ exp, remember, nonce }) . base64url(HMAC-SHA256(payload, SECRET))
 *
 * The signature is always compared with `crypto.timingSafeEqual` so an attacker
 * cannot brute force the signature byte by byte.
 */

const crypto = require('crypto');

/** Password of the dashboard (fail closed when it is not configured). */
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');

/** Secret used to sign the session tokens. */
const ADMIN_SECRET =
  String(process.env.ADMIN_SECRET || '') || ADMIN_PASSWORD || 'b1steam-locketgold-dev-secret';

/** Session lifetime without "remember me" (1 day). */
const TOKEN_TTL_SHORT_MS = 24 * 60 * 60 * 1000;

/** Session lifetime with "remember me" (30 days). */
const TOKEN_TTL_LONG_MS = 30 * 24 * 60 * 60 * 1000;

/** Name of the cookie that carries the token. */
const TOKEN_COOKIE = 'b1s_admin_token';

/**
 * Constant time comparison of two strings.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function constantTimeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const right = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(left, right);
}

/**
 * Create a signed session token.
 *
 * @param {boolean} [remember] 30 days instead of 1 day
 * @returns {string} `payload.signature`
 */
function generateAdminToken(remember = false) {
  const ttl = remember ? TOKEN_TTL_LONG_MS : TOKEN_TTL_SHORT_MS;
  const payload = {
    exp: Date.now() + ttl,
    remember: Boolean(remember),
    nonce: crypto.randomBytes(9).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a session token.
 *
 * @param {unknown} token
 * @returns {{ ok: boolean, reason: string, payload: object|null }}
 */
function verifyAdminToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'missing', payload: null };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: 'malformed', payload: null };
  }
  const [payloadB64, signature] = parts;
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payloadB64).digest('base64url');
  if (!constantTimeEqual(signature, expected)) {
    return { ok: false, reason: 'bad_signature', payload: null };
  }
  let payload = null;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (_err) {
    return { ok: false, reason: 'malformed', payload: null };
  }
  if (!payload || !payload.exp || Number(payload.exp) <= Date.now()) {
    return { ok: false, reason: 'expired', payload: null };
  }
  return { ok: true, reason: 'ok', payload };
}

/**
 * Boolean flavour of {@link verifyAdminToken}.
 *
 * @param {unknown} token
 * @returns {boolean}
 */
function isValidAdminToken(token) {
  return verifyAdminToken(token).ok;
}

/**
 * Check the dashboard password (constant time).
 *
 * @param {unknown} pass
 * @returns {boolean}
 */
function checkPassword(pass) {
  if (!ADMIN_PASSWORD) return false;
  return constantTimeEqual(String(pass == null ? '' : pass), ADMIN_PASSWORD);
}

/**
 * Extract the token from a request (header, custom header or cookie).
 *
 * @param {object} req
 * @returns {string}
 */
function extractToken(req) {
  if (!req) return '';
  const headers = req.headers || {};

  const auth = headers.authorization || headers.Authorization;
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();

  const custom = headers['x-admin-token'] || headers['X-Admin-Token'];
  if (custom) return String(custom).trim();

  const cookie = headers.cookie || headers.Cookie;
  if (cookie) {
    const match = new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]+)`).exec(String(cookie));
    if (match) return decodeURIComponent(match[1]);
  }

  return '';
}

/**
 * Guard used by every admin endpoint.
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} sendError
 * @returns {string} the token when the caller is authenticated, an empty string otherwise
 */
function requireAuth(req, res, sendError) {
  const token = extractToken(req);
  const result = verifyAdminToken(token);
  if (!result.ok) {
    if (typeof sendError === 'function') {
      sendError(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return '';
  }
  return token;
}

module.exports = {
  ADMIN_PASSWORD,
  ADMIN_SECRET,
  TOKEN_TTL_SHORT_MS,
  TOKEN_TTL_LONG_MS,
  TOKEN_COOKIE,
  constantTimeEqual,
  generateAdminToken,
  verifyAdminToken,
  isValidAdminToken,
  checkPassword,
  extractToken,
  requireAuth,
};
