CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','viewer')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_name TEXT NOT NULL,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#0f172a',
  logo TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  active INTEGER DEFAULT 1,
  sheet_url TEXT,
  sheet_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS column_mappings (
  branch_id TEXT PRIMARY KEY,
  mapping_json TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  stock TEXT,
  zone TEXT,
  rack TEXT,
  level TEXT,
  slot TEXT,
  warehouse TEXT,
  raw_json TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_search ON products(name, sku, barcode, brand, zone, rack);

CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  name TEXT NOT NULL,
  x REAL DEFAULT 0,
  y REAL DEFAULT 0,
  w REAL DEFAULT 220,
  h REAL DEFAULT 140,
  color TEXT DEFAULT '#dbeafe'
);

CREATE TABLE IF NOT EXISTS racks (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  zone_id TEXT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'simple',
  levels INTEGER DEFAULT 4,
  columns INTEGER DEFAULT 3,
  slots INTEGER DEFAULT 12,
  x REAL DEFAULT 0,
  y REAL DEFAULT 0,
  w REAL DEFAULT 120,
  h REAL DEFAULT 42,
  color TEXT DEFAULT '#334155'
);

INSERT OR IGNORE INTO users (id, name, email, password, role)
VALUES ('u_admin', 'Administrador', 'admin@empresa.com', 'admin123', 'admin');

INSERT OR IGNORE INTO users (id, name, email, password, role)
VALUES ('u_viewer', 'Visualizador', 'visor@empresa.com', 'visor123', 'viewer');

INSERT OR IGNORE INTO companies (id, name, system_name)
VALUES ('company_1', 'Mi Empresa', 'WMS Visual Interno');
