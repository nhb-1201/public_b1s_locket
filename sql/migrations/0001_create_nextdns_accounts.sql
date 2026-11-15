-- ---------------------------------------------------------------------------
-- B1sTeam — LocketGold (Free)
-- 0001 · Bảng lưu tài khoản NextDNS của người dùng.
--
-- DDL viết theo chuẩn SQLite (Cloudflare D1) và chạy được trên Postgres
-- (Supabase): không dùng AUTOINCREMENT, không dùng datetime('now') — mọi mốc
-- thời gian do ứng dụng ghi vào dưới dạng chuỗi ISO-8601.
-- ---------------------------------------------------------------------------

create table if not exists nextdns_accounts (
    id            text primary key,
    profile_id    text not null unique,
    profile_name  text not null default '',
    email         text not null,
    password      text not null,
    dns_url       text not null,
    fly_ip        text not null default '137.66.53.108',
    rewrites      text not null default '[]',
    query_count   integer not null default 0,
    is_active     integer not null default 1,
    created_at    text not null,
    updated_at    text not null
);

-- Truy vấn nhanh theo profile (đường dẫn /<profileId>/dns-query).
create index if not exists idx_nextdns_accounts_profile_id
    on nextdns_accounts(profile_id);

-- Tra cứu tài khoản theo email (dùng khi xoay vòng / kiểm tra usage).
create index if not exists idx_nextdns_accounts_email
    on nextdns_accounts(email);

-- Lọc nhanh các profile đang hoạt động.
create index if not exists idx_nextdns_accounts_is_active
    on nextdns_accounts(is_active);

-- Sắp xếp danh sách mới nhất trước.
create index if not exists idx_nextdns_accounts_created_at
    on nextdns_accounts(created_at);
