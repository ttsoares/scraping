const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
const {ProductProvider} = require('../ProductProvider');

chromium.use(stealthPlugin);

const HOME_URL = 'https://www.kabum.com.br/';
const SOURCE = 'kabum';

let browser = null;
let context = null;
let page = null;

// --- Browser lifecycle ---

const healthCheck = async () => {
  if (!browser) return false;
  if (!page || page.isClosed()) return false;
  const state = await page.evaluate(() => ({
    hasBody: !!document.body,
    location: window.location.href
  })).catch(() => ({hasBody: false, location: ''}));
  return state.hasBody && state.location.length > 0;
};

const ensurePage = async () => {
  if (page && !page.isClosed() && await healthCheck()) return page;
  if (!browser) browser = await chromium.launch({headless: true});
  if (!context) context = await browser.newContext();
  page = await context.newPage();
  return page;
};

const shutdown = async () => {
  try {
    if (page && !page.isClosed()) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  } finally { page = null; context = null; browser = null; }
};

// --- Helpers ---

const parsePrice = priceText => {
  if (!priceText) return null;
  const matches = priceText.match(/R\$([\d.]+,?\d*)/g);
  if (matches) {
    for (const match of matches) {
      const value = Number(
        match.replace('R$', '').replace(/\./g, '').replace(',', '.')
      );
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  const value = Number(
    priceText.replace(/\s/g, '').replace(/R\$/g, '').replace(/\./g, '').replace(',', '.')
  );
  return Number.isFinite(value) ? value : null;
};

const normalizeProducts = products => {
  return products
    .filter(item => item.title && item.url)
    .map(item => ({
      title: item.title,
      price: parsePrice(item.priceText),
      priceText: item.priceText,
      url: new URL(item.url, HOME_URL).toString(),
      source: SOURCE
    }));
};

const detectPagination = async currentPage => {
  const paginationLinks = await currentPage.$$eval('a[href*="page_number="]', links =>
    links.map(l => l.getAttribute('href')).filter(Boolean)
  );
  const baseUrl = currentPage.url();
  const currentUrl = new URL(baseUrl);
  const currentPageNumber = Number(currentUrl.searchParams.get('page_number') || '1');

  const pageMap = new Map();
  for (const link of paginationLinks) {
    try {
      const url = new URL(link, baseUrl);
      const pageValue = Number(url.searchParams.get('page_number'));
      if (Number.isFinite(pageValue) && !pageMap.has(pageValue)) {
        pageMap.set(pageValue, url.toString());
      }
    } catch (e) { /* skip */ }
  }

  const pages = Array.from(pageMap.keys()).sort((a, b) => a - b);
  const nextPage = pages.find(n => n > currentPageNumber) || null;

  return {
    currentPage: currentPageNumber,
    pages,
    nextPageUrl: nextPage ? pageMap.get(nextPage) : null,
    hasNextPage: Boolean(nextPage)
  };
};

// --- Main Provider ---

class KabumProvider extends ProductProvider {
  async search(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    const currentPage = await ensurePage();
    await currentPage.goto(HOME_URL, {waitUntil: 'networkidle'});

    // Locate search input, bypass overlays with force: true
    const searchInput = currentPage.locator('input[name="query"]');
    await searchInput.first().waitFor({state: 'visible', timeout: 30000});
    await searchInput.first().click({force: true});
    await searchInput.first().fill(query);
    await currentPage.keyboard.press('Enter');

    // Wait for SPA to re-render
    const waitForResults = async () =>
      currentPage.waitForSelector('a[href*="/produto/"]', {timeout: 30000});

    await currentPage.waitForURL(url => url.toString().includes('/busca/'), {timeout: 30000});
    await waitForResults();

    // Navigate to pagination if pageNum specified in options
    if (options.pageNum && options.pageNum > 1) {
      const currentUrl = new URL(currentPage.url());
      currentUrl.searchParams.set('page_number', String(options.pageNum));
      await currentPage.goto(currentUrl.toString(), {waitUntil: 'networkidle'});
      await waitForResults();
      await currentPage.waitForTimeout(1500);
    }

    const products = await currentPage.$$eval('a[href*="/produto/"]', links => {
      const seen = new Set();
      const results = [];

      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href || seen.has(href)) continue;
        const allText = (link.textContent || '').split('\n')
          .map(t => t.trim()).filter(Boolean);
        const combinedText = allText.join(' ');
        if (!combinedText.includes('R$')) continue;

        const prePriceText = combinedText.split('R$')[0] || combinedText;
        let cleanedTitle = prePriceText
          .replace(/Selo:\s*[\s\S]*?Produto\s+Patrocinado/i, '')
          .replace(/Selo:\s*\S+(?:\s+\S+)?/i, '')
          .replace(/Produto\s+Patrocinado/i, '')
          .replace(/Avaliação\s*[\d.,]+\s*de\s*[\d.,]+/i, '')
          .replace(/Frete\s+gr[aá]tis\*?/i, '')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/^[^A-Za-zÀ-ÿ0-9]+/g, '');

        const fallbackTitle = allText.find(t =>
          !t.includes('R$') && !t.includes('desconto')
          && !t.includes('pix') && !t.includes('frete')
          && t.length > 10
        ) || allText[0] || null;

        const title = cleanedTitle.length > 10 ? cleanedTitle : fallbackTitle;

        const priceMatches = [];
        const priceRegex = /R\$\s*[\d.]+,?\d*/g;
        for (const match of combinedText.matchAll(priceRegex)) {
          const index = match.index ?? 0;
          const prefix = combinedText.slice(Math.max(0, index - 10), index).toLowerCase();
          if (prefix.includes('x de')) continue;
          priceMatches.push(match[0]);
        }
        const priceText = priceMatches.length ? priceMatches[priceMatches.length - 1] : null;

        results.push({title, priceText, url: href});
        seen.add(href);
        if (results.length >= 80) break;
      }

      return results;
    });

    return {
      query: query,
      url: currentPage.url(),
      products: normalizeProducts(products),
      pagination: await detectPagination(currentPage),
      source: SOURCE
    };
  }
}

module.exports = {KabumProvider, shutdown};
