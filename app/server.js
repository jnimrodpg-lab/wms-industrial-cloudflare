const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    process.env.RENDER_DISK_PATH,
    '/opt/render/project/src/data',
    path.join(__dirname, 'data'),
  ].filter(Boolean).map(String);

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      fs.accessSync(candidate, fs.constants.W_OK);
      return candidate;
    } catch (_err) {}
  }
  return path.join(__dirname, 'data');
}

const DATA_DIR = resolveDataDir();
const DB_PATH = process.env.DB_PATH ? String(process.env.DB_PATH) : path.join(DATA_DIR, 'wms.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
try {
  db.pragma(process.env.NODE_ENV === 'production' ? 'journal_mode = DELETE' : 'journal_mode = WAL');
} catch (_err) {
  try { db.pragma('journal_mode = DELETE'); } catch (__err) {}
}
db.pragma('synchronous = FULL');
db.pragma('foreign_keys = ON');


class SqliteSessionStore extends session.Store {
  constructor(database, opts = {}) {
    super();
    this.db = database;
    this.ttlMs = Number(opts.ttlMs || 1000 * 60 * 60 * 24 * 30);
    this._ensureTable();
  }

  _ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions_store (
        sid TEXT PRIMARY KEY,
        sess_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_store_expires_at ON sessions_store(expires_at);
    `);
  }

  _cleanupExpired() {
    try {
      this.db.prepare('DELETE FROM sessions_store WHERE expires_at <= ?').run(Date.now());
    } catch (_err) {}
  }

  get(sid, cb) {
    try {
      this._cleanupExpired();
      const row = this.db.prepare('SELECT sess_json, expires_at FROM sessions_store WHERE sid = ?').get(String(sid || ''));
      if (!row) return cb(null, null);
      if (Number(row.expires_at || 0) <= Date.now()) {
        this.db.prepare('DELETE FROM sessions_store WHERE sid = ?').run(String(sid || ''));
        return cb(null, null);
      }
      const sess = safeJsonParse(row.sess_json, null);
      return cb(null, sess || null);
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sess, cb = () => {}) {
    try {
      const cookieMaxAge = Number(sess?.cookie?.maxAge || 0);
      const expiresAt = Date.now() + (cookieMaxAge > 0 ? cookieMaxAge : this.ttlMs);
      this.db.prepare(`
        INSERT INTO sessions_store (sid, sess_json, expires_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(sid) DO UPDATE SET
          sess_json = excluded.sess_json,
          expires_at = excluded.expires_at,
          updated_at = CURRENT_TIMESTAMP
      `).run(String(sid || ''), JSON.stringify(sess || {}), expiresAt);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb = () => {}) {
    try {
      this.db.prepare('DELETE FROM sessions_store WHERE sid = ?').run(String(sid || ''));
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sess, cb = () => {}) {
    try {
      const cookieMaxAge = Number(sess?.cookie?.maxAge || 0);
      const expiresAt = Date.now() + (cookieMaxAge > 0 ? cookieMaxAge : this.ttlMs);
      this.db.prepare('UPDATE sessions_store SET expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?').run(expiresAt, String(sid || ''));
      cb(null);
    } catch (err) {
      cb(err);
    }
  }
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      company_name TEXT DEFAULT 'WMS Control',
      company_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'tienda',
      slug TEXT NOT NULL,
      warehouses_json TEXT NOT NULL DEFAULT '[]',
      canvas_width INTEGER NOT NULL DEFAULT 900,
      canvas_height INTEGER NOT NULL DEFAULT 620,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, slug),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS branch_sheet_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL UNIQUE,
      sheet_id TEXT,
      sheet_name TEXT DEFAULT 'Productos',
      source_type TEXT DEFAULT 'google_sheet',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS branch_layouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL UNIQUE,
      layout_json TEXT NOT NULL,
      viewbox_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS viewer_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_state_blobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE,
      admin_json TEXT,
      rack_models_json TEXT,
      branch_layouts_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL,
      product_key TEXT NOT NULL,
      sku TEXT DEFAULT '',
      barcode TEXT DEFAULT '',
      name TEXT DEFAULT '',
      variant TEXT DEFAULT '',
      brand TEXT DEFAULT '',
      category TEXT DEFAULT '',
      color TEXT DEFAULT '',
      size TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      rack TEXT DEFAULT '',
      level TEXT DEFAULT '',
      slot TEXT DEFAULT '',
      location TEXT DEFAULT '',
      warehouse TEXT DEFAULT '',
      stock REAL DEFAULT 0,
      price REAL DEFAULT 0,
      image_url TEXT DEFAULT '',
      payload_json TEXT NOT NULL,
      search_text TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(branch_id, product_key),
      FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_products_branch_name ON products(branch_id, name);
    CREATE INDEX IF NOT EXISTS idx_products_branch_sku ON products(branch_id, sku);
    CREATE INDEX IF NOT EXISTS idx_products_branch_barcode ON products(branch_id, barcode);
    CREATE INDEX IF NOT EXISTS idx_products_branch_rack ON products(branch_id, rack);
    CREATE INDEX IF NOT EXISTS idx_products_branch_warehouse ON products(branch_id, warehouse);
    CREATE INDEX IF NOT EXISTS idx_products_branch_zone ON products(branch_id, zone);
  `);

  db.prepare(`
    INSERT INTO system_meta (key, value, updated_at)
    VALUES ('last_boot_at', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(new Date().toISOString());
  db.prepare(`
    INSERT INTO system_meta (key, value, updated_at)
    VALUES ('db_path', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(DB_PATH);

  const cols = db.prepare("PRAGMA table_info(branches)").all().map(r=>r.name);
  if (!cols.includes('company_id')) db.exec("ALTER TABLE branches ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1");
  const sheetCols = db.prepare("PRAGMA table_info(branch_sheet_config)").all().map(r=>r.name);
  if (!sheetCols.includes('sheet_map_json')) db.exec("ALTER TABLE branch_sheet_config ADD COLUMN sheet_map_json TEXT");
  if (!sheetCols.includes('imported_products_json')) db.exec("ALTER TABLE branch_sheet_config ADD COLUMN imported_products_json TEXT");
  if (!sheetCols.includes('last_sheet_count')) db.exec("ALTER TABLE branch_sheet_config ADD COLUMN last_sheet_count INTEGER NOT NULL DEFAULT 0");
  if (!sheetCols.includes('sheet_headers_json')) db.exec("ALTER TABLE branch_sheet_config ADD COLUMN sheet_headers_json TEXT");
  if (!sheetCols.includes('sheet_header_index')) db.exec("ALTER TABLE branch_sheet_config ADD COLUMN sheet_header_index INTEGER NOT NULL DEFAULT 0");
  const adminCols = db.prepare("PRAGMA table_info(admin_config)").all().map(r=>r.name);
  if (!adminCols.includes('company_id')) db.exec("ALTER TABLE admin_config ADD COLUMN company_id INTEGER");
  const appCols = db.prepare("PRAGMA table_info(app_state_blobs)").all().map(r=>r.name);
  if (!appCols.includes('company_id')) {
    db.exec("ALTER TABLE app_state_blobs RENAME TO app_state_blobs_legacy");
    db.exec(`CREATE TABLE IF NOT EXISTS app_state_blobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE,
      admin_json TEXT,
      rack_models_json TEXT,
      branch_layouts_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )`);
    const legacy = db.prepare('SELECT admin_json, rack_models_json, branch_layouts_json, updated_at FROM app_state_blobs_legacy WHERE id = 1').get();
    if (legacy) {
      db.prepare('INSERT INTO app_state_blobs (company_id, admin_json, rack_models_json, branch_layouts_json, updated_at) VALUES (1, ?, ?, ?, ?)').run(legacy.admin_json, legacy.rack_models_json, legacy.branch_layouts_json, legacy.updated_at || new Date().toISOString());
    }
    db.exec('DROP TABLE app_state_blobs_legacy');
  }

  let company = db.prepare('SELECT id, code FROM companies WHERE id = 1').get();
  if (!company) {
    const code = 'WMS-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const info = db.prepare('INSERT INTO companies (id, name, code) VALUES (1, ?, ?)').run('WMS Control', code);
    company = { id: 1, code };
  }

  const admin = db.prepare('SELECT id FROM admin_config WHERE id = 1').get();
  if (!admin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin_config (id, username, password_hash, company_name, company_id) VALUES (1, ?, ?, ?, ?)')
      .run('admin', passwordHash, 'WMS Control', 1);
  } else {
    db.prepare('UPDATE admin_config SET company_id = COALESCE(company_id, 1) WHERE id = 1').run();
  }

  const defaultUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!defaultUser) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(1, 'admin', passwordHash, 'admin');
    db.prepare('INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(1, 'viewer', bcrypt.hashSync('viewer123', 10), 'viewer');
  }

  const countBranches = db.prepare('SELECT COUNT(*) AS total FROM branches WHERE company_id = 1').get().total;
  if (countBranches === 0) {
    const insertBranch = db.prepare(`
      INSERT INTO branches (company_id, name, type, slug, warehouses_json, canvas_width, canvas_height)
      VALUES (@company_id, @name, @type, @slug, @warehouses_json, @canvas_width, @canvas_height)
    `);
    const result = insertBranch.run({
      company_id: 1,
      name: 'Sucursal principal',
      type: 'tienda',
      slug: 'sucursal-principal',
      warehouses_json: JSON.stringify(['Almacén principal']),
      canvas_width: 900,
      canvas_height: 620,
    });
    const branchId = result.lastInsertRowid;
    db.prepare("INSERT INTO branch_sheet_config (branch_id, sheet_id, sheet_name, source_type, sheet_map_json, imported_products_json, last_sheet_count, sheet_headers_json, sheet_header_index) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)")
      .run(branchId, '', 'Productos', 'google_sheet', JSON.stringify(null), JSON.stringify([]), JSON.stringify([]));
    db.prepare('INSERT INTO branch_layouts (branch_id, layout_json, viewbox_json) VALUES (?, ?, ?)')
      .run(branchId, JSON.stringify(defaultLayout()), JSON.stringify({ x: 0, y: 0, w: 900, h: 620 }));
  }
}

function defaultLayout() {
  return {
    zones: [
      { id: 'Z1', name: 'Zona Z1', color: '#ffd84d', pts: [{ x: 60, y: 60 }, { x: 300, y: 60 }, { x: 300, y: 210 }, { x: 60, y: 210 }] },
      { id: 'Z2', name: 'Zona Z2', color: '#4dd6ff', pts: [{ x: 350, y: 60 }, { x: 620, y: 60 }, { x: 620, y: 250 }, { x: 350, y: 250 }] },
      { id: 'Z3', name: 'Zona Z3', color: '#50e37b', pts: [{ x: 90, y: 290 }, { x: 350, y: 290 }, { x: 350, y: 520 }, { x: 90, y: 520 }] }
    ],
    racks: []
  };
}

function normalizeBranch(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    slug: row.slug,
    warehouses: safeJsonParse(row.warehouses_json, []),
    canvas_width: row.canvas_width,
    canvas_height: row.canvas_height,
    active: !!row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}



function buildAdminStateFromDb(companyId = 1, savedAdmin = null) {
  const companyRow = getCompanyById(companyId) || { name: 'WMS Industrial', code: '' };
  const branches = db.prepare('SELECT * FROM branches WHERE active = 1 AND company_id = ? ORDER BY id ASC').all(companyId);
  const sheetStmt = db.prepare('SELECT branch_id, sheet_id, sheet_name, source_type, updated_at, sheet_map_json, imported_products_json, last_sheet_count, sheet_headers_json, sheet_header_index FROM branch_sheet_config WHERE branch_id = ?');
  const adminBranches = branches.map((row, index) => {
    const savedBranch = Array.isArray(savedAdmin?.branches) ? (savedAdmin.branches.find(b => Number(b?.id) === Number(row.id)) || savedAdmin.branches[index] || {}) : {};
    const branch = normalizeBranch(row);
    const sheet = sheetStmt.get(row.id) || {};
    return {
      id: row.id,
      name: savedBranch.name || branch.name,
      type: savedBranch.type || branch.type,
      color: savedBranch.color || '#ffd84d',
      warehouses: Array.isArray(savedBranch.warehouses) && savedBranch.warehouses.length ? savedBranch.warehouses : (Array.isArray(branch.warehouses) && branch.warehouses.length ? branch.warehouses : ['Almacén principal']),
      sheetUrl: sheet.sheet_id || savedBranch.sheetUrl || '',
      sheetName: sheet.sheet_name || savedBranch.sheetName || 'Productos',
      sheetConnected: !!(sheet.sheet_id && sheet.sheet_name),
      lastSheetCount: Number(sheet.last_sheet_count || savedBranch.lastSheetCount || 0),
      sheetHeaders: safeJsonParse(sheet.sheet_headers_json, Array.isArray(savedBranch.sheetHeaders) ? savedBranch.sheetHeaders : []),
      sheetStatusText: savedBranch.sheetStatusText || '',
      sheetHeaderIndex: Number(sheet.sheet_header_index || savedBranch.sheetHeaderIndex || 0),
      sheetPreviewProducts: safeJsonParse(sheet.imported_products_json, Array.isArray(savedBranch.sheetPreviewProducts) ? savedBranch.sheetPreviewProducts : []),
      sheetMapRows: safeJsonParse(sheet.sheet_map_json, Array.isArray(savedBranch.sheetMapRows) ? savedBranch.sheetMapRows : null),
    };
  });
  return {
    company: savedAdmin?.company || companyRow.name || 'WMS Industrial',
    companyCode: companyRow.code || savedAdmin?.companyCode || '',
    logo: savedAdmin?.logo || '',
    branches: adminBranches,
    activeBranch: Number(savedAdmin?.activeBranch || 0),
  };
}

function getStoredAppState(companyId = 1) {
  const row = db.prepare('SELECT admin_json, rack_models_json, branch_layouts_json, updated_at FROM app_state_blobs WHERE company_id = ?').get(companyId);
  if (!row) return null;
  const savedAdmin = safeJsonParse(row.admin_json, null);
  return {
    admin: buildAdminStateFromDb(companyId, savedAdmin),
    models: safeJsonParse(row.rack_models_json, null),
    branchLayouts: safeJsonParse(row.branch_layouts_json, null),
    updated_at: row.updated_at,
  };
}

function buildFallbackAppState(companyId = 1) {
  const admin = buildAdminStateFromDb(companyId, null);
  const branches = db.prepare('SELECT * FROM branches WHERE active = 1 AND company_id = ? ORDER BY id ASC').all(companyId);
  const layoutStmt = db.prepare('SELECT branch_id, layout_json FROM branch_layouts WHERE branch_id = ?');
  const branchLayouts = {};
  branches.forEach((row, index) => {
    const layoutRow = layoutStmt.get(row.id);
    branchLayouts[index] = safeJsonParse(layoutRow?.layout_json, defaultLayout());
  });
  return {
    admin,
    models: null,
    branchLayouts,
  };
}

function getSessionCompanyId(req) {
  return Number(req?.session?.company_id || 1);
}
function getSessionUser(req) {
  if (!(req.session && req.session.isAuthenticated)) return null;
  return {
    id: Number(req.session.user_id || 0),
    username: String(req.session.username || ''),
    role: String(req.session.role || 'viewer'),
    company_id: getSessionCompanyId(req),
  };
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAuthenticated && String(req.session.role || '') === 'admin') return next();
  return res.status(403).json({ ok: false, error: 'Solo administradores' });
}
function getCompanyById(id) {
  return db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
}
function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1').get(username);
}
function getLegacyAdminConfig() {
  try {
    return db.prepare('SELECT * FROM admin_config WHERE id = 1').get();
  } catch (_err) {
    return null;
  }
}
function uniqueCompanyCode(base='WMS') {
  let code = '';
  do {
    code = `${String(base || 'WMS').replace(/[^A-Z0-9]/gi, '').slice(0,6).toUpperCase() || 'WMS'}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  } while (db.prepare('SELECT id FROM companies WHERE code = ?').get(code));
  return code;
}
function createCompanyBundle({ companyName, username, password, role='admin', companyCode=null }) {
  const tx = db.transaction(() => {
    let companyId;
    let code = companyCode;
    if (role === 'viewer') {
      const company = db.prepare('SELECT * FROM companies WHERE code = ?').get(companyCode);
      if (!company) throw new Error('Código de empresa inválido');
      companyId = company.id;
      code = company.code;
    } else {
      code = uniqueCompanyCode(companyName);
      const info = db.prepare('INSERT INTO companies (name, code, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(companyName, code);
      companyId = Number(info.lastInsertRowid);
      const insertBranch = db.prepare(`INSERT INTO branches (company_id, name, type, slug, warehouses_json, canvas_width, canvas_height) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      const binfo = insertBranch.run(companyId, 'Sucursal principal', 'tienda', 'sucursal-principal', JSON.stringify(['Almacén principal']), 900, 620);
      ensureBranchScaffolding(binfo.lastInsertRowid, 900, 620);
      db.prepare('INSERT INTO app_state_blobs (company_id, admin_json, rack_models_json, branch_layouts_json, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)').run(companyId, JSON.stringify({company:companyName,logo:'',branches:[{name:'Sucursal principal',type:'tienda',color:'#ffd84d',warehouses:['Almacén principal'],sheetUrl:'',sheetName:'Productos',sheetConnected:false,lastSheetCount:0}],activeBranch:0}), JSON.stringify(null), JSON.stringify({'0': defaultLayout()}));
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(companyId, username, passwordHash, role);
    return { companyId, code, userId: Number(info.lastInsertRowid) };
  });
  return tx();
}


