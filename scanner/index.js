'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Static scanner for the Shadowrocket tree.
 *
 * Finds hardcoded IP addresses and domain names so the team can spot a
 * leftover endpoint before shipping a release.
 *
 * Usage:
 *   node scanner/index.js                # scan ../shadowrocket
 *   node scanner/index.js --dir=./js     # scan another folder
 *   node scanner/index.js --dns          # resolve every domain
 *   node scanner/index.js --json         # machine readable output
 *   node scanner/index.js --self-check   # run the built-in assertions
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

/** Matches IPv4 addresses. */
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;

/** Matches the host part of an http(s) URL. */
const URL_HOST_REGEX = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

/** Matches the host of a Shadowrocket rule (DOMAIN, DOMAIN-SUFFIX, hostname…). */
const RULE_DOMAIN_REGEX =
  /(?:DOMAIN(?:-SUFFIX)?|hostname|Host|host)\s*[,=:]\s*([a-zA-Z0-9*_.-]+\.[a-zA-Z]{2,})/gi;

/** Loopback / "disabled" addresses that are not interesting. */
const IGNORED_IPS = new Set(['0.0.0.0', '127.0.0.1', '255.255.255.255']);

/** File extensions that are scanned. */
const SCAN_EXTENSIONS =
  /\.(js|mjs|cjs|module|sgmodule|plugin|stoverride|snippet|conf|txt|json|ya?ml|plist|xml|html?)$/i;

/** Folders that never contain interesting endpoints. */
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.cache', 'dist', 'build']);

/**
 * Extract the IPs and the domains of a text blob.
 *
 * @param {string} text
 * @param {string} [filename]
 * @returns {{ ips: string[], domains: string[], occurrences: object[] }}
 */
function findEndpointsInText(text, filename = '') {
  const ips = new Set();
  const domains = new Set();
  const occurrences = [];
  const content = String(text == null ? '' : text);

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    let match;
    IP_REGEX.lastIndex = 0;
    while ((match = IP_REGEX.exec(line)) !== null) {
      const ip = match[0];
      if (!IGNORED_IPS.has(ip)) {
        ips.add(ip);
        occurrences.push({ type: 'ip', value: ip, file: filename, line: lineNumber });
      }
    }

    URL_HOST_REGEX.lastIndex = 0;
    while ((match = URL_HOST_REGEX.exec(line)) !== null) {
      const host = match[1].toLowerCase().replace(/\.$/, '');
      if (host) {
        domains.add(host);
        occurrences.push({ type: 'domain', value: host, file: filename, line: lineNumber });
      }
    }

    RULE_DOMAIN_REGEX.lastIndex = 0;
    while ((match = RULE_DOMAIN_REGEX.exec(line)) !== null) {
      const host = match[1].toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
      if (host && !host.includes('*')) {
        domains.add(host);
        occurrences.push({ type: 'rule_domain', value: host, file: filename, line: lineNumber });
      }
    }
  });

  return { ips: Array.from(ips), domains: Array.from(domains), occurrences };
}

/**
 * Scan a folder recursively.
 *
 * @param {string} targetDir
 * @param {object} [options]
 * @param {number} [options.maxDepth]
 * @returns {{ ips: string[], domains: string[], occurrences: object[], files: number, root: string }}
 */
function scanDir(targetDir, options = {}) {
  const { maxDepth = 12 } = options || {};
  const root = path.resolve(targetDir || '.');
  const result = { ips: new Set(), domains: new Set(), occurrences: [], files: 0, root };

  if (!fs.existsSync(root)) {
    return { ips: [], domains: [], occurrences: [], files: 0, root };
  }

  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_err) {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        walk(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !SCAN_EXTENSIONS.test(entry.name)) continue;
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch (_err) {
        continue;
      }
      result.files += 1;
      const parsed = findEndpointsInText(content, path.relative(root, fullPath));
      parsed.ips.forEach((ip) => result.ips.add(ip));
      parsed.domains.forEach((domain) => result.domains.add(domain));
      result.occurrences.push(...parsed.occurrences);
    }
  }

  walk(root, 0);

  return {
    ips: Array.from(result.ips).sort(),
    domains: Array.from(result.domains).sort(),
    occurrences: result.occurrences,
    files: result.files,
    root,
  };
}

/**
 * Built-in assertions (--self-check).
 *
 * @returns {{ ok: boolean, checks: number }}
 */
