'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Apple configuration profile (.mobileconfig) builder.
 *
 * The generated profile contains two payloads:
 *   1. a Root CA payload (com.apple.security.root) so the on-device MITM proxy
 *      certificate is trusted by iOS;
 *   2. a managed DNS payload (com.apple.dnsSettings.managed) pointing the
 *      device at the B1sTeam DoH resolver.
 *
 * The output is plain XML and parses with python's `plistlib`.
 */

const fs = require('fs');
const path = require('path');

/** Public DoH resolver shipped with the profile. */
const DEFAULT_DNS_URL = 'https://doh.b1s.id.vn/fly/dns-query';

/** Maximum length of a base64 line inside <data> (RFC 4648 recommends 76). */
const BASE64_LINE_WIDTH = 76;

/** Domains that must always be routed through the managed resolver. */
const DEFAULT_DOMAINS = Object.freeze([
  'api.revenuecat.com',
  'api.rc-backup.com',
  'rev.cat',
  'revenuecat.com',
  'firebaseremoteconfig.googleapis.com',
  'firebaseremoteconfig.google.com',
  'firebaseremoteconfigrealtime.googleapis.com',
  'remoteconfig.googleapis.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'api.locketcamera.com',
  'cdn.locketcamera.com',
  'public.locketcamera.com',
  'locketcamera.com',
  'locket.camera',
  'us-central1-locket-4252a.cloudfunctions.net',
]);

/** Repository root (…/public_b1s_locket). */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Candidate locations of the real B1sTeam root CA. */
const CA_CANDIDATES = [
  { file: path.join(REPO_ROOT, 'ca', 'root-ca.crt'), format: 'pem' },
  { file: path.join(REPO_ROOT, 'ca', 'root-ca.pem'), format: 'pem' },
  { file: path.join(REPO_ROOT, 'ca', 'root-ca.der'), format: 'der' },
  { file: path.join(REPO_ROOT, 'ca', 'root-ca.crt.der'), format: 'der' },
];

/** Bundled fallback so the endpoint always works out of the box. */
const PLACEHOLDER_CA = path.join(__dirname, 'placeholder-root-ca.pem');

/**
 * Escape the five XML entities.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap a base64 blob into lines of at most `width` characters.
 *
 * @param {string} base64
 * @param {number} [width]
 * @returns {string}
 */
function wrapBase64(base64, width = BASE64_LINE_WIDTH) {
  const clean = String(base64 || '').replace(/\s+/g, '');
  if (!clean) return '';
  const lines = [];
  for (let i = 0; i < clean.length; i += width) {
    lines.push(clean.slice(i, i + width));
  }
  return lines.join('\n');
}

/**
 * Strip the PEM armour and return the raw base64 body.
 *
 * @param {string} pem
 * @returns {string}
 */
function pemToBase64(pem) {
  return String(pem || '')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Load the base64 DER body of the root CA.
 *
 * Lookup order:
 *   1. ROOT_CA_CRT_B64 (env)
 *   2. ca/root-ca.crt | ca/root-ca.pem | ca/root-ca.der (repo)
 *   3. the bundled placeholder certificate
 *
 * @returns {string} base64 encoded DER
 */
function loadCaDerBase64() {
  const fromEnv = String(process.env.ROOT_CA_CRT_B64 || '').trim();
  if (fromEnv) return pemToBase64(fromEnv);

  const envPath = String(process.env.ROOT_CA_PATH || '').trim();
  const candidates = envPath
    ? [{ file: path.resolve(envPath), format: path.extname(envPath) === '.der' ? 'der' : 'pem' }]
    : CA_CANDIDATES;

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate.file)) continue;
      if (candidate.format === 'der') {
        return fs.readFileSync(candidate.file).toString('base64');
      }
      const pem = fs.readFileSync(candidate.file, 'utf8');
      const b64 = pemToBase64(pem);
      if (b64) return b64;
    } catch (_err) {
      // try the next candidate
    }
  }

  try {
    if (fs.existsSync(PLACEHOLDER_CA)) {
      return pemToBase64(fs.readFileSync(PLACEHOLDER_CA, 'utf8'));
    }
  } catch (_err) {
    // ignore
  }

  return '';
}

