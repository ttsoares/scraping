/**
 * SQLite Repository Implementation
 *
 * Uses better-sqlite3 (synchronous, no ORM) for persistence.
 * Provides a full schema for search metadata, raw and normalized products.
 * Prepared for future: duplicate detection, price history, confidence scores.
 */

const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');
const { Repository, PATHS } = require('./Repository');

/**
 * Schema version for migration tracking.
 */
const SCHEMA_VERSION = 2;

/**
 * Schema SQL (creates all tables if they don't exist).
 * Prepared columns for future features (marked with #future).
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS searches (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    provider TEXT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    productCount INTEGER NOT NULL DEFAULT 0,
    executionTime INTEGER,
    rawJSON TEXT,        -- JSON blob from provider
    pagination TEXT,       -- serialized pagination metadata
    schemaVersion INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_searches_provider ON searches(provider);
  CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query);
  CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(createdAt);

  CREATE TABLE IF NOT EXISTS raw_products (
    id TEXT PRIMARY KEY,
    searchId TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerProductId TEXT,
    title TEXT NOT NULL,
    priceText TEXT,
    price REAL,
    url TEXT,
    source TEXT DEFAULT 'raw',
    rawJSON TEXT,        -- full provider product object
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (searchId) REFERENCES searches(id)
  );

  CREATE INDEX IF NOT EXISTS idx_raw_products_search ON raw_products(searchId);
  CREATE INDEX IF NOT EXISTS idx_raw_products_provider_product ON raw_products(provider, providerProductId);

  CREATE TABLE IF NOT EXISTS normalized_products (
    id TEXT PRIMARY KEY,
    searchId TEXT NOT NULL,
    provider TEXT NOT NULL,
    originalTitle TEXT NOT NULL,
    normalizedTitle TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    storageCapacity TEXT,
    memoryCapacity TEXT,
    currency TEXT NOT NULL DEFAULT 'BRL',
    currentPrice REAL,
    originalPrice REAL,
    originalPriceText TEXT,
    availability TEXT,
    priceText TEXT,
    price REAL,
    url TEXT,
    source TEXT DEFAULT 'normalized',
    confidence REAL,     -- scoring for AI enrichment
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (searchId) REFERENCES searches(id)
  );

  CREATE INDEX IF NOT EXISTS idx_normalized_products_search ON normalized_products(searchId);

  -- Prepared for future features (currently no-op):
  -- - duplicate detection: unique(provider + providerProductId)
  -- - price_history: add version column
  -- - canonical mapping: add canonical_id column
`;

/**
 * SQLite Repository implementation.
 */
class SQLiteRepository extends Repository {
  /**
   * @param {Object} [options]
   * @param {string} [options.dbPath] - Path to the SQLite database file.
   * @param {boolean} [options.fileBased] - Whether to use file-based or in-memory database.
   */
  constructor(options = {}) {
    super();
    const { dbPath, fileBased = true } = options;

    if (fileBased) {
      const resolvedPath = path.resolve(dbPath || PATHS.default);
      // Create parent directory if it doesn't exist
      const fs = require('fs');
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(resolvedPath);
      this.dbPath = resolvedPath;
    } else {
      this.db = new Database(':memory:');
      this.dbPath = ':memory:';
    }

    this._init();
  }

  /**
   * Initialize schema and verify version.
   * @private
   */
  _init() {
    this.db.exec(SCHEMA_SQL);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Verify schema version
    const result = this.db
      .prepare('SELECT schemaVersion FROM searches LIMIT 1')
      .get();
    if (result && result.schemaVersion !== SCHEMA_VERSION) {
      // future: run migrations
      console.warn(`[SQLiteRepository] Schema version mismatch: expected ${SCHEMA_VERSION}, got ${result.schemaVersion}`);
    }
  }

