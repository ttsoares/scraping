/**
 * MultiProviderSearcher — orchestrates search across multiple providers.
 *
 * Accepts multiple provider instances, executes them in parallel,
 * aggregates results into one collection, records per-provider errors,
 * and deduplicates products across providers.
 *
 * Single-provider execution continues to work unchanged (uses the
 * existing SearchService.search() path).
 *
 * @example
 * const searcher = new MultiProviderSearcher({ providers: [pichau, kabum, ml] });
 * const result = await searcher.searchMany('ssd 1tb');
 */

const { randomUUID } = require('crypto');
const { SearchService } = require('./SearchService');
const { StorageDeviceExtractor } = require('../StorageDeviceExtractor');
const ComparisonEngine = require('../comparison/ComparisonEngine');
const { normalizeProduct: _normalizeProduct } = require('../providers/normalizer');

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicate products across providers.
 * Primary key = URL; secondary key = title.
 *
 * @param {Array} allProducts
 * @returns {Array} deduplicated products
 */
function deduplicateProducts(allProducts) {
  const byUrl = new Map();

  for (const product of allProducts) {
    const urlKey = product.url || '';
    if (urlKey && !byUrl.has(urlKey)) {
      byUrl.set(urlKey, product);
    } else if (urlKey && byUrl.has(urlKey)) {
      const existing = byUrl.get(urlKey);
      if (product.source && !existing.source) {
        byUrl.set(urlKey, product);
      }
    }
  }

  const products = Array.from(byUrl.values());

  // Secondary dedup: titles that were not caught by URL dedup.
  // Use (title, provider) as the composite key so that products with the
  // same title from different providers are kept (they are different
  // listings with different URLs).
  const seenTitles = new Set();
  const filtered = [];
  for (const product of products) {
    const titleKey = (product.title || '').toLowerCase().trim();
    const providerKey = (product.provider || '').toLowerCase().trim();
    const providerSrc = (product.source || '').toLowerCase().trim();
    const providerLabel = providerKey || providerSrc;
    const compositeKey = `${titleKey}|${providerLabel}`;
    if (titleKey && seenTitles.has(compositeKey)) continue;
    seenTitles.add(compositeKey);
    filtered.push(product);
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Canonical product builder (reuses StorageDeviceExtractor)
// ---------------------------------------------------------------------------

function buildCanonical(product) {
  const title = product.originalTitle || product.title || '';
  const source = product.provider || product.source || '';

  const canonical = StorageDeviceExtractor.extract(title, { source });

  return {
    ...canonical,
    provenance: {
      provider: product.provider || product.source,
      originalTitle: product.originalTitle || product.title,
      normalizedTitle: product.normalizedTitle,
      url: product.url,
    },
  };
}

// ---------------------------------------------------------------------------
// Comparison builder (reuses existing logic)
// ---------------------------------------------------------------------------

function canonicalFromComparisonProduct(product) {
  if (product && product.category === 'StorageDevice') return product;

  const title = product.normalizedTitle || product.originalTitle || product.title;
  return {
    ...StorageDeviceExtractor.extract(title, {
      source: product.provider || product.source,
      url: product.url,
    }),
    provenance: {
      provider: product.provider || product.source,
      originalTitle: product.originalTitle || product.title,
      normalizedTitle: product.normalizedTitle,
      url: product.url,
    },
  };
}

function buildComparisonResults(canonicalProducts, compareAgainst) {
  if (!Array.isArray(compareAgainst) || compareAgainst.length === 0) return [];

  const rightProducts = compareAgainst.map(canonicalFromComparisonProduct);
  const results = [];
  canonicalProducts.forEach((left, leftIndex) => {
    rightProducts.forEach((right, rightIndex) => {
      results.push({
        leftIndex,
        rightIndex,
        left,
        right,
        comparison: ComparisonEngine.compare(left, right),
      });
    });
  });
  return results;
}

// ---------------------------------------------------------------------------
// Search result normalization (mirrors SearchService.search shape)
// ---------------------------------------------------------------------------

function normalizeSearchResult(innerResult, providerName, query) {
  const rawProducts = (innerResult.products || []).slice().map((product) => ({
    ...product,
    provider: product.provider || product.source || providerName,
  }));

  const normalizedProducts = rawProducts.map((p) =>
    _normalizeProduct(p, providerName)
  );

  const canonicalProducts = normalizedProducts.map((p) => buildCanonical(p));
  const comparisonResults = buildComparisonResults(canonicalProducts, []);

  return {
    url: innerResult.url || '',
    products: rawProducts.map((p) => ({
      title: p.title,
      price: p.price,
      priceText: p.priceText,
      url: p.url,
      provider: p.provider,
    })),
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
    canonicalProducts,
    comparisonResults,
    pagination: innerResult.pagination || null,
    productCount: rawProducts.length,
  };
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

class MultiProviderSearcher {
  /**
   * @param {Object} [options]
   * @param {Array} [options.providers] - Array of provider instances (must have .search method)
   * @param {string} [options.providerNames] - Optional custom names for providers
   * @param {string} [options.repositoryPath] - Path to SQLite DB
   * @param {boolean} [options.inMemory=false] - Use in-memory DB
   */
  constructor(options = {}) {
    this.providers = options.providers || [];
    this.providerNames = (options.providerNames || []).slice();
    this._searchService = new SearchService({
      repositoryPath: options.repositoryPath,
      inMemory: options.inMemory,
    });
  }

  /**
   * Search across all configured providers in parallel.
   *
   * Successful results are aggregated into one collection.
   * If a provider fails, its error is recorded and other providers
   * continue normally (partial failure tolerance).
   *
   * @param {string} query - Search query.
   * @param {Object} [options] - Optional search options (e.g. { pageNum }).
   * @returns {Promise<Object>} consolidated search result
   */
  async searchMany(query, options = {}) {
    const searchId = SearchService.createSearchId();
    const startTime = Date.now();

    // Map providers to their names
    const providerDefs = this.providers.map((provider, index) => {
      const name = this.providerNames[index] || this._inferProviderName(provider);
      return { provider, name };
    });

    // Execute all providers in parallel
    const results = await Promise.allSettled(
      providerDefs.map(({ provider, name }) =>
        this._executeProvider(provider, name, query, options)
      )
    );

    // Aggregate successful results and errors
    const successful = [];
    const errors = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const name = providerDefs[i].name;

      if (result.status === 'fulfilled') {
        const normalized = normalizeSearchResult(result.value, name, query);
        successful.push({
          provider: name,
          result: normalized,
          success: true,
        });
      } else {
        errors.push({
          provider: name,
          error: {
            message: result.reason.message || String(result.reason),
            code: result.reason.code || 'PROVIDER_ERROR',
          },
          success: false,
        });
      }
    }

    // Aggregate all products from successful results
    const allProducts = successful
      .map((s) => s.result.products)
      .flat();

    const deduplicatedProducts = deduplicateProducts(allProducts);

    // Compute total execution time
    const executionTime = Date.now() - startTime;

    // Build canonical products from deduplicated results
    const allNormalized = successful
      .map((s) => s.result.normalizedProducts)
      .flat();
    const canonicalProducts = allNormalized.map((p) => buildCanonical(p));
    const comparisonResults = buildComparisonResults(canonicalProducts, []);

    return {
      searchId,
      query,
      executionTime,
      providerCount: providerDefs.length,
      successfulCount: successful.length,
      failedCount: errors.length,
      productCount: deduplicatedProducts.length,

      // Aggregated products with source info
      products: deduplicatedProducts,
      normalizedProducts: allNormalized,
      canonicalProducts,
      comparisonResults,

      // Per-provider results
      providerResults: successful.map((s) => ({
        provider: s.provider,
        success: s.success,
        productCount: s.result.productCount,
        url: s.result.url,
        pagination: s.result.pagination,
      })),

      // Per-provider errors
      errors,

      // Consolidated error
      allFailed: successful.length === 0,
      persistence: {
        searchId,
        persistedProducts: deduplicatedProducts.length,
      },
    };
  }

  /**
   * Execute a single provider's search.
   *
   * @param {Object} provider - Provider instance with .search method
   * @param {string} name - Provider display name
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} provider search result
   */
  async _executeProvider(provider, name, query, options) {
    if (typeof provider.search !== 'function') {
      throw new Error(
        `Provider "${name}" does not have a search() method`
      );
    }
    const rawResult = await provider.search(query, options);
    return {
      ...rawResult,
      provider: name,
    };
  }

  /**
   * Search using the existing SearchService path (single provider).
   * This is the backward-compatible search path.
   *
   * @param {Function} providerFn - provider.search.bind(provider)
   * @param {string} query
   * @param {string} providerName
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async search(providerFn, query, providerName, options) {
    return this._searchService.search(providerFn, query, providerName, options);
  }

  /**
   * Infer provider name from class name (e.g. PichauProvider → 'PichauProvider').
   *
   * @param {Object} provider
   * @returns {string}
   */
  _inferProviderName(provider) {
    if (!provider) return 'unknown';
    const name = provider.constructor.name;
    if (name) return name;
    return 'unknown';
  }

  /**
   * Add a provider to the searcher.
   *
   * @param {Object} provider - Provider instance with .search method
   * @param {string} [name] - Optional provider name
   * @returns {MultiProviderSearcher} this
   */
  addProvider(provider, name) {
    this.providers.push(provider);
    if (name) this.providerNames.push(name);
    return this;
  }

  /**
   * Close the underlying repository.
   */
  async close() {
    await this._searchService.close();
  }
}

module.exports = { MultiProviderSearcher };
