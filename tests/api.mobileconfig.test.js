'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Tests for the .mobileconfig profile builder.
 *
 * Besides checking the XML, the test also runs `python -c "import plistlib…"`
 * to make sure the generated file parses with the official Apple format.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  buildMobileconfig,
  wrapBase64,
  pemToBase64,
  loadCaDerBase64,
  DEFAULT_DNS_URL,
  DEFAULT_DOMAINS,
} = require('../api/lib/mobileconfig');

/** Một chứng thư CA giả (DER base64) đủ dài để kiểm tra việc xuống dòng. */
const FAKE_CA_DER =
  'MIIFczCCA1ugAwIBAgIUQOJ9wGZR++DILyclU4kND3QX83cwDQYJKoZIhvcNAQELBQAwQTELMAkGA1UEBhMCVVMxFDASBgNVBAoMC0xvY2tldCBYVklQMRwwGgYDVQQDDBNMb2NrZXQgWFZJUCBSb290IENBMB4XDTI2MTEwODA5MzkxMloXDTM2MTEwNTA5MzkxMlowQTELMAkGA1UEBhMCVVMxFDASBgNVBAoMC0xvY2tldCBYVklQMRwwGgYDVQQDDBNMb2NrZXQgWFZJUCBSb290IENBMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAkCQM0LvQg4DRh/D+FdzIHRZr2uITgx5hLDSNNh9wV3XxS8ggqDhThHaOC6EzGTL+/x8jufJtF8bIM0TalxbfYW7aKo7/f0WNcsm4a40jbdqbmqgnO2d5HE1Q1sJyO+vtihHkExRALnm2DVJCIBLd1sW5ZLqQN6a5RpBDXJSxcFS+kU7lHQQ9oGEdaYOishyzmspdys3ZuFJKIqYY7V32ZfFBfaCLfYfuVfsPkFZEW4FM3+sgMeh0R1W0MHRXs2y8Uz1Q7cV1Qw7woA7+QQoC93bL1r1S5CI9V3Ysv8CjKR4bH62CnHIW270d6sgSOLAS2tjzTZ1Cly2fKFrxAr6ZGk2WUis8JBHRDBgzHObMBlp/Nh0Zy7GXcGBjLpES6eqbW9IHIrO7uupA/FSqmULnKz9j/oVMIOuFp0As6AxRrRiY6VBY7wNrUpzFyf1XuLcXKUDNq6H5YQWL2nid3+4gGeti8yYLF+5ID32vzXe5EOiOAcvAldpW9Va+EEGxYVSO5t2HxJbNZ5xPr9tOHu1uhAsJG1EHFaMa6x3qFq3/okDGSOm2dYOaI6dqEj/N1eXzHN1H5+sqPOGJOUvV8RYw+sUxxp0IzWFy+je/Gfur7lh71AMQjXH/V2lObDRx5zdNoUQgyhtLwDy2lu9fYY0Jq52wsu5ghwfRkHQuZs0WopMCAwEAAaNjMGEwHQYDVR0OBBYEFAGFfCibZ6nMB+ZRjRWkr3R7icZXMB8GA1UdIwQYMBaAFAGFfCibZ6nMB+ZRjRWkr3R7icZXMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMA0GCSqGSIb3DQEBCwUAA4ICAQAzckMcyqNAWZditAFYpYrg1SnIoWpdMv4vICz4B6nT9AmJ3ebPnOBBhbPZgGd1Cs1wOjnfauzfStJ1EN7zumX8uoz/rCw2njndkuT/AJJCnFujyqElWZaXNb3PO1iLUjqQbI3btogRF2KhXtDzSnQXlM3dVE4mq6XcEBO1XOXTm52twrlYx026UfRsK2YtqhW4TpQxdFydewFVf0k9GC7Krjl+MO6LgX8lJPYd4EzZb+Ht4nJ2SuUm47cuowIGCiW8SHlcHL/tQny6f3gdsnIWU/JTXv6UbhW4yYahqYKrVcTRxPTI5GzfKHGeGWhCEOn/b0b9CCbQ3Oq7N3iWlJUVjxJ4mTI4iUBCfs8RQNerwbW4s16iFo02MAr+/TvLaP/2i1CCjyMqm0ntoVI4tWQBhZfzdGt7pAxKzLLYraMGwkcMS4rcFtZX51zT0W/j2OKGKeNwTSxUOmUEYAY8dQ5NQ+OMJjhmZWggOGj4wlHtswTGU2gC3DlE3IFhY5Ma/lAMiHAAO5cKIUEeAgGs1Y/VM1V6UAnV+I1pl+24OAufFW9HX7qWfKo/JNbZLwSAaihehN5N4DlXUbjp+bYPtqlnyQ2CEWznR+VFuH2LI9Y3a4bLn/Me1epp1R/PtNSI0wAf8OvvUoNa7hQWRp5Yf19KFlhNH16TKSqMX6LZ1nM3RQ==';