function textValue(value) {
  if (value == null) return '';
  return String(value).trim();
}
function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function buildProductKey(product, index = 0) {
  const sku = textValue(product?.sku).toLowerCase();
  const barcode = textValue(product?.barcode).toLowerCase();
  const name = textValue(product?.name || product?.nombre).toLowerCase();
  const variant = textValue(product?.variant || product?.variante).toLowerCase();
  const location = textValue(product?.location || product?.ubicacion).toLowerCase();
  if (sku) return `sku:${sku}`;
  if (barcode) return `barcode:${barcode}`;
  return `row:${name}|${variant}|${location}|${index}`;
}
function normalizeImportedProduct(raw = {}, index = 0) {
  const product = {
    sku: textValue(raw.sku || raw.SKU),
    barcode: textValue(raw.barcode || raw.barras || raw.Barras || raw.codigo_barras),
    name: textValue(raw.name || raw.nombre || raw['Nombre'] || raw['Nombre Bsale']),
    variant: textValue(raw.variant || raw.variante || raw['Variante']),
    brand: textValue(raw.brand || raw.marca || raw['Marca']),
    category: textValue(raw.category || raw.categoria || raw['Categoría'] || raw['Categoria']),
    color: textValue(raw.color || raw['Color']),
    size: textValue(raw.size || raw.talla || raw['Talla']),
    zone: textValue(raw.zone || raw.zona || raw['Zona']),
    rack: textValue(raw.rack || raw.estante || raw['Estante']),
    level: textValue(raw.level || raw.nivel || raw['Nivel']),
    slot: textValue(raw.slot || raw['Slot']),
    location: textValue(raw.location || raw.ubicacion || raw['Ubicación'] || raw['Ubicacion']),
    warehouse: textValue(raw.warehouse || raw.almacen || raw['Almacén'] || raw['Almacen']),
    stock: numberValue(raw.stock || raw['Stock']),
    price: numberValue(raw.price || raw['Precio']),
    image_url: textValue(raw.image_url || raw.imageUrl || raw.imagen || raw['Imagen'] || raw['URL imagen'] || raw['Url imagen']),
  };
  const searchText = [
    product.sku, product.barcode, product.name, product.variant, product.brand, product.category,
    product.color, product.size, product.zone, product.rack, product.level, product.slot,
    product.location, product.warehouse
  ].join(' ').toLowerCase();
  return {
    ...raw,
    ...product,
    product_key: buildProductKey(product, index),
    search_text: searchText,
  };
}
function syncBranchProducts(branchId, importedProducts) {
  const rows = Array.isArray(importedProducts) ? importedProducts.slice(0, 12000).map((row, index) => normalizeImportedProduct(row, index)) : [];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM products WHERE branch_id = ?').run(branchId);
    if (!rows.length) return 0;
    const insert = db.prepare(`
      INSERT INTO products (
        branch_id, product_key, sku, barcode, name, variant, brand, category, color, size,
        zone, rack, level, slot, location, warehouse, stock, price, image_url, payload_json, search_text,
        created_at, updated_at
      ) VALUES (
        @branch_id, @product_key, @sku, @barcode, @name, @variant, @brand, @category, @color, @size,
        @zone, @rack, @level, @slot, @location, @warehouse, @stock, @price, @image_url, @payload_json, @search_text,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
    for (const row of rows) {
      insert.run({
        branch_id: branchId,
        product_key: row.product_key,
        sku: row.sku,
        barcode: row.barcode,
        name: row.name,
        variant: row.variant,
        brand: row.brand,
        category: row.category,
        color: row.color,
        size: row.size,
        zone: row.zone,
        rack: row.rack,
        level: row.level,
        slot: row.slot,
        location: row.location,
        warehouse: row.warehouse,
        stock: row.stock,
        price: row.price,
        image_url: row.image_url,
        payload_json: JSON.stringify(row),
        search_text: row.search_text,
      });
    }
    return rows.length;
  });
  return tx();
}
function bootstrapProductsFromConfigs() {
  const rows = db.prepare('SELECT branch_id, imported_products_json FROM branch_sheet_config').all();
  for (const row of rows) {
    const existing = db.prepare('SELECT COUNT(*) AS total FROM products WHERE branch_id = ?').get(row.branch_id)?.total || 0;
    if (existing > 0) continue;
    const importedProducts = safeJsonParse(row.imported_products_json, []);
    if (Array.isArray(importedProducts) && importedProducts.length) {
      syncBranchProducts(row.branch_id, importedProducts);
    }
  }
}
function buildProductWhereClause({ branchId = null, query = '', filters = {} } = {}) {
  const clauses = [];
  const params = [];
  if (branchId != null) {
    clauses.push('branch_id = ?');
    params.push(Number(branchId));
  }
  const q = String(query || '').trim().toLowerCase();
  if (q) {
    clauses.push('(search_text LIKE ? OR name LIKE ? OR sku LIKE ? OR barcode LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const exactFilters = {
    warehouse: 'warehouse',
    zone: 'zone',
    rack: 'rack',
    brand: 'brand',
    category: 'category',
  };
  for (const [inputKey, column] of Object.entries(exactFilters)) {
    const value = textValue(filters?.[inputKey]);
    if (!value) continue;
    clauses.push(`${column} = ?`);
    params.push(value);
  }
  const imageState = textValue(filters?.image_state);
  if (imageState === 'with_image') clauses.push("TRIM(COALESCE(image_url, '')) <> ''");
  if (imageState === 'without_image') clauses.push("TRIM(COALESCE(image_url, '')) = ''");
  const locationState = textValue(filters?.location_state);
  if (locationState === 'complete') clauses.push("TRIM(COALESCE(location, '')) <> ''");
  if (locationState === 'incomplete') clauses.push("TRIM(COALESCE(location, '')) = ''");
  const stockState = textValue(filters?.stock_state);
  if (stockState === 'with_stock') clauses.push('stock > 0');
  if (stockState === 'without_stock') clauses.push('stock <= 0');
  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function getPagination(req, { defaultLimit = 120, maxLimit = 250 } = {}) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(1, Math.min(maxLimit, parseInt(req.query.limit || String(defaultLimit), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
function getSearchFilters(req) {
  return {
    warehouse: req.query.warehouse,
    zone: req.query.zone,
    rack: req.query.rack,
    brand: req.query.brand,
    category: req.query.category,
    image_state: req.query.image_state,
    location_state: req.query.location_state,
    stock_state: req.query.stock_state,
  };
}
function getRackCodeFromLocation(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  const match = raw.match(/^([A-Z0-9]+-E\d+)/);
  return match ? match[1] : '';
}
function serializeProductRow(row) {
  const payload = safeJsonParse(row?.payload_json, {}) || {};
  const rackStore = textValue(payload.rackStore || payload.rack_store || getRackCodeFromLocation(payload.almacen || row?.warehouse || ''));
  return {
    id: row.id,
    branch_id: row.branch_id,
    sku: textValue(payload.sku || row.sku),
    barras: textValue(payload.barras || payload.barcode || row.barcode),
    barcode: textValue(payload.barcode || payload.barras || row.barcode),
    nombre: textValue(payload.nombre || payload.name || row.name),
    name: textValue(payload.name || payload.nombre || row.name),
    variante: textValue(payload.variante || payload.variant || row.variant),
    variant: textValue(payload.variant || payload.variante || row.variant),
    marca: textValue(payload.marca || payload.brand || row.brand),
    brand: textValue(payload.brand || payload.marca || row.brand),
    categoria: textValue(payload.categoria || payload.category || row.category),
    category: textValue(payload.category || payload.categoria || row.category),
    color: textValue(payload.color || row.color),
    talla: textValue(payload.talla || payload.size || row.size),
    size: textValue(payload.size || payload.talla || row.size),
    zona: textValue(payload.zona || payload.zone || row.zone),
    zone: textValue(payload.zone || payload.zona || row.zone),
    rack: textValue(payload.rack || payload.estante || row.rack),
    level: textValue(payload.level || payload.nivel || row.level),
    nivel: textValue(payload.nivel || payload.level || row.level),
    slot: textValue(payload.slot || row.slot),
    ubicacion: textValue(payload.ubicacion || payload.location || row.location),
    location: textValue(payload.location || payload.ubicacion || row.location),
    almacen: textValue(payload.almacen || payload.warehouse || row.warehouse),
    warehouse: textValue(payload.warehouse || payload.almacen || row.warehouse),
    rackStore,
    stock: Number(payload.stock != null ? payload.stock : row.stock || 0),
    price: Number(payload.price != null ? payload.price : row.price || 0),
    image_url: textValue(payload.image_url || payload.imageUrl || payload.imagen || row.image_url),
    imagen: textValue(payload.imagen || payload.imageUrl || payload.image_url || row.image_url),
    payload,
    updated_at: row.updated_at,
  };
}
function getProductFacetOptions(branchId) {
  const rows = db.prepare(`
    SELECT
      brand, category, warehouse, zone, rack,
      SUM(CASE WHEN TRIM(COALESCE(image_url, '')) <> '' THEN 1 ELSE 0 END) AS with_image,
      SUM(CASE WHEN TRIM(COALESCE(location, '')) <> '' THEN 1 ELSE 0 END) AS with_location,
      SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) AS with_stock,
      COUNT(*) AS total
    FROM products
    WHERE branch_id = ?
  `).all(branchId);
  const uniq = (key) => Array.from(new Set(rows.map(r => textValue(r[key])).filter(Boolean))).sort((a,b)=>a.localeCompare(b, 'es', { sensitivity:'base', numeric:true }));
  return {
    brands: uniq('brand'),
    categories: uniq('category'),
    warehouses: uniq('warehouse'),
    zones: uniq('zone'),
    racks: uniq('rack'),
  };
}

function parseSheetId(input) {
  const value = String(input || '').trim();
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  return match ? match[1] : value;
}
async function fetchWorksheetEntries(input) {
  const id = parseSheetId(input);
  const urls = [
    `https://spreadsheets.google.com/feeds/worksheets/${id}/public/basic?alt=json`,
    `https://spreadsheets.google.com/feeds/worksheets/${id}/public/full?alt=json`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const entries = data?.feed?.entry || [];
      if (entries.length) {
        return entries.map((e, index) => ({
          name: String(e?.title?.$t || '').trim(),
          gid: String(e?.['gs$sheetId']?.$t || e?.['gs:sheetId']?.$t || e?.gid || '').trim(),
          index
        })).filter(x => x.name);
      }
    } catch {}
  }
  throw new Error('No se pudieron detectar las hojas. Asegúrate de que el Sheet sea público o esté compartido con acceso de lectura.');
}
async function fetchSheetMetaByUrl(input) {
  const entries = await fetchWorksheetEntries(input);
  return entries.map(e => e.name);
}
async function resolveSheetGid(input, sheetName) {
  const target = String(sheetName || '').trim().toLowerCase();
  if (!target) return '';
  try {
    const entries = await fetchWorksheetEntries(input);
    const exact = entries.find(e => e.name.toLowerCase() === target);
    if (exact?.gid) return exact.gid;
    const loose = entries.find(e => e.name.toLowerCase().replace(/\s+/g,' ') === target.replace(/\s+/g,' '));
    if (loose?.gid) return loose.gid;
  } catch {}
  return '';
}
function detectCsvDelimiter(text) {
  const cleaned = String(text || '').replace(/^\ufeff/, '');
  const sampleLines = cleaned.split(/\r?\n/).slice(0, 5);
  const candidates = [',', ';', '\t'];

  function countSep(line, sep) {
    let inside = false;
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];
      if (inside) {
        if (ch === '"' && next === '"') { i++; continue; }
        if (ch === '"') inside = false;
      } else {
        if (ch === '"') inside = true;
        else if (ch === sep) count++;
      }
    }
    return count;
  }

  let best = ',';
  let bestScore = -1;
  for (const sep of candidates) {
    const score = sampleLines.reduce((sum, line) => sum + countSep(line, sep), 0);
    if (score > bestScore) {
      bestScore = score;
      best = sep;
    }
  }
  return best;
}