  /**
   * @inheritdoc
   */
  async createSearch({
    id,
    query,
    provider,
    url,
    status = 'success',
    productCount = 0,
    executionTime,
    rawJSON,
    pagination,
  }) {
    if (!id) {
      throw new Error('searchId is required');
    }
    const searchId = id;
    const rawJSONStr = rawJSON ? (typeof rawJSON === 'string' ? rawJSON : JSON.stringify(rawJSON)) : null;
    const paginationStr = pagination ? (typeof pagination === 'string' ? pagination : JSON.stringify(pagination)) : null;

    this.db.prepare(`
      INSERT INTO searches (id, query, provider, url, status, productCount, executionTime, rawJSON, pagination)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      searchId,
      query,
      provider,
      url,
      status,
      productCount,
      executionTime || null,
      rawJSONStr,
      paginationStr,
    );

    return searchId;
  }

  /**
   * @inheritdoc
   */
  async persistRawProducts(searchId, products) {
    const insert = this.db.prepare(`
      INSERT INTO raw_products (id, searchId, provider, providerProductId, title, priceText, price, url, rawJSON)
      VALUES (@id, @searchId, @provider, @providerProductId, @title, @priceText, @price, @url, @rawJSON)
    `);

    this.db.transaction(() => {
      for (const p of products) {
        insert.run({
          id: randomUUID(),
          searchId,
          provider: p.provider || '',
          providerProductId: p.providerProductId || null,
          title: p.title,
          priceText: p.priceText || null,
          price: typeof p.price === 'number' ? p.price : this._parsePrice(p.price),
          url: p.url,
          rawJSON: typeof p.rawJSON === 'string' ? p.rawJSON : JSON.stringify(p.rawJSON || p),
        });
      }
    })();

    return products.length;
  }

  /**
   * @inheritdoc
   */
  async persistNormalizedProducts(searchId, products) {
    const insert = this.db.prepare(`
      INSERT INTO normalized_products
        (id, searchId, provider, originalTitle, normalizedTitle,
         brand, model, storageCapacity, memoryCapacity,
         currency, currentPrice, originalPrice, originalPriceText,
         availability, priceText, price, url, confidence)
      VALUES
        (@id, @searchId, @provider, @originalTitle, @normalizedTitle,
         @brand, @model, @storageCapacity, @memoryCapacity,
         @currency, @currentPrice, @originalPrice, @originalPriceText,
         @availability, @priceText, @price, @url, @confidence)
    `);

    this.db.transaction(() => {
      for (const p of products) {
        insert.run({
          id: randomUUID(),
          searchId,
          provider: p.provider || null,
          originalTitle: p.originalTitle || p.title || null,
          normalizedTitle: p.normalizedTitle || p.title || null,
          brand: p.brand || null,
          model: p.model || null,
          storageCapacity: p.storageCapacity || null,
          memoryCapacity: p.memoryCapacity || null,
          currency: p.currency || 'BRL',
          currentPrice: typeof p.currentPrice === 'number' ? p.currentPrice : this._parsePrice(p.price),
          originalPrice: typeof p.originalPrice === 'number' ? p.originalPrice : this._parsePrice(p.price),
          originalPriceText: p.originalPriceText || p.priceText || null,
          availability: p.availability || null,
          priceText: p.priceText || null,
          price: typeof p.price === 'number' ? p.price : this._parsePrice(p.price),
          url: p.url,
          confidence: p.confidence || 1.0,
        });
      }
    })();

    return products.length;
  }

  /**
   * @inheritdoc
   */
  async getSearch(searchId) {
    const search = this.db.prepare(`
      SELECT * FROM searches WHERE id = ?
    `).get(searchId);

    if (!search) {
      return null;
    }

    const rawProducts = this.db.prepare(`
      SELECT * FROM raw_products WHERE searchId = ?
    `).all(searchId);

    const normalizedProducts = this.db.prepare(`
      SELECT * FROM normalized_products WHERE searchId = ?
    `).all(searchId);

    // Parse JSON fields
    const result = { ...search };
    if (result.rawJSON) {
      try { result.rawJSON = JSON.parse(result.rawJSON); } catch { /* keep as string */ }
    }
    if (result.pagination) {
      try { result.pagination = JSON.parse(result.pagination); } catch { /* keep as string */ }
    }

    return {
      ...result,
      rawProducts,
      normalizedProducts,
    };
  }

  /**
   * @inheritdoc
   */
  async getDBStatus() {
    const searchCount = this.db.prepare('SELECT COUNT(*) as count FROM searches').get().count;
    const rawProductCount = this.db.prepare('SELECT COUNT(*) as count FROM raw_products').get().count;
    const normalizedProductCount = this.db.prepare('SELECT COUNT(*) as count FROM normalized_products').get().count;

    return {
      isAvailable: true,
      searchCount,
      productCount: rawProductCount + normalizedProductCount,
      rawProductCount,
      normalizedProductCount,
      dbPath: this.dbPath,
      version: SCHEMA_VERSION,
    };
  }

  /**
   * Close the database connection.
   */
  async close() {
    this.db.close();
  }

  /**
   * Helper: parse a numeric price from various formats.
   * @param {string|number} value
   * @returns {number}
   * @private
   */
  _parsePrice(value) {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value !== 'string') {
      return 0;
    }
    // Remove currency symbols, spaces, and convert 'x.xxx,xx' (PT-BR) to numeric
    const cleaned = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}

module.exports = { SQLiteRepository, SCHEMA_VERSION };