/**
 * Build the .mobileconfig XML document.
 *
 * @param {object} [options]
 * @param {string} [options.caDer] base64 DER body of the root CA
 * @param {string} [options.uuid] profile UUID
 * @param {string} [options.dnsUrl] DoH server URL
 * @param {string[]} [options.domains] SupplementalMatchDomains
 * @param {string} [options.displayName]
 * @param {string} [options.organization]
 * @param {string} [options.description]
 * @returns {string} plist XML
 */
function buildMobileconfig(options = {}) {
  const {
    caDer = '',
    uuid = 'B1STEAM-LOCKETGOLD-PROFILE',
    dnsUrl = DEFAULT_DNS_URL,
    domains = DEFAULT_DOMAINS,
    displayName = 'B1sTeam — LocketGold (Free)',
    organization = 'B1sTeam',
    description = 'B1sTeam — LocketGold (Free): kích hoạt Gold + khung Kawaii + DoH riêng tư.',
  } = options || {};

  const base64 = String(caDer || '').replace(/\s+/g, '');
  const payloadContent = wrapBase64(base64);

  const domainList = (Array.isArray(domains) ? domains : DEFAULT_DOMAINS)
    .filter((d) => typeof d === 'string' && d.trim())
    .map((d) => `\t\t\t\t\t<string>${escapeXml(d.trim())}</string>`)
    .join('\n');

  const caUuid = String(uuid);
  const dnsUuid = `${caUuid}-DNS`;
  const rootUuid = `${caUuid}-CA`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>PayloadCertificateFileName</key>
			<string>B1sTeam-LocketGold-RootCA.crt</string>
			<key>PayloadContent</key>
			<data>${payloadContent}</data>
			<key>PayloadDescription</key>
			<string>Sau khi cài hồ sơ: Cài đặt &gt; Cài đặt chung &gt; Giới thiệu &gt; Cài đặt tin cậy chứng nhận, bật tin cậy với B1sTeam LocketGold Root CA.</string>
			<key>PayloadDisplayName</key>
			<string>B1sTeam LocketGold Root CA</string>
			<key>PayloadEnabled</key>
			<true/>
			<key>PayloadIdentifier</key>
			<string>com.b1steam.locketgold.rootca</string>
			<key>PayloadType</key>
			<string>com.apple.security.root</string>
			<key>PayloadUUID</key>
			<string>${escapeXml(rootUuid)}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
		<dict>
			<key>DNSSettings</key>
			<dict>
				<key>DNSProtocol</key>
				<string>HTTPS</string>
				<key>ServerURL</key>
				<string>${escapeXml(dnsUrl)}</string>
				<key>SupplementalMatchDomains</key>
				<array>
${domainList}
				</array>
			</dict>
			<key>PayloadDescription</key>
			<string>B1sTeam DoH (DNS over HTTPS) cho LocketGold — máy chủ riêng của B1sTeam.</string>
			<key>PayloadDisplayName</key>
			<string>B1sTeam LocketGold DoH</string>
			<key>PayloadEnabled</key>
			<true/>
			<key>PayloadIdentifier</key>
			<string>com.b1steam.locketgold.dns</string>
			<key>PayloadType</key>
			<string>com.apple.dnsSettings.managed</string>
			<key>PayloadUUID</key>
			<string>${escapeXml(dnsUuid)}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>${escapeXml(description)}</string>
	<key>PayloadDisplayName</key>
	<string>${escapeXml(displayName)}</string>
	<key>PayloadEnabled</key>
	<true/>
	<key>PayloadIdentifier</key>
	<string>com.b1steam.locketgold.profile</string>
	<key>PayloadOrganization</key>
	<string>${escapeXml(organization)}</string>
	<key>PayloadRemovalDisallowed</key>
	<false/>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>${escapeXml(caUuid)}</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
`;
}

module.exports = {
  BASE64_LINE_WIDTH,
  DEFAULT_DNS_URL,
  DEFAULT_DOMAINS,
  REPO_ROOT,
  escapeXml,
  wrapBase64,
  pemToBase64,
  loadCaDerBase64,
  buildMobileconfig,
};
