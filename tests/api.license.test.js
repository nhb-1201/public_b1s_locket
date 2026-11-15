'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Tests for the license key: format, issuing, verification, tamper detection,
 * expiry and device binding.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeKey,
  isValidKeyFormat,
  generateKey,
  keyPrefix,
  maskKey,
} = require('../api/lib/keys');

const {
  issueLicenseKey,
  verifyLicenseKey,
  authorizeLicense,
  hashDevice,
  hashLicenseKey,
  splitLicense,
  constantTimeEqual,
} = require('../api/lib/license');

const SECRET = 'test-secret-b1steam';

/* --------------------------------------------------------------------- */
/* Định dạng key                                                          */
/* --------------------------------------------------------------------- */

test('generateKey sinh key đúng định dạng B1S-XXXX-XXXX-XXXX', () => {
  const key = generateKey();
  assert.match(key, /^B1S-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/);
  assert.equal(key.length, 18);
  assert.equal(isValidKeyFormat(key), true);
});

test('mọi key sinh ra đều khác nhau', () => {
  const keys = new Set();
  for (let i = 0; i < 200; i += 1) keys.add(generateKey());
  assert.equal(keys.size, 200);
});

test('key không chứa chữ I, L, O, U (Crockford base32)', () => {
  for (let i = 0; i < 200; i += 1) {
    const body = generateKey().replace(/B1S-|-/g, '');
    assert.equal(/[ILOU]/.test(body), false, 'key chứa ký tự bị cấm');
  }
});

test('normalizeKey chấp nhận nhiều kiểu nhập liệu', () => {
  assert.equal(normalizeKey('b1s-2345-6789-abcd'), 'B1S-2345-6789-ABCD');
  assert.equal(normalizeKey('b1s 2345 6789 abcd'), 'B1S-2345-6789-ABCD');
  assert.equal(normalizeKey('B1S_2345_6789_ABCD'), 'B1S-2345-6789-ABCD');
  assert.equal(normalizeKey(' B1S23456789ABCD '), 'B1S-2345-6789-ABCD');
  assert.equal(normalizeKey('B1S-2345-6789-ABCD.payload.signature'), 'B1S-2345-6789-ABCD');
});

test('normalizeKey từ chối input không hợp lệ', () => {
  assert.equal(normalizeKey(''), '');
  assert.equal(normalizeKey(null), '');
  assert.equal(normalizeKey('ABC'), '');
  assert.equal(normalizeKey('B1S-2345-6789-ABC'), ''); // one character short
  assert.equal(normalizeKey('B1S-2345-6789-ABCDM'), ''); // one character too long
  assert.equal(normalizeKey('B1S-2345-6789-ABCI'), ''); // forbidden letter I
  assert.equal(normalizeKey('B1S-2345-6789-ABCL'), ''); // forbidden letter L
  assert.equal(normalizeKey('B1S-2345-6789-ABCO'), ''); // forbidden letter O
  assert.equal(normalizeKey('B1S-2345-6789-ABCU'), ''); // forbidden letter U
  assert.equal(normalizeKey('B1S-2345-6789-ABCD'), 'B1S-2345-6789-ABCD');
  assert.equal(isValidKeyFormat('nope'), false);
});

test('keyPrefix và maskKey không lộ key', () => {
  const key = 'B1S-2345-6789-ABCD';
  assert.equal(keyPrefix(key), 'B1S-2345');
  assert.equal(maskKey(key), 'B1S-****-****-ABCD');
  assert.equal(maskKey('x'), '');
});

/* --------------------------------------------------------------------- */
/* Phát hành / xác minh                                                    */
/* --------------------------------------------------------------------- */

test('issueLicenseKey + verifyLicenseKey round-trip', () => {
  const issued = issueLicenseKey({ device: 'device-1', plan: 'free', secret: SECRET });
  assert.ok(issued.key.startsWith('B1S-'));
  assert.ok(issued.license.startsWith(`${issued.key}.`));

  const result = verifyLicenseKey(issued.license, SECRET, { device: 'device-1' });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'ok');
  assert.equal(result.payload.key, issued.key);
  assert.equal(result.payload.device, 'device-1');
  assert.equal(result.payload.plan, 'free');
});

