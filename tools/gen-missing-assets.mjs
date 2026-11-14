// B1sTeam - Sinh ảnh mẫu (asset) cho sticker/photobooth overlay — thiết kế 100% gốc,
// phong cách kawaii vector, nền TRONG SUỐT ở khu vực giữa để làm AR overlay.
// Chạy: node tools/gen-missing-assets.mjs
// Output: assets/stickers/stk_*.png  (512x512) + assets/frames/*.png (1024x1024)
import sharp from 'file:///D:/gcmo-project/backend/node_modules/sharp/dist/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STICKERS = path.join(ROOT, 'assets', 'stickers');
const FRAMES = path.join(ROOT, 'assets', 'frames');

const C = (cx, cy, r, fill, stroke, sw = 0) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;

const E = (cx, cy, rx, ry, fill, stroke, sw = 0, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''} ${extra}/>`;

const P = (d, fill, stroke, sw = 0, extra = '') =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${
    extra.includes('stroke-linejoin') ? '' : ' stroke-linejoin="round"'
  }${extra.includes('stroke-linecap') ? '' : ' stroke-linecap="round"'}${extra ? ' ' + extra : ''}/>`;

const R = (x, y, w, h, rx, fill, stroke, sw = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;

const L = (x1, y1, x2, y2, stroke, sw = 0) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;

const heart = (cx, cy, s, fill, sw = 0, stroke = '#3d2b00') => {
  const t = s / 31.6;
  return P(
    `M ${cx} ${cy + 11 * t} C ${cx - 22 * t} ${cy - 8 * t}, ${cx - 32 * t} ${cy + 2 * t}, ${cx} ${cy + 31 * t} C ${cx + 32 * t} ${cy + 2 * t}, ${cx + 22 * t} ${cy - 8 * t}, ${cx} ${cy + 11 * t}`,
    fill,
    stroke,
    sw,
  );
};

const star = (cx, cy, s, fill, stroke = '#3d2b00', sw = 0, pts = 5) => {
  const inner = s / 2.6, outer = s;
  let d = '';
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / pts - Math.PI / 2;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    d += (i === 0 ? 'M' : 'L') + ` ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return P(d + ' Z', fill, stroke, sw);
};

const sparkle = (cx, cy, s, fill = '#fff', stroke = '#3d2b00', sw = 0) =>
  P(
    `M ${cx} ${cy - s} Q ${cx + s * 0.18} ${cy - s * 0.18} ${cx + s} ${cy} Q ${cx + s * 0.18} ${cy + s * 0.18} ${cx} ${cy + s} Q ${cx - s * 0.18} ${cy + s * 0.18} ${cx - s} ${cy} Q ${cx - s * 0.18} ${cy - s * 0.18} ${cx} ${cy - s} Z`,
    fill,
    stroke,
    sw,
  );

const flower = (cx, cy, r, fill, centerFill = '#ffd166', stroke = '#3d2b00', sw = 6) => {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    s += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(r * 0.62).toFixed(1)}" ry="${(r * 0.38).toFixed(1)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''} transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
  }
  s += C(cx, cy, r * 0.42, centerFill, stroke, sw);
  return s;
};

const arc = (cx, cy, r, startDeg, sweepDeg, stroke, sw = 8, fill = 'none') => {
  const a0 = (startDeg * Math.PI) / 180, a1 = ((startDeg + sweepDeg) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = sweepDeg > 180 ? 1 : 0;
  return `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
};

const clipText = (x, y, text, fill, stroke, sw, fontSize, fontFamily = 'Arial Black,Arial', weight = 900, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${fontFamily}" font-weight="${weight}" font-size="${fontSize}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" paint-order="stroke fill" text-anchor="middle" ${extra}>${text}</text>`;

// Kawaii face — dùng chung cho sticker, nền trong suốt
function kawaiiFace({ cx = 256, cy = 236, r = 118, fill = '#ffe0bd', stroke = '#3d2b00', sw = 9, eyeMode = 'happy', mouth = 'smile', extra = '' }) {
  const eyeY = cy - r * 0.18;
  const eyeDX = r * 0.42;
  let s = C(cx, cy, r, fill, stroke, sw);
  if (eyeMode === 'happy') {
    s += arc(cx - eyeDX, eyeY, r * 0.14, 180, 180, '#2b1d12', 8) + arc(cx + eyeDX, eyeY, r * 0.14, 180, 180, '#2b1d12', 8);
  } else if (eyeMode === 'open') {
    s += C(cx - eyeDX, eyeY, r * 0.1) + C(cx + eyeDX, eyeY, r * 0.1);
    s += C(cx - eyeDX + 5, eyeY - 5, r * 0.035, '#fff') + C(cx + eyeDX + 5, eyeY - 5, r * 0.035, '#fff');
  } else if (eyeMode === 'wink') {
    s += arc(cx - eyeDX, eyeY + 4, r * 0.13, 0, 180, '#2b1d12', 8) + C(cx + eyeDX, eyeY, r * 0.1);
  } else if (eyeMode === 'x') {
    for (const ex of [-eyeDX, eyeDX]) {
      s += `<path d="M ${cx + ex - 15} ${eyeY - 15} L ${cx + ex + 15} ${eyeY + 15} M ${cx + ex + 15} ${eyeY - 15} L ${cx + ex - 15} ${eyeY + 15}" stroke="#2b1d12" stroke-width="8" stroke-linecap="round"/>`;
    }
  } else if (eyeMode === 'sleepy') {
    s += arc(cx - eyeDX, eyeY + 4, r * 0.13, 0, 180, '#2b1d12', 8) + arc(cx + eyeDX, eyeY + 4, r * 0.13, 0, 180, '#2b1d12', 8);
  } else if (eyeMode === 'flat') {
    s += L(cx - eyeDX - 14, eyeY, cx - eyeDX + 14, eyeY, '#2b1d12', 8) + L(cx + eyeDX - 14, eyeY, cx + eyeDX + 14, eyeY, '#2b1d12', 8);
  }
  const mouthY = cy + r * 0.4;
  if (mouth === 'smile') s += arc(cx, mouthY - r * 0.14, r * 0.42, 20, 140, '#2b1d12', 8);
  else if (mouth === 'open') s += `<path d="M ${cx - 24} ${mouthY - 4} Q ${cx} ${mouthY + 32} ${cx + 24} ${mouthY - 4} Q ${cx} ${mouthY + 10} ${cx - 24} ${mouthY - 4} Z" fill="#5a2b2b" stroke="#2b1d12" stroke-width="6" stroke-linejoin="round"/>`;
  else if (mouth === 'flat') s += L(cx - 28, mouthY, cx + 28, mouthY, '#2b1d12', 7);
  else if (mouth === 'cat') {
    s += arc(cx, mouthY - 16, r * 0.2, 20, 140, '#2b1d12', 7);
    s += P(`M ${cx} ${mouthY - 18} L ${cx} ${mouthY - 2} M ${cx - 22} ${mouthY - 24} Q ${cx - 11} ${mouthY - 10} ${cx} ${mouthY - 2} M ${cx + 22} ${mouthY - 24} Q ${cx + 11} ${mouthY - 10} ${cx} ${mouthY - 2}`, 'none', '#2b1d12', 6, 'stroke-linejoin="round"');
  }
  s += E(cx - r * 0.56, cy + r * 0.28, r * 0.12, r * 0.07, '#ffb3ab') + E(cx + r * 0.56, cy + r * 0.28, r * 0.12, r * 0.07, '#ffb3ab');
  return s + extra;
}

const sticker = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${inner}</svg>`;

const frame = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg>`;

const linG = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<defs><linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient></defs>`;

const radG = (id, stops, cx = 0.5, cy = 0.42, r = 0.75) =>
  `<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</radialGradient></defs>`;

const roundRect = (x, y, w, h, rx, ry = rx) =>
  `M ${x + rx} ${y} H ${x + w - rx} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry} A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H ${x + rx} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} V ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;

