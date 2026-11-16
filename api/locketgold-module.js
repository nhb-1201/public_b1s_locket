'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * GET /api/locketgold-module?key=B1S-XXXX-XXXX-XXXX
 *
 * Streams the Shadowrocket module with the `__LICENSE_KEY__` placeholder
 * replaced by the key of the caller.
 */

const fs = require('fs');
const path = require('path');
const { getQuery, sendText, sendError, withErrorHandling } = require('./lib/http');
const { authorizeLicenseAsync, hashLicenseKey } = require('./lib/license');
const { findLicenseKey } = require('./lib/nextdns-store');

/** Repository root. */
const REPO_ROOT = path.resolve(__dirname, '..');

/** Where the module template can live (first existing file wins). */
const MODULE_CANDIDATES = [
  path.join(REPO_ROOT, 'shadowrocket', 'modules', 'B1sTeam_LocketGold.sgmodule'),
  path.join(REPO_ROOT, 'shadowrocket', 'modules', 'B1sTeam_LocketGold.module'),
  path.join(REPO_ROOT, 'ios', 'locketgold.sgmodule'),
];

/** Minimal built-in template used when no file is available (mirrors ios/locketgold.sgmodule v7.8.2). */
const BUILTIN_MODULE = `# B1sTeam — LocketGold (Free) — Shadowrocket Module
# author: B1sTeam | b1s.id.vn
#!name = B1sTeam — LocketGold (Free)
#!version = 7.8.2
#!updated = 2026-11-16
#!desc = Gold VIP vĩnh viễn 0₫ qua Shadowrocket MITM. Key của bạn được nhúng sẵn.
#!author = B1sTeam · Nguyễn Hoàng Bách
#!homepage = https://b1s.id.vn/locketvip

[Rule]
DOMAIN-SUFFIX,firebaselogging.googleapis.com,REJECT
DOMAIN-SUFFIX,firebaselogging-pa.googleapis.com,REJECT
DOMAIN-SUFFIX,revenuecat.com,DIRECT
DOMAIN-SUFFIX,rc-backup.com,DIRECT
DOMAIN-SUFFIX,rev.cat,DIRECT
DOMAIN-SUFFIX,locketcamera.com,DIRECT
DOMAIN-SUFFIX,locket.camera,DIRECT
DOMAIN-SUFFIX,firebaseremoteconfig.googleapis.com,DIRECT
DOMAIN-SUFFIX,firebaseremoteconfig.google.com,DIRECT
DOMAIN-SUFFIX,firebasestorage.googleapis.com,DIRECT
DOMAIN-SUFFIX,storage.googleapis.com,DIRECT
DOMAIN-SUFFIX,identitytoolkit.googleapis.com,DIRECT
DOMAIN-SUFFIX,securetoken.googleapis.com,DIRECT
DOMAIN-SUFFIX,firestore.googleapis.com,DIRECT
DOMAIN-SUFFIX,firebase.googleapis.com,DIRECT
FINAL,DIRECT

[Script]
b1s_revenuecat_all = type=http-response,pattern=^https?:\/\/api\.(revenuecat|rc-backup)\.com\/.*,script-path=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/b1s_unlock.v7.8.2.js,requires-body=true,max-size=-1,timeout=30,argument=__LICENSE_KEY__|revenuecat-all
locketgold_remote = type=http-request,pattern=^https:\/\/firebaseremoteconfig\.(googleapis\.com|google\.com)\/.+,script-path=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/locketgold_remote.v7.8.2.js,requires-body=true,timeout=30,argument=__LICENSE_KEY__
locketgold_remote_response = type=http-response,pattern=^https:\/\/firebaseremoteconfig\.(googleapis\.com|google\.com)\/.+,script-path=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/locketgold_remote.v7.8.2.js,requires-body=true,max-size=-1,timeout=30,argument=__LICENSE_KEY__
locketgold_locket_request = type=http-request,pattern=^https:\/\/((?:[a-z0-9-]+\.)*(?:locketcamera\.com|locket\.camera)|us-central1-locket-4252a\.cloudfunctions\.net)\/.*,script-path=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/locketgold_locket.v7.8.2.js,requires-body=true,timeout=25,argument=__LICENSE_KEY__
locketgold_locket_response = type=http-response,pattern=^https:\/\/((?:[a-z0-9-]+\.)*(?:locketcamera\.com|locket\.camera)|us-central1-locket-4252a\.cloudfunctions\.net)\/.*,script-path=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/locketgold_locket.v7.8.2.js,requires-body=true,max-size=-1,timeout=25,argument=__LICENSE_KEY__
locketgold_upload_frame = type=http-request,pattern=^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\/.*,script-path=https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/ios/scripts/locketgold_upload.v7.8.2.js,requires-body=true,max-size=-1,timeout=30,argument=__LICENSE_KEY__

[MITM]
hostname = %APPEND% firebasestorage.googleapis.com, storage.googleapis.com, api.revenuecat.com, api.rc-backup.com, rev.cat, firebaseremoteconfig.googleapis.com, firebaseremoteconfig.google.com, api.locketcamera.com, *.locketcamera.com, locketcamera.com, api.locket.camera, locket.camera, us-central1-locket-4252a.cloudfunctions.net, cdn.locketcamera.com, public.locketcamera.com, identitytoolkit.googleapis.com, securetoken.googleapis.com, firestore.googleapis.com, firebase.googleapis.com
`;

/**
 * Read the module template from disk.
 *
 * @returns {string}
 */
function readModuleTemplate() {
  for (const candidate of MODULE_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf8');
        if (content.trim()) return content;
      }
    } catch (_err) {
      // try the next candidate
    }
  }
  return BUILTIN_MODULE;
}

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

  const template = readModuleTemplate();
  const body = template.replace(/__LICENSE_KEY__/g, auth.key);

  return sendText(res, 200, body, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Disposition': 'attachment; filename="B1sTeam-LocketGold.sgmodule"',
    'X-B1s-License-Prefix': auth.key.slice(0, 8),
  });
});

module.exports.BUILTIN_MODULE = BUILTIN_MODULE;
module.exports.readModuleTemplate = readModuleTemplate;
module.exports.authorizeRequest = authorizeRequest;
