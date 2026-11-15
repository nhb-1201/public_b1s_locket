import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeHost,
  isWhitelisted,
  whitelistReason,
} from '../src/whitelist.js';
import {
  parseWireQuestion,
  buildWireResponse,
  buildFlyJsonAnswer,
  normalizeJsonAnswer,
  ipv4ToBytes,
  cacheSet,
  cacheGet,
  clearCache,
} from '../src/resolve.js';
import { createRateLimiter, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '../src/ratelimit.js';
import { pickProfile, parsePool, stableHash } from '../src/rotator.js';
import worker, { detectFormat, flyProxyIp, rotationRatio, clientIp } from '../src/index.js';

/**
 * Build a DNS query (wire format) for the given name.
 *
 * @param {string} name
 * @param {number} [type]
 * @returns {Buffer}
 */
function buildQuery(name, type = 1) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x1234, 0);
  header.writeUInt16BE(0x0100, 2); // RD
  header.writeUInt16BE(1, 4); // QDCOUNT

  const chunks = [];
  for (const label of name.split('.')) {
    chunks.push(Buffer.from([label.length]), Buffer.from(label, 'ascii'));
  }
  chunks.push(Buffer.from([0]));

  const question = Buffer.alloc(4);
  question.writeUInt16BE(type, 0);
  question.writeUInt16BE(1, 2);
  chunks.push(question);

  return Buffer.concat([header, ...chunks]);
}

test('normalizeHost strips the port, the trailing dot and the case', () => {
  assert.equal(normalizeHost('API.RevenueCat.COM.'), 'api.revenuecat.com');
  assert.equal(normalizeHost('api.revenuecat.com:443'), 'api.revenuecat.com');
  assert.equal(normalizeHost('  locket.camera '), 'locket.camera');
  assert.equal(normalizeHost(''), '');
});

test('the allow-list contains every Locket/Firebase/RevenueCat host', () => {
  const expected = [
    'api.revenuecat.com',
    'api.rc-backup.com',
    'rev.cat',
    'firebaseremoteconfig.googleapis.com',
    'x.firebaseremoteconfig.googleapis.com',
    'firebaseremoteconfig.google.com',
    'x.firebaseremoteconfig.google.com',
    'remoteconfig.googleapis.com',
    'x.remoteconfig.googleapis.com',
    'api.locketcamera.com',
    'cdn.locketcamera.com',
    'public.locketcamera.com',
    'locket.camera',
    'us-central1-locket-4252a.cloudfunctions.net',
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
  ];
  for (const host of expected) {
    assert.equal(isWhitelisted(host), true, `${host} phải nằm trong allow-list`);
  }
  assert.equal(whitelistReason('api.revenuecat.com'), 'exact');
  assert.equal(whitelistReason('a.b.firebaseremoteconfig.googleapis.com'), 'suffix');
});

test('unknown hosts are not part of the allow-list', () => {
  assert.equal(isWhitelisted('example.com'), false);
  assert.equal(isWhitelisted('evil-revenuecat.com'), false);
  assert.equal(isWhitelisted(''), false);
  assert.equal(whitelistReason('example.com'), null);
});

test('parseWireQuestion extracts the name and the type', () => {
  const query = buildQuery('api.revenuecat.com', 1);
  const question = parseWireQuestion(query);
  assert.ok(question);
  assert.equal(question.name, 'api.revenuecat.com');
  assert.equal(question.type, 1);
  assert.equal(question.id, 0x1234);
  assert.equal(question.rd, true);
  assert.equal(question.questionEnd, query.length);
});

test('parseWireQuestion rejects garbage', () => {
  assert.equal(parseWireQuestion(new Uint8Array(3)), null);
  assert.equal(parseWireQuestion(null), null);
});

test('buildWireResponse answers with the Fly.io proxy IP', () => {
  const query = buildQuery('api.revenuecat.com', 1);
  const response = buildWireResponse({ request: query, ip: '137.66.53.108' });

  assert.equal(response.length, query.length + 16);
  assert.equal((response[0] << 8) | response[1], 0x1234); // transaction id
  assert.equal(response[2] & 0x80, 0x80); // QR flag
  assert.equal((response[6] << 8) | response[7], 1); // ANCOUNT
  assert.equal(response[query.length], 0xc0); // pointer to the question name
  assert.equal((response[query.length + 2] << 8) | response[query.length + 3], 1); // TYPE A
  assert.deepEqual(Array.from(response.slice(query.length + 12)), ipv4ToBytes('137.66.53.108'));
});

test('buildWireResponse can produce an empty (NODATA) answer', () => {
  const query = buildQuery('api.revenuecat.com', 28);
  const response = buildWireResponse({ request: query, ip: '' });
  assert.equal((response[6] << 8) | response[7], 0);
  assert.equal(response.length, query.length);
});

test('the JSON answer exposes the documented fields', () => {
  const answer = buildFlyJsonAnswer('api.revenuecat.com', 'A', '137.66.53.108');
  for (const field of ['Status', 'TC', 'RD', 'RA', 'AD', 'CD', 'Question', 'Answer', 'Comment']) {
    assert.ok(Object.prototype.hasOwnProperty.call(answer, field), `thiếu trường ${field}`);
  }
  assert.equal(answer.Answer[0].data, '137.66.53.108');
  assert.equal(answer.Answer[0].name, 'api.revenuecat.com');

  const normalized = normalizeJsonAnswer({ Status: 0, Answer: [] }, 'example.com', 'A');
  assert.equal(normalized.Question[0].name, 'example.com');
  assert.deepEqual(normalized.Answer, []);
});