/** Khung viền (donut-style): lớp nền full, lỗ giữa trong suốt */
const ring = (o, i, paint, stroke, sw, extraStroke = '') =>
  `<path fill-rule="evenodd" d="${roundRect(o.x, o.y, o.w, o.h, o.rx, o.ry)} ${roundRect(i.x, i.y, i.w, i.h, i.rx, i.ry)}" fill="${paint}" stroke="${stroke}" stroke-width="${sw}" ${extraStroke}/>`;

async function writePng(svg, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  return sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toFile(dest);
}

// ============================================================
// FRAMES (1024x1024, phần giữa TRONG SUỐT)
// ============================================================
const O1 = { x: 24, y: 24, w: 976, h: 976, rx: 180, ry: 180 };      // outer chuẩn
const I1 = { x: 148, y: 148, w: 728, h: 728, rx: 105, ry: 105 };    // hole chuẩn
const S1 = { x: 84, y: 84, w: 856, h: 856, rx: 130, ry: 130 };      // slim ring outer
const I2 = { x: 162, y: 162, w: 700, h: 700, rx: 92, ry: 92 };      // tighter hole

const frames = [];
const addFrame = (name, inner) => frames.push({ name, svg: frame(inner) });

// 1) cmt_locket — huy hiệu locket vàng (mặt locket + sao)
addFrame(
  'cmt_locket',
  `${linG('goldgrad', [[0, '#FFE888'], [0.5, '#F2C94C'], [1, '#D9A03C']], 0, 0, 0, 1)}
   <path fill-rule="evenodd" d="M512 48 L808 190 V436 C808 676 668 838 512 900 C356 838 216 676 216 436 V190 Z M512 160 L722 268 V430 C722 634 622 762 512 814 C402 762 302 634 302 430 V268 Z" fill="url(#goldgrad)" stroke="#3d2b00" stroke-width="20" stroke-linejoin="round"/>
   ${star(512, 464, 84, '#F2C94C', '#3d2b00', 10, 5)}
   ${sparkle(300, 512, 22, '#FFF3C4')}${sparkle(724, 512, 22, '#FFF3C4')}${sparkle(512, 220, 18, '#FFF3C4')}${sparkle(512, 712, 18, '#FFF3C4')}`,
);

// 2) photobooth_4cut — film strip 4 ô
addFrame(
  'photobooth_4cut',
  `${R(36, 26, 952, 972, 54, '#23232b', '#0c0c10', 16)}
   ${[74, 290, 506, 722].map((y) => R(92, y, 840, 164, 16, 'none', '#fbf7ee', 7)).join('')}
   ${[150, 366, 582, 806].map((y) =>
     [[128, y], [892, y]].map(([x, yy]) => `<rect x="${x - 14}" y="${yy - 12}" width="28" height="24" rx="5" fill="none" stroke="#fbf7ee" stroke-width="5"/>`).join(''),
   ).join('')}
   ${clipText(512, 244, 'PHOTOBOOTH', '#fbf7ee', '#0c0c10', 3, 52)}
   ${clipText(512, 982, 'B1STEAM', '#8a8296', '#23232b', 0, 22, 'Courier New,monospace', 700)}`,
);

// 3) photobooth_cute — photobooth hồng dễ thương
addFrame(
  'photobooth_cute',
  `${linG('pct', [[0, '#ffd1e0'], [1, '#ff8fb3']], 0, 0, 0, 1)}
   ${ring(O1, { x: 138, y: 138, w: 748, h: 748, rx: 100, ry: 100 }, 'url(#pct)', '#3d2b00', 16)}
   ${heart(252, 84, 40, '#ff5d8f', 7)}${heart(776, 84, 30, '#ff8fb3', 7)}
   ${star(258, 946, 24, '#fff3a0', '#3d2b00', 6)}${star(772, 946, 20, '#fff3a0', '#3d2b00', 6)}
   ${clipText(512, 92, 'PHOTO BOOTH', '#a3133f', '#ffd1e0', 4, 34, 'Georgia,serif', 700)}
   ${clipText(512, 978, 'B1STEAM', '#a3133f', '#ffd1e0', 0, 18, 'Georgia,serif', 700)}`,
);

// 4) photoboot — khung film tối
addFrame(
  'photoboot',
  `${linG('pbt', [[0, '#16161f'], [1, '#05050a']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#pbt)', '#000', 18)}
   ${clipText(512, 96, 'PHOTOBOOTH', '#fbf7ee', '#05050a', 2, 30)}
   ${[[170, 140], [854, 140], [170, 884], [854, 884]].map(([x, y]) => sparkle(x, y, 18, '#fbf7ee')).join('')}
   ${clipText(512, 978, 'B1STEAM', '#6f6f80', '#16161f', 0, 18, 'Courier New,monospace', 700)}`,
);

// 5) khung_anh_o_kitty_v_sao — khung hồng Bow/Star
addFrame(
  'khung_anh_o_kitty_v_sao',
  `${linG('kit', [[0, '#ffe3ec'], [1, '#ffb6cf']], 0, 0, 1, 1)}
   ${ring(O1, I1, 'url(#kit)', '#3d2b00', 15)}
   ${heart(512, 84, 34, '#ff5d8f', 6)}
   ${star(150, 112, 18, '#fff3a0', '#3d2b00', 5)}${star(874, 112, 18, '#fff3a0', '#3d2b00', 5)}
   ${star(150, 912, 18, '#fff3a0', '#3d2b00', 5)}${star(874, 912, 18, '#fff3a0', '#3d2b00', 5)}
   ${clipText(512, 84, 'LOVELY', '#c2185b', '#ffe3ec', 0, 30, 'Georgia,serif', 700)}`,
);

// 6) khung_hello_kitty_h_ng_pastel — khung hồng nóng (hoa)
addFrame(
  'khung_hello_kitty_h_ng_pastel',
  `${linG('hhp', [[0, '#ff9ec4'], [1, '#ff6fa5']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#hhp)', '#3d2b00', 17)}
   ${[[110, 110], [914, 110], [110, 914], [914, 914]].map(([x, y]) => flower(x, y, 36, '#fff', '#ffd166', '#3d2b00', 6)).join('')}
   ${clipText(512, 90, 'KITTY', '#701f3a', '#ff9ec4', 0, 40, 'Georgia,serif', 700)}`,
);

