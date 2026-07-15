/**
 * Backend tests for MultiProviderSearcher.
 *
 * Tests:
 * 1. Multi-provider search returns aggregated products
 * 2. Single-provider search remains unchanged
 * 3. Partial failures do not abort the search
 * 4. Products include source information
 * 5. Deduplication works across providers
 * 6. searchMany() returns correct structure
 * 7. search() delegates to SearchService
 *
 * Run: node tests/multi-provider-search.test.js
 */

const assert = require('assert');
const path = require('path');

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const { MultiProviderSearcher } = require(
  path.join(__dirname, '../src/services/MultiProviderSearcher')
);

// ---------------------------------------------------------------------------
// Test harness helpers
// ---------------------------------------------------------------------------

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function pass(label) {
  totalTests++;
  passedTests++;
  process.stdout.write(`  PASS ${label}\n`);
}

function fail(label, err) {
  totalTests++;
  failedTests++;
  failures.push({ label, err });
  process.stdout.write(`  FAIL ${label}`);
  if (err) process.stdout.write(` — ${err.message}`);
  process.stdout.write('\n');
}

function assertCondition(condition, label, errMsg) {
  if (condition) {
    pass(label);
  } else {
    fail(label, new Error(errMsg || 'assertion failed'));
  }
}

// ---------------------------------------------------------------------------
// Mock providers (no browser required)
// ---------------------------------------------------------------------------

function createMockProvider(name, products, shouldFail = false) {
  return {
    search: async (query, options) => {
      if (shouldFail) {
        const err = new Error(`Simulated failure for ${name}`);
        err.code = 'PROVIDER_ERROR';
        throw err;
      }
      return {
        query,
        url: `https://www.${name.toLowerCase()}.com.br/search/${query}`,
        products: products.map((p) => ({
          ...p,
          provider: name,
          source: name,
          url: p.url || `https://www.${name.toLowerCase()}.com.br/product/${p.id}`,
        })),
        pagination: { currentPage: 1, hasNextPage: false, pages: [1] },
        source: name,
      };
    },
    shutdown: async () => {},
    constructor: { name: name },
  };
}

// ---------------------------------------------------------------------------
// Test: searchMany returns aggregated products
// ---------------------------------------------------------------------------

