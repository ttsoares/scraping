const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealthPlugin);

const HOME_URL = 'https://www.pichau.com.br/';
let browser = null;
let context = null;
let page = null;

const ensurePage = async () => {
  if (page && !page.isClosed()) {
    return page;
  }
  if (!browser) {
    browser = await chromium.launch({headless: true});
  }
  if (!context) {
    context = await browser.newContext();
  }
  page = await context.newPage();
  return page;
};

const parsePrice = priceText => {
  if (!priceText) return null;
  const cleaned = priceText.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

(async () => {
  const currentPage = await ensurePage();
  await currentPage.goto(HOME_URL, {waitUntil: 'networkidle'});

  const searchInput = currentPage.locator(
    'input[placeholder*="procurando"], input[aria-label="Buscar produtos"], input[role="searchbox"]'
  );
  await searchInput.first().waitFor({state: 'visible', timeout: 30000});
  console.log('Search input found, clicking...');
  await searchInput.first().click();
  await searchInput.first().fill('ssd 1tb sata');
  await currentPage.keyboard.press('Enter');

  // Wait for product cards and inspect
  try {
    await currentPage.waitForSelector('a[data-cy="list-product"]', {timeout: 30000});
    await currentPage.waitForTimeout(1500);
  } catch (e) {
    console.log('Warning: did not find list-product selector, checking DOM...');
  }

  console.log('Page URL after search:', currentPage.url());

  // Check raw DOM state
  const domCheck = await currentPage.evaluate(() => {
    const cards = document.querySelectorAll('a[data-cy="list-product"]');
    console.log('Raw card count:', cards.length);
    
    // Check first card's innerHTML for price info
    const firstCard = cards[0];
    if (firstCard) {
      const h2 = firstCard.querySelector('h2');
      const price_vista = firstCard.querySelector('.price_vista');
      const price_total = firstCard.querySelector('.price_total');
      const anyPrice = firstCard.querySelector('[class*="price"]');
      
      return {
        href: firstCard.getAttribute('href'),
        h2text: h2?.textContent?.trim(),
        priceVistaText: price_vista?.textContent?.trim(),
        priceVistaClass: price_vista?.className,
        priceTotalText: price_total?.textContent?.trim(),
        priceTotalClass: price_total?.className,
        anyPriceText: anyPrice?.textContent?.trim(),
        anyPriceClass: anyPrice?.className,
        allPriceEls: Array.from(firstCard.querySelectorAll('*')).filter(el => el.className && el.className.includes && el.className.includes('price')).slice(0, 10).map(el => ({
          cls: el.className,
          text: el.textContent?.trim()
        }))
      };
    }
    return {error: 'no first card'};
  });

  console.log('\nDOM check for first card:', JSON.stringify(domCheck, null, 2));

  // Now try $$eval with debug
  const rawProducts = await currentPage.$$eval('a[data-cy="list-product"]', cards => {
    console.log('$$eval received cards:', cards.length);
    return cards.map((card, idx) => {
      const title = card.querySelector('h2')?.textContent?.trim() || null;
      const priceElement = card.querySelector('.price_vista, .price_total, [class*="price"]');
      const priceText = priceElement?.textContent?.trim() || null;
      const href = card.getAttribute('href') || null;
      if (idx < 3) {
        console.log(`Card ${idx}: title="${title}", priceText="${priceText}", href=${href}`);
        const el = priceElement;
        if (el) {
          console.log(`  priceElement.className = ${el.className}, tag = ${el.tagName}`);
        }
      }
      return { title, priceText, url: href };
    });
  });

  console.log('\n$$eval rawProducts:', rawProducts.length);
  console.log('Sample:', JSON.stringify(rawProducts.slice(0, 3), null, 2));

})();
