const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealthPlugin);

async function run() {
  console.log('=== MercadoLivre Focused Research ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept network requests
  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || url.includes('graphql') || url.includes('_rsc')) {
      requests.push({ type: 'request', url, method: req.method() });
    }
  });
  page.on('response', res => {
    const url = res.request().url();
    const type = res.headers()['content-type'] || '';
    if (url.includes('/api/') || url.includes('graphql') || url.includes('mlb')) {
      requests.push({ type: 'response', url, status: res.status(), contentType: type });
    }
  });

  await page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  
  // Give it a moment for rendering
  await new Promise(r => setTimeout(r, 2000));
  
  const info = await page.evaluate(() => {
    const title = document.title;
    const hasRSC = !!document.querySelector('script[src*="//__next"]');
    const hasNextScript = !!document.querySelector('script[src*="_next"]:not([data-nscript])');
    const hasNextData = Object.keys(window).some(k => k.startsWith('__NEXT'));
    const jsonLdCount = document.querySelectorAll('script[type="application/ld+json"]').length;
    const rawJsonCount = document.querySelectorAll('script[type="application/json"]').length;
    
    // Product card selectors
    const productEls = Array.from(document.querySelectorAll(
      '[class*="product"], [data-cy*="product"], [data-testid*="product"], ' +
      '.listing__item, .js-product, [class*="item-produto"], ' +
      '.product-item, .product-card, .product-item__link, ' +
      '[data-component-id*="product"], .ui-search-result'
    ));
    
    // MercadoLivre specific selectors  
    const mlProducts = Array.from(document.querySelectorAll('.ui-search-link, [class*="product__title"], .ui-search-price, [class*="price"]'));
    
    // Search
    const searchEls = Array.from(document.querySelectorAll(
      'input[type="search"], input[role="searchbox"], input[placeholder*="busca"], input[placeholder*="buscar"], ' +
      'input[name="search"], input[type="text"][name="q"], [data-testid="search"], [class*="search-bar"]'
    ));
    
    // Pagination
    const pageLinks = Array.from(document.querySelectorAll('a[href*="page"], a[data-cy*="page"], .js-page, [class*="pagination"] a'))
      .slice(0, 5);
    const pageLinkData = pageLinks.map((e, i) => ({ href: e.getAttribute('href') || '', text: e.textContent?.trim(), class: e.className.replace(/ /g, ' | ') }));
    
    // Window data
    const windowData = Object.keys(window)
      .filter(k => k.startsWith('__NEXT') || k.startsWith('__REACT') || k.startsWith('__NUXT') || k.startsWith('__ML'))
      .slice(0, 5);
    
    // Price
    const priceEls = Array.from(document.querySelectorAll('[class*="price"]'));
    const priceExamples = priceEls.slice(0, 5).map(e => e.textContent?.trim().replace(/\s+/g, ' '));
    
    // Server-rendered HTML indicators
    const hasRscId = !!document.querySelector('[data-rsc]');
    const hasStreaming = !!document.querySelector('script[src*="__next"]');
    const hasFragmentId = !!document.querySelector('#__next');
    
    return {
      title, hasRSC, hasNextScript, hasNextData, jsonLdCount, rawJsonCount,
      productCount: productEls.length, mlProductCount: mlProducts.length,
      searchInputs: searchEls.slice(0, 3).map(e => ({ type: e.type, placeholder: e.placeholder, name: e.name, id: e.id, class: e.className.replace(/ /g, ' | ')})),
      pageLinkData, windowData,
      priceExamples, hasRscId, hasStreaming, hasFragmentId
    };
  });
  
  console.log(`Title: ${info.title}`);
  console.log(`Has RSC: ${info.hasRSC ? 'Yes' : 'No'}`);
  console.log(`Next.js: ${info.hasNextScript ? 'Yes' : 'No'}`);
  console.log(`NextData: ${info.hasNextData ? 'Yes' : 'No'}`);
  console.log(`JSON-LD: ${info.jsonLdCount}, Raw JSON: ${info.rawJsonCount}`);
  console.log(`Product cards: ${info.productCount}, MercadoLivre products: ${info.mlProductCount}`);
  console.log(`RscId: ${info.hasRscId}, Streaming: ${info.hasStreaming}, Fragment: ${info.hasFragmentId}`);
  console.log(`Search inputs: ${JSON.stringify(info.searchInputs)}`);
  console.log(`Price examples: ${info.priceExamples.join('\n  ')}`);
  
  // Check for MercadoLivre specific patterns
  console.log('\n=== MercadoLivre Specifics ===');
  
  // Check for server-side rendered products
  const productLinks = await page.$$eval('a.ui-search-link, a[href*="SKU_"], [class*="product__title"] a', els => {
    els.slice(0, 5).map(el => ({
      href: el.getAttribute('href') || '',
      text: el.textContent?.trim(),
      class: el.className.replace(/ /g, ' | '),
      sku: el.getAttribute('data-item-id') || el.getAttribute('data-sku') || '',
      component: el.getAttribute('data-component-id') || ''
    }));
  });
  
  console.log('Product links preview:');
  productLinks.forEach((p, i) => console.log(`  [${i}] ${p.text.substring(0, 60)} -> ${p.href.substring(0, 80)} | SKU: ${p.sku}`));
  
  // Check for grid/list selectors
  const gridEls = await page.$$('.ui-search-grid, [class*="search-grid"], [class*="view-mode"], [class*="product-grid"]');
  console.log(`\nGrid elements: ${gridEls.length}`);
  
  // Check for infinite scroll
  const infiniteScroll = await page.$('[class*="infinite"], [class*="endless"], [data-infinite]');
  console.log(`Infinite scroll: ${infiniteScroll ? 'Yes' : 'No (pagination based)'}`);
  
  // Check for API endpoints
  const apiScripts = await page.evaluate(() => {
    const apis = [];
    document.querySelectorAll('[data-component-id]').forEach(el => {
      const cid = el.getAttribute('data-component-id');
      if (cid) apis.push(cid);
    });
    return { components: apis.slice(0, 10) };
  });
  console.log(`\nComponent IDs: ${JSON.stringify(apiScripts.components)}`);
  
  // Check pagination format
  const pagLinks = await page.$$eval('a[class*="pagination"], a[data-testid*="page"], [class*="ui-pagination"] a', els => 
    els.slice(0, 6).map(el => ({ text: el.textContent?.trim(), href: el.getAttribute('href') || '', class: el.className.replace(/ /g, ' | ') }))
  );
  
  console.log('\nPagination preview:');
  pagLinks.forEach(p => console.log(`  ${p.text} -> ${p.href} | ${p.class.substring(0, 60)}`));
  
  // Check for window.ML2 or similar ML state
  const mlState = await page.evaluate(() => {
    const keys = Object.keys(window).filter(k => k.startsWith('ML') || k.startsWith('ml'));
    return keys.map(k => ({ key: k, value: typeof window[k] }));
  });
  console.log('\nML window state:');
  mlState.slice(0, 5).forEach(s => console.log(`  ${s.key}: ${s.value}`));
  
  // Print captured requests
  console.log('\n=== Network Requests ===');
  requests.slice(0, 10).forEach(r => console.log(`  ${r.type}\t${r.method || r.status}\t${r.url}`));
  
  await browser.close();
}

run().catch(console.error);