// 7) khung_hello_kitty_pastel_ng_t_ng_o — khung mint tim
addFrame(
  'khung_hello_kitty_pastel_ng_t_ng_o',
  `${linG('mtt', [[0, '#d4f5e2'], [1, '#8fdcb0']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#mtt)', '#3d2b00', 15)}
   ${heart(512, 80, 32, '#ff8fb3', 6)}${heart(512, 944, 32, '#ff8fb3', 6)}
   ${[120, 904].map((x) => heart(x, 512, 28, '#ffb3d1', 6)).join('')}
   ${clipText(512, 86, 'MINT', '#1e5a3a', '#d4f5e2', 0, 28, 'Georgia,serif', 700)}`,
);

// 8) khung_kh_ng_gian_xanh_pastel — khung không gian
addFrame(
  'khung_kh_ng_gian_xanh_pastel',
  `${radG('sp', [[0, '#3a4a8f'], [0.6, '#1c2450'], [1, '#0a0c24']], 0.5, 0.42, 0.78)}
   ${ring(O1, I1, 'url(#sp)', '#a8c6ff', 12)}
   ${C(262, 200, 26, '#ffd8a8', '#3d2b00', 5)}
   ${[[180, 170], [360, 150], [700, 150], [860, 240], [140, 380], [880, 420]].map(([x, y]) => sparkle(x, y, 10, '#fff')).join('')}
   ${star(512, 96, 20, '#cfe0ff', '#a8c6ff', 4)}
   ${clipText(512, 84, 'SPACE', '#cfe0ff', '#1c2450', 0, 34, 'Courier New,monospace', 700)}`,
);

// 9) khung_nh_hoa_pastel_vi_n_xanh_m_nh — khung hoa oải hương
addFrame(
  'khung_nh_hoa_pastel_vi_n_xanh_m_nh',
  `${linG('bflower', [[0, '#f3e2ff'], [1, '#d9b8f0']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#bflower)', '#3d2b00', 15)}
   ${flower(200, 118, 38, '#ffb3d1', '#fff3a0', '#3d2b00', 6)}${flower(824, 118, 38, '#c5f0d0', '#ffd166', '#3d2b00', 6)}
   ${flower(200, 906, 38, '#c5f0d0', '#ff8fb3', '#3d2b00', 6)}${flower(824, 906, 38, '#ffb3d1', '#fff3a0', '#3d2b00', 6)}
   ${flower(512, 84, 44, '#ffd6a5', '#ff8fb3', '#3d2b00', 6)}
   ${clipText(512, 105, 'BLOOM', '#5a2b7a', '#f3e2ff', 0, 28, 'Georgia,serif', 700)}`,
);

// 10) khung_nh_n_pastel_vi_n_ren — khung ren kem
addFrame(
  'khung_nh_n_pastel_vi_n_ren',
  `<path fill-rule="evenodd" d="${roundRect(36, 36, 952, 952, 160)} ${roundRect(150, 150, 724, 724, 90)}" fill="#fdf6ec" stroke="#3d2b00" stroke-width="16" stroke-linejoin="round"/>
   ${Array.from({ length: 12 }, (_, i) => {
     const a = (Math.PI * 2 * i) / 12;
     const x = 512 + 330 * Math.cos(a), y = 512 + 330 * Math.sin(a);
     return C(x, y, 26, '#fdeef4', '#3d2b00', 5);
   }).join('')}
   ${clipText(512, 92, 'LACE', '#8a5a2b', '#fdf6ec', 0, 32, 'Georgia,serif', 700)}`,
);

// 11) khung_nh_pastel_vi_n_s_h_i_c_u — viền sóng biển
addFrame(
  'khung_nh_pastel_vi_n_s_h_i_c_u',
  `${linG('sea', [[0, '#fff1d6'], [1, '#f5cfa9']], 0, 0, 0, 1)}
   ${ring(O1, { x: 162, y: 162, w: 700, h: 700, rx: 85, ry: 85 }, 'url(#sea)', '#3d2b00', 15)}
   ${Array.from({ length: 6 }, (_, i) =>
     arc(60 + 84 + i * 156, 64, 48, 0, 180, '#e88a3a', 12),
   ).join('')}
   ${Array.from({ length: 6 }, (_, i) =>
     arc(60 + 84 + i * 156, 960, 48, 180, 180, '#e88a3a', 12),
   ).join('')}
   ${clipText(512, 92, 'SEASHELL', '#8a4a12', '#fff1d6', 0, 26, 'Georgia,serif', 700)}`,
);

// 12) khung_nh_shin_chan_vi_n_m_nh — mặt trời vàng
addFrame(
  'khung_nh_shin_chan_vi_n_m_nh',
  `${linG('shin', [[0, '#ffe86b'], [1, '#ffc93a']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#shin)', '#3d2b00', 17)}
   ${[[110, 110], [914, 110], [110, 914], [914, 914]].map(([x, y]) => C(x, y, 40, '#ff8fb3', '#3d2b00', 7)).join('')}
   ${clipText(512, 90, 'WOW!', '#c2202f', '#ffe86b', 0, 52)}`,
);

// 13) khung_nh_vu_ng_m_ng_nh_n_b_c — bạc ánh kim
addFrame(
  'khung_nh_vu_ng_m_ng_nh_n_b_c',
  `${linG('silv', [[0, '#ffffff'], [0.35, '#c8ccd4'], [0.55, '#f4f6fa'], [0.75, '#8f95a3'], [1, '#e9ecf1']], 0, 0, 0, 1)}
   ${ring(O1, I2, 'url(#silv)', '#20242c', 19)}
   ${clipText(512, 92, 'SILVER', '#20242c', '#ffffff', 0, 34, 'Georgia,serif', 700)}`,
);

// 14) khung_vu_ng_ng_i_sao_h_ng_pastel — sao hồng pastel
addFrame(
  'khung_vu_ng_ng_i_sao_h_ng_pastel',
  `${linG('str', [[0, '#ffd6e7'], [1, '#ff9ec4']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#str)', '#3d2b00', 15)}
   ${[[120, 108], [904, 108], [120, 916], [904, 916]].map(([x, y]) => star(x, y, 26, '#fff3a0', '#3d2b00', 6)).join('')}
   ${clipText(512, 88, 'STAR', '#a3133f', '#ffd6e7', 0, 32, 'Georgia,serif', 700)}`,
);

// 15) khung_xanh_v_tay_sao_v_ng — teal sao vàng
addFrame(
  'khung_xanh_v_tay_sao_v_ng',
  `${linG('teal', [[0, '#5fd4c2'], [1, '#1d8a7a']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#teal)', '#0d3d34', 17)}
   ${[[120, 112], [904, 112], [120, 912], [904, 912]].map(([x, y]) => star(x, y, 26, '#ffe86b', '#0d3d34', 6)).join('')}
   ${clipText(512, 92, 'TEAL', '#e8fff7', '#1d8a7a', 0, 34, 'Georgia,serif', 700)}`,
);

