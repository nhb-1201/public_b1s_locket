-- ---------------------------------------------------------------------------
-- B1sTeam — LocketGold (Free)
-- 0002 · Bảng lưu license key.
--
-- Chỉ lưu SHA-256 của key (key_hash), không bao giờ lưu key thô.
-- Mọi mốc thời gian là chuỗi ISO-8601 do ứng dụng ghi vào.
-- ---------------------------------------------------------------------------

create table if not exists license_keys (
    id           text primary key,
    key_hash     text not null unique,
    key_prefix   text not null default '',
    plan         text not null default 'free',
    device_id    text not null default '',
    issued_at    text not null,
    expires_at   text,
    revoked_at   text,
    usage_count  integer not null default 0,
    created_at   text not null
);

-- Tra cứu theo hash (đường chính khi kiểm tra license).
create index if not exists idx_license_keys_key_hash
    on license_keys(key_hash);

-- Tra cứu nhanh theo tiền tố hiển thị (hỗ trợ).
create index if not exists idx_license_keys_key_prefix
    on license_keys(key_prefix);

-- Liệt kê các key đã gắn với một thiết bị.
create index if not exists idx_license_keys_device_id
    on license_keys(device_id);

-- Thống kê theo gói.
create index if not exists idx_license_keys_plan
    on license_keys(plan);

-- Lọc các key còn hiệu lực.
create index if not exists idx_license_keys_expires_at
    on license_keys(expires_at);
