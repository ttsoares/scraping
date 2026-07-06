
// Research script for candidate retailers
// Navigates to each and collects: frontend arch, search mechanism, product extraction, pagination, anti-bot

const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealthPlugin);

async function researchRetailer(name, baseUrl, searchQuery, sampleSelector) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RETAILER: ${name}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`${'='.repeat(60)}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Homepage analysis
    console.log(`\n--- Homepage Analysis ---`);
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const homeTitle = await page.title();
    const homeUrl = page.url();
    console.log(`Title: ${homeTitle}`);
    console.log(`URL: ${homeUrl}`);

    // Check for Cloudflare
    if (homeTitle.includes('Manutenção') || homeTitle.includes('Pru Pru') || homeUrl.includes('cdn-cloud')) {
      console.log(`Anti-bot: Cloudflare detected`);
    }

    // 2. Search analysis
    console.log(`\n--- Search Mechanism ---`);
    const searchInput = page.locator(
      'input[placeholder*="procurando"], input[aria-label="Buscar"], input[type="search"], input[name="q"], input[name="query"], input[name="search"]'
    );
    const searchCount = await searchInput.count();
    console.log(`Search inputs found: ${searchCount}`);
    
    if (searchCount > 0) {
      await searchInput.first().click();
      await searchInput.first().fill(searchQuery);
      
      // Intercept navigation events
      let searchUrlAfterEnter = null;
      let searchMethod = 'Enter key press';
      
      const response = await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      searchUrlAfterEnter = page.url();
      console.log(`Search method: ${searchMethod}`);
      console.log(`Search URL after Enter: ${searchUrlAfterEnter}`);
    }

    // 3. Product extraction analysis
    console.log(`\n--- Product Extraction ---`);
    
    // Check product cards
    const products = await page.$$eval(sampleSelector, cards => 
      cards.map(card => {
        return {
          text: card.textContent?.trim()?.substring(0, 100),
          href: card.getAttribute('href'),
          className: card.className?.substring(0, 100),
          innerHTML: card.innerHTML?.substring(0, 150),
        };
      })
    );
    console.log(`Products found: ${products.length}`);
    if (products.length > 0) {
      console.log(`Sample product:`, products[0]);
      console.log(`Sample href:`, products[0].href);
      console.log(`Sample className:`, products[0].className);
    }

    // 4. Check for specific extraction strategies
    // DOM selectors
    console.log(`\n--- Extraction Strategies ---`);
    const domSelectors = [
      'a[data-cy]',
      '.product-card',
      '.product-item',
      '[class*="product"]',
      'a[href*="/produto"]',
      'a[href*="/item"]',
      '.product-grid [class*="product"]',
    ];
    for (const sel of domSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        console.log(`  ${sel}: ${count} elements`);
      }
    }

    // 5. Pagination analysis
    console.log(`\n--- Pagination ---`);
    const paginationLinks = await page.$$eval('a[href*="page"], a[href*="pagina"], a[class*="next"], a[class*="prev"]', links => 
      links.map(l => l.getAttribute('href')?.substring(0, 80))
    );
    console.log(`Pagination links found: ${paginationLinks.length}`);
    if (paginationLinks.length > 0) {
      console.log(`Sample: ${paginationLinks.slice(0, 5).join(', ')}`);
    }

    // 6. Check for API endpoints
    console.log(`\n--- API Endpoints ---`);
    const responseInfo = await page.evaluate(() => {
      return {
        hasGraphQL: !!window.__APOLLO_CLIENT__,
        hasRSC: typeof window.__nextData !== 'undefined',
      };
    });
    console.log(`  Apollo (GraphQL): ${responseInfo.hasGraphQL}`);
    console.log(`  Has __nextData (RSC): ${responseInfo.hasRSC}`);

    // 7. Browser fingerprint check
    console.log(`\n--- Browser Fingerprint ---`);
    const browserFingerprint = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        webgl: !!navigator.webgl,
        plugins: navigator.plugins?.length || 0,
        language: navigator.language,
      };
    });
    console.log(`  User Agent: ${browserFingerprint.userAgent}`);
    console.log(`  WebGL: ${browserFingerprint.webgl}`);
    console.log(`  Plugins: ${browserFingerprint.plugins}`);
    console.log(`  Language: ${browserFingerprint.language}`);

  } catch (error) {
    console.log(`Error researching ${name}: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('Researching candidate retailers for PichauProvider architecture validation\n');
  console.log('This script navigates to each retailer and collects:');
  console.log('  - Frontend architecture');
  console.log('  - Search mechanism');
  console.log('  - Product extraction targets');
  console.log('  - Pagination strategy');
  console.log('  - Anti-bot protections');

  await researchRetailer(
    'KABUM',
    'https://www.kabum.com.br/',
    'ssd 1tb sata',
    'a[data-cy="product-item-card"]'
  );

  await researchRetailer(
    'TERABYTESHOP',
    'https://www.terabyteshop.com.br/',
    'ssd 1tb sata',
    'a[data-cy="product-item-card"], article.product-item-card, .product-card'
  );

  await researchRetailer(
    'MERCADO LIVRE',
    'https://www.mercadolivre.com.br/',
    'ssd 1tb sata',
    'a[data-aspect-id="products"]'
  );

  console.log('\n' + '='.repeat(60));
  console.log('Research complete.');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
