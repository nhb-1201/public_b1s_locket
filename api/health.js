'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * GET /api/health
 *
 * Liveness probe of the API layer. `?verbose=1` adds storage/dns details.
 */

const { getQuery, sendJson, withErrorHandling } = require('./lib/http');
const { getStoreBackend } = require('./lib/nextdns-store');

/** Version of the B1sTeam LocketGold backend. */
const VERSION = '4.0.0';

/** Service identifier. */
const SERVICE = 'b1steam-api';

module.exports = withErrorHandling(async function handler(req, res) {
  const payload = {
    ok: true,
    service: SERVICE,
    version: VERSION,
    time: new Date().toISOString(),
  };

  if (String(getQuery(req, 'verbose') || '') === '1') {
    payload.store = getStoreBackend();
    payload.fly_ip = process.env.FLY_PROXY_IP || '137.66.53.108';
    payload.doh_url = process.env.FLY_DOH_URL || 'https://doh.b1s.id.vn/fly/dns-query';
    payload.license_strict = String(process.env.LICENSE_STRICT || '').toLowerCase() === 'true';
  }

  return sendJson(res, 200, payload);
});

module.exports.VERSION = VERSION;
module.exports.SERVICE = SERVICE;
