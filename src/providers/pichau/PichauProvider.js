const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
const {ProductProvider} = require('../ProductProvider');

chromium.use(stealthPlugin);

const HOME_URL = 'https://www.pichau.com.br/';
const SOURCE = 'pichau';

// --- Custom error types for meaningful error differentiation ---

class PichauProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PichauProviderError';
    this.code = code; // e.g., 'CLOUDFLARE', 'NO_PRODUCTS', 'INPUT_NOT_FOUND', 'TIMEOUT', 'NAVIGATION', 'DOM_CHANGED'
  }
}

class CloudflareDetected extends PichauProviderError {
  constructor() {
    super('Cloudflare challenge detected. Expected status 200/404 with application HTML.', 'CLOUDFLARE');
    this.name = 'CloudflareDetected';
  }
}

class NoProductsFound extends PichauProviderError {
  constructor(query) {
    super(`Search for "${query}" returned zero products after retry.`, 'NO_PRODUCTS');
    this.name = 'NoProductsFound';
  }
}

class SearchInputNotFound extends PichauProviderError {
  constructor() {
    super('Search input not found within timeout.', 'INPUT_NOT_FOUND');
    this.name = 'SearchInputNotFound';
  }
}

class NavigationError extends PichauProviderError {
  constructor(message) {
    super(`Navigation failure: ${message}`, 'NAVIGATION');
    this.name = 'NavigationError';
  }
}