function parseCsv(text, delimiter = null) {
  const src = String(text || '').replace(/^\ufeff/, '');
  const sep = delimiter || detectCsvDelimiter(src);
  const rows = [];
  let row = [];
  let cell = '';
  let inside = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inside) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inside = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inside = true;
      } else if (ch === sep) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch === '\r') {
      } else {
        cell += ch;
      }
    }
  }

  row.push(cell);
  if (row.length && !(row.length === 1 && row[0] === '')) rows.push(row);
  return rows;
}
function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}


function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function parseGoogleVizJson(text) {
  const src = String(text || '').trim();
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) throw new Error('Respuesta inválida del Sheet');
  return JSON.parse(src.slice(start, end + 1));
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) return next();
  return res.status(401).json({ ok: false, error: 'No autorizado' });
}

function getBranchById(id) {
  return normalizeBranch(db.prepare('SELECT * FROM branches WHERE id = ?').get(id));
}


function getOwnedBranch(req, branchId) {
  return db.prepare('SELECT * FROM branches WHERE id = ? AND company_id = ? AND active = 1').get(branchId, getSessionCompanyId(req));
}

function cleanupDuplicateBranches() {
  const rows = db.prepare('SELECT id, name, company_id FROM branches WHERE active = 1 ORDER BY company_id ASC, id ASC').all();
  const seen = new Set();
  const toDelete = [];
  for (const row of rows) {
    const key = `${row.company_id}::${String(row.name || '').trim().toLowerCase()}`;
    if (!key) continue;
    if (seen.has(key)) toDelete.push(row.id);
    else seen.add(key);
  }
  const del = db.prepare('DELETE FROM branches WHERE id = ?');
  const tx = db.transaction((ids) => ids.forEach((id) => del.run(id)));
  if (toDelete.length) tx(toDelete);
}

