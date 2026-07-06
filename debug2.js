const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealthPlugin);

(async () => {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.pichau.com.br/', {waitUntil: 'networkidle'});
  
  // Collect all network requests
  const responses = [];
  page.on('response', r => {
    if (r.url().includes('/_next/') || r.url().includes('/api/') || r.url().includes('/search')) {
      responses.push({url: r.url(), status: r.status(), timing: Date.now()});
    }
  });

  const searchInput = page.locator('input[placeholder*="procurando"]:not([style*="display: none"])');
  await searchInput.first().click();
  await searchInput.first().fill('ssd 1tb sata');
  await page.keyboard.press('Enter');
  
  // Longer wait for RSC hydration
  console.log('After Enter, waiting for network...');
  await page.waitForLoadState('networkidle');
  console.log('URL:', page.url());
  
  // Check at multiple intervals
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const count = await page.evaluate(() => document.querySelectorAll('a[data-cy="list-product"]').length);
    const cards = await page.$$('a[data-cy="list-product"]');
    console.log(`t=${i*500}ms: eval=$(${count}), $$=${cards.length}, url=${page.url()}`);
    
    if (count >= 30) {
      // Save HTML
      const html = await page.content();
      require('fs').writeFileSync('/tmp/pichau.html', html);
      console.log('Saved HTML to /tmp/pichau.html');
      
      // Now do $$eval
      const products = await page.$$eval('a[data-cy="list-product"]', cards => {
        return cards.slice(0, 3).map(card => ({
          title: card.querySelector('h2')?.textContent?.trim(),
          price: card.querySelector('[class*="price"]')?.textContent?.trim(),
          priceSimple: card.querySelector('.price_vista')?.textContent?.trim(),
          url: card.getAttribute('href')
        }));
      });
      console.log('Products:', JSON.stringify(products));
      break;
    }
  }
  
  await browser.close();
  process.exit(0);
})();
