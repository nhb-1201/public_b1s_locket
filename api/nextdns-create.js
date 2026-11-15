'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * POST /api/nextdns-create
 *
 * Creates a NextDNS account, applies the allow-list rewrites that point at the
 * Fly.io MITM proxy and returns the DNS URL of the user.
 *
 * Body (all optional):
 *   { "name": "Profile name", "device": "device-id", "ratio": 0.8 }
 */

const { readJsonBody, sendJson, sendError, withErrorHandling } = require('./lib/http');
const { createNextDnsAccount, DEFAULT_FLY_IP } = require('../nextdns/index');
const { pickProfile } = require('../nextdns/rotate');
const { saveNextDnsAccount } = require('./lib/nextdns-store');

/** Public DoH entry point of the B1sTeam resolver. */
const FLY_DOH_URL = process.env.FLY_DOH_URL || 'https://doh.b1s.id.vn/fly/dns-query';

module.exports = withErrorHandling(async function handler(req, res) {
  const body = await readJsonBody(req);
  const profileName = String(body.name || body.profile_name || 'B1sTeam LocketGold').trim();
  const ratio = Number.isFinite(Number(body.ratio)) ? Number(body.ratio) : 0.8;

  let account;
  try {
    account = await createNextDnsAccount({
      profileName,
      flyIp: String(body.fly_ip || process.env.FLY_PROXY_IP || DEFAULT_FLY_IP),
    });
  } catch (err) {
    return sendError(res, 502, `Không tạo được tài khoản NextDNS: ${(err && err.message) || err}`);
  }

  try {
    await saveNextDnsAccount({
      profile_id: account.profile_id,
      profile_name: profileName,
      email: account.email,
      password: account.password,
      dns_url: account.dns_url,
      fly_ip: account.fly_ip,
      rewrites: account.rewrites,
      is_active: true,
    });
  } catch (err) {
    // The account exists but the store failed: report it, the account is usable.
    return sendJson(res, 200, {
      success: true,
      warning: `Không lưu được vào cơ sở dữ liệu: ${(err && err.message) || err}`,
      profile_id: account.profile_id,
      email: account.email,
      password: account.password,
      dns_url: account.dns_url,
      fly_ip: account.fly_ip,
      rewrites: account.rewrites,
      rotation: { route: 'nextdns', ratio, fallback_url: FLY_DOH_URL },
    });
  }

  // 80% of the traffic goes to the per user NextDNS profile, the remaining
  // 20% uses the shared Fly.io resolver.
  const choice = pickProfile(
    [{ id: account.profile_id, dns_url: account.dns_url, kind: 'nextdns' }],
    {
      profileId: String(body.device || account.profile_id),
      ratio,
      fallback: { id: 'fly', dns_url: FLY_DOH_URL, kind: 'direct' },
    },
  );

  return sendJson(res, 200, {
    success: true,
    profile_id: account.profile_id,
    profile_name: profileName,
    email: account.email,
    password: account.password,
    dns_url: account.dns_url,
    fly_ip: account.fly_ip,
    rewrites: account.rewrites,
    rotation: {
      route: choice.route,
      score: choice.score,
      ratio,
      fallback_url: FLY_DOH_URL,
    },
    doh_url: choice.profile ? choice.profile.dns_url : FLY_DOH_URL,
  });
});
