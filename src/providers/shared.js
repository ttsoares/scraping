/**
 * Shared utilities for all product providers.
 *
 * Extracted from PichauProvider, KabumProvider, and MercadoLivreProvider
 * to reduce duplication in price parsing, product normalization, and URL
 * helpers while preserving each provider's unique selectors and strategies.
 */

/**
 * Parse a price string in the format "R$ 1.299,90" and return a number.
 * Falls back to a generic numeric extraction if no currency prefix is found.
 *
 * @param {string} priceText
 * @param {object} [options]
 * @param {string} [options.currencyPrefix='R$'] Currency prefix to look for (e.g. 'R$', '€', '$')
 * @returns {number | null}
 */
function parsePrice(priceText, { currencyPrefix = 'R$' } = {}) {
  if (!priceText) return null;

  const text = String(priceText);
  const escapedPrefix = currencyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalizeNumeric = (value) => {
    const compact = value.trim().replace(/\s+/g, '');
    if (!compact) return null;

    if (compact.includes(',')) {
      const normalized = compact.replace(/\./g, '').replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
      const parsed = Number(compact.replace(/\./g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }

    const normalized = compact.replace(/[^\d.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const isInstallmentContext = (index, length) => {
    const left = text.slice(Math.max(0, index - 12), index).toLowerCase();
    const right = text.slice(index + length, index + length + 4).toLowerCase();
    if (/\d\s*[x×]\s*de\s*$/.test(left) || /\d\s*[x×]\s*$/.test(left)) return true;
    if (/^[x×]/.test(right)) return true;
    return false;
  };

  const prefixPattern = new RegExp(`${escapedPrefix}\\s*([\\d\s.,]+)`, 'gi');
  const prefixCandidates = [];
  let match;

  while ((match = prefixPattern.exec(text)) !== null) {
    if (isInstallmentContext(match.index, match[0].length)) continue;
    const value = normalizeNumeric(match[1]);
    if (Number.isFinite(value) && value > 0) prefixCandidates.push(value);
  }

  if (prefixCandidates.length) {
    return Math.min(...prefixCandidates);
  }

  const fallbackPattern = /\d[\d.,\s]*/g;
  const fallbackCandidates = [];

  while ((match = fallbackPattern.exec(text)) !== null) {
    if (isInstallmentContext(match.index, match[0].length)) continue;
    const value = normalizeNumeric(match[0]);
    if (Number.isFinite(value) && value > 0) fallbackCandidates.push(value);
  }

  if (fallbackCandidates.length) {
    return Math.max(...fallbackCandidates);
  }

  return null;
}

/**
 * Normalize raw product entries into the standard Product schema.
 *
 * Standard schema:
 *   { title, price (number), priceText (string), url (absolute), source }
 *
 * @param {Array} products Raw product entries
 * @param {object} [options]
 * @param {string} [options.HOME_URL] Base URL for resolving relative URLs
 * @param {string} [options.SOURCE] Provider source name (e.g. 'kabum')
 * @param {boolean} [options.dedupTitles] Remove products with duplicate titles
 * @returns {Array} Normalized product objects
 */
function normalizeProducts(products, { HOME_URL, SOURCE, dedupTitles = true } = {}) {
  const seen = new Set();
  return products
    .filter(item => item.title && item.url)
    .map(item => {
      let url;
      if (item.url.startsWith('http')) {
        url = item.url;
      } else {
        url = new URL(item.url, HOME_URL).toString();
      }
      const price = parsePrice(item.priceText);
      const obj = {
        title: item.title,
        price,
        priceText: item.priceText,
        url,
        source: SOURCE
      };
      return obj;
    })
    .filter(item => {
      if (dedupTitles) {
        if (seen.has(item.title)) return false;
        seen.add(item.title);
      }
      return true;
    });
}

/**
 * Build a URL slug from a query string by replacing spaces with hyphens.
 * Preserves the encoding of non-ASCII characters.
 *
 * @param {string} query The search query
 * @returns {string}
 */
function toSearchSlug(query) {
  return encodeURIComponent(query.trim()).replace(/%20/g, '-');
}

/**
 * Build a base search URL with the query slug appended.
 *
 * @param {string} query
 * @param {string} searchBase Base URL (e.g. 'https://lista.mercadolivre.com.br/')
 * @param {function} [slugFn] Optional slug-transform function (defaults to toSearchSlug)
 * @returns {string}
 */
function buildSearchUrl(query, searchBase, slugFn) {
  const fn = slugFn || toSearchSlug;
  return `${searchBase}${fn(query)}`;
}

/**
 * Create pagination helpers that work with DOM links containing a named query parameter.
 *
 * @param {Array<string>} hrefs Raw href attribute values from the DOM
 * @param {string} currentPageUrl Current page URL (for resolving relative URLs)
 * @param {string} paramName The query parameter name (e.g. 'page', 'page_number')
 * @returns {{ pages: number[], currentPage: number, mapToUrls: function }}
 */
function createPaginationState(hrefs, currentPageUrl, paramName) {
  const baseUrl = currentPageUrl;
  const currentUrl = new URL(baseUrl);
  const currentPageNumber = Number(currentUrl.searchParams.get(paramName) || '1');

  const pageMap = new Map();
  for (const href of hrefs) {
    try {
      const url = new URL(href, baseUrl);
      const pageValue = Number(url.searchParams.get(paramName));
      if (Number.isFinite(pageValue) && !pageMap.has(pageValue)) {
        pageMap.set(pageValue, url.toString());
      }
    } catch { /* skip invalid hrefs */ }
  }

  const pages = Array.from(pageMap.keys()).sort((a, b) => a - b);
  const nextPage = pages.find(n => n > currentPageNumber) || null;

  return {
    pages,
    currentPage: currentPageNumber,
    map: pageMap,
    nextPageUrl: nextPage ? pageMap.get(nextPage) : null,
    hasNextPage: Boolean(nextPage)
  };
}

module.exports = {
  parsePrice,
  normalizeProducts,
  toSearchSlug,
  buildSearchUrl,
  createPaginationState
};
