/**
 * SearchQueryMatcher — post-retrieval query relevance filter.
 *
 * This is a provider-agnostic, post-retrieval filter that matches
 * product titles against the search query using token-based scoring.
 *
 * The filter runs after normalization and deduplication, providing a
 * deterministic way to reject irrelevant products without modifying
 * the existing provider pipeline.
 *
 * @example
 * const matcher = new SearchQueryMatcher({ threshold: 0.5 });
 * const results = matcher.score(productTitles, 'Monitor 29pol');
 * const filtered = results.filter(r => r.score >= results.threshold);
 */

'use strict';

// ---------------------------------------------------------------------------
// Unit/synonym maps for Brazilian Portuguese → English normalization
// ---------------------------------------------------------------------------

const UNIT_MAP = {
  'pol': 'in',        // polegadas = inches
  'polgadas': 'in',   // full word
  'pulg': 'in',       // abbrev
  'pulgadas': 'in',
  'inch': 'in',
  'in': 'in',
  'gb': 'gb',
  'tb': 'tb',
};

// ---------------------------------------------------------------------------
// Token classification weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  brand:      0.30,
  model:      0.25,
  unit:       0.15,
  numeric:    0.10,
  generic:    0.08,
};

// ---------------------------------------------------------------------------
// Brand list (aligned with normalizer.js BRANDS, focused on search)
// ---------------------------------------------------------------------------

const BRANDS = [
  'Intel', 'AMD', 'Nvidia', 'NVIDIA', 'ASUS', 'ASRock',
  'Gigabyte', 'MSI', 'Corsair', 'Kingston', 'Samsung',
  'Western Digital', 'WD', 'Seagate', 'Crucial', 'ADATA',
  'Kingmax', 'HyperX', 'Logitech', 'Razer', 'Cooler Master',
  'EVGA', 'Thermaltake', 'Be Quiet', 'Seasonic', 'FSP',
  'Super Flower', 'NZXT', 'Lian Li', 'Montech', 'SilverStone',
  'Transcend', 'Lexar', 'SanDisk', 'KingSpec',
  'G-Skill', 'Pichau', 'Kabum', 'GeForce',
];

// Map brand names to lowercase tokens for matching
const BRAND_MAP = new Map(
  BRANDS.map(b => [b.toLowerCase(), b])
);

// ---------------------------------------------------------------------------
// Query normalization
// ---------------------------------------------------------------------------

/**
 * Normalize query text: lowercase tokens, resolve unit synonyms.
 *
 * @param {string} query
 * @returns {Array<{text: string, type: string, original: string}>}
 */
function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return [];

  const normalized = query.toLowerCase().trim();
  const tokens = normalized.split(/\s+/);

  // Pre-compute unit lookup set for contains checks
  const unitValues = Object.values(UNIT_MAP).map(v => v.toLowerCase());
  const unitKeys = Object.keys(UNIT_MAP).map(k => k.toLowerCase());

  return tokens.map(token => {
    const isPureNumeric = /^\d+\.?\d*$/.test(token);
    const isExactUnit = unitKeys.includes(token);
    const containsUnit = unitValues.some(u => token.includes(u)) ||
                         unitKeys.some(k => token.toLowerCase().includes(k.toLowerCase()));
    const hasDigits = /\d/.test(token);
    const isBrand = BRAND_MAP.has(token);

    let type = 'generic';

    if (isPureNumeric) type = 'numeric';
    else if (isExactUnit || containsUnit) type = 'unit';
    else if (isBrand) type = 'brand';
    else if (hasDigits) type = 'model';

    return {
      text: token,
      type,
      original: token,
    };
  });
}

// ---------------------------------------------------------------------------
// Product title normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a product title for comparison: lowercase, trim, collapse spaces.
 * Uses the existing normalizeTitle if available.
 *
 * @param {string} title
 * @returns {string}
 */
function normalizeTitle(title) {
  if (!title) return '';
  let n = String(title);
  n = n
    .replace(/[*\u2605\u2B50]+\u200B?/g, '')
    .replace(/Avalia\u00e7\u00e3o\s*[\d.,]+\s*de\s*[\d.,]*/gi, '')
    .replace(/^Selo:\s*\S+(?:\s+\S+)?\s*/i, '')
    .replace(/^Produto\s+Patrocinado\s*/i, '')
    .replace(/frete\s+gr[a\u00e1]tis\*/gi, 'frete grátis')
    .replace(/\s*\d+\s*[xXx\u00D7]\s*de\s*R\$\s*[\d.,]+\s*/gi, ' ')
    .replace(/\s*\(\d+[^)]*\s*[Gg]era\u00e7\u00e3o\)/, '')
    .trim();
  return n.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Token classification
// ---------------------------------------------------------------------------

/**
 * Classify tokens from a normalized title.
 *
 * @param {Object} titleObj - { title: string, normalizedTitle: string, brand: string | null, model: string | null }
 * @returns {Array<{text: string, type: string}>}
 */
