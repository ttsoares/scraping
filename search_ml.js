const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealthPlugin);

const BASE_URL = 'https://lista.mercadolivre.com.br/';

const toSearchSlug = (query) => encodeURIComponent(query.trim()).replace(/%20/g, '-');

const extractProducts = (items) => {
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
    const priceText = amount?.textContent?.replace(/\s+/g, ' ').trim();

    const links = Array.from(item.querySelectorAll('a[href]')).map((anchor) => anchor.getAttribute('href'));
    const url = links.map(normalizeLink).find(Boolean);

    if (!title || !url) continue;

    results.push({
      title,
      priceText: priceText || null,
      url,
    });
  }

  return results;
};

const search = async (query) => {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  const searchUrl = `${BASE_URL}${toSearchSlug(query)}`;

  try {
    await page.goto(searchUrl, {waitUntil: 'domcontentloaded', timeout: 30000});
    await page.waitForSelector('li.ui-search-layout__item', {timeout: 30000});
    await page.waitForTimeout(1500);

    const products = await page.$$eval('li.ui-search-layout__item', extractProducts);

    return {query, url: searchUrl, products};
  } finally {
    await browser.close();
  }
};

(async () => {
  try {
    const result = await search('ssd 1tb');

    console.log(`Search URL: ${result.url}`);
    console.log(`Products: ${result.products.length}`);

    result.products.forEach((product, index) => {
      const price = product.priceText ? ` | ${product.priceText}` : '';
      console.log(`${index + 1}. ${product.title}${price} | ${product.url}`);
    });
  } catch (error) {
    console.error(`Search failed: ${error.message}`);
    process.exitCode = 1;
  }
})();