// 16) pb_denim_ripped_2x2 — denim 2x2
addFrame(
  'pb_denim_ripped_2x2',
  `<defs><pattern id="denim" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#3a5a8c"/><rect width="60" height="30" fill="#44649a"/><path d="M0 30 L60 30 M30 0 L30 60" stroke="#2b4568" stroke-width="8"/></pattern></defs>
   ${R(40, 40, 944, 944, 120, 'url(#denim)', '#1b2a42', 22)}
   ${R(110, 110, 804, 360, 22, 'none', '#f4ead9', 12)}
   ${R(110, 552, 804, 360, 22, 'none', '#f4ead9', 12)}
   ${[[114, 112], [906, 112], [114, 906], [906, 906]].map(([x, y]) => C(x, y, 22, '#e8b64c', '#1b2a42', 8)).join('')}
   ${clipText(512, 94, 'DENIM 2x2', '#f4ead9', '#44649a', 0, 26, 'Courier New,monospace', 700)}`,
);

// 17) pb_galaxy — khung galaxy
addFrame(
  'pb_galaxy',
  `${radG('gal', [[0, '#b84df0'], [0.45, '#5a2a9e'], [1, '#14092e']], 0.5, 0.45, 0.78)}
   ${ring(O1, I1, 'url(#gal)', '#d98cff', 13)}
   ${[[210, 190], [420, 158], [690, 210], [840, 320], [180, 430], [840, 560], [230, 800], [620, 830]].map(([x, y]) => sparkle(x, y, 9, '#ffb3ff')).join('')}
   ${clipText(512, 90, 'GALAXY', '#ffd9ff', '#5a2a9e', 0, 34, 'Courier New,monospace', 700)}`,
);

// 18) pb_holo_4cut — film holo Y2K 4 ô
addFrame(
  'pb_holo_4cut',
  `${linG('holo', [[0, '#a4f0ff'], [0.2, '#ffd0f0'], [0.4, '#fff7a8'], [0.6, '#a4ffc8'], [0.8, '#c8b4ff'], [1, '#ffb3d9']], 0, 0, 1, 1)}
   ${R(36, 26, 952, 972, 60, '#23232b', '#0c0c10', 16)}
   ${[74, 290, 506, 722].map((y) => R(96, y, 832, 162, 18, 'url(#holo)', '#0c0c10', 6)).join('')}
   ${[150, 366, 582, 806].map((y) =>
     [[128, y], [888, y]].map(([x, yy]) => `<rect x="${x - 14}" y="${yy - 12}" width="28" height="24" rx="5" fill="none" stroke="#fbf7ee" stroke-width="4" opacity="0.9"/>`).join(''),
   ).join('')}
   ${clipText(512, 244, 'Y2K HOLO', '#0c0c10', '#ffd0f0', 3, 44)}`,
);

// 19) pb_ripped_paper_4cut — giấy rách 4 ô
addFrame(
  'pb_ripped_paper_4cut',
  `${ring(O1, I1, '#f2e7d5', '#5a4632', 15)}
   ${[74, 290, 506, 722].map((y, i) =>
     R(100 + (i % 2 === 0 ? 18 : -16), y + 8, 824, 172, 8, 'none', '#5a4632', 6, ),
   ).join('')}
   ${clipText(512, 92, 'torn paper', '#5a4632', '#f2e7d5', 0, 38, 'Georgia,serif', 700)}`,
);

// 20) pb_scrapbook_ripped_4cut — scrapbook
addFrame(
  'pb_scrapbook_ripped_4cut',
  `${ring(O1, I1, '#e8d9be', '#3d2b00', 15)}
   ${[74, 290, 506, 722].map((y) => R(96, y, 832, 164, 8, 'none', '#3d2b00', 6)).join('')}
   <g transform="rotate(-10 118 108)">${R(32, 74, 150, 54, 6, '#ffd166', '#3d2b00', 6)}</g>
   <g transform="rotate(9 906 900)">${R(826, 866, 150, 54, 6, '#ffd166', '#3d2b00', 6)}</g>
   <g transform="rotate(-7 900 120)">${R(820, 90, 140, 54, 6, '#ff9ec4', '#3d2b00', 6)}</g>
   ${clipText(512, 92, 'MEMORIES', '#3d2b00', '#e8d9be', 0, 40, 'Georgia,serif', 700)}`,
);

// 21) pb_single_denim_ripped — denim single
addFrame(
  'pb_single_denim_ripped',
  `${ring(S1, I2, 'url(#denim2x2)', '#1b2a42', 18)}
   <defs><pattern id="denim2x2" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#44649a"/><path d="M0 24 L48 24 M24 0 L24 48" stroke="#2b4568" stroke-width="7"/></pattern></defs>
   ${[[168, 168], [856, 856]].map(([x, y]) => C(x, y, 22, '#e8b64c', '#1b2a42', 7)).join('')}
   ${clipText(512, 98, 'DENIM', '#f4ead9', '#44649a', 0, 32, 'Courier New,monospace', 700)}`,
);

// 22) pb_single_film_nostalgia — film cổ
addFrame(
  'pb_single_film_nostalgia',
  `${R(40, 120, 944, 784, 60, '#3a2b1c', '#1a110a', 19)}
   ${R(128, 232, 768, 560, 26, 'none', '#e8d9a8', 9)}
   ${[70, 133, 196, 259, 322, 385].map((y) =>
     [[64, y], [932, y]].map(([x, yy]) => `<rect x="${x - 12}" y="${yy - 10}" width="24" height="20" rx="4" fill="#1a110a" stroke="#e8d9a8" stroke-width="4"/>`).join(''),
   ).join('')}
   ${clipText(512, 178, 'NOSTALGIA', '#e8d9a8', '#1a110a', 0, 28, 'Courier New,monospace', 700)}`,
);

// 23) pb_single_y2k_silver_holo — Y2K silver holo single
addFrame(
  'pb_single_y2k_silver_holo',
  `${linG('y2k', [[0, '#eaf6ff'], [0.3, '#c9d7ea'], [0.48, '#ffffff'], [0.66, '#b7c2d6'], [0.84, '#f4f9ff'], [1, '#a8b3c8']], 0, 0, 1, 1)}
   ${ring(S1, { x: 150, y: 110, w: 724, h: 804, rx: 70, ry: 70 }, 'url(#y2k)', '#2a3242', 18)}
   ${[[196, 116], [828, 116], [196, 908], [828, 908]].map(([x, y]) => sparkle(x, y, 18, '#fff')).join('')}
   ${clipText(512, 128, 'Y2K', '#2a3242', '#eaf6ff', 0, 40)}`,
);

// 24) pb_strawberry — dâu
addFrame(
  'pb_strawberry',
  `${linG('strb', [[0, '#ff8fa8'], [1, '#e33d5f']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#strb)', '#5a0e1f', 17)}
   ${[[130, 110], [894, 110], [130, 914], [894, 914]].map(([x, y]) => `<g transform="translate(${x} ${y})">${P('M 0 -26 C 48 -26, 56 12, 0 44 C -56 12, -48 -26, 0 -26 Z', '#ff5d7a', '#5a0e1f', 6)}${[[-14, -4], [0, -14], [14, -4]].map(([dx, dy]) => sparkle(dx, dy, 5, '#ffe9a8')).join('')}</g>`).join('')}
   ${clipText(512, 88, 'BERRY', '#fff', '#e33d5f', 0, 34, 'Georgia,serif', 700)}`,
);

