-- ---------------------------------------------------------------------------
-- B1sTeam — LocketGold (Free)
-- 0003 · Bảng catalog khung ảnh + dữ liệu mẫu của B1sTeam.
--
-- `tags` lưu chuỗi JSON, `premium`/`enabled` lưu 0/1 để tương thích cả
-- SQLite (D1) lẫn Postgres (Supabase).
-- ---------------------------------------------------------------------------

create table if not exists frame_catalog (
    id           text primary key,
    slug         text not null unique,
    name         text not null,
    group_name   text not null default 'Kawaii',
    file_path    text not null,
    worker_path  text not null,
    tags         text not null default '[]',
    premium      integer not null default 0,
    enabled      integer not null default 1,
    sort_order   integer not null default 0,
    created_at   text not null
);

-- Tìm khung theo slug (đường dẫn /f/:id của worker).
create index if not exists idx_frame_catalog_slug
    on frame_catalog(slug);

-- Lọc theo nhóm khung.
create index if not exists idx_frame_catalog_group_name
    on frame_catalog(group_name);

-- Lọc theo trạng thái bật/tắt.
create index if not exists idx_frame_catalog_enabled
    on frame_catalog(enabled);

-- Sắp xếp thứ tự hiển thị trong app.
create index if not exists idx_frame_catalog_sort_order
    on frame_catalog(sort_order);

-- ---------------------------------------------------------------------------
-- Dữ liệu mẫu: các khung nổi bật của B1sTeam.
-- ---------------------------------------------------------------------------

insert into frame_catalog
    (id, slug, name, group_name, file_path, worker_path, tags, premium, enabled, sort_order, created_at)
values
    ('frame-royal-gold', 'frame-royal-gold', 'Khung Vàng Hoàng Gia', 'Gold',
     'assets/frames/frame_royal_gold.png', '/f/frame-royal-gold',
     '["gold","vàng","hoàng gia"]', 1, 1, 10, '2026-11-15T00:00:00.000Z'),

    ('frame-12-gold', 'frame-12-gold', 'Khung Vàng Kim Cương', 'Gold',
     'assets/frames/frame-12-gold.png', '/f/frame-12-gold',
     '["gold","vàng","kim cương"]', 1, 1, 20, '2026-11-15T00:00:00.000Z'),

    ('frame-cmt-locket', 'frame-cmt-locket', 'Khung Comment Locket', 'Gold',
     'assets/frames/cmt_locket.png', '/f/frame-cmt-locket',
     '["comment","locket"]', 0, 1, 30, '2026-11-15T00:00:00.000Z'),

    ('frame-08-valentine', 'frame-08-valentine', 'Khung Valentine', 'Seasonal',
     'assets/frames/frame-08-valentine.png', '/f/frame-08-valentine',
     '["valentine","tình yêu"]', 0, 1, 40, '2026-11-15T00:00:00.000Z'),

    ('frame-09-christmas', 'frame-09-christmas', 'Khung Giáng Sinh', 'Seasonal',
     'assets/frames/frame-09-christmas.png', '/f/frame-09-christmas',
     '["christmas","giáng sinh"]', 0, 1, 50, '2026-11-15T00:00:00.000Z'),

    ('frame-10-halloween', 'frame-10-halloween', 'Khung Halloween', 'Seasonal',
     'assets/frames/frame-10-halloween.png', '/f/frame-10-halloween',
     '["halloween","ma quỷ"]', 0, 1, 60, '2026-11-15T00:00:00.000Z'),

    ('frame-11-neon', 'frame-11-neon', 'Khung Neon', 'Seasonal',
     'assets/frames/frame-11-neon.png', '/f/frame-11-neon',
     '["neon","cyberpunk"]', 0, 1, 70, '2026-11-15T00:00:00.000Z'),

    ('frame-13-pastel', 'frame-13-pastel', 'Khung Pastel', 'Kawaii',
     'assets/frames/frame-13-pastel.png', '/f/frame-13-pastel',
     '["pastel","kawaii"]', 0, 1, 80, '2026-11-15T00:00:00.000Z'),

    ('frame-14-crayon', 'frame-14-crayon', 'Khung Crayon', 'Kawaii',
     'assets/frames/frame-14-crayon.png', '/f/frame-14-crayon',
     '["crayon","vẽ tay"]', 0, 1, 90, '2026-11-15T00:00:00.000Z'),

    ('frame-citopia-y2k', 'frame-citopia-y2k', 'Khung Citopia Y2K', 'Kawaii',
     'assets/frames/frame_citopia_y2k.png', '/f/frame-citopia-y2k',
     '["y2k","citopia"]', 1, 1, 100, '2026-11-15T00:00:00.000Z'),

    ('frame-kitty-shinchan', 'frame-kitty-shinchan', 'Khung Kitty & Shin-chan', 'Kawaii',
     'assets/frames/frame_kitty_shinchan.png', '/f/frame-kitty-shinchan',
     '["kitty","shin chan"]', 1, 1, 110, '2026-11-15T00:00:00.000Z'),

    ('photobooth-4cut', 'photobooth-4cut', 'Photobooth 4 Cut', 'Photo Booth',
     'assets/frames/photobooth_4cut.png', '/f/photobooth-4cut',
     '["photobooth","4 ô"]', 0, 1, 120, '2026-11-15T00:00:00.000Z'),

    ('photobooth-cute', 'photobooth-cute', 'Photobooth Dễ Thương', 'Photo Booth',
     'assets/frames/photobooth_cute.png', '/f/photobooth-cute',
     '["photobooth","dễ thương"]', 0, 1, 130, '2026-11-15T00:00:00.000Z'),

    ('pb-galaxy', 'pb-galaxy', 'Photobooth Thiên Hà', 'Photo Booth',
     'assets/frames/pb_galaxy.png', '/f/pb-galaxy',
     '["photobooth","thiên hà"]', 1, 1, 140, '2026-11-15T00:00:00.000Z'),

    ('pb-holo-4cut', 'pb-holo-4cut', 'Photobooth Holo 4 Cut', 'Photo Booth',
     'assets/frames/pb_holo_4cut.png', '/f/pb-holo-4cut',
     '["photobooth","holo"]', 1, 1, 150, '2026-11-15T00:00:00.000Z'),

    ('sinh-nh-hello-kitty', 'sinh-nh-hello-kitty', 'Khung Sinh Nhật Hello Kitty', 'Seasonal',
     'assets/frames/sinh_nh_t_hello_kitty_ho_i_c.png', '/f/sinh-nh-hello-kitty',
     '["sinh nhật","hello kitty"]', 1, 1, 160, '2026-11-15T00:00:00.000Z')
on conflict(slug) do nothing;
