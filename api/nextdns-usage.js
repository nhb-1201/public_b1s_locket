'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * GET /api/nextdns-usage?profile_id=<id>[&email=..&password=..]
 *
 * Returns the query usage of a NextDNS profile. When the credentials are not
 * supplied they are looked up inside the storage adapter.
 */

const { getQuery, sendJson, sendError, withErrorHandling } = require('./lib/http');
const { checkNextDnsQueryUsage } = require('../nextdns/index');
const { getNextDnsAccount, updateQueryUsage } = require('./lib/nextdns-store');

module.exports = withErrorHandling(async function handler(req, res) {
  const profileId = String(getQuery(req, 'profile_id') || getQuery(req, 'profileId') || '').trim();
  if (!profileId) {
    return sendError(res, 400, 'Thiếu tham số profile_id');
  }

  let email = String(getQuery(req, 'email') || '').trim();
  let password = String(getQuery(req, 'password') || '');

  if (!email || !password) {
    try {
      const account = await getNextDnsAccount(profileId);
      if (account) {
        email = email || account.email;
        password = password || account.password;
      }
    } catch (_err) {
      // ignore: the usage call below will report the real problem
    }
  }

  if (!email || !password) {
    return sendError(res, 404, 'Không tìm thấy thông tin đăng nhập của profile này');
  }

  let usage;
  try {
    usage = await checkNextDnsQueryUsage({ email, password, profileId });
  } catch (err) {
    return sendError(res, 502, `Không lấy được usage từ NextDNS: ${(err && err.message) || err}`);
  }

  if (!usage || !usage.ok) {
    return sendError(res, 502, (usage && usage.error) || 'NextDNS từ chối trả usage', {
      profile_id: profileId,
    });
  }

  try {
    await updateQueryUsage(profileId, usage.queries);
  } catch (_err) {
    // Updating the counter is best effort only.
  }

  return sendJson(res, 200, {
    success: true,
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