// 25) pb_vintage — dark vintage
addFrame(
  'pb_vintage',
  `${linG('vin', [[0, '#5a4632'], [1, '#2c211a']], 0, 0, 0, 1)}
   ${ring(O1, I1, 'url(#vin)', '#100a06', 19)}
   ${flower(140, 130, 28, '#c9a86a', '#8a6a3a', '#100a06', 5)}${flower(884, 130, 28, '#c9a86a', '#8a6a3a', '#100a06', 5)}
   ${flower(140, 894, 28, '#c9a86a', '#8a6a3a', '#100a06', 5)}${flower(884, 894, 28, '#c9a86a', '#8a6a3a', '#100a06', 5)}
   ${clipText(512, 92, 'VINTAGE', '#e8d9a8', '#2c211a', 0, 36, 'Georgia,serif', 700)}`,
);

// 26) sticker_b_nh_lu_n_minh_tu — băng rôn
addFrame(
  'sticker_b_nh_lu_n_minh_tu',
  `${linG('ban', [[0, '#ffe86b'], [1, '#ffb703']], 0, 0, 0, 1)}
   <path fill-rule="evenodd" d="M 64 300 L 180 240 L 180 940 L 64 880 Z M 64 330 L 120 306 L 120 910 L 64 850 Z M 964 300 L 844 240 L 844 940 L 964 880 Z M 964 330 L 908 306 L 908 910 L 964 850 Z" fill="url(#ban)" stroke="#3d2b00" stroke-width="11" stroke-linejoin="round"/>
   ${ring({ x: 130, y: 240, w: 764, h: 540, rx: 80, ry: 80 }, { x: 190, y: 310, w: 644, h: 400, rx: 55, ry: 55 }, '#ff8fb3', '#3d2b00', 11)}
   ${heart(512, 256, 40, '#ff3d68', 8)}
   ${clipText(512, 560, 'MINH TU', '#fff', '#3d2b00', 6, 64)}
   ${sparkle(210, 700, 16)}${sparkle(814, 700, 16)}`,
);

// 27) sinh_nh_t_hello_kitty_ho_i_c — sinh nhật
addFrame(
  'sinh_nh_t_hello_kitty_ho_i_c',
  `${radG('bday', [[0, '#ffe0ec'], [1, '#ff9ec4']], 0.5, 0.42, 0.78)}
   ${ring(O1, I1, 'url(#bday)', '#3d2b00', 16)}
   ${[[150, 130, 14], [874, 130, 14], [150, 894, 14], [874, 894, 14]].map(([x, y, s]) => `<g transform="translate(${x} ${y})">${star(0, 0, s, '#ffe86b', '#3d2b00', 5)}</g>`).join('')}
   <g transform="translate(512 108)">
     ${R(-110, 0, 220, 48, 12, '#ffd166', '#3d2b00', 7)}
     ${R(-80, -34, 160, 42, 10, '#ff8fb3', '#3d2b00', 7)}
     ${[-52, 0, 52].map((x) => `<line x1="${x}" y1="-34" x2="${x}" y2="-64" stroke="#3d2b00" stroke-width="8" stroke-linecap="round"/>`).join('')}
     ${star(-52, -74, 10, '#fff')}${star(0, -82, 12, '#fff')}${star(52, -74, 10, '#fff')}
   </g>
   ${clipText(512, 86, 'BIRTHDAY', '#a3133f', '#ffe0ec', 0, 34, 'Georgia,serif', 700)}`,
);

// ============================================================
// STICKERS
// ============================================================
const stickers = [];
const addSticker = (name, inner) => stickers.push({ name, svg: sticker(inner) });

addSticker('stk_cute_zombie', kawaiiFace({ fill: '#a9e5a0', eyeMode: 'x', mouth: 'flat',
  extra: `${P('M150 150 L214 112 M332 132 L382 92', 'none', '#3d2b00', 9, 'stroke-linecap="round"')}${R(160, 300, 190, 30, 12, '#83c47c', '#3d2b00', 6)}${sparkle(392, 152, 12)}` }));
addSticker('stk_dio_bearded', kawaiiFace({ eyeMode: 'open', mouth: 'flat',
  extra: `${E(256, 328, 112, 58, '#6b4a2a', '#3d2b00', 8)}${E(208, 300, 17, 9, '#6b4a2a')}${E(304, 300, 17, 9, '#6b4a2a')}` }));
addSticker('stk_dio_bleached_hair', kawaiiFace({ eyeMode: 'open', mouth: 'smile',
  extra: P('M146 196 C 174 96, 348 92, 380 196 C 330 148, 300 172, 256 158 C 212 172, 180 150, 146 196 Z', '#f5d76e', '#3d2b00', 8) }));
addSticker('stk_dio_bob', kawaiiFace({ eyeMode: 'open', mouth: 'cat',
  extra: P('M136 246 C 126 104, 392 104, 382 246 C 336 188, 300 200, 256 190 C 210 200, 180 190, 136 246 Z', '#2f2430', '#3d2b00', 8) }));
addSticker('stk_dio_bowling_ball', `${C(256, 256, 150, '#4a3a5e', '#3d2b00', 10)}${C(216, 236, 19, '#241a30')}${C(256, 216, 19, '#241a30')}${C(296, 236, 19, '#241a30')}${sparkle(190, 190, 10)}`);
addSticker('stk_dio_braces', kawaiiFace({ eyeMode: 'open', mouth: 'open',
  extra: `${R(202, 282, 108, 32, 9, '#fdfdfd', '#3d2b00', 6)}${[230, 256, 282].map((x) => L(x, 284, x, 312, '#3d2b00', 5)).join('')}` }));
addSticker('stk_dio_buns', kawaiiFace({ eyeMode: 'open', mouth: 'smile',
  extra: `${C(138, 128, 54, '#3d2b00')}${C(374, 128, 54, '#3d2b00')}${C(138, 128, 26, '#5a4632')}${C(374, 128, 26, '#5a4632')}` }));
addSticker('stk_dio_bye_brows', kawaiiFace({ eyeMode: 'wink', mouth: 'flat',
  extra: `${P('M152 176 L224 160 M288 158 L360 170', 'none', '#3d2b00', 10, 'stroke-linecap="round"')}` }));
addSticker('stk_dio_cash', `${E(256, 316, 150, 126, '#5aa64e', '#3d2b00', 10)}${P('M150 258 L116 176 L206 222 Z', '#5aa64e', '#3d2b00', 9)}${P('M362 258 L396 176 L306 222 Z', '#5aa64e', '#3d2b00', 9)}${E(256, 328, 82, 62, '#6fc160', '#3d2b00', 7)}${clipText(256, 350, '$', '#f4ffe0', '#1e4a18', 3, 76)}`);
addSticker('stk_dio_clown', kawaiiFace({ fill: '#fff2f2', eyeMode: 'open', mouth: 'open',
  extra: `${C(256, 214, 32, '#ff3d3d', '#3d2b00', 6)}${P('M124 296 C 128 208, 208 176, 256 216 C 304 178, 396 210, 400 296', '#ff6fa5', '#3d2b00', 7)}` }));