/** Thu thập nội dung của mọi thẻ <data>…</data>. */
function extractDataBlocks(xml) {
  const blocks = [];
  const regex = /<data>([\s\S]*?)<\/data>/g;
  let match = regex.exec(xml);
  while (match !== null) {
    blocks.push(match[1]);
    match = regex.exec(xml);
  }
  return blocks;
}

/* --------------------------------------------------------------------- */

test('buildMobileconfig sinh XML đầy đủ payload', () => {
  const xml = buildMobileconfig({
    caDer: FAKE_CA_DER,
    uuid: 'TEST-UUID-0001',
    dnsUrl: DEFAULT_DNS_URL,
    domains: DEFAULT_DOMAINS,
  });

  assert.ok(xml.includes('com.apple.security.root'), 'thiếu payload Root CA');
  assert.ok(xml.includes('PayloadContent'), 'thiếu PayloadContent');
  assert.ok(xml.includes('PayloadEnabled'), 'thiếu PayloadEnabled');
  assert.ok(xml.includes('com.apple.dnsSettings.managed'), 'thiếu payload DoH');
  assert.ok(xml.includes('doh.b1s.id.vn/fly/dns-query'), 'thiếu URL DoH');
  assert.ok(xml.includes('<key>DNSSettings</key>'), 'thiếu khối DNSSettings');
  assert.ok(xml.includes('<key>SupplementalMatchDomains</key>'), 'thiếu SupplementalMatchDomains');
  assert.ok(xml.includes('<key>ServerURL</key>'), 'thiếu ServerURL');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'thiếu XML header');
});

test('mọi dòng base64 không vượt quá 76 ký tự', () => {
  const xml = buildMobileconfig({ caDer: FAKE_CA_DER, uuid: 'TEST-UUID-0002' });
  const blocks = extractDataBlocks(xml);
  assert.ok(blocks.length >= 1, 'phải có ít nhất một khối <data>');

  for (const block of blocks) {
    for (const line of block.split('\n')) {
      assert.ok(line.length <= 76, `dòng base64 dài ${line.length} ký tự`);
    }
    const joined = block.replace(/\s+/g, '');
    assert.equal(joined, FAKE_CA_DER, 'base64 phải khớp với đầu vào');
  }
});

test('wrapBase64 xuống dòng đúng 76 ký tự', () => {
  const wrapped = wrapBase64(FAKE_CA_DER);
  const lines = wrapped.split('\n');
  assert.ok(lines.length > 1, 'base64 dài phải được xuống dòng');
  for (const line of lines) assert.ok(line.length <= 76);
  assert.equal(wrapped.replace(/\s+/g, ''), FAKE_CA_DER);
});

test('pemToBase64 bóc đúng phần thân PEM', () => {
  const pem = '-----BEGIN CERTIFICATE-----\nQUJD\nREVG\n-----END CERTIFICATE-----\n';
  assert.equal(pemToBase64(pem), 'QUJDREVG');
});

test('loadCaDerBase64 luôn trả về một CA hợp lệ', () => {
  const ca = loadCaDerBase64();
  assert.ok(ca.length > 100, 'CA phải có độ dài hợp lý');
  assert.match(ca, /^[A-Za-z0-9+/=\s]+$/, 'CA phải là base64');
});

test('UUID và DNS URL tùy chỉnh được đưa vào hồ sơ', () => {
  const xml = buildMobileconfig({
    caDer: FAKE_CA_DER,
    uuid: 'CUSTOM-UUID-42',
    dnsUrl: 'https://dns.example.com/fly/dns-query',
    domains: ['example.com'],
  });
  assert.ok(xml.includes('CUSTOM-UUID-42'));
  assert.ok(xml.includes('https://dns.example.com/fly/dns-query'));
  assert.ok(xml.includes('<string>example.com</string>'));
  assert.ok(!xml.includes('revenuecat.com'), 'không được thêm domain ngoài danh sách');
});

test('file sinh ra parse được bằng plistlib của python', (t) => {
  let python = null;
  for (const candidate of ['python', 'python3', 'py']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      python = candidate;
      break;
    } catch (_err) {
      // thử candidate tiếp theo
    }
  }
  if (!python) {
    t.skip('không tìm thấy python trên máy');
    return;
  }

  const xml = buildMobileconfig({ caDer: FAKE_CA_DER, uuid: 'PLIST-UUID-1' });
  const file = path.join(os.tmpdir(), `b1s-profile-${process.pid}.mobileconfig`);
  fs.writeFileSync(file, xml, 'utf8');

  const script = [
    'import plistlib, sys',
    'with open(sys.argv[1], "rb") as handle:',
    '    parsed = plistlib.load(handle)',
    'types = sorted(item["PayloadType"] for item in parsed["PayloadContent"])',
    'print(",".join(types))',
  ].join('\n');

  try {
    const output = execFileSync(python, ['-c', script, file], { encoding: 'utf8' }).trim();
    assert.equal(output, 'com.apple.dnsSettings.managed,com.apple.security.root');
  } finally {
    try { fs.unlinkSync(file); } catch (_err) { /* bỏ qua */ }
  }
});
