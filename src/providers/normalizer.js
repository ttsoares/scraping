/**
 * Product Normalization Layer
 *
 * Provides shared normalization functions that all providers use to converge
 * toward a common representation. The original provider data is preserved
 * alongside the normalized values.
 */

const { parsePrice } = require('./shared');

const BRANDS = [
  'Intel', 'AMD', 'Nvidia', 'NVIDIA', 'ASUS', 'ASRock',
  'Gigabyte', 'MSI', 'Corsair', 'Kingston', 'Samsung',
  'Western Digital', 'WD', 'Seagate', 'Crucial', 'ADATA',
  'Kingmax', 'HyperX', 'Logitech', 'Razer', 'Cooler Master',
  'EVGA', 'Thermaltake', 'Be Quiet', 'Seasonic', 'FSP',
  'Super Flower', 'NZXT', 'Lian Li', 'Montech', 'SilverStone',
  'Transcend', 'Lexar', 'SanDisk', 'KingSpec',
  'G-Skill', 'Pichau', 'Kabum',
];

/**
 * Normalize a product title: trim, collapse spaces, remove noise.
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
    .replace(/Frete\s+gr[a\u00e1]tis\*?/gi, '')
    .replace(/\s*\d+\s*[xXx\u00D7]\s*de\s*R\$\s*[\d.,]+\s*/gi, ' ')
    .replace(/\s*\(\d+\w*\s*[Gg]era\u00e7\u00e3o\)/, '')
    .trim();
  return n.replace(/\s+/g, ' ').trim();
}

/**
 * Detect brand from title text.
 * @param {string} title
 * @returns {string | null}
 */
