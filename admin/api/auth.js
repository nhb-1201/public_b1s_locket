'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Admin endpoint - sign in / session check.
 *
 * POST /api/auth            { password, remember } -> { ok, token, expiresAt }
 * GET  /api/auth            -> validate the current token
 * DELETE /api/auth          -> sign out (clear the cookie)
 */

const {
  readJsonBody,
  sendJson,
  sendError,
  withErrorHandling,
} = require('../../api/lib/http');
const {
  generateAdminToken,
  verifyAdminToken,
  checkPassword,
  extractToken,
  TOKEN_COOKIE,
} = require('../lib/auth');

module.exports = withErrorHandling(async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'POST') {
    const body = await readJsonBody(req);
    const password = String(body.password || '');
    const remember = Boolean(body.remember);

    if (!checkPassword(password)) {
      return sendError(res, 401, 'Mật khẩu không đúng');
    }

    const token = generateAdminToken(remember);
    const payload = verifyAdminToken(token).payload || {};
    const maxAge = remember ? 30 * 24 * 3600 : 24 * 3600;

    if (typeof res.setHeader === 'function') {
      res.setHeader(
        'Set-Cookie',
        `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`,
      );
    }

    return sendJson(res, 200, {
      ok: true,
      token,
      remember,
      expiresAt: payload.exp || null,
    });
  }

  if (method === 'DELETE') {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Set-Cookie', `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }
    return sendJson(res, 200, { ok: true });
  }

  const token = extractToken(req);
  const result = verifyAdminToken(token);
  return sendJson(res, result.ok ? 200 : 401, {
    ok: result.ok,
    valid: result.ok,
    reason: result.reason,
    expiresAt: result.payload ? result.payload.exp : null,
  });
});