addSticker('stk_dio_cowboy', kawaiiFace({ eyeMode: 'open', mouth: 'cat',
  extra: `${P('M96 162 C 118 92, 394 92, 416 162 L 356 192 C 340 162, 172 162, 156 192 Z', '#8a5a2b', '#3d2b00', 8)}${R(96, 152, 320, 28, 10, '#6b4220', '#3d2b00', 7)}` }));
addSticker('stk_dio_cutesy', kawaiiFace({ eyeMode: 'open', mouth: 'smile' }));
addSticker('stk_dio_disco', `${R(182, 60, 148, 58, 8, '#8f95a3', '#3d2b00', 6)}${C(256, 258, 136, '#c8ccd4', '#3d2b00', 10)}${Array.from({ length: 10 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 10;
  return sparkle(256 + 122 * Math.cos(a), 258 + 122 * Math.sin(a), 11, '#fff');
}).join('')}${C(256, 258, 40, '#8f95a3', '#3d2b00', 6)}`);
addSticker('stk_dio_easter_bunny', kawaiiFace({ fill: '#fdf1f5', eyeMode: 'open', mouth: 'cat',
  extra: `${E(200, 84, 38, 96, '#fdf1f5', '#3d2b00', 8)}${E(312, 84, 38, 96, '#fdf1f5', '#3d2b00', 8)}${E(200, 98, 17, 56, '#ffb3d1')}${E(312, 98, 17, 56, '#ffb3d1')}` }));
addSticker('stk_dio_easter_chick', `${C(256, 276, 120, '#ffe86b', '#3d2b00', 10)}${L(256, 178, 256, 122, '#3d2b00', 9)}${star(256, 108, 19, '#ff8fb3', '#3d2b00', 5)}${C(216, 264, 12)}${C(296, 264, 12)}${P('M236 302 L256 320 L276 302 Z', '#ff9a3d', '#3d2b00', 5)}`);
addSticker('stk_dio_elf', kawaiiFace({ eyeMode: 'open', mouth: 'open',
  extra: `${P('M116 178 L256 40 L396 178 L330 178 L256 128 L182 178 Z', '#3f9e56', '#3d2b00', 8)}${C(256, 34, 20, '#ffd166', '#3d2b00', 6)}` }));
addSticker('stk_dio_flower_crown', kawaiiFace({ eyeMode: 'open', mouth: 'smile',
  extra: `${flower(160, 152, 24, '#ff8fb3', '#ffd166', '#3d2b00', 5)}${flower(230, 118, 28, '#fff3a0', '#ffb3d1', '#3d2b00', 5)}${flower(302, 118, 28, '#c5f0d0', '#ff8fb3', '#3d2b00', 5)}${flower(372, 152, 24, '#ffd6a5', '#ff8fb3', '#3d2b00', 5)}` }));
addSticker('stk_dio_frosty', `${C(256, 282, 130, '#fdfeff', '#3d2b00', 10)}${C(216, 264, 12)}${C(296, 264, 12)}${P('M244 300 L256 324 L268 300 Z', '#ff9a3d', '#3d2b00', 5)}${[-48, 48].map((d) => sparkle(256 + d, 350, 8)).join('')}${sparkle(256, 376, 10)}`);
addSticker('stk_dio_giraffe', `${E(256, 300, 116, 130, '#f5cf7a', '#3d2b00', 10)}${[[200, 236, 17], [312, 236, 13], [236, 320, 15], [292, 312, 10]].map(([x, y, r]) => C(x, y, r, '#a8763a', '#3d2b00', 4)).join('')}${C(196, 176, 13, '#f5cf7a', '#3d2b00', 6)}${C(316, 176, 13, '#f5cf7a', '#3d2b00', 6)}${C(196, 156, 12, '#3d2b00')}${C(316, 156, 12, '#3d2b00')}${C(216, 288, 12)}${C(296, 288, 12)}`);
addSticker('stk_dio_happy_birthday', kawaiiFace({ eyeMode: 'x', mouth: 'open',
  extra: `${P('M152 380 L360 380 L342 452 L170 452 Z', '#ff8fb3', '#3d2b00', 8)}${[202, 256, 310].map((x) => `<line x1="${x}" y1="380" x2="${x}" y2="344" stroke="#3d2b00" stroke-width="8" stroke-linecap="round"/>`).join('')}${[202, 256, 310].map((x, i) => star(x, 332 + (i === 1 ? -6 : 0), 10, '#fff')).join('')}` }));
addSticker('stk_dio_influencer', kawaiiFace({ eyeMode: 'flat', mouth: 'smile',
  extra: `${R(146, 178, 220, 44, 20, '#2b2b33', '#3d2b00', 7)}${L(170, 178, 170, 136, '#3d2b00', 11)}${L(342, 178, 342, 136, '#3d2b00', 11)}${sparkle(256, 146, 12, '#fff')}` }));
addSticker('stk_dio_leprechaun', kawaiiFace({ eyeMode: 'wink', mouth: 'open',
  extra: `${P('M150 158 C 170 84, 342 84, 362 158 Z', '#2f7a3f', '#3d2b00', 8)}${R(150, 148, 212, 28, 7, '#ffd166', '#3d2b00', 6)}${C(256, 84, 17, '#ffd166', '#3d2b00', 6)}` }));
addSticker('stk_dio_looksmaxing', `${C(256, 244, 126, '#ffe0bd', '#3d2b00', 10)}${C(212, 230, 13)}${C(300, 230, 13)}${arc(256, 262, 44, 20, 140, '#2b1d12', 9)}${P('M128 386 C 110 300, 178 268, 236 304 C 192 330, 168 362, 190 424 C 140 426, 118 406, 128 386 Z', '#ffe0bd', '#3d2b00', 9)}`);
addSticker('stk_dio_love_bug', `${heart(256, 248, 130, '#ff5d7a', 9)}${C(206, 246, 14)}${C(306, 246, 14)}${arc(256, 268, 34, 20, 140, '#2b1d12', 8)}`);
addSticker('stk_dio_lucky_face', kawaiiFace({ eyeMode: 'wink', mouth: 'open',
  extra: `${P('M330 386 L366 342 L402 386 L370 386 Z', '#3f9e56', '#3d2b00', 7)}${C(346, 374, 6, '#1e4a18')}${C(366, 366, 6, '#1e4a18')}${C(386, 374, 6, '#1e4a18')}` }));
addSticker('stk_dio_mohawk', kawaiiFace({ eyeMode: 'open', mouth: 'flat',
  extra: P('M224 128 L224 32 L264 58 L284 22 L304 58 L344 32 L344 128 Z', '#ff6fa5', '#3d2b00', 8) }));
addSticker('stk_dio_orange_wig', kawaiiFace({ eyeMode: 'open', mouth: 'smile',
  extra: P('M118 226 C 118 96, 394 96, 394 226 C 356 150, 316 162, 256 152 C 196 162, 156 152, 118 226 Z', '#ff8a3d', '#3d2b00', 8) }));
addSticker('stk_dio_pm2', kawaiiFace({ eyeMode: 'open', mouth: 'flat',
  extra: `${R(146, 268, 220, 80, 38, '#4a7a8c', '#3d2b00', 8)}${[186, 233, 280, 327].map((x) => L(x, 276, x, 340, '#2b4654', 7)).join('')}` }));