function classifyTokens(titleObj) {
  const normalized = normalizeTitle(titleObj.normalizedTitle || titleObj.title || '');
  const titleParts = normalized.split(/\s+/);

  const tokens = titleParts.map(text => {
    const lower = text.toLowerCase();
    let type = 'generic';

    if (BRAND_MAP.has(lower)) type = 'brand';
    else if (/\d/.test(text) && text.length <= 8) type = 'model';
    else if (text.match(/^(in|inch|inches|pol|pulgadas|gb|tb|m\.2|nvme|ssd|hdd|ddr|sata|pci)$/i)) type = 'unit';
    else if (text.length >= 2) type = 'generic';
    else type = 'generic';

    return { text, type };
  });

  // Add brand token if present
  if (titleObj.brand) {
    const brandLower = titleObj.brand.toLowerCase();
    const existingBrand = tokens.find(
      t => t.type === 'brand' && t.text.toLowerCase() === brandLower
    );
    if (!existingBrand) {
      tokens.push({ text: brandLower, type: 'brand' });
    }
  }

  // Add model token if present
  if (titleObj.model) {
    const modelLower = titleObj.model.toLowerCase();
    const existingModel = tokens.find(
      t => t.type === 'model' && t.text.toLowerCase() === modelLower
    );
    if (!existingModel) {
      tokens.push({ text: modelLower, type: 'model' });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score a product title against a query.
 *
 * Returns:
 * - score: number (0 to 1)
 * - matchedTokens: array of matched query tokens
 * - unmatchedTokens: array of unmatched query tokens
 *
 * @param {Object} titleObj - product title object
 * @param {string} query
 * @returns {{ score: number, matchedTokens: string[], unmatchedTokens: string[] }}
 */
function scoreProduct(titleObj, query) {
  const queryTokens = normalizeQuery(query);
  const titleTokens = classifyTokens(titleObj);

  if (queryTokens.length === 0) {
    return { score: 1.0, matchedTokens: [], unmatchedTokens: [] };
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedTokens = [];
  const unmatchedTokens = [];

  for (const qToken of queryTokens) {
    const weight = WEIGHTS[qToken.type] || WEIGHTS.generic;
    totalWeight += weight;

    const matched = titleTokens.find(t => {
      if (qToken.type === 'unit') {
        // Check unit aliases: exact match or token contains unit value (handles 1TB, 2TB, etc.)
        return Object.values(UNIT_MAP).some(v => t.text.toLowerCase().includes(v)) ||
               t.text.toLowerCase().includes(qToken.text.toLowerCase());
      }
      return t.text.toLowerCase() === qToken.text.toLowerCase() ||
             (qToken.type === 'model' && t.type === 'model') ||
             (qToken.type === 'brand' && t.type === 'brand');
    });

    if (matched) {
      matchedWeight += weight;
      matchedTokens.push(qToken.text);
    } else {
      unmatchedTokens.push(qToken.text);
    }
  }

  const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  return {
    score: Math.min(score, 1.0),
    matchedTokens,
    unmatchedTokens,
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Filter products by relevance score.
 *
 * @param {Array<Object>} products - product array with title/normalizedTitle
 * @param {string} query
 * @param {number} [threshold] - minimum score (0-1)
 * @returns {{ results: Array, filteredCount: number, totalBefore: number }}
 */
function filterByQuery(products, query, threshold = 0.3) {
  if (!products || !Array.isArray(products) || !query) {
    return { results: products || [], filteredCount: 0, totalBefore: products?.length || 0 };
  }

  const results = products.map(product => {
    const titleObj = {
      title: product.title || product.originalTitle || product.name || '',
      normalizedTitle: product.normalizedTitle || '',
      brand: product.brand || null,
      model: product.model || null,
    };

    const scoring = scoreProduct(titleObj, query);

    return {
      ...product,
      _matchScore: scoring.score,
      _matchedTokens: scoring.matchedTokens,
      _unmatchedTokens: scoring.unmatchedTokens,
    };
  });

  const thresholdForFilter = threshold || 0.3;
  const filtered = results.filter(r => r._matchScore >= thresholdForFilter);

  return {
    results: filtered,
    filteredCount: results.length - filtered.length,
    totalBefore: results.length,
  };
}

// ---------------------------------------------------------------------------
// SearchPipeline integration helper
// ---------------------------------------------------------------------------

/**
 * SearchPipeline wrapper: integrates the matcher into the pipeline flow.
 *
 * @param {Array<Object>} allProducts - all aggregated products
 * @param {string} query - search query
 * @param {number} threshold
 * @returns {{ results: Array, pipeline: Object }}
 */
function searchPipeline(allProducts, query, threshold = 0.3) {
  const filtered = filterByQuery(allProducts, query, threshold);

  // Clean up internal fields before returning
  const cleanResults = filtered.results.map(({ _matchScore, _matchedTokens, _unmatchedTokens, ...rest }) => ({
    ...rest,
    _relevanceScore: _matchScore,
    _matchedTokens: _matchedTokens,
    _unmatchedTokens: _unmatchedTokens,
  }));

  return {
    results: cleanResults,
    pipeline: {
      query,
      threshold,
      totalProducts: filtered.totalBefore,
      filteredProducts: filtered.filteredCount,
      keptCount: filtered.results.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

const SearchQueryMatcher = {
  normalizeQuery,
  normalizeTitle,
  classifyTokens,
  scoreProduct,
  filterByQuery,
  searchPipeline,
  WEIGHTS,
  BRANDS,
  UNIT_MAP,
};

module.exports = {
  SearchQueryMatcher,
  normalizeQuery,
  normalizeTitle,
  classifyTokens,
  scoreProduct,
  filterByQuery,
  searchPipeline,
};
