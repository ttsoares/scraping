const {PichauProvider, shutdown, PichauProviderError} = require('./src/providers/pichau/PichauProvider');

// --- Test configuration ---

const testCases = [
  {query: 'ssd 1tb sata', description: 'SSD category', minProducts: 20, maxProducts: 100},
  {query: 'rtx 5060', description: 'GPU category', minProducts: 10, maxProducts: 80},
  {query: 'ryzen', description: 'CPU category', minProducts: 10, maxProducts: 80},
  {query: 'fonte 600w', description: 'Power supply', minProducts: 5, maxProducts: 60},
  {query: 'gabinete', description: 'Cases/chassis', minProducts: 5, maxProducts: 60},
  {query: 'mouse gamer', description: 'Peripherals', minProducts: 5, maxProducts: 60},
];

// --- Validation helpers ---

function validateProduct(product, query, index) {
  const errors = [];
  
  if (typeof product.title !== 'string' || !product.title.trim()) {
    errors.push(`[${index}] title is missing/invalid: ${JSON.stringify(product.title)}`);
  }
  
  if (typeof product.url !== 'string' || !product.url.startsWith('http')) {
    errors.push(`[${index}] url is invalid: ${product.url}`);
  }
  
  if (product.source !== 'pichau') {
    errors.push(`[${index}] source is not 'pichau': ${product.source}`);
  }
  
  if (product.price !== null && typeof product.price !== 'number') {
    errors.push(`[${index}] price format issue: ${typeof product.price} (${product.price})`);
  }
  
  return errors;
}

function validateResult(result, query, testCase, runIndex) {
  const errors = [];
  
  if (!result.source) {
    errors.push(`Result missing source field`);
  }
  
  if (result.products.length < testCase.minProducts) {
    errors.push(`Too few products: ${result.products.length} (min: ${testCase.minProducts})`);
  }
  
  if (result.products.length > testCase.maxProducts) {
    errors.push(`Too many products: ${result.products.length} (max: ${testCase.maxProducts})`);
  }
  
  if (!result.pagination) {
    errors.push('Missing pagination field');
  } else {
    if (typeof result.pagination.currentPage !== 'number') {
      errors.push('pagination.currentPage is not a number');
    }
    if (!Array.isArray(result.pagination.pages)) {
      errors.push('pagination.pages is not an array');
    }
  }
  
  // Validate first few products have all required fields
  const sampleSize = Math.min(5, result.products.length);
  for (let i = 0; i < sampleSize; i++) {
    const prodErrors = validateProduct(result.products[i], query, i);
    errors.push(...prodErrors);
  }
  
  // Check for valid URL
  if (result.url && typeof result.url === 'string') {
    try {
      new URL(result.url);
    } catch (e) {
      errors.push(`Invalid result URL: ${result.url}`);
    }
  }
  
  return errors;
}

// --- Main test runner ---

async function runTests() {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  console.log('=== PichauProvider Robustness Tests ===\n');
  
  for (let runIndex = 0; runIndex < testCases.length; runIndex++) {
    const testCase = testCases[runIndex];
    totalTests++;
    
    try {
      const provider = new PichauProvider();
      const result = await provider.search(testCase.query);
      
      const errors = validateResult(result, testCase.query, testCase, runIndex);
      
      if (errors.length === 0) {
        passedTests++;
        console.log(`✓ PASS [${testCase.query}] - ${testCase.description}`);
        console.log(`  Products: ${result.products.length} | Current page: ${result.pagination.currentPage} | URL: ${result.url}\n`);
      } else {
        failedTests++;
        console.log(`✗ FAIL [${testCase.query}] - ${testCase.description}`);
        errors.forEach(err => console.log(`  - ${err}`));
        console.log();
      }
    } catch (error) {
      failedTests++;
      console.log(`✗ ERROR [${testCase.query}] - ${testCase.description}`);
      console.log(`  ${error.name}: ${error.message}\n`);
    }
  }
  
  // Test error handling
  console.log('--- Testing error handling ---');
  totalTests++;
  try {
    const provider = new PichauProvider();
    
    // Test empty query
    try {
      await provider.search('');
      console.log('✗ Expected error for empty query');
      failedTests++;
    } catch (e) {
      console.log('✓ Correctly threw for empty query');
    }
    
    // Test shutdown
    await shutdown();
    console.log('✓ Shutdown successful');
    
    passedTests++;
  } catch (e) {
    console.log(`✗ Error handling failed: ${e.message}`);
    failedTests++;
  }
  
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  
  if (failedTests > 0) {
    process.exit(1);
  }
  
  process.exit(0);
}

// --- Execute tests ---

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