function ensureBranchScaffolding(branchId, canvasWidth = 900, canvasHeight = 620) {
  const hasSheet = db.prepare('SELECT id FROM branch_sheet_config WHERE branch_id = ?').get(branchId);
  if (!hasSheet) {
    db.prepare("INSERT INTO branch_sheet_config (branch_id, sheet_id, sheet_name, source_type, sheet_map_json, imported_products_json, last_sheet_count, sheet_headers_json, sheet_header_index) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)")
      .run(branchId, '', 'Productos', 'google_sheet', JSON.stringify(null), JSON.stringify([]), JSON.stringify([]));
  }
  const hasLayout = db.prepare('SELECT id FROM branch_layouts WHERE branch_id = ?').get(branchId);
  if (!hasLayout) {
    db.prepare('INSERT INTO branch_layouts (branch_id, layout_json, viewbox_json) VALUES (?, ?, ?)')
      .run(branchId, JSON.stringify(defaultLayout()), JSON.stringify({ x: 0, y: 0, w: canvasWidth, h: canvasHeight }));
  }
}

initDb();
cleanupDuplicateBranches();

app.use(express.json({ limit: '5mb' }));
const sessionStore = new SqliteSessionStore(db, { ttlMs: 1000 * 60 * 60 * 24 * 30 });
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production' || !!process.env.RENDER;
const isSecureProxy = String(process.env.TRUST_PROXY || '1') !== '0';
app.set('trust proxy', 1);

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'wms-basic-secret-change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  unset: 'destroy',
  name: 'wms.sid',
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
}));

app.use('/assets', express.static(PUBLIC_DIR));
app.use(express.static(PUBLIC_DIR));


app.get('/healthz', (_req, res) => {
  res.json({ ok: true, status: 'ok' });
});


