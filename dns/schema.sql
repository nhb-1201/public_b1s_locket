-- B1sTeam - Schema toi thieu cho DoH Worker (multi-tenant)
-- Ban day la ban rut gon cua migrations `0020_nextdns_dns.sql` + `0021_dns_account_per_rotation.sql`
-- trong repo `b1steam_web`.
-- Dung khi ban trien khai doc lap (chi can DoH Worker, khong co backend NextDNS).
--
-- Luu y: NextDNS Free = 300.000 truy van / thang tinh theo TAI KHOAN (khong phai profile).
-- Vong xoay luon tao tai khoan NextDNS MOI - khong phai profile moi trong cung tai khoan.

-- Moi user: nhieu tai khoan NextDNS (1 dang current + toi da 1 ready cho vong xoay tiep theo).
CREATE TABLE IF NOT EXISTS dns_nextdns_accounts (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  generation         INTEGER NOT NULL DEFAULT 1,
  nextdns_email      TEXT NOT NULL,
  nextdns_password   TEXT NOT NULL,
  session_enc        TEXT,
  status             TEXT NOT NULL DEFAULT 'current',
  is_current         INTEGER NOT NULL DEFAULT 0,
  account_queries    INTEGER NOT NULL DEFAULT 0,
  last_error         TEXT,
  last_synced_at     TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dns_nextdns_accounts_current
  ON dns_nextdns_accounts (user_id) WHERE is_current = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dns_nextdns_accounts_ready
  ON dns_nextdns_accounts (user_id) WHERE status = 'ready';

-- Moi user: nhieu profile (moi vong xoay 1 profile; profile pending = tai khoan san sang).
CREATE TABLE IF NOT EXISTS dns_profiles (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  account_id         TEXT NOT NULL,
  generation         INTEGER NOT NULL DEFAULT 1,
  nextdns_profile_id TEXT NOT NULL UNIQUE,
  profile_name       TEXT,
  nextdns_dns_url    TEXT NOT NULL,
  doh_url            TEXT NOT NULL,
  access_token       TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'active',
  is_current         INTEGER NOT NULL DEFAULT 1,
  queries_used       INTEGER NOT NULL DEFAULT 0,
  query_limit        INTEGER NOT NULL DEFAULT 300000,
  quota_percent      REAL NOT NULL DEFAULT 0,
  threshold_percent  INTEGER NOT NULL DEFAULT 80,
  rotation_required  INTEGER NOT NULL DEFAULT 0,
  devices_count      INTEGER NOT NULL DEFAULT 0,
  cycle_start        TEXT NOT NULL DEFAULT (datetime('now')),
  cycle_end          TEXT,
  last_synced_at     TEXT,
  last_seen_at       TEXT,
  rotated_at         TEXT,
  revoked_at         TEXT,
  last_error         TEXT,
  user_update_required INTEGER NOT NULL DEFAULT 0,
  update_reason      TEXT,
  update_notified_at TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dns_profiles_current
  ON dns_profiles (user_id) WHERE is_current = 1;

CREATE INDEX IF NOT EXISTS idx_dns_profiles_status
  ON dns_profiles (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dns_profiles_update_required
  ON dns_profiles (user_update_required) WHERE user_update_required = 1;

-- Bo dem truy van thuc (DoH Worker ghi, backend doc).
CREATE TABLE IF NOT EXISTS dns_usage_counters (
  profile_id  TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 0,
  cycle_start TEXT NOT NULL DEFAULT (datetime('now')),
  cycle_end   TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