addSticker('stk_dio_princess', kawaiiFace({ eyeMode: 'open', mouth: 'cat',
  extra: `${P('M150 170 L214 62 L256 140 L298 62 L362 170 Z', '#ffd166', '#3d2b00', 8)}${[210, 256, 302].map((x) => C(x, 152, 9, '#ff8fb3', '#3d2b00', 4)).join('')}` }));
addSticker('stk_dio_santa', kawaiiFace({ eyeMode: 'happy', mouth: 'smile',
  extra: `${P('M116 176 C 150 64, 362 64, 396 176 C 330 134, 300 156, 256 142 C 212 156, 182 140, 116 176 Z', '#d63a3a', '#3d2b00', 8)}${E(398, 178, 24, 24, '#fdfdfd', '#3d2b00', 6)}${P('M168 320 C 200 396, 312 396, 344 320', 'none', '#fdfdfd', 24, 'stroke-linecap="round"')}` }));
addSticker('stk_dio_slimed', kawaiiFace({ fill: '#c3f0a0', eyeMode: 'x', mouth: 'flat',
  extra: `${P('M112 192 C 150 240, 140 322, 122 380 C 162 332, 180 300, 200 262 Z', '#7ed957', '#3d2b00', 8)}${P('M392 202 C 368 250, 380 322, 398 380 C 360 332, 340 302, 322 260 Z', '#7ed957', '#3d2b00', 8)}` }));
addSticker('stk_dio_sticker_face', kawaiiFace({ eyeMode: 'flat', mouth: 'smile',
  extra: `${R(146, 174, 96, 34, 16, '#ffd166', '#3d2b00', 6)}${R(270, 174, 96, 34, 16, '#ffd166', '#3d2b00', 6)}` }));
addSticker('stk_dio_sweat_hearts', kawaiiFace({ eyeMode: 'happy', mouth: 'smile',
  extra: `${heart(160, 142, 36, '#ff5d7a', 6)}${heart(354, 150, 28, '#ff5d7a', 6)}${P('M352 316 C 368 342, 356 364, 340 370 C 322 364, 322 338, 336 320', '#a4f0ff', '#3d2b00', 6)}` }));
addSticker('stk_dio_tatted', kawaiiFace({ eyeMode: 'wink', mouth: 'flat',
  extra: `${L(340, 196, 382, 152, '#3d2b00', 7)}${L(360, 226, 414, 172, '#3d2b00', 7)}${sparkle(392, 144, 10)}` }));
addSticker('stk_dio_toothless', kawaiiFace({ eyeMode: 'open', mouth: 'open',
  extra: `<rect x="230" y="282" width="52" height="10" rx="4" fill="#3d2b00"/>` }));
addSticker('stk_dio_wedding', kawaiiFace({ eyeMode: 'happy', mouth: 'smile',
  extra: `${P('M136 216 C 120 116, 256 62, 376 216 C 340 148, 300 148, 256 158 C 212 148, 172 150, 136 216 Z', '#fdfdfd', '#3d2b00', 8)}${flower(256, 116, 25, '#ffb3d1', '#ffd166', '#3d2b00', 5)}` }));
addSticker('stk_fire_flame', `${P('M256 36 C 340 160, 430 210, 400 340 C 360 448, 152 448, 112 340 C 82 210, 172 160, 256 36 Z', '#ff8a3d', '#3d2b00', 10)}${P('M256 148 C 310 236, 350 268, 330 356 C 300 424, 212 424, 182 356 C 162 268, 202 236, 256 148 Z', '#ffd166', '#3d2b00', 7)}${C(206, 358, 14)}${C(306, 358, 14)}${arc(256, 358, 60, 200, 140, '#2b1d12', 8)}`);
addSticker('stk_fireworks', `${[[150, 132, '#ff5d7a'], [366, 112, '#ffd166'], [420, 306, '#5fd4c2'], [100, 328, '#ff8fb3']].map(([x, y, col]) => {
  let s = C(x, y, 17, col, '#3d2b00', 6);
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI * 2 * k) / 8;
    s += `<line x1="${x + 24 * Math.cos(a)}" y1="${y + 24 * Math.sin(a)}" x2="${x + 54 * Math.cos(a)}" y2="${y + 54 * Math.sin(a)}" stroke="${col}" stroke-width="10" stroke-linecap="round"/>`;
  }
  return s;
}).join('')}${sparkle(256, 436, 16, '#fff')}`);
addSticker('stk_fortnite_llama', `${P('M176 306 L176 238 L208 238 L208 208 L240 172 L256 186 L272 172 L304 208 L304 238 L336 238 L336 306 Z', '#a37de0', '#3d2b00', 9)}${C(228, 236, 16)}${C(284, 236, 16)}${[['#ffd166', 214], ['#5fd4c2', 256], ['#ff8fb3', 296]].map(([c, x]) => R(x - 18, 272, 36, 100, 7, c, '#3d2b00', 5)).join('')}${E(256, 352, 126, 22, '#e8f0ff', '#3d2b00', 8)}`);
addSticker('stk_giant_spider', `${E(256, 308, 118, 96, '#5a4632', '#3d2b00', 10)}${C(216, 288, 13, '#ffd166')}${C(296, 288, 13, '#ffd166')}${[[128, 252], [148, 302], [148, 356], [384, 252], [364, 302], [364, 356]].map(([x, y]) => `<path d="M${x} ${y} C ${x + (x > 256 ? -52 : 52)} ${y - 38} ${x + (x > 256 ? -24 : 24)} ${y + 38} ${x + (x > 256 ? -70 : 70)} ${y + 4}" stroke="#5a4632" stroke-width="14" fill="none" stroke-linecap="round"/>`).join('')}${[[256, 92], [212, 116], [300, 116]].map(([x, y]) => sparkle(x, y, 9)).join('')}`);
addSticker('stk_golden_hour', `${C(256, 256, 120, '#ffb703', '#3d2b00', 10)}${C(216, 238, 13)}${C(296, 238, 13)}${arc(256, 262, 44, 15, 150, '#2b1d12', 9)}${Array.from({ length: 12 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 12;
  return `<line x1="${256 + 148 * Math.cos(a)}" y1="${256 + 148 * Math.sin(a)}" x2="${256 + 202 * Math.cos(a)}" y2="${256 + 202 * Math.sin(a)}" stroke="#ffb703" stroke-width="15" stroke-linecap="round" opacity="0.9"/>`;
}).join('')}`);
addSticker('stk_harry_potter', kawaiiFace({ eyeMode: 'open', mouth: 'flat',
  extra: `${P('M98 224 C 148 62, 364 62, 414 224 C 358 174, 312 192, 256 180 C 200 192, 154 176, 98 224 Z', '#1f1f28', '#3d2b00', 8)}${R(206, 168, 24, 16, 6, '#c9a86a')}${R(282, 168, 24, 16, 6, '#c9a86a')}${L(158, 222, 208, 218, '#3d2b00', 7)}${L(304, 218, 354, 222, '#3d2b00', 7)}` }));
