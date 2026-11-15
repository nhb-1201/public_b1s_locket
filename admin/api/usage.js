'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Admin endpoint - query usage of a NextDNS profile.
 *
 * GET /api/usage?profile_id=xxx
 */

const { getQuery, sendJson, sendError, withErrorHandling } = require('../../api/lib/http');
const { checkNextDnsQueryUsage } = require('../../nextdns/index');
const { getNextDnsAccount, updateQueryUsage } = require('../../api/lib/nextdns-store');
const { requireAuth } = require('../lib/auth');

module.exports = withErrorHandling(async function handler(req, res) {
  if (!requireAuth(req, res, sendError)) return undefined;

  const profileId = String(getQuery(req, 'profile_id') || getQuery(req, 'profileId') || '').trim();
  if (!profileId) return sendError(res, 400, 'Thiếu tham số profile_id');

  let email = String(getQuery(req, 'email') || '').trim();
  let password = String(getQuery(req, 'password') || '');

  if (!email || !password) {
    const account = await getNextDnsAccount(profileId);
    if (account) {
      email = email || account.email;
      password = password || account.password;
    }
  }

  if (!email || !password) {
    return sendError(res, 404, 'Không tìm thấy thông tin đăng nhập của profile này');
  }

  const usage = await checkNextDnsQueryUsage({ email, password, profileId });
  if (!usage || !usage.ok) {
    return sendError(res, 502, (usage && usage.error) || 'NextDNS từ chối trả usage');
  }

  try {
    await updateQueryUsage(profileId, usage.queries);
  } catch (_err) {
    // best effort
  }

  return sendJson(res, 200, {
    ok: true,
    profile_id: usage.profileId || profileId,
    queries: usage.queries,
    limit: usage.limit,
    percent: usage.percent,
    devices: usage.devices,
    is_active: usage.is_active,
    last_query_at: usage.last_query_at,
    last_query_ago_minutes: usage.last_query_ago_minutes,
  });
});
