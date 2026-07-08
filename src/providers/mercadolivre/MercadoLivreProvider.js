const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
const {ProductProvider} = require('../ProductProvider');

chromium.use(stealthPlugin);

const HOME_URL = 'https://www.mercadolivre.com.br/';
const SEARCH_BASE = 'https://lista.mercadolivre.com.br/';
const SOURCE = 'mercadolivre';
const RESULTS_PER_PAGE = 48;

let browser = null;
let context = null;
let page = null;

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

const toSearchSlug = query => encodeURIComponent(query.trim()).replace(/%20/g, '-');

const buildSearchUrl = query => `${SEARCH_BASE}${toSearchSlug(query)}`;

const buildPageUrl = (query, pageNum) => {
  if (!pageNum || pageNum <= 1) return buildSearchUrl(query);
  const offset = (pageNum - 1) * RESULTS_PER_PAGE + 1;
  return `${buildSearchUrl(query)}_Desde_${offset}_NoIndex_True`;
};

const parsePrice = priceText => {
  if (!priceText) return null;
  const match = priceText.match(/[\d.]+,?\d*/);
  if (!match) return null;
  const value = Number(match[0].replace(/\./g, '').replace(',', '.'));
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
  const pagination = await currentPage.$$eval('.andes-pagination__button', buttons => {
    const pages = [];
    let currentPageValue = 1;

    for (const button of buttons) {
      const text = button.textContent?.trim();
      const pageNumber = Number(text);
      if (Number.isFinite(pageNumber)) pages.push(pageNumber);
      if (button.classList.contains('andes-pagination__button--current')) {
        currentPageValue = pageNumber;
      }
    }

    const nextButton = document.querySelector('.andes-pagination__button--next');
    const disabled = nextButton?.classList.contains('andes-pagination__button--disabled')
      || nextButton?.querySelector('[data-andes-state="disabled"]');

    return {
      pages: Array.from(new Set(pages)).sort((a, b) => a - b),
      currentPage: currentPageValue,
      hasNextPage: Boolean(nextButton) && !disabled
    };
  }).catch(() => ({pages: [1], currentPage: 1, hasNextPage: false}));

  return pagination;
};

class MercadoLivreProvider extends ProductProvider {
  async search(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    const currentPage = await ensurePage();
    const targetUrl = buildPageUrl(query, options.pageNum);

    await currentPage.goto(targetUrl, {waitUntil: 'domcontentloaded', timeout: 30000});
    await currentPage.waitForSelector('li.ui-search-layout__item', {timeout: 30000});
    await currentPage.waitForTimeout(1500);

    const rawProducts = await currentPage.$$eval('li.ui-search-layout__item', items => {
      const normalizeLink = (href) => {
        if (!href) return null;
        if (href.includes('publicidade.mercadolivre.com.br')) return null;
        if (href.includes('mercadoclics')) return null;
        if (href.includes('click')) return null;
        return href.includes('mercadolivre.com.br') ? href : null;
      };

      const results = [];

      for (const item of items) {
        const isAd = !!item.querySelector('.poly-component__ads-promotions, .ui-search-item__ad');
        if (isAd) continue;

        const title = item.querySelector('h2, .ui-search-item__title, .poly-component__title')?.textContent?.trim();
        const amount = item.querySelector('.poly-price__current [data-andes-money-amount], .ui-search-price__part [data-andes-money-amount]');
        const priceText = amount?.textContent?.replace(/\s+/g, ' ').trim()
          || item.querySelector('.ui-search-price, .poly-price__current')?.textContent?.replace(/\s+/g, ' ').trim()
          || null;

        const links = Array.from(item.querySelectorAll('a[href]')).map(anchor => anchor.getAttribute('href'));
        const url = links.map(normalizeLink).find(Boolean);

        if (!title || !url) continue;

        results.push({title, priceText, url});
      }

      return results;
    });

    const products = normalizeProducts(rawProducts);
    const pagination = await detectPagination(currentPage);
    const currentPageNumber = options.pageNum || pagination.currentPage || 1;

    return {
      query,
      url: currentPage.url(),
      products,
      pagination: {
        currentPage: currentPageNumber,
        pages: pagination.pages,
        nextPageUrl: pagination.hasNextPage ? buildPageUrl(query, currentPageNumber + 1) : null,
        hasNextPage: pagination.hasNextPage
      },
      source: SOURCE
    };
  }
}

module.exports = {MercadoLivreProvider, shutdown};
