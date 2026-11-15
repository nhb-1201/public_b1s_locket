'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Tests for the static scanner.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findEndpointsInText,
  scanDir,
  selfCheck,
  parseArgs,
} = require('../scanner/index');

test('scanner tìm thấy IP cứng và bỏ qua địa chỉ loopback', () => {
  const out = findEndpointsInText(
    ['const proxy = "137.66.53.108";', 'const local = "127.0.0.1";', 'const off = "0.0.0.0";'].join('\n'),
    'sample.js',
  );
  assert.deepEqual(out.ips, ['137.66.53.108']);
});

test('scanner tìm thấy domain trong URL và trong rule', () => {
  const out = findEndpointsInText(
    [
      "fetch('https://locket.b1s.id.vn/api/verify');",
      'DOMAIN,api.revenuecat.com,DIRECT',
      'DOMAIN-SUFFIX,firebaseremoteconfig.googleapis.com,DIRECT',
      'hostname = locket.camera',
    ].join('\n'),
    'sample.js',
  );
  assert.ok(out.domains.includes('locket.b1s.id.vn'));
  assert.ok(out.domains.includes('api.revenuecat.com'));
  assert.ok(out.domains.includes('firebaseremoteconfig.googleapis.com'));
  assert.ok(out.domains.includes('locket.camera'));
});

test('scanner ghi lại vị trí phát hiện', () => {
  const out = findEndpointsInText('const ip = "1.2.3.4";\nconst ip2 = "5.6.7.8";', 'a.js');
  assert.ok(out.occurrences.length >= 2);
  assert.equal(out.occurrences[0].file, 'a.js');
  assert.equal(out.occurrences[0].line, 1);
});

test('self-check của scanner pass', () => {
  const result = selfCheck();
  assert.equal(result.ok, true);
});

test('scanDir quét được cây thư mục tạm', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b1s-scanner-'));
  fs.mkdirSync(path.join(root, 'modules'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'modules', 'B1sTeam_LocketGold.sgmodule'),
    '#!name = B1sTeam\nDOMAIN,api.revenuecat.com,DIRECT\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'js', 'locket.js'),
    'const host = "https://api.locketcamera.com/v1";',
    'utf8',
  );

  try {
    const result = scanDir(root);
    assert.ok(result.files >= 2, `phải quét được ít nhất 2 tệp, thực tế ${result.files}`);
    assert.ok(result.domains.includes('api.revenuecat.com'));
    assert.ok(result.domains.includes('api.locketcamera.com'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('scanDir trả về kết quả rỗng khi thư mục không tồn tại', () => {
  const result = scanDir(path.join(os.tmpdir(), 'b1s-khong-ton-tai-12345'));
  assert.deepEqual(result.ips, []);
  assert.deepEqual(result.domains, []);
  assert.equal(result.files, 0);
});

test('parseArgs hiểu các cờ của CLI', () => {
  const options = parseArgs(['--dns', '--json', '--dir=./shadowrocket']);
  assert.equal(options.resolve, true);
  assert.equal(options.json, true);
  assert.equal(options.dir, './shadowrocket');
  assert.equal(options.selfCheck, false);

  const fallback = parseArgs([]);
  assert.ok(fallback.dir.endsWith('shadowrocket'));
  assert.equal(fallback.selfCheck, false);

  const selfCheckMode = parseArgs(['--self-check']);
  assert.equal(selfCheckMode.selfCheck, true);
});