function extractBrand(title) {
  if (!title) return null;
  const escaped = BRANDS.map(b => b.replace(/[.*+?${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'i');
  const match = regex.exec(title);
  return match ? match[1] : null;
}

/**
 * Extract model from title (e.g., "Ryzen 9 5600X", "A400", "GeForce RTX 3060").
 * @param {string} title
 * @returns {string | null}
 */
function extractModel(title) {
  if (!title) return null;
  const clean = normalizeTitle(title);
  if (!clean) return null;

  const patterns = [
    /\b(GeForce\s+(?:RTX|GTX)\s*[\d]+(?:\s*Ti)?(?:\s+[\w]+)?)/i,
    /\b(Ryzen\s+(?:\d+\s*[^\s]+|9\s+[\d]+(?:[^\s]*)))/i,
    /\b(Core\s+(?:i\d|3|5|7|9)[\s.\d\-IX]+)/i,
    /\b([A-Z][\d]{2,4}[A-Z]?)/,
  ];

  for (const pat of patterns) {
    const m = pat.exec(clean);
    if (m && m[1]) {
      const brand = extractBrand(title);
      if (brand && m[1].trim().toLowerCase() === brand.toLowerCase().split(' ')[0]) continue;
      return m[1].trim();
    }
  }

  if (clean.length > 0) {
    const brand = extractBrand(title);
    if (brand) {
      const idx = clean.indexOf(brand);
      if (idx >= 0) {
        const rest = clean.slice(idx + brand.length).trim();
        if (rest.length > 0 && rest.length < 60) return rest;
      }
    }
    const tokens = clean.split(/\s+/);
    for (const t of tokens) {
      if (t.length >= 2 && /\d/.test(t)) return t;
    }
  }
  return clean || null;
}

/**
 * Extract storage capacity (SSD/HDD/TB/GB) from title.
 * @param {string} title
 * @returns {string | null}
 */
function extractStorageCapacity(title) {
  if (!title) return null;
  const lower = title.toLowerCase();

  if (!lower.includes('ssd') && !lower.includes('hdd') &&
      !lower.includes('nvme') && !lower.includes('armazen') &&
      !lower.includes('tb') && !lower.includes('gb')) {
    return null;
  }

  const patterns = [
    /\b(\d+\.\d+\s*TB)\b/i,
    /\b(\d+(?:\.\d+)?\s*TB)\b/i,
    /\b(\d+(?:\.\d+)?\s*GB)\b/i,
    /\b(\d{2,4}\s*GB)\b/i,
  ];

  for (const p of patterns) {
    const m = p.exec(title);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

/**
 * Extract memory (RAM) capacity from title.
 * @param {string} title
 * @returns {string | null}
 */
function extractMemoryCapacity(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  const hasRamKeyword = lower.includes('ram') || lower.includes('dimm')
    || lower.includes('ddr') || lower.includes('mem\u00f3ria');

  if (!hasRamKeyword && !/\b\d+(?:\.\d+)?\s*GB/i.test(title)) return null;

  const m = /\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i.exec(title);
  return m ? m[1].trim() : null;
}

/**
 * Normalize currency to BRL.
 * @param {string} priceText
 * @returns {"BRL"}
 */
function normalizeCurrency(priceText) {
  if (!priceText) return 'BRL';
  return /r\$|real/i.test(priceText) ? 'BRL' : 'BRL';
}

/**
 * Normalize price to numeric BRL value.
 * @param {number | null} price
 * @param {string | null} priceText
 * @param {string} currency
 * @returns {{ currentPrice: number | null, originalPrice: number | null }}
 */
function normalizePrice(price, priceText, currency) {
  let currentPrice = price;
  let originalPrice = null;

  if (currentPrice == null && priceText) {
    currentPrice = parsePrice(priceText, { currencyPrefix: currency === 'BRL' ? 'R$' : '$' });
    originalPrice = currentPrice;
  } else if (currentPrice != null) {
    originalPrice = currentPrice;
    if (priceText) {
      const dm = String(priceText).match(/(\d+(?:\.\d+)?,?\d+).*?(\d+(?:\.\d+)?,?\d+)/);
      if (dm) {
        const a = parseFloat(dm[1].replace(/\./g, '').replace(',', '.'));
        const b = parseFloat(dm[2].replace(/\./g, '').replace(',', '.'));
        if (Number.isFinite(a) && Number.isFinite(b)) {
          currentPrice = a > 0 ? a : currentPrice;
          originalPrice = b > currentPrice ? b : currentPrice;
        }
      }
    }
  }

  if (currentPrice == null) currentPrice = null;
  if (originalPrice == null) originalPrice = currentPrice;

  return {
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
    originalPrice: Number.isFinite(originalPrice) ? originalPrice : null,
    currency: normalizeCurrency(priceText)
  };
}

/**
 * Detect availability.
 * @param {string} title
 * @param {string | null} priceText
 * @param {string} provider
 * @returns {"in_stock" | "out_of_stock" | "unknown"}
 */
function detectAvailability(title, priceText, provider) {
  if (!title) return 'unknown';
  const combined = (title + ' ' + (priceText || '')).toLowerCase();
  const outOfStock = ['fora de estoque', 'sem estoque', 'indispon\u00edvel',
    'esgotado', 'sem disponibilidade', 'out of stock'];
  for (const p of outOfStock) {
    if (combined.includes(p)) return 'out_of_stock';
  }
  if (priceText && /\d/.test(priceText)) return 'in_stock';
  return provider === 'kabum' ? (priceText ? 'in_stock' : 'unknown') : 'in_stock';
}

/**
 * Full single-product normalization.
 * @param {Object} rawProduct
 * @param {string} [provider]
 * @returns {Object}
 */
function normalizeProduct(rawProduct, provider) {
  const originalTitle = rawProduct.title || '';
  const priceResult = normalizePrice(rawProduct.price, rawProduct.priceText, rawProduct.currency || 'BRL');

  return {
    provider: rawProduct.provider || rawProduct.source || provider || '',
    originalTitle,
    normalizedTitle: normalizeTitle(originalTitle),
    brand: extractBrand(originalTitle),
    model: extractModel(originalTitle),
    storageCapacity: extractStorageCapacity(originalTitle),
    memoryCapacity: extractMemoryCapacity(originalTitle),
    currency: priceResult.currency,
    currentPrice: priceResult.currentPrice,
    originalPrice: priceResult.originalPrice,
    priceText: rawProduct.priceText,
    originalPriceText: rawProduct.priceText,
    availability: detectAvailability(originalTitle, rawProduct.priceText, provider),
    url: rawProduct.url,
    confidence: 1.0,
  };
}

/**
 * Batch normalization.
 * @param {Array} products
 * @param {string} provider
 * @returns {Array}
 */
function normalizeProducts(products, provider) {
  if (!Array.isArray(products)) return [];
  return products.map(p => normalizeProduct(p, provider));
}

module.exports = {
  normalizeTitle,
  extractBrand,
  extractModel,
  extractStorageCapacity,
  extractMemoryCapacity,
  normalizeCurrency,
  normalizePrice,
  detectAvailability,
  normalizeProduct,
  normalizeProducts,
};
