'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * GET /api/generate-profile?key=B1S-XXXX-XXXX-XXXX
 *
 * Builds a per user .mobileconfig profile (Root CA + managed DoH) and sends it
 * back as `application/x-apple-aspen-config`.
 */

const crypto = require('crypto');
const { getQuery, sendText, sendError, withErrorHandling } = require('./lib/http');
const { authorizeLicenseAsync, hashLicenseKey } = require('./lib/license');
const { findLicenseKey } = require('./lib/nextdns-store');
const { buildMobileconfig, loadCaDerBase64, DEFAULT_DNS_URL } = require('./lib/mobileconfig');

/**
 * Look the key up inside the license store.
 *
 * @param {string} key
 * @returns {Promise<object|null>}
 */
async function lookupLicense(key) {
  try {
    return await findLicenseKey(hashLicenseKey(key));
  } catch (_err) {
    return null;
  }
}

/**
 * Authorize the `?key=` parameter.
 *
 * @param {object} req
 * @returns {Promise<{ ok: boolean, reason: string, key: string }>}
 */
async function authorizeRequest(req) {
  const raw = getQuery(req, 'key') || getQuery(req, 'license') || '';
  const secret = process.env.LICENSE_SECRET || process.env.B1S_LICENSE_SECRET || '';
  const strict = String(process.env.LICENSE_STRICT || '').toLowerCase() === 'true';
  const device = getQuery(req, 'device') || '';

  return authorizeLicenseAsync(raw, {
    secret,
    device,
    strict,
    lookup: lookupLicense,
  });
}

module.exports = withErrorHandling(async function handler(req, res) {
  const auth = await authorizeRequest(req);
  if (!auth.ok) {
    return sendError(res, 401, 'License key không hợp lệ hoặc đã hết hạn', {
      reason: auth.reason,
    });
  }

  const caDer = loadCaDerBase64();
  if (!caDer) {
    return sendError(res, 503, 'Chưa có Root CA trên máy chủ. Hãy đặt ca/root-ca.crt hoặc khai báo ROOT_CA_CRT_B64.');
  }

  const dnsUrl = String(process.env.DOH_URL || DEFAULT_DNS_URL);
  const uuid = crypto.randomUUID().toUpperCase();

  const xml = buildMobileconfig({
    caDer,
    uuid,
    dnsUrl,
    displayName: 'B1sTeam — LocketGold (Free)',
    organization: 'B1sTeam',
  });

  return sendText(res, 200, xml, {
    'Content-Type': 'application/x-apple-aspen-config',
    'Cache-Control': 'no-store',
    'Content-Disposition': 'attachment; filename="B1sTeam-LocketGold.mobileconfig"',
    'X-B1s-License-Prefix': auth.key.slice(0, 8),
  });
});

module.exports.authorizeRequest = authorizeRequest;
