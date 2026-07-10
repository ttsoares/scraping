const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealthPlugin);

(async () => {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.pichau.com.br/', {waitUntil: 'networkidle'});
  
  const searchInput = page.locator('input[placeholder*="procurando"]:not([style*="display: none"])');
  await searchInput.first().click();
  await searchInput.first().fill('ssd 1tb sata');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');

  // Inspect price elements deeply
  const priceInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('a[data-cy="list-product"]'));
    // Get all price-containing classes from first few cards
    const pricePatterns = [];
    const allClasses = new Set();
    cards.slice(0, 5).forEach(card => {
      const allEls = card.querySelectorAll('[class]');
      allEls.forEach(el => {
        el.className.split(' ').forEach(c => {
          if (c.includes('price') || c.includes('preco') || c.includes('real')) {
            allClasses.add(c);
            pricePatterns.push({tag: el.tagName, cls: c, text: el.textContent?.trim(), html: el.innerHTML?.trim().slice(0, 100)});
          }
        });
      });
    });
    return { classes: [...allClasses], patterns: pricePatterns };
  });
  console.log('Price classes found:', JSON.stringify(priceInfo.classes, null, 2));
  console.log('Price patterns:', JSON.stringify(priceInfo.patterns, null, 2));

  // Check the specific element that matches the selector used in provider
  const firstCard = await page.$('a[data-cy="list-product"]');
  if (firstCard) {
    const innerHTML = await firstCard.$eval('*', el => {
      // Find all price elements and list their full context
      const allPriceEls = [];
      // Check for any element containing 'price' in className
      findAllPrice = (node, depth = 0) => {
        if (depth > 5) return;
        if (node.className && typeof node.className === 'string') {
          node.className.split(' ').forEach(c => {
            if (c.includes('price') && !allPriceEls.find(a => a.el === node)) {
              allPriceEls.push({
                el: node.outerHTML?.slice(0, 200),
                text: node.textContent?.trim()?.slice(0, 100),
                cls: node.className,
                tag: node.tagName
              });
            }
          });
        }
        Array.from(node.children).forEach(c => findAllPrice(c, depth+1));
      };
      findAllPrice(el);
      return JSON.stringify(allPriceEls.slice(0, 10));
    });
    console.log('Price elements in first card:', innerHTML);
  }

  await browser.close();
  process.exit(0);
})();
