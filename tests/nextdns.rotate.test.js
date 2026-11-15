'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Tests for the NextDNS rotation engine (80% NextDNS / 20% direct).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  pickProfile,
  estimateRatio,
  shouldRotate,
  stableHash,
  hashUnit,
  DEFAULT_RATIO,
} = require('../nextdns/rotate');

/** Các profile giả dùng cho test. */
const POOL = [
  { id: 'aaa11111', kind: 'nextdns', dns_url: 'https://dns.nextdns.io/aaa11111' },
  { id: 'bbb22222', kind: 'nextdns', dns_url: 'https://dns.nextdns.io/bbb22222' },
  { id: 'ccc33333', kind: 'nextdns', dns_url: 'https://dns.nextdns.io/ccc33333' },
  { id: 'ddd44444', kind: 'nextdns', dns_url: 'https://dns.nextdns.io/ddd44444' },
];

/** Profile dùng chung (20% traffic). */
const FALLBACK = { id: 'fly-shared', kind: 'fallback', dns_url: 'https://doh.b1s.id.vn/fly/dns-query' };

test('DEFAULT_RATIO là 0.8', () => {
  assert.equal(DEFAULT_RATIO, 0.8);
});

test('pickProfile là xác định (deterministic)', () => {
  const first = pickProfile(POOL, { profileId: 'user-abc', ratio: 0.8, fallback: FALLBACK });
  const second = pickProfile(POOL, { profileId: 'user-abc', ratio: 0.8, fallback: FALLBACK });
  assert.equal(first.profile.id, second.profile.id);
  assert.equal(first.route, second.route);
  assert.equal(first.score, second.score);
});

test('pickProfile luôn trả về profile hợp lệ', () => {
  for (let i = 0; i < 500; i += 1) {
    const choice = pickProfile(POOL, { profileId: `user-${i}`, ratio: 0.8, fallback: FALLBACK });
    assert.ok(choice.profile, 'phải có profile');
    assert.ok(choice.route === 'nextdns' || choice.route === 'fallback');
    if (choice.route === 'nextdns') {
      assert.ok(POOL.some((item) => item.id === choice.profile.id), 'profile phải thuộc pool');
    } else {
      assert.equal(choice.profile.id, FALLBACK.id);
    }
  }
});

test('pickProfile giữ tỉ lệ 80% trên toàn bộ pool', () => {
  const samples = 20000;
  let nextdns = 0;
  for (let i = 0; i < samples; i += 1) {
    const choice = pickProfile(POOL, { profileId: `user-${i}`, ratio: 0.8, fallback: FALLBACK });
    if (choice.route === 'nextdns') nextdns += 1;
  }
  const measured = nextdns / samples;
  assert.ok(measured > 0.77 && measured < 0.83, `tỉ lệ đo được ${measured}`);
});

test('estimateRatio đo được gần đúng tỉ lệ yêu cầu', () => {
  const measured = estimateRatio(POOL, { ratio: 0.8, fallback: FALLBACK, samples: 20000 });
  assert.ok(measured > 0.77 && measured < 0.83, `estimateRatio trả về ${measured}`);
  assert.equal(estimateRatio([], { ratio: 0.8, fallback: FALLBACK }), 0);
});

test('estimateRatio bám theo tỉ lệ yêu cầu', () => {
  const measured = estimateRatio(POOL, { ratio: 0.5, fallback: FALLBACK, samples: 20000 });
  assert.ok(measured > 0.47 && measured < 0.53, `estimateRatio(0.5) = ${measured}`);
});

test('mọi profile trong pool đều được dùng (không dồn vào một chỗ)', () => {
  const used = new Set();
  for (let i = 0; i < 5000; i += 1) {
    const choice = pickProfile(POOL, { profileId: `spread-${i}`, ratio: 0.8, fallback: FALLBACK });
    if (choice.route === 'nextdns') used.add(choice.profile.id);
  }
  assert.equal(used.size, POOL.length, 'phải dùng đủ cả 4 profile');
});

test('pool rỗng luôn trả về fallback', () => {
  const choice = pickProfile([], { profileId: 'user-1', ratio: 0.8, fallback: FALLBACK });
  assert.equal(choice.route, 'fallback');
  assert.equal(choice.profile.id, FALLBACK.id);
});

test('tỉ lệ 0 hoặc 1 được áp dụng đúng', () => {
  const zero = pickProfile(POOL, { profileId: 'user-1', ratio: 0, fallback: FALLBACK });
  assert.equal(zero.route, 'fallback');

  const one = pickProfile(POOL, { profileId: 'user-1', ratio: 1, fallback: FALLBACK });
  assert.equal(one.route, 'nextdns');
});

test('stableHash ổn định và hashUnit nằm trong [0,1)', () => {
  assert.equal(stableHash('b1steam'), stableHash('b1steam'));
  assert.notEqual(stableHash('b1steam'), stableHash('b1steam2'));
  const unit = hashUnit('b1steam');
  assert.ok(unit >= 0 && unit < 1);
});

test('shouldRotate so sánh mốc thời gian', () => {
  const now = 1_700_000_000_000;
  const interval = 6 * 60 * 60 * 1000;

  assert.equal(shouldRotate(null, now, interval), true, 'chưa xoay lần nào thì phải xoay');
  assert.equal(shouldRotate(now - interval - 1, now, interval), true);
  assert.equal(shouldRotate(now - interval + 1000, now, interval), false);
  assert.equal(shouldRotate(now, now, 0), false, 'interval <= 0 nghĩa là tắt xoay vòng');
});