addSticker('stk_jungle_leaf', `${P('M256 44 C 178 132, 120 200, 148 322 C 220 280, 282 262, 256 44 Z', '#3f9e56', '#1e4a18', 8)}${P('M256 44 C 332 132, 392 212, 360 332 C 300 280, 240 262, 256 44 Z', '#59c273', '#1e4a18', 8)}${P('M150 384 C 210 352, 310 352, 370 384 C 310 416, 210 416, 150 384 Z', '#2f7a3f', '#1e4a18', 8)}${sparkle(256, 434, 12, '#fff')}`);
addSticker('stk_minecraft', `${R(116, 116, 280, 280, 8, '#5fae3f', '#1e4a18', 10)}${[[156, 156], [216, 156], [276, 156], [336, 156], [156, 256], [276, 256], [156, 356], [216, 356], [276, 356], [336, 356]].map(([x, y]) => R(x, y, 36, 36, 2, '#3f7a28')).join('')}${R(170, 224, 52, 36, 2, '#141414')}${R(292, 224, 52, 36, 2, '#141414')}${R(212, 330, 88, 24, 2, '#141414')}`);
addSticker('stk_new_year_2026', `<text x="256" y="290" font-family="Arial Black,Arial" font-size="122" font-weight="900" fill="#ffd166" stroke="#3d2b00" stroke-width="13" paint-order="stroke fill" text-anchor="middle" letter-spacing="2">2026</text>${[[104, 132], [408, 132]].map(([x, y]) => `<g>${L(x, y, x, 244, '#3d2b00', 10)}${star(x, y, 20, '#ff5d7a', '#3d2b00', 5)}</g>`).join('')}${sparkle(256, 384, 14)}`);
addSticker('stk_ocean_underwater', `${P('M40 300 C 110 250, 180 350, 250 300 C 320 250, 380 350, 472 290 L 472 462 L 40 462 Z', '#3a8fc4', '#1a4a68', 8)}${E(140, 336, 44, 22, '#ffd166', '#3d2b00', 7)}${P('M140 318 L108 340 L140 362 Z', '#ffd166', '#3d2b00', 7)}${C(296, 334, 30, '#ffb3d1', '#3d2b00', 7)}${P('M296 304 L268 334 L296 364 Z', '#ffb3d1', '#3d2b00', 7)}${[60, 150, 380].map((x) => P(`M${x} 470 L${x + 26} 398 L${x + 52} 470 Z`, '#59c273', '#1e4a18', 6)).join('')}`);
addSticker('stk_pirate_hat', `${P('M96 252 C 120 150, 392 150, 416 252 C 330 302, 190 302, 96 252 Z', '#26262e', '#0c0c10', 11)}${C(256, 90, 26, '#26262e', '#0c0c10', 7)}${C(256, 90, 11, '#fdfdfd')}${L(212, 246, 300, 246, '#ffd166', 22)}`);
addSticker('stk_rain_storm', `${E(256, 204, 150, 90, '#c8ccd4', '#3d2b00', 9)}${E(148, 232, 66, 52, '#a8b3c8', '#3d2b00', 7)}${E(366, 232, 66, 52, '#a8b3c8', '#3d2b00', 7)}${P('M256 258 L210 356 L258 356 L234 456 L332 330 L272 330 L322 258 Z', '#ffd166', '#3d2b00', 6)}${[166, 346].map((x) => `<path d="M${x} 300 v42 M${x - 9} 344 v12 M${x + 9} 344 v12" stroke="#5fd4c2" stroke-width="8" stroke-linecap="round"/>`).join('')}`);
addSticker('stk_rose_flower', `${C(256, 200, 92, '#ff5d7a', '#3d2b00', 9)}${E(256, 200, 62, 38, '#ff8fb3', '#3d2b00', 5)}${E(256, 200, 34, 20, '#ffb3d1', '#3d2b00', 4)}${C(256, 200, 13, '#ffd6e7', '#3d2b00', 4)}${P('M256 292 C 250 380, 260 430, 256 470', 'none', '#3f9e56', 13, 'stroke-linecap="round"')}${E(218, 372, 44, 18, '#3f9e56', '#1e4a18', 6)}${E(294, 358, 44, 18, '#3f9e56', '#1e4a18', 6)}`);
addSticker('stk_shrek_ogre', `${C(256, 248, 122, '#8fc35f', '#3d2b00', 10)}${E(138, 288, 26, 40, '#8fc35f', '#3d2b00', 8)}${E(374, 288, 26, 40, '#8fc35f', '#3d2b00', 8)}${C(212, 240, 13)}${C(300, 240, 13)}${arc(256, 258, 44, 20, 140, '#2b1d12', 9)}`);
addSticker('stk_spooky_ghost', `${P('M156 238 C 156 110, 356 110, 356 238 L 356 392 L 318 342 L 282 392 L 250 342 L 218 392 L 192 340 L 156 392 Z', '#fdfdfd', '#3d2b00', 9)}${E(216, 238, 14, 20, '#2b1d12')}${E(296, 238, 14, 20, '#2b1d12')}${E(256, 302, 15, 20, '#2b1d12')}`);
addSticker('stk_superhero_cape', `${P('M156 118 L256 62 L356 118 L336 258 L442 332 L352 380 L256 356 L160 380 L70 332 L176 258 Z', '#d63a3a', '#3d2b00', 9)}${P('M196 222 L256 182 L316 222 L296 300 L256 330 L216 300 Z', '#ffd166', '#3d2b00', 7)}`);
addSticker('stk_ufo_alien', `${E(256, 132, 56, 42, '#a9e5a0', '#3d2b00', 8)}${E(234, 128, 10, 14, '#2b1d12')}${E(278, 128, 10, 14, '#2b1d12')}${E(256, 240, 168, 58, '#8f95a3', '#3d2b00', 9)}${E(256, 216, 96, 24, '#c8ccd4', '#3d2b00', 7)}${P('M140 262 L110 330 L166 262', 'none', '#ffd166', 7)}${P('M372 262 L402 330 L346 262', 'none', '#ffd166', 7)}${sparkle(256, 356, 13, '#fff')}`);
addSticker('stk_volcano_lava', `${P('M110 402 L190 168 L220 208 L256 166 L292 208 L322 168 L402 402 Z', '#5a4632', '#3d2b00', 9)}${P('M216 246 L210 402 L302 402 L296 246 Z', '#ff8a3d', '#3d2b00', 6)}${[[208, 250], [256, 228], [304, 250]].map(([x, y], i) => sparkle(x, y, 7 + i * 3, '#ffd166')).join('')}${L(256, 56, 256, 114, '#ff8a3d', 12)}`);
addSticker('stk_watercolor_art', `${heart(256, 252, 128, '#ffb3d1', 5, '#a3133f')}${heart(212, 218, 32, '#ffd6e7', 0, '#a3133f')}${E(256, 332, 78, 15, '#ff8fb3', '#a3133f', 5)}${sparkle(330, 174, 12, '#fff')}`);

// ============================================================
// MAIN
// ============================================================
fs.mkdirSync(STICKERS, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });
let made = 0;
for (const { name, svg } of frames) {
  await writePng(svg, path.join(FRAMES, `${name}.png`));
  made++;
}
for (const { name, svg } of stickers) {
  await writePng(svg, path.join(STICKERS, `${name}.png`));
  made++;
}
console.log('OK generated', made, 'assets (', frames.length, 'frames +', stickers.length, 'stickers )');
