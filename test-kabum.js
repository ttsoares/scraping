const {KabumProvider} = require('./src/providers/kabum/KabumProvider');

const QUERIES = ['ssd', 'ryzen', 'rtx', 'fonte', 'gabinete', 'mouse'];

(async () => {
  const provider = new KabumProvider();
  let allPassed = true;

  try {
    for (const query of QUERIES) {
      console.log(`\n=== Search: "${query}" ===`);
      const result = await provider.search(query);
      
      console.log(`  Source:   ${result.source}`);
      console.log(`  URL:      ${result.url}`);
      console.log(`  Query:    ${result.query}`);
      console.log(`  Products: ${result.products.length}`);
      console.log(`  Pagination:`, JSON.stringify(result.pagination));
      
      if (result.products.length === 0) {
        console.log(`  FAILED: No products returned`);
        allPassed = false;
        continue;
      }

      // Verify all products have required fields
      const allValid = result.products.every(p => p.title && p.url);
      if (!allValid) {
        console.log(`  FAILED: Some products missing title or url`);
        allPassed = false;
      }

      // Show first 3 products as sample
      console.log(`  Sample products:`);
      for (const p of result.products.slice(0, 3)) {
        console.log(`    - ${p.title} | ${p.priceText} (${p.price}) | ${p.url}`);
      }

      // Verify pagination
      if (!result.pagination.hasNextPage && result.pagination.currentPage === 1) {
        console.log(`  Pagination: On page 1, no next page (may be valid for this query)`);
      } else {
        console.log(`  Pagination: On page ${result.pagination.currentPage}, next: ${result.pagination.nextPageUrl || 'none'}`);
      }

      if (result.source !== 'kabum') {
        console.log(`  FAILED: Source is "${result.source}", expected "kabum"`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log('\n\n=== ALL QUERIES PASSED ===');
    } else {
      console.log('\n\n=== SOME QUERIES FAILED ===');
    }
  } catch(e) {
    console.error('ERROR:', e.message, e.stack);
    allPassed = false;
  }

  process.exit(allPassed ? 0 : 1);
})();
