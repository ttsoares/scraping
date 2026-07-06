const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealthPlugin);

(async () => {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.pichau.com.br/', {waitUntil: 'networkidle'});

  // Check all inputs on the page
  const allInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(inp => ({
      type: inp.type,
      placeholder: inp.placeholder,
      ariaLabel: inp.getAttribute('aria-label'),
      role: inp.getAttribute('role'),
      visible: inp.offsetParent !== null,
      text: inp.value
    })).filter(i => i.placeholder || i.ariaLabel || i.role);
  });
  console.log('All inputs:', JSON.stringify(allInputs, null, 2));

  // Find search input
  const searchInput = page.locator('input[placeholder*="procurando"]:not([style*="display: none"])');
  const count = await searchInput.count();
  console.log('Search input count:', count);

  if (count > 0) {
    await searchInput.first().click();
    await searchInput.first().fill('ssd 1tb sata');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    console.log('Final URL:', url);

    // Check product cards
    const productCards = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[data-cy="list-product"]')).map(card => ({
        title: card.querySelector('h2')?.textContent?.trim(),
        price: card.querySelector('.price_vista')?.textContent?.trim(),
        priceTotal: card.querySelector('.price_total')?.textContent?.trim(),
        url: card.getAttribute('href')
      }));
    });
    console.log('Product cards:', productCards.length);
    if (productCards.length > 0) {
      console.log('Sample:', JSON.stringify(productCards[0]));
      console.log('Second:', JSON.stringify(productCards[1]));
    }

    // Check pagination
    const paginationLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="page="]')).map(link => link.href);
    });
    console.log('Pagination links:', paginationLinks.slice(0, 5));

    console.log('Title check:', !!productCards[0]?.title);
    console.log('Price check:', !!productCards[0]?.price);
    console.log('URL check:', !!productCards[0]?.url);
  }

  await browser.close();
  process.exit(0);
})();
