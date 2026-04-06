PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  label TEXT NOT NULL,
  parent_category_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (parent_category_id IS NULL OR parent_category_id <> id)
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  date_label TEXT NOT NULL DEFAULT '',
  size_label TEXT NOT NULL DEFAULT '',
  visits INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  price TEXT NOT NULL DEFAULT '',
  drive_url TEXT NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (status IN ('published', 'draft')),
  CHECK (featured IN (0, 1)),
  CHECK (visits >= 0),
  CHECK (downloads >= 0)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_brand_id ON categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_category_id ON categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_files_brand_id ON files(brand_id);
CREATE INDEX IF NOT EXISTS idx_files_category_id ON files(category_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_updated_at ON files(updated_at DESC);

INSERT INTO brands (id, label, created_at, updated_at)
VALUES
  ('huawei', 'Huawei', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('honor', 'Honor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('solution', 'SOLUTION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

INSERT INTO categories (id, brand_id, label, parent_category_id, created_at, updated_at)
VALUES
  ('huawei-removed-id', 'huawei', 'Removed ID', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('repair-chip-damage', 'huawei', 'Repair Chip Damage', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fix-reboot', 'huawei', 'Fix Reboot', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xml-qualcomm', 'huawei', 'XML Qualcomm', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('honor-removed-id', 'honor', 'Removed ID', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('honor-fix-reboot', 'honor', 'Fix Reboot', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('honor-otg-file', 'honor', 'OTG File', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('honor-repair-imei', 'honor', 'Repair IMEI', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

INSERT INTO meta (key, value, updated_at)
VALUES
  ('public_cache_version', strftime('%s','now'), CURRENT_TIMESTAMP),
  ('last_admin_update', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO NOTHING;