class TimeoutError extends PichauProviderError {
  constructor(phase) {
    super(`Timeout during: ${phase}`, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

class DomChanged extends PichauProviderError {
  constructor(message) {
    super(`DOM structure changed: ${message}`, 'DOM_CHANGED');
    this.name = 'DomChanged';
  }
}

let browser = null;
let context = null;
let page = null;

// --- Browser lifecycle ---

const healthCheck = async () => {
  if (!browser) return false;
  if (!page || page.isClosed()) return false;

  // Check page is navigated and responsive
  const state = await page.evaluate(() => {
    return {
      title: document.title,
      location: window.location.href,
      hasBody: !!document.body
    };
  }).catch(() => ({title: '', location: '', hasBody: false}));

  return state.hasBody && state.location.length > 0;
};

const ensurePage = async () => {
  // Fast path: page exists and is valid
  if (page && !page.isClosed()) {
    const isValid = await healthCheck();
    if (isValid) return page;
  }

  // Slow path: recreate page
  if (!browser) {
    browser = await chromium.launch({headless: true});
  }

  // Recreate context if it's defunct
  if (!context) {
    context = await browser.newContext();
  }

  page = await context.newPage();
  return page;
};

// Explicit shutdown for resource cleanup
const shutdown = async () => {
  try {
    if (page && !page.isClosed()) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  } finally {
    page = null;
    context = null;
    browser = null;
  }
};

// --- Error detection helpers ---

const checkCloudflare = async (currentPage) => {
  const title = await currentPage.title();
  if (title.includes('Manutenção') || title.includes('Pru Pru')) {
    throw new CloudflareDetected();
  }
};

const filterValidProducts = (products) => {
  return products.filter((item) => {
    // Filter out items with empty titles
    if (!item.title || !item.title.trim()) return false;
    // Filter out "Ver todas" and similar navigation items
    if (['Ver todas', 'Ver todos', ''].includes(item.title.trim())) return false;
    return true;
  });
};

const parsePrice = priceText => {
  if (!priceText) {
    return null;
  }
  // Extract the last R$ value (price_vista is typically the first price shown;
  // but some cards show "de R$ value por" where the "de" and "por" wrap the price).
  // Extract all R$ values and return the one that converts cleanly.
  const matches = priceText.match(/R\$([\d.]+,?\d*)/g);
  if (matches) {
    for (const match of matches) {
      const cleaned = match
        .replace('R$', '')
        .replace(/\./g, '')
        .replace(',', '.');
      const value = Number(cleaned);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
  }
  // Fallback: try cleaning the full text
  const cleaned = priceText
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
    .replace(/de/g, '')
    .replace(/por/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

const normalizeProducts = products => {
  return products
    .filter(item => item.title && item.url)
    .map(item => {
      const absoluteUrl = new URL(item.url, HOME_URL).toString();
      const price = parsePrice(item.priceText);

      return {
        title: item.title,
        price,
        priceText: item.priceText,
        url: absoluteUrl,
        source: SOURCE
      };
    });
};

const detectPagination = async currentPage => {
  const paginationLinks = await currentPage.$$eval('a[href*="page="]', links =>
    links.map(link => link.getAttribute('href')).filter(Boolean)
  );

  const baseUrl = currentPage.url();
  const currentUrl = new URL(baseUrl);
  const currentPageNumber = Number(currentUrl.searchParams.get('page') || '1');

  const pageMap = new Map();
  for (const link of paginationLinks) {
    try {
      const url = new URL(link, baseUrl);
      const pageValue = Number(url.searchParams.get('page'));
      if (Number.isFinite(pageValue)) {
        if (!pageMap.has(pageValue)) {
          pageMap.set(pageValue, url.toString());
        }
      }
    } catch (error) {
      continue;
    }
  }

  const pages = Array.from(pageMap.keys()).sort((a, b) => a - b);
  const nextPage = pages.find(pageNumber => pageNumber > currentPageNumber) || null;

  return {
    currentPage: currentPageNumber,
    pages,
    nextPageUrl: nextPage ? pageMap.get(nextPage) : null,
    hasNextPage: Boolean(nextPage)
  };
};

class PichauProvider extends ProductProvider {
  async search(query, _options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    const currentPage = await ensurePage();

    await currentPage.goto(HOME_URL, {waitUntil: 'networkidle'});

    const searchInput = currentPage.locator(
      'input[placeholder*="procurando"], input[aria-label="Buscar produtos"], input[role="searchbox"]'
    );

    await searchInput.first().waitFor({state: 'visible', timeout: 30000});
    await searchInput.first().click();
    await searchInput.first().fill(query);
    await currentPage.keyboard.press('Enter');

    await currentPage.waitForSelector('a[data-cy="list-product"]', {timeout: 30000});
    // Wait for product count to be >0 (not just selector existence, which can be
    // fleeting during RSC navigation) and stable for 300ms.
    await currentPage.waitForFunction(() => {
      const cards = document.querySelectorAll('a[data-cy="list-product"]');
      let count = 0;
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].querySelector('h2')?.textContent?.trim()) count++;
      }
      return count;
    }, {timeout: 10000});

    // Extract products with a retry: if $$eval returns 0, try once more after 500ms.
    let rawProducts = await currentPage.$$eval('a[data-cy="list-product"]', cards =>
      cards.map(card => {
        const title = card.querySelector('h2')?.textContent?.trim() || null;
        const priceElement = card.querySelector('.price_vista, .price_total, [class*="price"]');
        const priceText = priceElement?.textContent?.trim() || null;
        return {
          title,
          priceText,
          url: card.getAttribute('href')
        };
      })
    );

    if (rawProducts.length === 0) {
      await currentPage.waitForTimeout(500);
      rawProducts = await currentPage.$$eval('a[data-cy="list-product"]', cards =>
        cards.map(card => {
          const title = card.querySelector('h2')?.textContent?.trim() || null;
          const priceElement = card.querySelector('.price_vista, .price_total, [class*="price"]');
          const priceText = priceElement?.textContent?.trim() || null;
          return {
            title,
            priceText,
            url: card.getAttribute('href')
          };
        })
      );
    }

    const products = normalizeProducts(rawProducts);
    const pagination = await detectPagination(currentPage);

    return {
      query,
      url: currentPage.url(),
      products,
      pagination,
      source: SOURCE
    };
  }
}

module.exports = {PichauProvider, shutdown, PichauProviderError, CloudflareDetected, NoProductsFound, SearchInputNotFound, NavigationError, TimeoutError, DomChanged};
