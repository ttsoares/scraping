/**
 * Repository Abstraction
 *
 * Provides a storage-agnostic interface for search metadata and product data.
 * The rest of the system queries the repository without knowing whether the
 * backend is SQLite, PostgreSQL, or another engine.
 *
 * Future implementations need only satisfy this interface.
 */

const PATHS = {
  default: 'data/scraper.db',
  production: 'data/scraper.db',
  test: 'data/scraper-test.db',
};

/**
 * @typedef {Object} SearchRecord
 * @property {string} id - Unique search identifier (UUID v4).
 * @property {string} query - Normalized search query string.
 * @property {string} provider - Provider source (e.g. 'pichau').
 * @property {string} url - Provider search URL.
 * @property {string} status - 'success' | 'failed' | 'partial'.
 * @property {number} productCount - Number of products returned.
 * @property {number} [executionTime] - Duration in milliseconds.
 * @property {string} [rawJSON] - Serialized raw provider response.
 * @property {string} [pagination] - Serialized pagination metadata.
 * @property {string} createdAt - ISO timestamp.
 */

/**
 * @typedef {Object} ProductRecord
 * @property {string} id - Unique product identifier.
 * @property {string} searchId - FK to searches.id.
 * @property {string} provider - Provider source.
 * @property {string} [providerProductId] - Provider's own ID (if available).
 * @property {string} title - Cleaned product title.
 * @property {string} priceText - Original price string (e.g. 'R$ 1.234,56').
 * @property {number} price - Normalized numeric price.
 * @property {string} url - Absolute product URL.
 * @property {string} source - Source name (same as provider for now).
 * @property {string} [rawJSON] - Serialized raw provider product object.
 * @property {string} createdAt - ISO timestamp.
 */

/**
 * Database status for monitoring.
 * @typedef {Object} DBStatus
 * @property {boolean} isAvailable - Whether the database is reachable.
 * @property {number} searchCount - Total searches persisted.
 * @property {number} productCount - Total products persisted.
 * @property {string} [version] - SQLite version.
 */

class Repository {
  /**
   * Create a new search record and return its id.
   * @param {Object} params
   * @param {string} params.id - Unique search identifier.
   * @param {string} params.query
   * @param {string} params.provider
   * @param {string} params.url
   * @param {string} params.status
   * @param {number} [params.productCount]
   * @param {number} [params.executionTime]
   * @param {string} [params.rawJSON]
   * @param {string} [params.pagination]
   * @returns {string} search id
   */
  async createSearch(params) {
    throw new Error('createSearch must be implemented');
  }

  /**
   * Persist raw provider products for a given search.
   * @param {string} searchId
   * @param {Array<Object>} products - Raw provider product objects
   * @returns {number} number of rows inserted
   */
  async persistRawProducts(searchId, products) {
    throw new Error('persistRawProducts must be implemented');
  }

  /**
   * Persist normalized product records for a given search.
   * @param {string} searchId
   * @param {Array<Object>} products - Normalized product objects
   * @returns {number} number of rows inserted
   */
  async persistNormalizedProducts(searchId, products) {
    throw new Error('persistNormalizedProducts must be implemented');
  }

  /**
   * Retrieve a complete search record.
   * @param {string} searchId
   * @returns {Promise<SearchRecord & { rawProducts: Array<Object>, normalizedProducts: Array<Object> }>}
   */
  async getSearch(searchId) {
    throw new Error('getSearch must be implemented');
  }

  /**
   * Get database status (counts, version, availability).
   * @returns {Promise<DBStatus>}
   */
  async getDBStatus() {
    throw new Error('getDBStatus must be implemented');
  }

  /**
   * Close the repository (free resources).
   */
  async close() {
    // No-op by default; override in implementations.
  }
}

module.exports = { Repository, PATHS };
