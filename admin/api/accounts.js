'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Admin endpoint - NextDNS account list.
 *
 * GET    /api/accounts                 -> list every account
 * DELETE /api/accounts?profile_id=xxx  -> delete a single account
 */

const { getQuery, sendJson, sendError, withErrorHandling } = require('../../api/lib/http');
const { listNextDnsAccounts, deleteNextDnsAccount } = require('../../api/lib/nextdns-store');
const { requireAuth } = require('../lib/auth');

module.exports = withErrorHandling(async function handler(req, res) {
  if (!requireAuth(req, res, sendError)) return undefined;

  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'DELETE') {
    const profileId = String(getQuery(req, 'profile_id') || '').trim();
    if (!profileId) return sendError(res, 400, 'Thiếu tham số profile_id');
    try {
      const removed = await deleteNextDnsAccount(profileId);
      return sendJson(res, removed ? 200 : 404, {
        ok: removed,
        profile_id: profileId,
        error: removed ? undefined : 'Không tìm thấy tài khoản',
      });
    } catch (err) {
      return sendError(res, 500, `Không xoá được tài khoản: ${(err && err.message) || err}`);
    }
  }

  try {
    const accounts = await listNextDnsAccounts();
    const safe = accounts.map((account) => ({
      profile_id: account.profile_id,
      profile_name: account.profile_name || '',
      email: account.email,
      dns_url: account.dns_url,
      fly_ip: account.fly_ip,
      rewrites: Array.isArray(account.rewrites) ? account.rewrites.length : 0,
      query_count: Number(account.query_count) || 0,
      is_active: Boolean(account.is_active),
      created_at: account.created_at,
      updated_at: account.updated_at,
    }));
    return sendJson(res, 200, { ok: true, count: safe.length, accounts: safe });
  } catch (err) {
    return sendError(res, 500, `Không lấy được danh sách tài khoản: ${(err && err.message) || err}`);
  }
});
