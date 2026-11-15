'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Admin endpoint - NextDNS profile rotation (80% NextDNS / 20% direct).
 *
 * GET  /api/rotate                    -> current ratio
 * POST /api/rotate { ratio }          -> set the ratio (0..1)
 * POST /api/rotate { profile_id }     -> rotate a profile: refresh every
 *                                         allow-list rewrite
 */

const { readJsonBody, getQuery, sendJson, sendError, withErrorHandling } = require('../../api/lib/http');
const {
  REWRITE_DOMAINS,
  loginNextDnsSession,
  listRewrites,
  createRewrite,
  deleteRewrite,
} = require('../../nextdns/index');
const { getNextDnsAccount, updateNextDnsAccount } = require('../../api/lib/nextdns-store');
const { requireAuth } = require('../lib/auth');

/** Current rotation ratio (persisted in memory per serverless instance). */
let rotationRatio = 0.8;

/** Timestamp of the last rotation. */
let lastRotatedAt = null;

/**
 * @returns {number} the active ratio
 */
function getRatio() {
  return rotationRatio;
}

/**
 * Set the rotation ratio.
 *
 * @param {number} value
 * @returns {number}
 */
function setRatio(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    rotationRatio = Math.min(1, Math.max(0, numeric));
  }
  return rotationRatio;
}

module.exports = withErrorHandling(async function handler(req, res) {
  if (!requireAuth(req, res, sendError)) return undefined;

  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      ratio: rotationRatio,
      percent: Math.round(rotationRatio * 100),
      last_rotated_at: lastRotatedAt,
      domains: REWRITE_DOMAINS.length,
    });
  }

  const body = await readJsonBody(req);
  const profileId = String(body.profile_id || getQuery(req, 'profile_id') || '').trim();

  if (body.ratio !== undefined) setRatio(body.ratio);

  if (!profileId) {
    return sendJson(res, 200, {
      ok: true,
      ratio: rotationRatio,
      percent: Math.round(rotationRatio * 100),
      message: 'Đã cập nhật tỉ lệ xoay vòng',
    });
  }

  const account = await getNextDnsAccount(profileId);
  if (!account) return sendError(res, 404, 'Không tìm thấy profile');

  const session = await loginNextDnsSession(account.email, account.password);
  if (!session.ok) {
    return sendError(res, 502, session.error || 'Không đăng nhập được NextDNS');
  }

  const flyIp = account.fly_ip || process.env.FLY_PROXY_IP || '';
  if (!flyIp) {
    return sendError(res, 500, 'Thiếu biến FLY_PROXY_IP — đặt giá trị thật qua biến môi trường (không commit vào repo)');
  }
  const existing = await listRewrites(profileId, session.sid);
  const current = new Map(
    (existing.rewrites || []).map((rewrite) => [String(rewrite.name || '').toLowerCase(), rewrite]),
  );

  const applied = [];
  for (const domain of REWRITE_DOMAINS) {
    const known = current.get(domain.toLowerCase());
    if (known && String(known.answer || '') === flyIp) {
      applied.push({ domain, ok: true, status: 200, action: 'kept' });
      continue;
    }
    if (known) {
      const removed = await deleteRewrite(profileId, session.sid, domain);
      applied.push({
        domain,
        ok: true,
        status: removed.status,
        action: removed.ok ? 'replaced' : 'kept',
      });
    }
    const created = await createRewrite(profileId, session.sid, domain, flyIp);
    applied.push({ domain, ok: created.ok, status: created.status, action: 'added', error: created.error });
  }

  lastRotatedAt = new Date().toISOString();
  try {
    await updateNextDnsAccount(profileId, {
      rewrites: applied.map((item) => ({ domain: item.domain, ok: item.ok, answer: flyIp })),
      is_active: true,
    });
  } catch (_err) {
    // The rotation itself succeeded, the counter update is best effort.
  }

  return sendJson(res, 200, {
    ok: true,
    profile_id: profileId,
    ratio: rotationRatio,
    percent: Math.round(rotationRatio * 100),
    last_rotated_at: lastRotatedAt,
    rewrites: applied,
  });
});

module.exports.getRatio = getRatio;
module.exports.setRatio = setRatio;