test('verifyLicenseKey phát hiện chữ ký bị sửa', () => {
  const issued = issueLicenseKey({ device: 'device-1', secret: SECRET });
  const parts = issued.license.split('.');
  const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}AA`;

  const result = verifyLicenseKey(tampered, SECRET);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad_signature');
});

test('verifyLicenseKey phát hiện payload bị sửa', () => {
  const issued = issueLicenseKey({ device: 'device-1', plan: 'free', secret: SECRET });
  const parts = issued.license.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ key: issued.key, device: 'device-1', plan: 'pro', exp: 0 }),
  ).toString('base64url');

  const result = verifyLicenseKey(`${parts[0]}.${forgedPayload}.${parts[2]}`, SECRET);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad_signature');
});

test('verifyLicenseKey từ chối secret sai', () => {
  const issued = issueLicenseKey({ secret: SECRET });
  const result = verifyLicenseKey(issued.license, 'another-secret');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad_signature');
});

test('verifyLicenseKey báo hết hạn', () => {
  const issued = issueLicenseKey({ secret: SECRET, expiresInMs: -1000 });
  const result = verifyLicenseKey(issued.license, SECRET);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'expired');
  assert.ok(result.payload, 'payload vẫn được trả về khi hết hạn');
});

test('verifyLicenseKey trả lời đúng khi chưa hết hạn', () => {
  const issued = issueLicenseKey({ secret: SECRET, expiresInMs: 60_000 });
  const result = verifyLicenseKey(issued.license, SECRET);
  assert.equal(result.ok, true);
});

test('verifyLicenseKey phát hiện sai thiết bị', () => {
  const issued = issueLicenseKey({ device: 'device-1', secret: SECRET });
  const result = verifyLicenseKey(issued.license, SECRET, { device: 'device-2' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'device_mismatch');
});

test('verifyLicenseKey bỏ qua kiểm tra thiết bị khi không truyền device', () => {
  const issued = issueLicenseKey({ device: 'device-1', secret: SECRET });
  const result = verifyLicenseKey(issued.license, SECRET);
  assert.equal(result.ok, true);
});

test('verifyLicenseKey từ chối license hỏng', () => {
  assert.equal(verifyLicenseKey('', SECRET).reason, 'missing');
  assert.equal(verifyLicenseKey('B1S-2345-6789-ABCD', SECRET).reason, 'malformed');
  assert.equal(verifyLicenseKey('nope.payload.signature', SECRET).reason, 'bad_format');
});

/* --------------------------------------------------------------------- */
/* authorizeLicense                                                        */
/* --------------------------------------------------------------------- */

test('authorizeLicense chấp nhận license đã ký', () => {
  const issued = issueLicenseKey({ device: 'device-1', secret: SECRET });
  const result = authorizeLicense(issued.license, { secret: SECRET, device: 'device-1' });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'signed');
  assert.equal(result.key, issued.key);
});

test('authorizeLicense dùng bản ghi trong store khi có', () => {
  const key = 'B1S-2345-6789-ABCD';
  const result = authorizeLicense(key, {
    record: { plan: 'pro', device_id: 'device-9', expires_at: null, revoked_at: null },
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'registered');
  assert.equal(result.payload.plan, 'pro');
});

test('authorizeLicense từ chối key đã thu hồi', () => {
  const key = 'B1S-2345-6789-ABCD';
  const result = authorizeLicense(key, { record: { revoked_at: new Date().toISOString() } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'revoked');
});

test('authorizeLicense từ chối key đã hết hạn trong store', () => {
  const key = 'B1S-2345-6789-ABCD';
  const result = authorizeLicense(key, {
    record: { expires_at: new Date(Date.now() - 1000).toISOString() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'expired');
});

test('authorizeLicense chế độ strict từ chối key chưa đăng ký', () => {
  const key = 'B1S-2345-6789-ABCD';
  const result = authorizeLicense(key, { strict: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_registered');
});

test('authorizeLicense chế độ mặc định chỉ kiểm tra định dạng', () => {
  const key = 'B1S-2345-6789-ABCD';
  const result = authorizeLicense(key);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'format_only');
});

/* --------------------------------------------------------------------- */
/* Tiện ích                                                                */
/* --------------------------------------------------------------------- */

test('hashDevice trả về sha256 hex ổn định', () => {
  const hash = hashDevice('device-1');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashDevice('device-1'));
  assert.notEqual(hash, hashDevice('device-2'));
  assert.equal(hashDevice(''), hashDevice(''));
});

test('hashLicenseKey không bao giờ trả về key thô', () => {
  const key = 'B1S-2345-6789-ABCD';
  const hash = hashLicenseKey(key);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes('B1S'));
});

test('splitLicense tách đúng ba phần', () => {
  const issued = issueLicenseKey({ secret: SECRET });
  const parts = splitLicense(issued.license);
  assert.equal(parts.key, issued.key);
  assert.equal(parts.signed, true);
  assert.equal(splitLicense('B1S-2345-6789-ABCD').signed, false);
});

test('constantTimeEqual so sánh chính xác', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'abcd'), false);
});
