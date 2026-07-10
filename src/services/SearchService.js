/**
 * SearchService — orchestrates the search pipeline.
 *
 * It wraps an existing provider's search() call, stores the result
 * in the backing Repository, and enriches the response with
 * persistence metadata (searchId, persistedProductCount, etc.).
 */

const { randomUUID } = require('crypto');
const { SQLiteRepository } = require('../repository/SQLiteRepository');
const { normalizeProducts } = require('../providers/normalizer');

class SearchService {
  /**
   * @param {Object} [options]
   * @param {string} [options.repositoryPath] - Path to the SQLite DB.
   * @param {boolean} [options.inMemory=false] - Use in-memory DB.
   * @param {string} [options.repository] - Which repository to use ('sqlite' | 'memory').
   */
  constructor(options = {}) {
    this.options = { ...options };
    this.repository = null;
    this._resolved = false;
  }

  static createSearchId() {
    return randomUUID();
  }

  createSearchId() {
    return SearchService.createSearchId();
  }


  /**
   * Resolve (lazy-init) the underlying repository instance.
   */
  async _resolveRepo() {
    if (this._resolved) return;
    if (this.repository) {
      this._resolved = true;
      return;
    }

    if (this.options.repository === 'repo') {
      // Repository pattern: construct via factory
      this.repository = this._createRepository();
    } else {
      this.repository = new SQLiteRepository({
        dbPath: this.options.repositoryPath,
        inMemory: this.options.inMemory,
      });
    }
    this._resolved = true;
  }

  /**
   * Factory method (Repository pattern).
   */
  _createRepository() {
    return new SQLiteRepository({
      dbPath: this.options.repositoryPath,
      inMemory: this.options.inMemory,
    });
  }

  /**
   * Run a full search pipeline.
   * @param {Function} providerFn - e.g. provider.search('query', { pageNum })
   * @param {string} query - Search query.
   * @param {string} providerName - Provider source name.
   * @param {Object} [options] - Options to pass through.
   * @returns {Promise<Object>} search result with persistence metadata.
   */
  async search(providerFn, query, providerName, options = {}) {
    await this._resolveRepo();
    const searchId = this.createSearchId();
    const repo = this.repository;
    const startTime = Date.now();
    let result = null;
    let products = [];
    let searchPersisted = false;

    try {
      // 1. Call the provider's search
      result = await providerFn(query, options);
      products = (result.products || []).slice().map((product) => ({
        ...product,
        provider: product.provider || product.source || providerName,
      }));

      // 2. Normalize products using the dedicated normalizer
      const normalizedProducts = normalizeProducts(products, providerName);

      const statusText = products.length > 0 ? 'success' : 'partial';
      const executionTime = (result.executionTime || 0);

      // 3. Persist via Repository (raw + normalized products)
      await repo.createSearch({
        id: searchId,
        query,
        provider: providerName,
        url: result.url || '',
        status: statusText,
        productCount: products.length,
        executionTime,
        rawJSON: result.rawResponse ? JSON.stringify(result.rawResponse) : null,
        pagination: result.pagination ? JSON.stringify(result.pagination) : null,
      });
      searchPersisted = true;

      await repo.persistRawProducts(searchId, products);
      await repo.persistNormalizedProducts(searchId, normalizedProducts);

      // 4. Enrich the result with both raw and normalized data
      result.searchId = searchId;
      result.persisted = products.length;

      return {
        ...result,
        searchId,
        provider: providerName,
        query,
        url: result.url,
        // Raw products (as returned by provider)
        products: products.map((p) => ({
          title: p.title,
          price: p.price,
          priceText: p.priceText,
          url: p.url,
          provider: p.provider,
        })),
        // Normalized products (side-by-side for comparison)
        normalizedProducts: normalizedProducts.map((np) => ({
          originalTitle: np.originalTitle,
          normalizedTitle: np.normalizedTitle,
          brand: np.brand,
          model: np.model,
          storageCapacity: np.storageCapacity,
          memoryCapacity: np.memoryCapacity,
          currency: np.currency,
          currentPrice: np.currentPrice,
          originalPrice: np.originalPrice,
          originalPriceText: np.originalPriceText,
          availability: np.availability,
          priceText: np.priceText,
          url: np.url,
          provider: np.provider,
        })),
        pagination: result.pagination,
        executionTime,
        productCount: products.length,
        persistence: { searchId, persistedProducts: products.length },
      };
    } catch (err) {
      // On failure still record the search with productCount=0
      const executionTime = result?.executionTime ?? (Date.now() - startTime);
      if (!searchPersisted) {
        await repo.createSearch({
          id: searchId,
          query,
          provider: providerName,
          url: '',
          status: 'failed',
          productCount: 0,
          executionTime,
          rawJSON: result?.rawResponse ? JSON.stringify(result.rawResponse) : null,
          pagination: result?.pagination ? JSON.stringify(result.pagination) : null,
        });
        searchPersisted = true;
      }

      return {
        searchId,
        provider: providerName,
        query,
        url: '',
        products: [],
        pagination: null,
        executionTime,
        productCount: 0,
        persistence: { searchId, persistedProducts: 0, failed: true },
        error: { message: err.message, code: err.code || 'SEARCH_ERROR' },
      };
    }
  }

  /**
   * Return repository status.
   * @returns {Promise<Object>}
   */
  async getDBStatus() {
    await this._resolveRepo();
    return this.repository.getDBStatus();
  }

  /**
   * Return a specific search record from the DB.
   * @param {string} searchId
   * @returns {Promise<Object|null>}
   */
  async getSearchRecord(searchId) {
    await this._resolveRepo();
    return this.repository.getSearch(searchId);
  }

  /**
   * Close the repository if open.
   */
  async close() {
    if (this.repository) {
      await this.repository.close();
      this.repository = null;
    }
  }
}

module.exports = { SearchService };
