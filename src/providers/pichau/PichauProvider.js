const {ProductProvider} = require('../ProductProvider');
const {normalizeProducts} = require('../shared');
const {BrowserExecutor, BrowserFactory} = require('../../browser');

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

const createExecutor = (executorOpts = {}) => new BrowserExecutor(executorOpts);

// Compatibility hook: cleanup is delegated to the browser abstraction.
const shutdown = async () => {
  await BrowserFactory.create().close();
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

// --- Pagination ---

const detectPagination = async currentPage => {
  const hrefs = await currentPage.$$eval('a[href*="page="]', links =>
    links.map(l => l.getAttribute('href')).filter(Boolean)
  );
  const pageState = require('../shared').createPaginationState(hrefs, currentPage.url(), 'page');

  return {
    currentPage: pageState.currentPage,
    pages: pageState.pages,
    nextPageUrl: pageState.nextPageUrl,
    hasNextPage: pageState.hasNextPage
  };
};

class PichauProvider extends ProductProvider {
  constructor(options = {}) {
    super();
    this.engine = options.engine || null;
    this.executor = options.executor || createExecutor({ engine: this.engine });
  }

  async search(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    const engine = options.engine || this.engine;
    const executor = options.engine !== this.engine
      ? new BrowserExecutor({ engine })
      : this.executor;

    return executor.execute(async (session) => {
      const currentPage = session.page;

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

      // Navigate to pagination if pageNum specified in options
      if (options.pageNum && options.pageNum > 1) {
        const currentUrl = new URL(currentPage.url());
        currentUrl.searchParams.set('page', String(options.pageNum));
        await currentPage.goto(currentUrl.toString(), {waitUntil: 'networkidle'});
        await currentPage.waitForTimeout(3000);
      }

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

      const products = normalizeProducts(rawProducts, {HOME_URL, SOURCE});
      const pagination = await detectPagination(currentPage);

      return {
        query,
        url: currentPage.url(),
        products,
        pagination,
        source: SOURCE
      };
    }, `${SOURCE}.search`);
  }
}

module.exports = {PichauProvider, shutdown, PichauProviderError, CloudflareDetected, NoProductsFound, SearchInputNotFound, NavigationError, TimeoutError, DomChanged};