test('the cache stores and expires the answers', () => {
  clearCache();
  cacheSet('k', 'v', 1000, 1000);
  assert.equal(cacheGet('k', 1500), 'v');
  assert.equal(cacheGet('k', 3000), null);
});

test('the rate limiter allows 60 queries per 10 minutes', () => {
  const limiter = createRateLimiter({ limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS });
  const now = 1_000_000;
  for (let i = 0; i < DEFAULT_LIMIT; i += 1) {
    const result = limiter.check('1.2.3.4', now);
    assert.equal(result.allowed, true, `query ${i + 1} phải được phép`);
  }
  const blocked = limiter.check('1.2.3.4', now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.limit, DEFAULT_LIMIT);

  // another client is not affected
  assert.equal(limiter.check('5.6.7.8', now).allowed, true);

  // the bucket refills over time
  assert.equal(limiter.check('1.2.3.4', now + DEFAULT_WINDOW_MS).allowed, true);
});

test('the rotation is deterministic and keeps the 80% ratio', () => {
  const pool = [
    { id: 'aaa', kind: 'nextdns' },
    { id: 'bbb', kind: 'nextdns' },
    { id: 'ccc', kind: 'nextdns' },
  ];
  const fallback = { id: 'fly', kind: 'fallback' };

  const first = pickProfile(pool, { profileId: 'user-42', ratio: 0.8, fallback });
  const second = pickProfile(pool, { profileId: 'user-42', ratio: 0.8, fallback });
  assert.equal(first.profile.id, second.profile.id);
  assert.equal(first.route, second.route);

  let hits = 0;
  const samples = 20000;
  for (let i = 0; i < samples; i += 1) {
    const choice = pickProfile(pool, { profileId: `user-${i}`, ratio: 0.8, fallback });
    if (choice.route === 'nextdns') hits += 1;
  }
  const measured = hits / samples;
  assert.ok(measured > 0.75 && measured < 0.85, `tỉ lệ đo được ${measured}`);
});

test('stableHash is stable and parsePool understands the env variable', () => {
  assert.equal(stableHash('b1steam'), stableHash('b1steam'));
  assert.notEqual(stableHash('a'), stableHash('b'));
  const pool = parsePool(' abc123 , def456 ');
  assert.equal(pool.length, 2);
  assert.equal(pool[0].id, 'abc123');
  assert.equal(pool[0].dns_url, 'https://dns.nextdns.io/abc123');
});

test('the worker answers the health probe', async () => {
  const response = await worker.fetch(new Request('https://dns.b1s.id.vn/health'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'b1steam-dns');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Cache-Control'), 'max-age=60');
  assert.equal(response.headers.get('Vary'), 'Accept');
});

test('the worker answers the allow-list with the Fly.io proxy IP', async () => {
  const response = await worker.fetch(
    new Request('https://dns.b1s.id.vn/fly/dns-query?name=api.revenuecat.com&type=A', {
      headers: { Accept: 'application/dns-json' },
    }),
    { FLY_PROXY_IP: '137.66.53.108' },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.Answer[0].data, '137.66.53.108');
});

test('the worker rejects unknown routes', async () => {
  const response = await worker.fetch(new Request('https://dns.b1s.id.vn/nope'), {});
  assert.equal(response.status, 404);
});

test('the worker rate limits after 60 queries', async () => {
  const ip = '203.0.113.7';
  const makeRequest = () =>
    new Request('https://dns.b1s.id.vn/fly/dns-query?name=api.revenuecat.com&type=A', {
      headers: { Accept: 'application/dns-json', 'CF-Connecting-IP': ip },
    });

  let limited = null;
  for (let i = 0; i < 70; i += 1) {
    const response = await worker.fetch(makeRequest(), { FLY_PROXY_IP: '137.66.53.108' });
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  assert.ok(limited, 'phải trả về 429 sau khi vượt giới hạn');
  assert.equal(limited.headers.get('Retry-After'), '600');
  const body = await limited.json();
  assert.equal(body.limit, 60);
});

test('helper: detectFormat, flyProxyIp, rotationRatio and clientIp', () => {
  const url = new URL('https://dns.b1s.id.vn/fly/dns-query?name=a.com');
  assert.equal(detectFormat(new Request(url, { headers: { Accept: 'application/dns-json' } }), url), 'json');
  assert.equal(
    detectFormat(
      new Request(url, { method: 'POST', body: new Uint8Array(1), headers: { 'Content-Type': 'application/dns-message' } }),
      url,
    ),
    'wire',
  );
  assert.equal(flyProxyIp({ FLY_PROXY_IP: '1.2.3.4' }), '1.2.3.4');
  assert.equal(flyProxyIp({}), '137.66.53.108');
  assert.equal(rotationRatio({ ROTATION_RATIO: '0.5' }), 0.5);
  assert.equal(rotationRatio({}), 0.8);
  assert.equal(
    clientIp(new Request('https://dns.b1s.id.vn/', { headers: { 'CF-Connecting-IP': '9.9.9.9' } })),
    '9.9.9.9',
  );
});
