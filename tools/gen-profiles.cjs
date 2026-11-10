#!/usr/bin/env node
/*
 * gen-profiles.cjs — Sinh lại 2 hồ sơ .mobileconfig của LocketGold B1sTeam:
 *
 *   ios/locketgold.mobileconfig          → DNS DoH chống thu hồi (iOS/iPadOS 14+)
 *   ios/locketgold-webclip.mobileconfig  → Web Clip “Giới thiệu B1sTeam”
 *
 * Dùng đúng bộ công cụ của github.com/zone-eu/mobileconfig (npm: @zone-eu/mobileconfig):
 *   · plist được build/kiểm tra bằng thư viện `plist` (cùng luồng getSignedConfig của package)
 *   · `--sign` ký hồ sơ bằng CMS SignedData (cần PROFILE_KEY_PEM + PROFILE_CERT_PEM)
 *
 * iOS hiển thị trực tiếp PayloadDisplayName / PayloadDescription / PayloadIcon nên
 * file này chính là nơi “thiết kế UI” của hồ sơ. Giữ ổn định PayloadUUID để người
 * dùng cũ nhận bản cập nhật thay vì cài trùng hồ sơ.
 *
 * Cách dùng:
 *   cd tools && npm install && node gen-profiles.cjs            # unsigned (mặc định — AdGuard/NextDNS chuẩn)
 *   node gen-profiles.cjs --sign                                 # ký (cần biến môi trường PEM bên dưới)
 *
 * Ký cần CA cert thật (Apple tin cậy) để hiện nhãn “Verified”. Cert tự ký chỉ đổi
 * dòng đỏ “Not Verified” — không nên phát hành; unsigned cũng hiện đỏ như vậy nhưng là thực tế chung.
 *
 *   PROFILE_KEY_PEM=<path key PEM> PROFILE_CERT_PEM=<path cert PEM> node gen-profiles.cjs --sign
 *
 * author: B1sTeam | b1s.id.vn | @b1steam
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_IOS = path.join(ROOT, 'ios');
const ASSETS = path.join(ROOT, 'assets');
const SIGN_MODE = process.argv.includes('--sign');

/* ── Icon PNG từ SVG (sharp — dùng sharp của workspace frontend nếu có) ── */
function loadSharp() {
  const candidates = [
    'sharp',
    path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'sharp'),
    path.join(__dirname, 'node_modules', 'sharp'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* thử tiếp */ }
  }
  console.error('✗ Không tìm thấy module `sharp`. Cài trong tools/ hoặc frontend/ rồi chạy lại.');
  process.exit(1);
}

async function rasterize(svgFile, outFile, size, backgroundHex = '#0E3320') {
  const sharp = loadSharp();
  const svg = fs.readFileSync(svgFile);
  // flatten: bỏ kênh alpha — Apple yêu cầu icon PNG không có nền trong suốt (PayloadIcon/webClip Icon)
  const png = await sharp(svg, { density: 384 })
    .resize(size, size)
    .flatten({ background: backgroundHex })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(outFile, png);
  console.log(`✓ icon ${size}px → ${path.relative(ROOT, outFile)} (${png.length} bytes)`);
  return fs.readFileSync(outFile).toString('base64');
}

/* ── Dữ liệu hồ sơ ──────────────────────────────────────────── */
const CREATOR = 'B1sTeam — b1s.id.vn · @b1steam';

// UUID cho payload dnsSettings.managed bên trong (cố định — để update tại chỗ)
const DNS_INNER_UUID = 'D6E1C9A2-5B4F-4E3D-9A7C-18F24B6D05E3';

function dnsProfile(iconPngBase64) {
  // Cấu trúc theo chuẩn Apple: Payload Content = ARRAY payload dnsSettings.managed.
  // Split DNS thật qua OnDemandRules: Connect CHỈ cho domain Locket/RevenueCat đi DoH,
  // mọi domain khác Disconnect → DNS gốc của thiết bị (tốc độ 100%).
  const locketDomains = [
    'locketcamera.com',
    'locket.camera',
    'revenuecat.com',
    'rc-backup.com',
    'firebaseremoteconfig.googleapis.com',
  ];
  const dnsPayload = {
    PayloadType: 'com.apple.dnsSettings.managed',
    PayloadVersion: 1,
    PayloadIdentifier: `com.apple.dnsSettings.managed.${DNS_INNER_UUID}`,
    PayloadUUID: DNS_INNER_UUID,
    PayloadDisplayName: 'LocketGold DoH · B1sTeam ✦',
    PayloadDescription: 'DNS này chỉ áp dụng cho domain Locket & RevenueCat (Split DNS qua doh.b1s.id.vn) — chặn thu hồi Gold. Web khác dùng DNS gốc của bạn.',
    PayloadOrganization: CREATOR,
    DNSSettings: {
      DNSProtocol: 'HTTPS',
      ServerURL: 'https://doh.b1s.id.vn/dns-query',
      // ── Split DNS THẬT (iOS 14+): CHỈ query cho các domain dưới đây (và subdomain)
      //    đi qua DoH B1sTeam — mọi domain khác dùng DNS gốc của thiết bị.
      //    Wildcard ngầm: "example.com" khớp cả "foo.example.com" (Apple docs).
      SupplementalMatchDomains: locketDomains,
    },
    ProhibitDisablement: false,
  };

  return {
    PayloadType: 'Configuration',
    PayloadVersion: 1,
    PayloadIdentifier: 'vn.b1s.locketgold.dns',
    PayloadUUID: 'E8B7C2A4-3F1D-4A6E-9C5B-7D2A91F04B63', // giữ cố định → update tại chỗ
    PayloadDisplayName: 'LocketGold DoH · B1sTeam ✦',
    PayloadDescription:
      'DoH dành riêng cho Locket Gold VIP — chỉ truy vấn Locket/RevenueCat ' +
      'đi qua máy chủ B1sTeam, chặn mọi lệnh thu hồi Gold. Mọi web khác giữ nguyên ' +
      'DNS gốc: tốc độ 100% · không log · miễn phí vĩnh viễn · b1s.id.vn/locketgold',
    PayloadOrganization: CREATOR,
    PayloadScope: 'System',
    PayloadRemovalDisallowed: false,
    PayloadIcon: iconPngBase64,
    PayloadContent: [dnsPayload],
  };
}

