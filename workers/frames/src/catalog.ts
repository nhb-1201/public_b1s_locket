/**
 * B1sTeam — LocketGold (Free)
 * Frame catalog of the rotating frame workers.
 *
 * The catalog is inlined so the worker compiles standalone (no import of the
 * `assets/` folder at build time). It mirrors the files that live inside
 * `assets/frames/`.
 */

export interface FrameEntry {
  /** Stable slug used by /f/:id */
  id: string;
  /** Display name (Vietnamese) */
  name: string;
  /** Group used to filter the catalog */
  group: string;
  /** File name inside assets/frames */
  file: string;
  /** Search tags */
  tags: string[];
  /** True when the frame requires a premium license */
  premium: boolean;
}

/** Version of the catalog (bumped on every content change). */
export const CATALOG_VERSION = '4.0.0';

/** 1x1 transparent PNG used when an asset is missing (never fail hard). */
export const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg==';

/** Every frame shipped with LocketGold (Free). */
export const FRAMES: FrameEntry[] = [
  {
    id: 'frame-royal-gold',
    name: 'Khung Vàng Hoàng Gia',
    group: 'Gold',
    file: 'frame_royal_gold.png',
    tags: ['gold', 'vàng', 'hoàng gia', 'sinh nhật'],
    premium: true,
  },
  {
    id: 'frame-12-gold',
    name: 'Khung Vàng Kim Cương',
    group: 'Gold',
    file: 'frame-12-gold.png',
    tags: ['gold', 'vàng', 'kim cương'],
    premium: true,
  },
  {
    id: 'frame-cmt-locket',
    name: 'Khung Comment Locket',
    group: 'Gold',
    file: 'cmt_locket.png',
    tags: ['comment', 'locket', 'vàng'],
    premium: false,
  },
  {
    id: 'frame-08-valentine',
    name: 'Khung Valentine',
    group: 'Seasonal',
    file: 'frame-08-valentine.png',
    tags: ['valentine', 'tình yêu', '2/14'],
    premium: false,
  },
  {
    id: 'frame-09-christmas',
    name: 'Khung Giáng Sinh',
    group: 'Seasonal',
    file: 'frame-09-christmas.png',
    tags: ['christmas', 'giáng sinh', 'noel'],
    premium: false,
  },
  {
    id: 'frame-10-halloween',
    name: 'Khung Halloween',
    group: 'Seasonal',
    file: 'frame-10-halloween.png',
    tags: ['halloween', 'ma quỷ', 'halloween'],
    premium: false,
  },
  {
    id: 'frame-11-neon',
    name: 'Khung Neon',
    group: 'Seasonal',
    file: 'frame-11-neon.png',
    tags: ['neon', 'cyberpunk', 'màu'],
    premium: false,
  },
  {
    id: 'frame-13-pastel',
    name: 'Khung Pastel',
    group: 'Kawaii',
    file: 'frame-13-pastel.png',
    tags: ['pastel', 'kawaii', 'màu nhạt'],
    premium: false,
  },
  {
    id: 'frame-14-crayon',
    name: 'Khung Crayon',
    group: 'Kawaii',
    file: 'frame-14-crayon.png',
    tags: ['crayon', 'sáp màu', 'vẽ tay'],
    premium: false,
  },
  {
    id: 'frame-citopia-y2k',
    name: 'Khung Citopia Y2K',
    group: 'Kawaii',
    file: 'frame_citopia_y2k.png',
    tags: ['y2k', 'citopia', 'kawaii'],
    premium: true,
  },
  {
    id: 'frame-kitty-shinchan',
    name: 'Khung Kitty & Shin-chan',
    group: 'Kawaii',
    file: 'frame_kitty_shinchan.png',
    tags: ['kitty', 'shin chan', 'kawaii'],
    premium: true,
  },
  {
    id: 'frame-lowg-l2k',
    name: 'Khung Low G L2K',
    group: 'Kawaii',
    file: 'frame_lowg_l2k.png',
    tags: ['l2k', 'low g', 'kawaii'],
    premium: true,
  },
  {
    id: 'khung-hello-kitty-hoa-pastel',
    name: 'Khung Hello Kitty Hoa Pastel',
    group: 'Kawaii',
    file: 'khung_hello_kitty_h_ng_pastel.png',
    tags: ['hello kitty', 'pastel', 'hoa'],
    premium: true,
  },
  {
    id: 'khung-hello-kitty-pastel',
    name: 'Khung Hello Kitty Pastel',
    group: 'Kawaii',
    file: 'khung_hello_kitty_pastel_ng_t_ng_o.png',
    tags: ['hello kitty', 'pastel', 'kawaii'],
    premium: true,
  },
  {
    id: 'khung-h-ng-gian-xanh-pastel',
    name: 'Khung Hình Giản Xanh Pastel',
    group: 'Kawaii',
    file: 'khung_h_ng_gian_xanh_pastel.png',
    tags: ['minimal', 'xanh', 'pastel'],
    premium: false,
  },
  {
    id: 'khung-nh-hoa-pastel',
    name: 'Khung Nhà Hoa Pastel',
    group: 'Kawaii',
    file: 'khung_nh_hoa_pastel_vi_n_xanh_m_nh.png',
    tags: ['hoa', 'pastel', 'xanh mint'],
    premium: false,
  },
  {
    id: 'khung-nh-n-pastel-vi-n-ren',
    name: 'Kung Nhà Nhỏ Pastel Viền Rèn',
    group: 'Kawaii',
    file: 'khung_nh_n_pastel_vi_n_ren.png',
    tags: ['nhà nhỏ', 'pastel', 'viền rèn'],
    premium: false,
  },
  {
    id: 'khung-nh-pastel-vi-n-s-i-c-u',
    name: 'Khung Nhà Pastel Viền Săn Cao',
    group: 'Kawaii',
    file: 'khung_nh_pastel_vi_n_s_i_c_u.png',
    tags: ['nhà', 'pastel', 'săn cao'],
    premium: false,
  },
  {
    id: 'khung-nh-shin-chan',
    name: 'Khung Nhà Shin-chan',
    group: 'Kawaii',
    file: 'khung_nh_shin_chan_vi_n_m_nh.png',
    tags: ['shin chan', 'nhà', 'kawaii'],
    premium: true,
  },
  {
    id: 'khung-nh-vu-ng',
    name: 'Khung Nhà Vũ Ngữ',
    group: 'Kawaii',
    file: 'khung_nh_vu_ng_n_ng_nh_n_b_c.png',
    tags: ['nhà', 'kawaii'],
    premium: false,
  },
  {
    id: 'khung-vu-ng-sao',
    name: 'Khung Vũ Ngữ Sao Pastel',
    group: 'Kawaii',
    file: 'khung_vu_ng_ng_i_sao_h_ng_pastel.png',
    tags: ['sao', 'pastel', 'kawaii'],
    premium: false,
  },
  {
    id: 'khung-xanh-v-tay-sao',
    name: 'Khung Xanh Vẽ Tay Sao',
    group: 'Kawaii',
    file: 'khung_xanh_v_tay_sao_v_ng.png',
    tags: ['vẽ tay', 'xanh', 'sao'],
    premium: false,
  },
  {
    id: 'khung-anh-kitty-sao',
    name: 'Khung Ảnh Kitty Và Sao',
    group: 'Kawaii',
    file: 'khung_anh_o_kitty_v_sao.png',
    tags: ['kitty', 'sao', 'kawaii'],
    premium: true,
  },
  {
    id: 'photobooth-4cut',
    name: 'Photobooth 4 Cut',
    group: 'Photo Booth',
    file: 'photobooth_4cut.png',
    tags: ['photobooth', '4 ô', 'strip'],
    premium: false,
  },
  {
    id: 'photobooth-cute',
    name: 'Photobooth Dễ Thương',
    group: 'Photo Booth',
    file: 'photobooth_cute.png',
    tags: ['photobooth', 'dễ thương'],
    premium: false,
  },
  {
    id: 'photoboot',
    name: 'Photoboot Kawaii',
    group: 'Photo Booth',
    file: 'photoboot.png',
    tags: ['photoboot', 'kawaii'],
    premium: false,
  },
  {
    id: 'pb-galaxy',
    name: 'Photobooth Thiên Hà',
    group: 'Photo Booth',
    file: 'pb_galaxy.png',
    tags: ['photobooth', 'thiên hà', 'galaxy'],
    premium: true,
  },
  {
    id: 'pb-holo-4cut',
    name: 'Photobooth Holo 4 Cut',
    group: 'Photo Booth',
    file: 'pb_holo_4cut.png',
    tags: ['photobooth', 'holo', '4 ô'],
    premium: true,
  },
  {
    id: 'pb-scrapbook-4cut',
    name: 'Photobooth Scrapbook 4 Cut',
    group: 'Photo Booth',
    file: 'pb_scrapbook_ripped_4cut.png',
    tags: ['photobooth', 'scrapbook', '4 ô'],
    premium: true,
  },
  {
    id: 'pb-denim-ripped-2x2',
    name: 'Photobooth Denim Ripped 2x2',
    group: 'Photo Booth',
    file: 'pb_denim_ripped_2x2.png',
    tags: ['photobooth', 'denim', '2x2'],
    premium: true,
  },
  {
    id: 'pb-ripped-paper-4cut',
    name: 'Photobooth Giấy Xé 4 Cut',
    group: 'Photo Booth',
    file: 'pb_ripped_paper_4cut.png',
    tags: ['photobooth', 'giấy xé', '4 ô'],
    premium: true,
  },
  {
    id: 'pb-single-denim-ripped',
    name: 'Photobooth Denim Ripped Đơn',
    group: 'Photo Booth',
    file: 'pb_single_denim_ripped.png',
    tags: ['photobooth', 'denim'],
    premium: true,
  },
  {
    id: 'pb-single-film-nostalgia',
    name: 'Photobooth Phim Hoài Niệm',
    group: 'Photo Booth',
    file: 'pb_single_film_nostalgia.png',
    tags: ['photobooth', 'phim', 'hoài niệm'],
    premium: false,
  },
  {
    id: 'pb-single-y2k-silver-holo',
    name: 'Photobooth Y2K Bạc Holo',
    group: 'Photo Booth',
    file: 'pb_single_y2k_silver_holo.png',
    tags: ['photobooth', 'y2k', 'bạc'],
    premium: true,
  },
  {
    id: 'pb-strawberry',
    name: 'Photobooth Dâu Tây',
    group: 'Photo Booth',
    file: 'pb_strawberry.png',
    tags: ['photobooth', 'dâu tây'],
    premium: false,
  },
  {
    id: 'pb-vintage',
    name: 'Photobooth Hoài Niệm',
    group: 'Photo Booth',
    file: 'pb_vintage.png',
    tags: ['photobooth', 'hoài niệm'],
    premium: false,
  },
  {
    id: 'sinh-nh-hello-kitty',
    name: 'Khung Sinh Nhật Hello Kitty',
    group: 'Seasonal',
    file: 'sinh_nh_t_hello_kitty_ho_i_c.png',
    tags: ['sinh nhật', 'hello kitty', 'bánh'],
    premium: true,
  },
  {
    id: 'sticker-banh-luon-minh-tu',
    name: 'Sticker Bánh Luôn Mỉm Cười',
    group: 'Sticker',
    file: 'sticker_b_nh_lu_n_minh_tu.png',
    tags: ['sticker', 'bánh', 'cười'],
    premium: false,
  },
];

/**
 * Find a frame by its slug.
 *
 * @param {string} id
 * @returns {FrameEntry|null}
 */
export function findFrame(id: string): FrameEntry | null {
  const needle = String(id || '').toLowerCase();
  for (const frame of FRAMES) {
    if (frame.id.toLowerCase() === needle) return frame;
  }
  return null;
}

/**
 * Group the catalog by group name.
 *
 * @returns {Record<string, number>}
 */
export function groupCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const frame of FRAMES) {
    counts[frame.group] = (counts[frame.group] || 0) + 1;
  }
  return counts;
}
