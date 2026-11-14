// B1sTeam - Static scanner (TypeScript)
// author: B1sTeam | b1s.id.vn | @b1steam
//
// Quet nguon proxy + dns de phat hien endpoint/domain hardcode (bao mat + audit).
// Chay: node --experimental-strip-types scanner/index.ts [--dns]
// Tu kiem tra: node --experimental-strip-types scanner/index.ts --self-check

import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ponytail: regex-based static scanner; upgrade to AST parser if obfuscated payloads appear.
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const URL_HOST_REGEX = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const RULE_DOMAIN_REGEX = /(?:DOMAIN(?:-SUFFIX)?|hostname|Host)\s*[,=:]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

const IGNORED_IPS = new Set(['0.0.0.0', '127.0.0.1']);

export interface ScanOccurrence {
  type: 'ip' | 'domain' | 'rule_domain';
  value: string;
  file: string;
  line: number;
}

export interface ScanResult {
  ips: string[];
  domains: string[];
  occurrences: ScanOccurrence[];
}

interface ScanSets {
  ips: Set<string>;
  domains: Set<string>;
  occurrences: ScanOccurrence[];
}

function findEndpointsInText(text: string, filename = ''): ScanResult {
  const ips = new Set<string>();
  const domains = new Set<string>();
  const occurrences: ScanOccurrence[] = [];

  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    let match: RegExpExecArray | null;

    while ((match = IP_REGEX.exec(line)) !== null) {
      const ip = match[0];
      if (!IGNORED_IPS.has(ip)) {
        ips.add(ip);
        occurrences.push({ type: 'ip', value: ip, file: filename, line: idx + 1 });
      }
    }

    while ((match = URL_HOST_REGEX.exec(line)) !== null) {
      const host = match[1].toLowerCase();
      domains.add(host);
      occurrences.push({ type: 'domain', value: host, file: filename, line: idx + 1 });
    }

    while ((match = RULE_DOMAIN_REGEX.exec(line)) !== null) {
      const host = match[1].toLowerCase().replace(/^%[\w-]+%,?\s*/i, '');
      if (host) {
        domains.add(host);
        occurrences.push({ type: 'rule_domain', value: host, file: filename, line: idx + 1 });
      }
    }
  });

  return { ips: Array.from(ips), domains: Array.from(domains), occurrences };
}

function scanDir(targetDir: string): ScanResult {
  const result: ScanSets = { ips: new Set(), domains: new Set(), occurrences: [] };
  if (!fs.existsSync(targetDir)) return { ips: [], domains: [], occurrences: [] };

  function walk(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      // Bo qua noi dung sach (node_modules, lock file, cache build) - khong phai nguon cua ta.
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.wrangler' || entry.name === 'dist' || entry.name === '.next') {
          continue;
        }
        walk(fullPath);
      } else if (/\.(js|ts|tsx|module|sgmodule|plugin|stoverride|snippet|conf|txt|json)$/i.test(entry.name)) {
        if (entry.name === 'package-lock.json' || entry.name === 'yarn.lock' || entry.name === 'pnpm-lock.yaml') {
          continue;
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = findEndpointsInText(content, path.relative(targetDir, fullPath));
        parsed.ips.forEach((ip) => result.ips.add(ip));
        parsed.domains.forEach((d) => result.domains.add(d));
        result.occurrences.push(...parsed.occurrences);
      }
    }
  }

  walk(targetDir);
  return {
    ips: Array.from(result.ips).sort(),
    domains: Array.from(result.domains).sort(),
    occurrences: result.occurrences,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes('--self-check')) {
    const sample =
      "fetch('https://frame.b1s.id.vn/apply-frame');\nproxy = 192.168.1.50\nDOMAIN,api.revenuecat.com,DIRECT";
    const out = findEndpointsInText(sample, 'sample.ts');
    assert.deepStrictEqual(out.ips, ['192.168.1.50']);
    assert.ok(out.domains.includes('frame.b1s.id.vn'));
    assert.ok(out.domains.includes('api.revenuecat.com'));
    console.log('Self-check passed');
    process.exit(0);
  }

  // Quét toàn bộ mã nguồn của repo (proxy + dns) để phát hiện endpoint/domain hardcode.
  const root = path.resolve(__dirname, '..');
  const targets = ['proxy', 'dns'].map((dir) => path.join(root, dir));
  const merged = { ips: new Set<string>(), domains: new Set<string>(), occurrences: [] as ScanOccurrence[] };
  for (const target of targets) {
    const res = scanDir(target);
    res.ips.forEach((ip) => merged.ips.add(ip));
    res.domains.forEach((d) => merged.domains.add(d));
    merged.occurrences.push(...res.occurrences);
  }

  console.log('=== B1sTeam Endpoints & Domains ===');
  console.log('Direct IPs:', merged.ips.size ? [...merged.ips].sort().join(', ') : '(None directly hardcoded)');
  console.log('\nDetected Domains / Hosts:');

  const shouldResolve = process.argv.includes('--dns') || process.argv.includes('--resolve');
  for (const d of [...merged.domains].sort()) {
    if (shouldResolve) {
      try {
        const { address } = await dns.lookup(d);
        console.log(` - ${d} -> ${address}`);
      } catch {
        console.log(` - ${d} -> (unresolved)`);
      }
    } else {
      console.log(` - ${d}`);
    }
  }
}

void main();