function webClipProfile(iconPngBase64) {
  return {
    PayloadIdentifier: 'vn.b1s.about.webclip',
    PayloadType: 'Configuration',
    PayloadVersion: 1,
    PayloadUUID: 'F2A91C3E-7B44-4E58-9D1F-3C6A5B0E72D4',
    PayloadDisplayName: 'B1sTeam ✦ Giới thiệu',
    PayloadDescription:
      'Lưu lối tắt tới trang giới thiệu B1sTeam — Nền tảng dịch vụ số Việt Nam: ' +
      'giao tự động 24/7 · bảo hành định danh · hỗ trợ 24/7. Chạm để mở nhanh · b1s.id.vn/about',
    PayloadOrganization: CREATOR,
    PayloadRemovalDisallowed: false,
    PayloadContent: {
      PayloadType: 'com.apple.webClip.create',
      PayloadVersion: 1,
      PayloadIdentifier: 'vn.b1s.about.webclip',
      PayloadUUID: 'B7C42E19-9E25-4B0C-95A1-4D3F8B2E1C77',
      PayloadDisplayName: 'B1sTeam ✦ Giới thiệu',
      PayloadDescription: 'Lối tắt về trang giới thiệu B1sTeam',
      PayloadOrganization: CREATOR,
      FullScreen: false,
      IsRemovable: true,
      Label: 'B1sTeam',
      URL: 'https://b1s.id.vn/about',
      Icon: iconPngBase64,
    },
  };
}

function writeProfile(file, obj) {
  const plist = require('plist');
  const xml = plist.build(obj);
  fs.writeFileSync(file, xml, 'utf8');
  console.log(`✓ profile → ${path.relative(ROOT, file)} (${fs.statSync(file).size} bytes)`);
}

async function main() {
  console.log('— B1sTeam · sinh hồ sơ LocketGold —\n');
  fs.mkdirSync(OUT_IOS, { recursive: true });

  const dohIcon = await rasterize(path.join(ASSETS, 'icon-doh-locketgold.svg'), path.join(ASSETS, 'icon-doh-locketgold-1024.png'), 1024, '#0E3320');
  const crownIcon = await rasterize(path.join(ASSETS, 'icon-locketgold.svg'), path.join(ASSETS, 'icon-locketgold-512.png'), 512, '#08080F');

  const dns = dnsProfile(dohIcon);
  const webClip = webClipProfile(crownIcon);

  if (SIGN_MODE) {
    const keyPath = process.env.PROFILE_KEY_PEM;
    const certPath = process.env.PROFILE_CERT_PEM;
    if (!keyPath || !certPath) {
      console.error('✗ Thiếu PROFILE_KEY_PEM / PROFILE_CERT_PEM — không thể ký.');
      process.exit(1);
    }
    const mobileconfig = require('@zone-eu/mobileconfig');
    const keys = {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
    };
    for (const [file, data] of [
      [path.join(OUT_IOS, 'locketgold.mobileconfig'), dns],
      [path.join(OUT_IOS, 'locketgold-webclip.mobileconfig'), webClip],
    ]) {
      await new Promise((resolve, reject) => {
        mobileconfig.getSignedConfig(data, keys, (err, der) => {
          if (err) return reject(err);
          fs.writeFileSync(file, der);
          console.log(`✓ SIGNED → ${path.relative(ROOT, file)} (${der.length} bytes)`);
          resolve();
        });
      });
    }
  } else {
    writeProfile(path.join(OUT_IOS, 'locketgold.mobileconfig'), dns);
    writeProfile(path.join(OUT_IOS, 'locketgold-webclip.mobileconfig'), webClip);
  }
  console.log('\nXong. Copy sang frontend/public/locketgold/ios/ để deploy.');
}

main().catch((e) => {
  console.error('✗ Lỗi:', e);
  process.exit(1);
});
