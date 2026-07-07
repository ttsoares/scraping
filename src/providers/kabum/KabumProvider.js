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
  async search(query, _options = {}) {
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
    await currentPage.waitForTimeout(4000);

    // Extract product divs: must have a link AND R$ price
    let products = await currentPage.$$eval('div', cards => {
      return cards
        .filter(card => {
          const text = (card.textContent || '').trim();
          return card.querySelector('a') !== null
            && text.length > 15
            && card.innerHTML.includes('R$');
        })
        .slice(0, 80)
        .map(card => {
          const allText = (card.textContent || '').split('\n')
            .map(t => t.trim()).filter(Boolean);
          const title = allText.find(t =>
            !t.includes('R$') && !t.includes('desconto')
            && !t.includes('pix') && !t.includes('frete')
            && t.length > 10
          ) || allText[0] || null;

          const priceMatch = (card.textContent || '').match(/R\$[\s]*([\d.]+,?\d*)/g);
          const priceText = priceMatch ? priceMatch[priceMatch.length - 1] : null;
          const a = card.querySelector('a');
          const href = a ? (a.getAttribute('href') || a.href || null) : null;

          return {title: title, priceText: priceText, url: href};
        });
    });

    // Fallback
    if (products.length === 0) {
      await currentPage.waitForTimeout(500);
      products = await currentPage.$$eval('div', cards => {
        return cards.filter(card => {
          const text = (card.textContent || '').trim();
          return card.querySelector('a') !== null
            && text.length > 10
            && card.innerHTML.includes('R$');
        }).slice(0, 80).map(card => {
          const allText = (card.textContent || '').split('\n')
            .map(t => t.trim()).filter(Boolean);
          const title = allText.find(t =>
            !t.includes('R$') && !t.includes('desconto') && !t.includes('pix')
          ) || allText[0] || null;
          const priceMatch = (card.textContent || '').match(/R\$[\s]*([\d.]+,?\d*)/g);
          const priceText = priceMatch ? priceMatch[priceMatch.length - 1] : null;
          const a = card.querySelector('a');
          return {title: title, priceText: priceText, url: a ? a.href : null};
        });
      });
    }

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