function countMeaningfulLayouts(branchLayouts) {
  if (!branchLayouts || typeof branchLayouts !== 'object') return 0;
  return Object.values(branchLayouts).filter(layout => layout && ((Array.isArray(layout.zones) && layout.zones.length) || (Array.isArray(layout.racks) && layout.racks.length))).length;
}
function countMeaningfulSheetBranches(admin) {
  const branches = Array.isArray(admin?.branches) ? admin.branches : [];
  return branches.filter(b => String(b?.sheetUrl || '').trim() || Number(b?.lastSheetCount || 0) > 0 || (Array.isArray(b?.sheetPreviewProducts) && b.sheetPreviewProducts.length)).length;
}
function isSuspiciousAppStateOverwrite(companyId, incomingAdmin, incomingBranchLayouts) {
  const stored = getStoredAppState(companyId);
  if (!stored) return false;
  const prevSheetBranches = countMeaningfulSheetBranches(stored.admin);
  const prevLayouts = countMeaningfulLayouts(stored.branchLayouts);
  const nextSheetBranches = countMeaningfulSheetBranches(incomingAdmin);
  const nextLayouts = countMeaningfulLayouts(incomingBranchLayouts);
  return (prevSheetBranches > 0 || prevLayouts > 0) && nextSheetBranches === 0 && nextLayouts === 0;
}

app.get('/api/app-state', (req, res) => {
  const companyId = getSessionCompanyId(req);
  const stored = getStoredAppState(companyId);
  if (stored) return res.json({ ok: true, state: stored });
  return res.json({ ok: true, state: buildFallbackAppState(companyId) });
});