function selfCheck() {
  const sample = [
    "const API = 'https://locket.b1s.id.vn/api/verify';",
    'fetch("http://api.revenuecat.com/v1/subscribers");',
    'proxy = 192.168.1.50;',
    'DOMAIN,api.rc-backup.com,DIRECT',
    'DOMAIN-SUFFIX,firebaseremoteconfig.googleapis.com,DIRECT',
    'hostname = locket.camera',
    'blocked = 0.0.0.0;',
    'local = 127.0.0.1;',
  ].join('\n');

  const out = findEndpointsInText(sample, 'sample.js');

  assert.deepStrictEqual(out.ips, ['192.168.1.50'], 'phải bỏ qua 0.0.0.0 và 127.0.0.1');
  assert.ok(out.domains.includes('locket.b1s.id.vn'), 'phải tìm thấy domain trong URL');
  assert.ok(out.domains.includes('api.revenuecat.com'), 'phải tìm thấy domain trong URL');
  assert.ok(out.domains.includes('api.rc-backup.com'), 'phải tìm thấy domain trong rule');
  assert.ok(
    out.domains.includes('firebaseremoteconfig.googleapis.com'),
    'phải tìm thấy domain trong DOMAIN-SUFFIX',
  );
  assert.ok(out.domains.includes('locket.camera'), 'phải tìm thấy domain trong hostname');
  assert.ok(!out.domains.includes('0.0.0.0'), 'không được coi 0.0.0.0 là domain');
  assert.ok(out.occurrences.length >= 6, 'phải ghi lại vị trí phát hiện');

  return { ok: true, checks: 8 };
}

/**
 * Parse the command line arguments.
 *
 * @param {string[]} argv
 * @returns {{ dir: string, resolve: boolean, json: boolean, selfCheck: boolean }}
 */
function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  let dir = '';
  let resolve = false;
  let json = false;
  let selfCheckMode = false;

  for (const arg of args) {
    if (arg === '--dns' || arg === '--resolve') resolve = true;
    else if (arg === '--json') json = true;
    else if (arg === '--self-check') selfCheckMode = true;
    else if (arg.startsWith('--dir=')) dir = arg.slice('--dir='.length);
    else if (!arg.startsWith('-') && !dir) dir = arg;
  }

  return {
    dir: dir || path.resolve(__dirname, '..', 'shadowrocket'),
    resolve,
    json,
    selfCheck: selfCheckMode,
  };
}

/**
 * Entry point of the CLI.
 *
 * @param {string[]} [argv]
 * @returns {Promise<number>} the exit code
 */
async function main(argv) {
  const options = parseArgs(argv || process.argv.slice(2));

  if (options.selfCheck) {
    const result = selfCheck();
    if (!options.json) console.log(`✅ Self-check passed (${result.checks} assertions)`);
    return 0;
  }

  const result = scanDir(options.dir);

  if (options.json) {
    const payload = {
      root: result.root,
      files: result.files,
      ips: result.ips,
      domains: result.domains,
      occurrences: result.occurrences,
    };
    if (options.resolve) {
      payload.resolved = await resolveDomains(result.domains);
    }
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  console.log('=== B1sTeam · Shadowrocket scanner ===');
  console.log(`Thư mục : ${result.root}`);
  console.log(`Tệp đã quét : ${result.files}`);
  console.log(`IP cứng : ${result.ips.length ? result.ips.join(', ') : '(không có)'}`);
  console.log(`Domain : ${result.domains.length}`);

  for (const domain of result.domains) {
    if (options.resolve) {
      const address = await resolveDomain(domain);
      console.log(` - ${domain} -> ${address}`);
    } else {
      console.log(` - ${domain}`);
    }
  }

  return 0;
}

/**
 * Resolve a single domain.
 *
 * @param {string} domain
 * @returns {Promise<string>}
 */
async function resolveDomain(domain) {
  try {
    const dns = require('node:dns').promises;
    const { address } = await dns.lookup(domain);
    return address;
  } catch (_err) {
    return '(không phân giải được)';
  }
}

/**
 * Resolve a list of domains.
 *
 * @param {string[]} domains
 * @returns {Promise<Record<string, string>>}
 */
async function resolveDomains(domains) {
  const out = {};
  for (const domain of domains) {
    out[domain] = await resolveDomain(domain);
  }
  return out;
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error('Lỗi scanner:', (err && err.message) || err);
      process.exitCode = 1;
    });
}

module.exports = {
  IP_REGEX,
  URL_HOST_REGEX,
  RULE_DOMAIN_REGEX,
  IGNORED_IPS,
  SCAN_EXTENSIONS,
  findEndpointsInText,
  scanDir,
  selfCheck,
  parseArgs,
  resolveDomain,
  resolveDomains,
  main,
};
