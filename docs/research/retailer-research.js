const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealthPlugin);

const URLS = [
  { name: 'Kabum', url: 'https://www.kabum.com.br/' },
  { name: 'Terabyteshop', url: 'https://www.terabyteshop.com.br/' },
  { name: 'MercadoLivre', url: 'https://www.mercadolivre.com.br/' },
];

async function analyze(page, name, url) {
  console.log();
  console.log('='.repeat(70));
  console.log(`RETAILER: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(70));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const info = await page.evaluate(() => {
    const title = document.title;
    const href = window.location.href;
    const hasRSC = !!document.querySelector('script[src*="//__next"]');
    const hasNextScript = !!document.querySelector('script[src*="_next"]:not([data-nscript])');
    const hasNextData = Object.keys(window).some(k => k.startsWith('__NEXT'));
    const jsonLdCount = document.querySelectorAll('script[type="application/ld+json"]').length;
    const rawJsonCount = document.querySelectorAll('script[type="application/json"]').length;
    const hasCFClass = !!document.querySelector('[class*="cf-"]');
    
    const productEls = Array.from(document.querySelectorAll(
      '[class*="product"], [data-cy*="product"], [data-testid*="product"], ' +
      '.listing__item, [class*="item-produto"], a[data-cy*="product"], ' +
      '.product-item, .product-card, .product-item__link, .product-item__container'
    ));
    const cards = productEls.slice(0, 3).map(e => ({
      tag: e.tagName,
      cls: e.className.replace(/ /g, ' | '),
      html: e.innerHTML.substring(0, 150)
    }));
    
    const searchEls = Array.from(document.querySelectorAll(
      'input[type="search"], input[role="searchbox"], ' +
      'input[placeholder*="busca"], input[placeholder*="buscar"], ' +
      'input[placeholder*="procurando"]'
    ));
    const searchInputs = searchEls.slice(0, 3).map(e => ({
      type: e.type,
      placeholder: e.placeholder,
      ariaLabel: e.getAttribute('aria-label') || '',
      id: e.id
    }));
    
    const pageLinks = Array.from(document.querySelectorAll('a[href*="page"], a[data-cy*="page"]'))
      .slice(0, 5)
      .map(e => ({ href: e.getAttribute('href') || '', text: e.textContent?.trim() }));
    
    const windowData = Object.keys(window)
      .filter(k => k.startsWith('__NEXT') || k.startsWith('__REACT') || k.startsWith('__NUXT'))
      .map(k => ({ key: k, value: typeof window[k] }));
    
    const priceEls = Array.from(document.querySelectorAll('[class*="price"], .price_vista, .price_total'));
    const priceExamples = priceEls.slice(0, 5).map(e => e.textContent?.trim());
    const priceText = priceExamples.join(' | ');
    const hasRPrice = priceText.includes('R$');
    const hasDollar = priceText.includes('$');
    const hasPeso = priceText.includes('S/');
    
    return {
      title, url: href, hasRSC, hasNextScript, hasNextData,
      jsonLdCount, rawJsonCount, hasCFClass,
      productCount: productEls.length, cards,
      searchInputs, pageLinks, windowData,
      priceExamples, hasRPrice, hasDollar, hasPeso
    };
  });

  console.log(`Title: ${info.title}`);
  console.log(`URL: ${info.url}`);
  console.log(`RSC: ${info.hasRSC ? 'Yes' : 'No'} | Next.js: ${info.hasNextScript ? 'Yes' : 'No'} | NextData: ${info.hasNextData ? 'Yes' : 'No'}`);
  console.log(`JSON-LD: ${info.jsonLdCount}, Raw JSON: ${info.rawJsonCount}`);
  console.log(`Cloudflare: class=${info.hasCFClass}`);
  console.log(`Product cards found: ${info.productCount}`);
  console.log(`Search inputs: ${info.searchInputs.map(s => s.placeholder || s.ariaLabel || s.type).join(', ')}`);
  console.log(`Price examples: ${info.priceExamples.join(' | ')}`);
  console.log(`Currency: ${info.hasRPrice ? 'R$ (Brazilian Real)' : info.hasDollar ? '$ (Dollar)' : info.hasPeso ? 'S/ (Peruvian Sol)' : 'Unknown'}`);
  console.log(`Pagination: ${info.pageLinks.length} links found`);
  console.log('Card preview:');
  info.cards.forEach((c, i) => console.log(`  [${i}] <${c.tag}> class="${c.cls}"`));
  console.log('Page links preview:');
  info.pageLinks.slice(0, 3).forEach((p, i) => console.log(`  [${i}] ${p.text} -> ${p.href}`));
  console.log('Window data:');
  info.windowData.slice(0, 3).forEach(w => console.log(`  ${w.key}: ${w.value}`));
  console.log('');
}

async function main() {
  console.log('=== Retailer Architecture Research ===');
  for (const item of URLS) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await analyze(page, item.name, item.url);
    await browser.close();
  }
}

main().catch(console.error);
