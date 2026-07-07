const {KabumProvider} = require('./src/providers/kabum/KabumProvider');

(async () => {
  const provider = new KabumProvider();
  
  const QUERIES = ['ssd', 'ryzen', 'rtx'];
  
  for (const query of QUERIES) {
    console.log(`\n=== Search: "${query}" ===`);
    try {
      const result = await provider.search(query);
      console.log(`  URL:      ${result.url}`);
      console.log(`  Products: ${result.products.length}`);
      console.log(`  URL:      ${result.url}`);
      
      if (result.products.length > 0) {
        const first = result.products[0];
        console.log(`  First:    ${first.title} | ${first.priceText} | ${first.url}`);
      } else {
        console.log(`  FAILED: No products`);
      }
    } catch(e) {
      console.log(`  ERROR: ${e.message}`);
    }
    
    // Small delay between searches
    await new Promise(r => setTimeout(r, 500));
  }
  
  await provider.shutdown();
})();