app.post('/api/app-state', requireAuth, (req, res) => {
  const body = req.body || {};
  const force = !!body.force;
  const admin = body.admin && typeof body.admin === 'object' ? body.admin : null;
  const models = Array.isArray(body.models) ? body.models : null;
  const branchLayouts = body.branchLayouts && typeof body.branchLayouts === 'object' ? body.branchLayouts : null;
  const companyId = getSessionCompanyId(req);
  if (!force && isSuspiciousAppStateOverwrite(companyId, admin, branchLayouts)) {
    return res.status(409).json({ ok:false, error:'Guardado bloqueado para evitar sobrescribir el estado persistido con datos vacíos.' });
  }
  db.prepare(`
    INSERT INTO app_state_blobs (company_id, admin_json, rack_models_json, branch_layouts_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(company_id) DO UPDATE SET
      admin_json = excluded.admin_json,
      rack_models_json = excluded.rack_models_json,
      branch_layouts_json = excluded.branch_layouts_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(companyId, JSON.stringify(admin), JSON.stringify(models), JSON.stringify(branchLayouts));
  const companyName = String(admin?.company || '').trim();
  if (companyName) {
    db.prepare('UPDATE companies SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(companyName, companyId);
  }
  const companyCode = String(admin?.companyCode || '').trim();
  if (companyCode) {
    db.prepare('UPDATE companies SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(companyCode, companyId);
  }
  res.json({ ok: true });
});


function writeSessionAndRespond(req, res, payload) {
  req.session.save((err) => {
    if (err) return res.status(500).json({ ok: false, error: 'No se pudo guardar la sesión' });
    return res.json(payload);
  });
}

function establishUserSession(req, user) {
  req.session.isAuthenticated = true;
  req.session.user_id = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.company_id = user.company_id;
}

app.get('/api/session', (req, res) => {
  const user = getSessionUser(req);
  if (user) {
    const company = getCompanyById(user.company_id) || { name: 'WMS Industrial', code: '' };
    return res.json({ ok: true, user: user.username, role: user.role, company_name: company.name, company_code: company.code });
  }
  return res.status(401).json({ ok: false });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const safeUsername = String(username || '').trim();
  const safePassword = String(password || '');
  let user = getUserByUsername(safeUsername);
  let valid = !!user && bcrypt.compareSync(safePassword, user.password_hash);

  if (!valid) {
    const legacy = getLegacyAdminConfig();
    const legacyMatch = legacy
      && String(legacy.username || '').toLowerCase() === safeUsername.toLowerCase()
      && bcrypt.compareSync(safePassword, String(legacy.password_hash || ''));
    if (legacyMatch) {
      user = {
        id: Number(legacy.id || 1),
        username: String(legacy.username || safeUsername || 'admin'),
        role: 'admin',
        company_id: Number(legacy.company_id || 1),
      };
      valid = true;

      if (!getUserByUsername(user.username)) {
        const passwordHash = bcrypt.hashSync(safePassword || 'admin123', 10);
        try {
          db.prepare('INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(user.company_id, user.username, passwordHash, 'admin');
          user = getUserByUsername(user.username) || user;
        } catch (_err) {}
      }
    }
  }

  if (!valid || !user) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
  const company = getCompanyById(user.company_id) || { name: 'WMS Industrial', code: '' };
  return req.session.regenerate((err) => {
    if (err) return res.status(500).json({ ok: false, error: 'No se pudo iniciar la sesión' });
    establishUserSession(req, user);
    return writeSessionAndRespond(req, res, { ok: true, user: user.username, role: user.role, company_name: company.name, company_code: company.code });
  });
});

app.post('/api/register', (req, res) => {
  try {
    const body = req.body || {};
    const mode = String(body.mode || 'admin').trim().toLowerCase();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const companyName = String(body.companyName || '').trim() || 'Nueva empresa';
    const companyCode = String(body.companyCode || '').trim().toUpperCase();
    if (!username || !password) return res.status(400).json({ ok:false, error:'Completa usuario y contraseña' });
    if (getUserByUsername(username)) return res.status(400).json({ ok:false, error:'Ese usuario ya existe' });
    if (mode === 'viewer' && !companyCode) return res.status(400).json({ ok:false, error:'Ingresa el código de empresa' });
    const created = createCompanyBundle({ companyName, username, password, role: mode === 'viewer' ? 'viewer' : 'admin', companyCode });
    const company = getCompanyById(created.companyId);
    const createdUser = { id: created.userId, username, role: mode === 'viewer' ? 'viewer' : 'admin', company_id: created.companyId };
    return req.session.regenerate((err) => {
      if (err) return res.status(500).json({ ok:false, error:'No se pudo crear la sesión' });
      establishUserSession(req, createdUser);
      return writeSessionAndRespond(req, res, { ok:true, user: username, role: req.session.role, company_name: company.name, company_code: company.code, message: mode === 'viewer' ? 'Cuenta visualizadora creada.' : 'Cuenta administradora creada.' });
    });
  } catch (err) {
    return res.status(400).json({ ok:false, error: err.message || 'No se pudo crear la cuenta' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('wms.sid', { path: '/', sameSite: isProduction ? 'none' : 'lax', secure: isProduction });
    res.json({ ok: true });
  });
});

app.get('/api/branches', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM branches WHERE active = 1 AND company_id = ? ORDER BY id ASC').all(getSessionCompanyId(req));
  res.json({ branches: rows.map(normalizeBranch) });
});

app.post('/api/branches', requireAdmin, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const type = String(body.type || 'tienda').trim() || 'tienda';
  const slug = String(body.slug || slugify(name || `sucursal-${Date.now()}`)).trim();
  const warehouses = Array.isArray(body.warehouses) ? body.warehouses : ['Almacén principal'];
  const canvasWidth = Number(body.canvas_width || 900);
  const canvasHeight = Number(body.canvas_height || 620);
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const companyId = getSessionCompanyId(req);
  const stmt = db.prepare(`
    INSERT INTO branches (company_id, name, type, slug, warehouses_json, canvas_width, canvas_height, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const info = stmt.run(companyId, name, type, uniqueSlug(slug, companyId), JSON.stringify(warehouses), canvasWidth, canvasHeight);
  ensureBranchScaffolding(info.lastInsertRowid, canvasWidth, canvasHeight);
  res.json({ ok: true, branch: getBranchById(info.lastInsertRowid) });
});

app.put('/api/branches/:id', requireAdmin, (req, res) => {
  const branchId = Number(req.params.id);
  const existing = getBranchById(branchId);
  if (!existing) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const body = req.body || {};
  const name = String(body.name || existing.name).trim();
  const type = String(body.type || existing.type).trim() || existing.type;
  const slug = uniqueSlug(String(body.slug || existing.slug).trim(), branchId);
  const warehouses = Array.isArray(body.warehouses) ? body.warehouses : existing.warehouses;
  const canvasWidth = Number(body.canvas_width || existing.canvas_width || 900);
  const canvasHeight = Number(body.canvas_height || existing.canvas_height || 620);

  db.prepare(`
    UPDATE branches
    SET name = ?, type = ?, slug = ?, warehouses_json = ?, canvas_width = ?, canvas_height = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, type, slug, JSON.stringify(warehouses), canvasWidth, canvasHeight, branchId);

  const branch = getOwnedBranch(req, branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const currentLayout = db.prepare('SELECT id, viewbox_json FROM branch_layouts WHERE branch_id = ?').get(branchId);
  if (currentLayout && !currentLayout.viewbox_json) {
    db.prepare('UPDATE branch_layouts SET viewbox_json = ?, updated_at = CURRENT_TIMESTAMP WHERE branch_id = ?')
      .run(JSON.stringify({ x: 0, y: 0, w: canvasWidth, h: canvasHeight }), branchId);
  }

  res.json({ ok: true, branch: getBranchById(branchId) });
});


app.delete('/api/branches/:id', requireAdmin, (req, res) => {
  const branchId = Number(req.params.id);
  const existing = getBranchById(branchId);
  if (!existing) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const total = db.prepare('SELECT COUNT(*) AS total FROM branches WHERE active = 1').get().total;
  if (total <= 1) return res.status(400).json({ error: 'Debe quedar al menos una sucursal' });
  const branch = getOwnedBranch(req, branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  db.prepare('DELETE FROM branches WHERE id = ?').run(branchId);
  res.json({ ok: true });
});

app.get('/api/branches/:id/layout', requireAuth, (req, res) => {
  const branchId = Number(req.params.id);
  ensureBranchScaffolding(branchId);
  const branch = getOwnedBranch(req, branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const row = db.prepare('SELECT layout_json, viewbox_json, updated_at FROM branch_layouts WHERE branch_id = ?').get(branchId);
  if (!row) return res.status(404).json({ error: 'Layout no encontrado' });
  res.json({
    ok: true,
    layout: {
      layout: safeJsonParse(row.layout_json, defaultLayout()),
      viewBox: safeJsonParse(row.viewbox_json, { x: 0, y: 0, w: 900, h: 620 }),
      updated_at: row.updated_at,
    }
  });
});

app.post('/api/branches/:id/layout', requireAdmin, (req, res) => {
  const branchId = Number(req.params.id);
  if (!getBranchById(branchId)) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const payload = req.body || {};
  const layout = payload.layout && typeof payload.layout === 'object' ? payload.layout : defaultLayout();
  const viewBox = payload.viewBox && typeof payload.viewBox === 'object' ? payload.viewBox : { x: 0, y: 0, w: 900, h: 620 };
  ensureBranchScaffolding(branchId);
  const branch = getOwnedBranch(req, branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  db.prepare(`
    UPDATE branch_layouts
    SET layout_json = ?, viewbox_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE branch_id = ?
  `).run(JSON.stringify(layout), JSON.stringify(viewBox), branchId);
  res.json({ ok: true });
});

app.get('/api/branches/:id/sheet', requireAuth, (req, res) => {
  const branchId = Number(req.params.id);
  ensureBranchScaffolding(branchId);
  const branch = getOwnedBranch(req, branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const row = db.prepare('SELECT sheet_id, sheet_name, source_type, updated_at, sheet_map_json, imported_products_json, last_sheet_count, sheet_headers_json, sheet_header_index FROM branch_sheet_config WHERE branch_id = ?').get(branchId);
  const config = row || { sheet_id: '', sheet_name: 'Productos', source_type: 'google_sheet', sheet_map_json: null, imported_products_json: '[]', last_sheet_count: 0, sheet_headers_json: '[]', sheet_header_index: 0 };
  res.json({ ok: true, config: { ...config, sheet_map_rows: safeJsonParse(config.sheet_map_json, null), imported_products: safeJsonParse(config.imported_products_json, []), sheet_headers: safeJsonParse(config.sheet_headers_json, []), sheet_header_index: Number(config.sheet_header_index || 0) } });
});

app.post('/api/branches/:id/sheet', requireAdmin, (req, res) => {
  const branchId = Number(req.params.id);
  if (!getBranchById(branchId)) return res.status(404).json({ error: 'Sucursal no encontrada' });
  ensureBranchScaffolding(branchId);
  const branch = getOwnedBranch(req, branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const body = req.body || {};
  const current = db.prepare('SELECT sheet_id, sheet_name, source_type, sheet_map_json, imported_products_json, last_sheet_count, sheet_headers_json, sheet_header_index FROM branch_sheet_config WHERE branch_id = ?').get(branchId) || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const sheet_id = has('sheet_id') ? String(body.sheet_id || '') : String(current.sheet_id || '');
  const sheet_name = has('sheet_name') ? String(body.sheet_name || 'Productos') : String(current.sheet_name || 'Productos');
  const source_type = has('source_type') ? String(body.source_type || 'google_sheet') : String(current.source_type || 'google_sheet');
  const sheet_map_rows = has('sheet_map_rows') ? body.sheet_map_rows : safeJsonParse(current.sheet_map_json, null);
  const imported_products = has('imported_products') ? body.imported_products : safeJsonParse(current.imported_products_json, []);
  const last_sheet_count = has('last_sheet_count') ? Number(body.last_sheet_count || 0) : Number(current.last_sheet_count || 0);
  const sheet_headers = has('sheet_headers') ? body.sheet_headers : safeJsonParse(current.sheet_headers_json, []);
  const sheet_header_index = has('sheet_header_index') ? Number(body.sheet_header_index || 0) : Number(current.sheet_header_index || 0);
  const importedProductsSafe = Array.isArray(imported_products) ? imported_products.slice(0,12000) : [];
  db.prepare(`
    UPDATE branch_sheet_config
    SET sheet_id = ?, sheet_name = ?, source_type = ?, sheet_map_json = ?, imported_products_json = ?, last_sheet_count = ?, sheet_headers_json = ?, sheet_header_index = ?, updated_at = CURRENT_TIMESTAMP
    WHERE branch_id = ?
  `).run(
    sheet_id,
    sheet_name,
    source_type,
    JSON.stringify(sheet_map_rows),
    JSON.stringify(importedProductsSafe),
    last_sheet_count,
    JSON.stringify(Array.isArray(sheet_headers) ? sheet_headers : []),
    sheet_header_index,
    branchId
  );
  const syncedCount = syncBranchProducts(branchId, importedProductsSafe);
  res.json({ ok: true, synced_products: syncedCount });
});


app.post('/api/branches/:id/sheet-metadata', requireAdmin, (req, res) => {
  const branchId = Number(req.params.id);
  if (!getBranchById(branchId)) return res.status(404).json({ error: 'Sucursal no encontrada' });
  ensureBranchScaffolding(branchId);
  const branch = getOwnedBranch(req, branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const body = req.body || {};
  const current = db.prepare('SELECT sheet_id, sheet_name, source_type, sheet_map_json, imported_products_json, last_sheet_count, sheet_headers_json, sheet_header_index FROM branch_sheet_config WHERE branch_id = ?').get(branchId) || {};
  const sheet_id = String(body.sheet_id != null ? body.sheet_id : (current.sheet_id || ''));
  const sheet_name = String(body.sheet_name != null ? body.sheet_name : (current.sheet_name || 'Productos'));
  const source_type = String(body.source_type != null ? body.source_type : (current.source_type || 'google_sheet'));
  const sheet_map_rows = Array.isArray(body.sheet_map_rows) ? body.sheet_map_rows : safeJsonParse(current.sheet_map_json, null);
  const imported_products = safeJsonParse(current.imported_products_json, []);
  const last_sheet_count = Number(current.last_sheet_count || (Array.isArray(imported_products) ? imported_products.length : 0) || 0);
  const sheet_headers = Array.isArray(body.sheet_headers) ? body.sheet_headers : safeJsonParse(current.sheet_headers_json, []);
  const sheet_header_index = Number(body.sheet_header_index != null ? body.sheet_header_index : (current.sheet_header_index || 0));
  const importedProductsSafe = Array.isArray(imported_products) ? imported_products.slice(0,12000) : [];
  db.prepare(`
    UPDATE branch_sheet_config
    SET sheet_id = ?, sheet_name = ?, source_type = ?, sheet_map_json = ?, imported_products_json = ?, last_sheet_count = ?, sheet_headers_json = ?, sheet_header_index = ?, updated_at = CURRENT_TIMESTAMP
    WHERE branch_id = ?
  `).run(
    sheet_id,
    sheet_name,
    source_type,
    JSON.stringify(sheet_map_rows),
    JSON.stringify(importedProductsSafe),
    last_sheet_count,
    JSON.stringify(Array.isArray(sheet_headers) ? sheet_headers : []),
    sheet_header_index,
    branchId
  );
  const syncedCount = syncBranchProducts(branchId, importedProductsSafe);
  res.json({ ok: true, preserved_products: importedProductsSafe.length, synced_products: syncedCount });
});

app.post('/api/branches/:id/view-link', requireAdmin, (req, res) => {
  const branchId = Number(req.params.id);
  const branch = getBranchById(branchId);
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' });
  let existing = db.prepare('SELECT token FROM viewer_links WHERE branch_id = ? AND active = 1 ORDER BY id DESC LIMIT 1').get(branchId);
  if (!existing) {
    const token = crypto.randomBytes(9).toString('base64url');
    db.prepare('INSERT INTO viewer_links (branch_id, token, active) VALUES (?, ?, 1)').run(branchId, token);
    existing = { token };
  }
  res.json({ ok: true, token: existing.token, url: `${req.protocol}://${req.get('host')}/viewer/${existing.token}` });
});

app.get('/api/view-links/:token', (req, res) => {
  const token = String(req.params.token || '');
  const link = db.prepare('SELECT * FROM viewer_links WHERE token = ? AND active = 1').get(token);
  if (!link) return res.status(404).json({ error: 'Link no encontrado o inactivo' });
  const branch = getBranchById(link.branch_id);
  const layout = db.prepare('SELECT layout_json, viewbox_json FROM branch_layouts WHERE branch_id = ?').get(link.branch_id);
  const sheet = db.prepare('SELECT sheet_id, sheet_name, source_type, imported_products_json, last_sheet_count, sheet_map_json, sheet_headers_json, sheet_header_index, updated_at FROM branch_sheet_config WHERE branch_id = ?').get(link.branch_id);
  const importedProducts = safeJsonParse(sheet?.imported_products_json, []);
  res.json({
    ok: true,
    branch,
    layout: {
      layout: safeJsonParse(layout?.layout_json, defaultLayout()),
      viewBox: safeJsonParse(layout?.viewbox_json, { x: 0, y: 0, w: branch?.canvas_width || 900, h: branch?.canvas_height || 620 }),
    },
    sheet: {
      ...(sheet || { sheet_id: '', sheet_name: 'Productos', source_type: 'google_sheet' }),
      imported_products: importedProducts,
      last_sheet_count: Number(sheet?.last_sheet_count || importedProducts.length || 0),
      sheet_map_rows: safeJsonParse(sheet?.sheet_map_json, null),
      sheet_headers: safeJsonParse(sheet?.sheet_headers_json, []),
      sheet_header_index: Number(sheet?.sheet_header_index || 0)
    },
  });
});

app.get('/viewer/:token', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});


app.get('/api/sheets/meta', async (req, res) => {
  try {
    const sheets = await fetchSheetMetaByUrl(req.query.url || '');
    res.json({ ok: true, sheets });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudieron detectar las hojas' });
  }
});

app.get('/api/sheets/probe', async (req, res) => {
  try {
    const id = parseSheetId(req.query.url || '');
    const sheet = String(req.query.sheet || '').trim();
    if (!id || !sheet) return res.status(400).json({ error: 'URL/ID y hoja son obligatorios' });

    const hasVisibleValue = (value) => String(value == null ? '' : value).trim() !== '';
    const dedupeHeaders = (row) => {
      const seen = new Map();
      return (row || []).map((v, i) => {
        const base = String(v || '').trim() || `Columna ${i + 1}`;
        const count = (seen.get(base) || 0) + 1;
        seen.set(base, count);
        return count === 1 ? base : `${base} (${count})`;
      });
    };

    const gid = await resolveSheetGid(id, sheet);

    // --- Intento 1: gviz JSON (respeta celdas combinadas y encabezados reales) ---
    try {
      const jsonUrl = gid
        ? `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}&headers=1`
        : `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}&headers=1`;
      const r = await fetchWithTimeout(jsonUrl, 9000);
      if (r.ok) {
        const parsed = parseGoogleVizJson(await r.text());
        const table = ((parsed || {}).table || {});
        const gvizHeaders = (table.cols || []).map((c, idx) =>
          String((c && (c.label || c.id)) || '').trim() || `Columna ${idx + 1}`
        );
        const gvizRows = (table.rows || []).map(row =>
          ((row.c) || []).map(c => c && c.v != null ? c.v : '')
        );
        const dataRowsAll = gvizRows.filter(rw => rw.some(v => hasVisibleValue(v)));
        const headers = dedupeHeaders(gvizHeaders.filter((_, i) => hasVisibleValue(gvizHeaders[i]) || dataRowsAll.some(r => hasVisibleValue((r || [])[i]))));
        return res.json({ ok: true, headers, headerIndex: 0, previewCount: dataRowsAll.length, source: 'gviz-json' });
      }
    } catch (_) {}

    // --- Intento 2: CSV como fallback ---
    const tryUrls = [];
    if (gid) tryUrls.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`);
    tryUrls.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`);

    let rows = [];
    for (const csvUrl of tryUrls) {
      try {
        const response = await fetchWithTimeout(csvUrl, 8000);
        if (!response.ok) continue;
        const csv = await response.text();
        const parsed = parseCsv(csv).map(row => row.map(v => String(v || '').trim()));
        if (parsed.some(r => r.some(v => hasVisibleValue(v)))) { rows = parsed; break; }
      } catch {}
    }

    const nonEmptyRows = rows.filter(r => r.some(v => hasVisibleValue(v)));
    if (!nonEmptyRows.length) throw new Error('La hoja está vacía o no se pudo leer');

    let headerIndex = 0;
    let headerRow = nonEmptyRows[0] || [];
    if ((headerRow.filter(hasVisibleValue).length <= 1) && nonEmptyRows[1] && nonEmptyRows[1].filter(hasVisibleValue).length >= 2) {
      headerIndex = 1;
      headerRow = nonEmptyRows[1] || [];
    }
    const dataRows = nonEmptyRows.slice(headerIndex + 1);
    const maxLen = Math.max(headerRow.length, ...dataRows.map(r => r.length), 0);
    let last = 0;
    for (let i = 0; i < maxLen; i++) {
      if (hasVisibleValue(headerRow[i])) last = i;
      else if (dataRows.slice(0, 100).some(r => hasVisibleValue((r || [])[i]))) last = i;
    }

    const headers = dedupeHeaders(headerRow.slice(0, last + 1));
    res.json({ ok: true, headers, headerIndex, previewCount: Math.max(0, dataRows.length), source: gid ? 'csv-gid' : 'csv-sheet' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo leer la hoja' });
  }
});


app.get('/api/sheets/rows', async (req, res) => {
  try {
    const id = parseSheetId(req.query.url || '');
    const sheet = String(req.query.sheet || '').trim();
    const headerOnly = String(req.query.headerOnly || '') === '1';
    const limit = Math.max(1, Math.min(12000, parseInt(req.query.limit || (headerOnly ? '1' : '200'), 10) || (headerOnly ? 1 : 200)));
    if (!id || !sheet) return res.status(400).json({ error: 'URL/ID y hoja son obligatorios' });

    const toSafeRows = (rawRows) => (rawRows || []).map(r => (r || []).map(v => String(v == null ? '' : v).trim()));
    const hasVisibleValue = (value) => String(value == null ? '' : value).trim() !== '';
    const dedupeHeaders = (row) => {
      const seen = new Map();
      return (row || []).map((v, i) => {
        const base = String(v || '').trim() || `Columna ${i + 1}`;
        const count = (seen.get(base) || 0) + 1;
        seen.set(base, count);
        return count === 1 ? base : `${base} (${count})`;
      });
    };

    const gid = await resolveSheetGid(id, sheet);
    const timeout = headerOnly ? 9000 : 18000;

    // ── INTENTO 1: gviz JSON ── siempre primero, lee encabezados de la metadata
    // de Google (no del contenido de las celdas), lo que evita el problema de
    // filas 1 con valores repetidos que confunden al parser CSV.
    try {
      const jsonUrl = gid
        ? `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}&headers=1`
        : `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}&headers=1`;
      const r = await fetchWithTimeout(jsonUrl, timeout);
      if (r.ok) {
        const parsed = parseGoogleVizJson(await r.text());
        const table = ((parsed || {}).table || {});
        const gvizHeaders = (table.cols || []).map((c, idx) =>
          String((c && (c.label || c.id)) || '').trim() || `Columna ${idx + 1}`
        );
        const gvizRows = (table.rows || []).map(row =>
          ((row.c) || []).map(c => c && c.v != null ? c.v : '')
        );
        const dataRowsAll = toSafeRows(gvizRows).filter(rw => rw.some(v => hasVisibleValue(v)));
        // Filtrar columnas que no tienen encabezado NI datos
        const lastCol = gvizHeaders.reduce((last, h, i) => {
          if (hasVisibleValue(h)) return i;
          if (dataRowsAll.some(r => hasVisibleValue((r || [])[i]))) return i;
          return last;
        }, 0);
        const headers = dedupeHeaders(gvizHeaders.slice(0, lastCol + 1));
        const rows = dataRowsAll.map(r => r.slice(0, lastCol + 1));
        if (headers.length > 0) {
          if (headerOnly) return res.json({ ok: true, headers, headerIndex: 0, previewCount: rows.length, source: 'gviz-json' });
          return res.json({ ok: true, headers, rows: rows.slice(0, limit), headerIndex: 0, totalRows: rows.length, source: 'gviz-json' });
        }
      }
    } catch (_) {}

    // ── INTENTO 2: CSV via export con gid ──
    // ── INTENTO 3: CSV via gviz tq ──
    const tryUrls = [];
    if (gid) tryUrls.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`);
    tryUrls.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`);

    let rows = [];
    let source = gid ? 'csv-gid' : 'csv-sheet';
    let lastErr = null;
    for (const csvUrl of tryUrls) {
      try {
        const response = await fetchWithTimeout(csvUrl, timeout);
        if (!response.ok) throw new Error(`csv no disponible (${response.status})`);
        const csv = await response.text();
        const parsed = toSafeRows(parseCsv(csv));
        if (parsed.some(r => r.some(v => hasVisibleValue(v)))) {
          rows = parsed;
          source = csvUrl.includes('gid=') ? 'csv-gid' : 'csv-sheet';
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!rows.length) throw (lastErr || new Error('No se pudo leer la hoja. Verifica permisos y URL.'));

    const nonEmptyRows = rows.filter(r => r.some(v => hasVisibleValue(v)));
    if (!nonEmptyRows.length) throw new Error('La hoja no contiene filas con datos');

    let headerIndex = 0;
    let headerRow = nonEmptyRows[0] || [];
    if ((headerRow.filter(hasVisibleValue).length <= 1) && nonEmptyRows[1] && nonEmptyRows[1].filter(hasVisibleValue).length >= 2) {
      headerIndex = 1;
      headerRow = nonEmptyRows[1] || [];
    }

    const dataRowsAllRaw = nonEmptyRows.slice(headerIndex + 1);
    // Encontrar última columna con encabezado o dato
    const maxLen = Math.max((headerRow || []).length, ...(dataRowsAllRaw.map(r => r.length)), 0);
    let lastMeaningfulCol = 0;
    for (let i = 0; i < maxLen; i++) {
      if (hasVisibleValue((headerRow || [])[i])) { lastMeaningfulCol = i; continue; }
      for (let j = 0; j < Math.min(dataRowsAllRaw.length, 200); j++) {
        if (hasVisibleValue(((dataRowsAllRaw[j] || [])[i]))) { lastMeaningfulCol = i; break; }
      }
    }
    const headers = dedupeHeaders((headerRow || []).slice(0, lastMeaningfulCol + 1));
    const dataRowsAll = dataRowsAllRaw.map(r => (r || []).slice(0, lastMeaningfulCol + 1));

    if (headerOnly) return res.json({ ok: true, headers, headerIndex, previewCount: dataRowsAll.length, source });
    return res.json({ ok: true, headers, rows: dataRowsAll.slice(0, limit), headerIndex, totalRows: dataRowsAll.length, source });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo leer la hoja' });
  }
});

app.get('/api/branches/:id/products', requireAuth, (req, res) => {
  try {
    const branchId = Number(req.params.id);
    const branch = getOwnedBranch(req, branchId);
    if (!branch) return res.status(404).json({ ok: false, error: 'Sucursal no encontrada' });
    const { page, limit, offset } = getPagination(req, { defaultLimit: 120, maxLimit: 250 });
    const query = String(req.query.q || '').trim();
    const filters = getSearchFilters(req);
    const { whereSql, params } = buildProductWhereClause({ branchId, query, filters });
    const total = db.prepare(`SELECT COUNT(*) AS total FROM products ${whereSql}`).get(...params)?.total || 0;
    const rows = db.prepare(`
      SELECT * FROM products
      ${whereSql}
      ORDER BY name COLLATE NOCASE ASC, variant COLLATE NOCASE ASC, sku COLLATE NOCASE ASC, id ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    res.json({
      ok: true,
      branch: normalizeBranch(branch),
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      items: rows.map(serializeProductRow),
      facets: getProductFacetOptions(branchId),
      query,
      filters,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'No se pudieron listar los productos' });
  }
});

app.get('/api/products/search', requireAuth, (req, res) => {
  try {
    const branchId = Number(req.query.branch_id || req.query.branchId || 0);
    if (!branchId) return res.status(400).json({ ok: false, error: 'branch_id es obligatorio' });
    const branch = getOwnedBranch(req, branchId);
    if (!branch) return res.status(404).json({ ok: false, error: 'Sucursal no encontrada' });
    const { page, limit, offset } = getPagination(req, { defaultLimit: 120, maxLimit: 250 });
    const query = String(req.query.q || '').trim();
    const filters = getSearchFilters(req);
    const { whereSql, params } = buildProductWhereClause({ branchId, query, filters });
    const total = db.prepare(`SELECT COUNT(*) AS total FROM products ${whereSql}`).get(...params)?.total || 0;
    const rows = db.prepare(`
      SELECT * FROM products
      ${whereSql}
      ORDER BY name COLLATE NOCASE ASC, variant COLLATE NOCASE ASC, sku COLLATE NOCASE ASC, id ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    res.json({ ok: true, page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)), items: rows.map(serializeProductRow), query, filters });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'No se pudo buscar productos' });
  }
});

app.get('/api/branches/:id/products-summary', requireAuth, (req, res) => {
  try {
    const branchId = Number(req.params.id);
    const branch = getOwnedBranch(req, branchId);
    if (!branch) return res.status(404).json({ ok: false, error: 'Sucursal no encontrada' });
    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN TRIM(COALESCE(image_url, '')) <> '' THEN 1 ELSE 0 END) AS with_image,
        SUM(CASE WHEN TRIM(COALESCE(image_url, '')) = '' THEN 1 ELSE 0 END) AS without_image,
        SUM(CASE WHEN TRIM(COALESCE(location, '')) <> '' THEN 1 ELSE 0 END) AS with_location,
        SUM(CASE WHEN TRIM(COALESCE(location, '')) = '' THEN 1 ELSE 0 END) AS without_location,
        SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) AS with_stock,
        SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) AS without_stock,
        MAX(updated_at) AS last_product_update
      FROM products
      WHERE branch_id = ?
    `).get(branchId) || {};
    res.json({ ok: true, branch: normalizeBranch(branch), summary, facets: getProductFacetOptions(branchId) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'No se pudo obtener el resumen' });
  }
});

app.get('/api/debug/persistence', requireAuth, (req, res) => {
  try {
    const companyId = getSessionCompanyId(req);
    const branchCount = db.prepare('SELECT COUNT(*) AS total FROM branches WHERE company_id = ?').get(companyId)?.total || 0;
    const sheetCount = db.prepare('SELECT COUNT(*) AS total FROM branch_sheet_config').get()?.total || 0;
    const layoutCount = db.prepare('SELECT COUNT(*) AS total FROM branch_layouts').get()?.total || 0;
    const appStateCount = db.prepare('SELECT COUNT(*) AS total FROM app_state_blobs WHERE company_id = ?').get(companyId)?.total || 0;
    const lastBoot = db.prepare("SELECT value, updated_at FROM system_meta WHERE key = 'last_boot_at'").get();
    res.json({ ok: true, data_dir: DATA_DIR, db_path: DB_PATH, company_id: companyId, branch_count: branchCount, sheet_count: sheetCount, layout_count: layoutCount, app_state_count: appStateCount, last_boot: lastBoot || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'debug failed' });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WMS app corriendo en http://localhost:${PORT}`);
  console.log('Usuario inicial: admin');
  console.log('Contraseña inicial: admin123');
  console.log('DATA_DIR:', DATA_DIR);
  console.log('DB_PATH:', DB_PATH);
console.log('*** SESSION COOKIE FIX ACTIVE ***');
});

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `sucursal-${Date.now()}`;
}

function uniqueSlug(baseSlug, excludeId = null) {
  const base = slugify(baseSlug);
  let candidate = base;
  let i = 2;
  while (true) {
    const row = db.prepare('SELECT id FROM branches WHERE slug = ?').get(candidate);
    if (!row || row.id === excludeId) return candidate;
    candidate = `${base}-${i++}`;
  }
}