async function testSearchManyReturnsAggregated() {
  const pichau = createMockProvider('Pichau', [
    { id: 'p1', title: 'SSD Kingston 1TB', price: 450 },
    { id: 'p2', title: 'SSD Samsung 512GB', price: 320 },
  ]);

  const kabum = createMockProvider('Kabum', [
    { id: 'k1', title: 'SSD Kingston 1TB', price: 445 }, // Same title
    { id: 'k2', title: 'SSD WD Blue 1TB', price: 390 },
  ]);

  const ml = createMockProvider('MercadoLivre', [
    { id: 'm1', title: 'SSD Samsung 500GB', price: 300 },
  ]);

  const searcher = new MultiProviderSearcher({
    providers: [pichau, kabum, ml],
    providerNames: ['Pichau', 'Kabum', 'MercadoLivre'],
  });

  const result = await searcher.searchMany('ssd 1tb');

  assertCondition(
    Array.isArray(result.products) && result.products.length > 0,
    'searchMany returns products',
  );
  assertCondition(
    typeof result.productCount === 'number' && result.productCount > 0,
    'productCount is a positive number',
  );
  assertCondition(
    result.providerCount === 3,
    `providerCount is 3, got ${result.providerCount}`,
  );
  assertCondition(
    result.successfulCount === 3,
    `successfulCount is 3, got ${result.successfulCount}`,
  );
  assertCondition(
    result.failedCount === 0,
    `failedCount is 0, got ${result.failedCount}`,
  );
  assertCondition(
    result.query === 'ssd 1tb',
    `query is "ssd 1tb", got "${result.query}"`,
  );
  assertCondition(
    Array.isArray(result.providerResults),
    'providerResults is an array',
  );
  assertCondition(
    Array.isArray(result.errors),
    'errors is an array',
  );
  assertCondition(
    Array.isArray(result.canonicalProducts),
    'canonicalProducts is an array',
  );
  assertCondition(
    Array.isArray(result.comparisonResults),
    'comparisonResults is an array',
  );
  assertCondition(
    typeof result.executionTime === 'number',
    'executionTime is a number',
  );
  assertCondition(
    result.allFailed === false,
    'allFailed is false',
  );

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: Single-provider search remains unchanged
// ---------------------------------------------------------------------------

async function testSingleProviderSearch() {
  const pichau = createMockProvider('Pichau', [
    { id: 'p1', title: 'RTX 5070', price: 3500 },
  ]);

  const searcher = new MultiProviderSearcher();

  // Use .search() to delegate to SearchService (backward compatible)
  const result = await searcher.search(
    pichau.search.bind(pichau),
    'rtx 5070',
    'Pichau',
    {},
  );

  assertCondition(
    result != null,
    'search() returns a result (delegates to SearchService)',
  );
  assertCondition(
    typeof searcher.search === 'function',
    'search method exists on MultiProviderSearcher',
  );

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: Partial failures do not abort the search
// ---------------------------------------------------------------------------

async function testPartialFailures() {
  const pichau = createMockProvider('Pichau', [
    { id: 'p1', title: 'SSD 1TB', price: 400 },
  ]);

  const failedProvider = createMockProvider('Kabum', [
    { id: 'k1', title: 'PSU 750W', price: 500 },
  ], true); // shouldFail = true

  const ml = createMockProvider('MercadoLivre', [
    { id: 'm1', title: 'GPU RTX', price: 2800 },
  ]);

  const searcher = new MultiProviderSearcher({
    providers: [pichau, failedProvider, ml],
    providerNames: ['Pichau', 'Kabum', 'MercadoLivre'],
  });

  const result = await searcher.searchMany('gpu rtx');

  assertCondition(
    result.successfulCount === 2,
    `successfulCount is 2 (one provider failed), got ${result.successfulCount}`,
  );
  assertCondition(
    result.failedCount === 1,
    `failedCount is 1 (Kabum failed), got ${result.failedCount}`,
  );
  assertCondition(
    result.productCount > 0,
    'products present despite partial failure',
  );
  assertCondition(
    Array.isArray(result.errors) && result.errors.length > 0,
    'errors array populated',
  );
  assertCondition(
    Array.isArray(result.providerResults),
    'providerResults populated',
  );
  assertCondition(
    result.allFailed === false,
    'allFailed is false despite partial failure',
  );

  // Check that errors have correct shape
  const kabumError = result.errors.find((e) => e.provider === 'Kabum');
  assertCondition(
    kabumError != null,
    'Kabum error is present in errors array',
  );
  if (kabumError) {
    assertCondition(
      typeof kabumError.error.message === 'string',
      'kabumError.error.message is a string',
    );
    assertCondition(
      kabumError.success === false,
      'kabumError.success is false',
    );
  }

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: Products include source information
// ---------------------------------------------------------------------------

async function testProductSources() {
  const pichau = createMockProvider('Pichau', [
    { id: 'p1', title: 'Product P', price: 100 },
  ]);

  const kabum = createMockProvider('Kabum', [
    { id: 'k1', title: 'Product K', price: 200 },
  ]);

  const ml = createMockProvider('MercadoLivre', [
    { id: 'm1', title: 'Product M', price: 300 },
    { id: 'm2', title: 'Product M2', price: 350 },
  ]);

  const searcher = new MultiProviderSearcher({
    providers: [pichau, kabum, ml],
    providerNames: ['Pichau', 'Kabum', 'MercadoLivre'],
  });

  const result = await searcher.searchMany('test');

  assertCondition(
    result.products.length > 0,
    'products array is non-empty',
  );

  // Check each product has a source/provider indicator
  const allHaveSource = result.products.every(
    (p) => p.provider || p.source,
  );
  assertCondition(
    allHaveSource,
    'all products have provider or source',
  );

  // Check provider results mention each expected provider
  const providerNamesFound = result.providerResults.map((r) => r.provider);
  for (const name of ['Pichau', 'Kabum', 'MercadoLivre']) {
    assertCondition(
      providerNamesFound.includes(name),
      `${name} found in providerResults`,
    );
  }

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: searchMany returns correct structure
// ---------------------------------------------------------------------------

async function testStructure() {
  const pichau = createMockProvider('Pichau', [
    { id: 'p1', title: 'Product', price: 100 },
  ]);

  const searcher = new MultiProviderSearcher({
    providers: [pichau],
    providerNames: ['Pichau'],
  });

  const result = await searcher.searchMany('test');

  const expectedKeys = [
    'searchId',
    'query',
    'executionTime',
    'providerCount',
    'successfulCount',
    'failedCount',
    'productCount',
    'products',
    'normalizedProducts',
    'canonicalProducts',
    'comparisonResults',
    'providerResults',
    'errors',
    'allFailed',
    'persistence',
  ];

  for (const key of expectedKeys) {
    assertCondition(
      Object.prototype.hasOwnProperty.call(result, key),
      `result has key "${key}"`,
    );
  }

  assertCondition(
    typeof result.searchId === 'string' && result.searchId.length > 0,
    'searchId is a non-empty string',
  );
  assertCondition(
    typeof result.persistence === 'object',
    'persistence is an object',
  );
  assertCondition(
    typeof result.persistence.searchId === 'string',
    'persistence.searchId is a string',
  );
  assertCondition(
    typeof result.persistence.persistedProducts === 'number',
    'persistence.persistedProducts is a number',
  );

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: Deduplication across providers
// ---------------------------------------------------------------------------

async function testDeduplication() {
  // Pichau and ML share the same URL -> one product in aggregated result
  // Kabum has a different URL -> second product
  const pichau = createMockProvider('Pichau', [
    { id: 'p1', title: 'SSD Kingston 1TB', price: 450, url: 'https://www.pichau.com.br/ssd-kingston-1tb' },
  ]);

  const kabum = createMockProvider('Kabum', [
    { id: 'k1', title: 'SSD Kingston 1TB', price: 445, url: 'https://www.kabum.com.br/ssd-kingston-1tb' },
  ]);

  const ml = createMockProvider('MercadoLivre', [
    { id: 'm1', title: 'SSD Kingston 1TB', price: 460, url: 'https://www.pichau.com.br/ssd-kingston-1tb' },
  ]);

  const searcher = new MultiProviderSearcher({
    providers: [pichau, kabum, ml],
    providerNames: ['Pichau', 'Kabum', 'MercadoLivre'],
  });

  const result = await searcher.searchMany('test');

  // Pichau and ML share the same URL -> one product in aggregated result
  assertCondition(
    result.productCount === 2,
    `deduplication works: productCount is 2 (Pichau+ML merged by URL), got ${result.productCount}`,
  );

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: No providers yields empty result
// ---------------------------------------------------------------------------

async function testNoProviders() {
  const searcher = new MultiProviderSearcher({
    providers: [],
  });

  const result = await searcher.searchMany('test');

  assertCondition(
    result.productCount === 0,
    'productCount is 0 with no providers',
  );
  assertCondition(
    result.providerCount === 0,
    'providerCount is 0 with no providers',
  );
  assertCondition(
    result.allFailed === true,
    'allFailed is true when no providers',
  );

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: Provider error shape
// ---------------------------------------------------------------------------

async function testErrorShape() {
  const failed = createMockProvider('BadProvider', [], true);

  const searcher = new MultiProviderSearcher({
    providers: [failed],
    providerNames: ['BadProvider'],
  });

  const result = await searcher.searchMany('test');

  assertCondition(
    result.errors.length === 1,
    'one error recorded',
  );

  const err = result.errors[0];
  assertCondition(
    typeof err.provider === 'string',
    'err.provider is a string',
  );
  assertCondition(
    typeof err.error.message === 'string',
    'err.error.message is a string',
  );
  assertCondition(
    err.error.code === 'PROVIDER_ERROR',
    'err.error.code is PROVIDER_ERROR',
  );
  assertCondition(
    err.success === false,
    'err.success is false',
  );

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test: searchMany persists products
// ---------------------------------------------------------------------------

async function testPersistence() {
  const pichau = createMockProvider('Pichau', [
    { id: 'p1', title: 'Persistent SSD', price: 350 },
  ]);

  const searcher = new MultiProviderSearcher({
    providers: [pichau],
    providerNames: ['Pichau'],
  });

  const result = await searcher.searchMany('persistent');

  assertCondition(
    result.persistence != null,
    'persistence object exists',
  );
  assertCondition(
    typeof result.persistence.searchId === 'string',
    'persistence.searchId is a string',
  );
  assertCondition(
    typeof result.persistence.persistedProducts === 'number',
    'persistence.persistedProducts is a number',
  );

  await searcher.close();
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   Multi-Provider Search Tests                      ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  process.stdout.write('Running...\n\n');

  // Run all tests
  console.log('── Group 1: Multi-provider aggregation ──');
  await testSearchManyReturnsAggregated();
  process.stdout.write('\n');

  console.log('── Group 2: Single-provider compatibility ──');
  await testSingleProviderSearch();
  process.stdout.write('\n');

  console.log('── Group 3: Partial failures ──');
  await testPartialFailures();
  process.stdout.write('\n');

  console.log('── Group 4: Product sources ──');
  await testProductSources();
  process.stdout.write('\n');

  console.log('── Group 5: Result structure ──');
  await testStructure();
  process.stdout.write('\n');

  console.log('── Group 6: Deduplication ──');
  await testDeduplication();
  process.stdout.write('\n');

  console.log('── Group 7: Edge cases ──');
  await testNoProviders();
  await testErrorShape();
  await testPersistence();
  process.stdout.write('\n');

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Resumo                                          ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  process.stdout.write(`║   Total: ${String(totalTests).padStart(3, ' ')} testes                        ║\n`);
  process.stdout.write(`║   PASS: ${String(passedTests).padStart(3, ' ')}                                       ║\n`);
  process.stdout.write(`║   FAIL: ${String(failedTests).padStart(3, ' ')}                                       ║\n`);

  if (failures.length > 0) {
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log('║   Falhas:                                       ║');
    for (const f of failures) {
      console.log(`║   - ${f.label}${f.err ? ': ' + f.err.message : ''}`);
    }
  }
  console.log('╚═══════════════════════════════════════════════════╝\n');

  return failedTests;
}

// ── Entry point ────────────────────────────────────────────────────────

(async () => {
  const exitCode = await runTests();
  process.exit(exitCode);
})();
