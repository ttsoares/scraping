/**
 * Backend tests for SearchQueryMatcher.
 *
 * Tests:
 * 1. Query normalization (units, brands, numeric tokens)
 * 2. Product scoring (high relevance products score above threshold)
 * 3. Query filtering (irrelevant products filtered out)
 * 4. searchPipeline integration (end-to-end flow)
 * 5. Edge cases (empty query, single query, no products)
 *
 * Run: node tests/SearchQueryMatcher.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const {
  normalizeQuery,
  normalizeTitle,
  classifyTokens,
  scoreProduct,
  filterByQuery,
  searchPipeline,
  SearchQueryMatcher,
} = require(path.join(__dirname, '../src/services/SearchQueryMatcher'));

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
  process.stdout.write('  PASS ' + label + '\n');
}

function fail(label, err) {
  totalTests++;
  failedTests++;
  failures.push({ label, err });
  process.stdout.write('  FAIL ' + label);
  if (err) process.stdout.write(' — ' + err.message);
  process.stdout.write('\n');
}

function check(cond, label) {
  if (cond) pass(label);
  else fail(label, new Error('Assertion failed'));
}

// ---------------------------------------------------------------------------
// Test groups
// ---------------------------------------------------------------------------

console.log('\n=== SearchQueryMatcher Tests ===\n');

// Group 1: Query Normalization
async function testQueryNormalization() {
  process.stdout.write('  1. Query Normalization\n');

  const normalized = normalizeQuery('Monitor 29pol ssd 1tb');
  check(normalized.length === 4, 'normalizes to 4 tokens');
  check(normalized[0].text === 'monitor', 'first token is monitor');
  check(normalized[1].type === 'unit', '29pol is unit type');
  check(normalized[2].text === 'ssd', 'ssd token exists');
  check(normalized[3].type === 'unit', '1tb is unit type (contains tb)');
}

// Group 2: Product Scoring
async function testProductScoring() {
  process.stdout.write('  2. Product Scoring\n');

  const title = { title: 'SSD Samsung 990 PRO 2TB M.2', normalizedTitle: 'SSD Samsung 990 PRO 2TB', brand: 'Samsung', model: '990 PRO' };
  const scored = scoreProduct(title, 'Samsung SSD 2TB');
  check(scored.score >= 0.6, 'score >= 0.6: ' + scored.score);
  check(scored.matchedTokens.length > 0, 'has matched tokens');
  check(Array.isArray(scored.unmatchedTokens), 'has unmatched tokens array');
}

// Group 3: Filter by Query
async function testFilterByQuery() {
  process.stdout.write('  3. Filter by Query\n');

  const products = [
    { title: 'SSD Samsung 990 PRO 2TB', normalizedTitle: 'SSD Samsung 990 PRO 2TB', brand: 'Samsung' },
    { title: 'Monitor Samsung 29pol', normalizedTitle: 'Monitor Samsung 29pol', brand: 'Samsung' },
    { title: 'Gabinete Gamer', normalizedTitle: 'Gabinete Gamer', brand: 'Corsair' },
    { title: 'SSD Kingston A400 480GB', normalizedTitle: 'SSD Kingston A400 480GB', brand: 'Kingston' },
  ];

  const filtered = filterByQuery(products, 'SSD', 0.2);
  check(filtered.results.length === 2, '2 SSD products kept (ssd + brand match)');
  check(filtered.filteredCount === 2, '2 products filtered out');
  check(filtered.totalBefore === 4, 'total before = 4');
}

// Group 4: SearchPipeline Integration
async function testSearchPipeline() {
  process.stdout.write('  4. SearchPipeline Integration\n');

  const products = [
    { title: 'SSD Samsung 990 PRO 2TB', url: 'https://example.com/ssd1' },
    { title: 'SSD Kingston A400 480GB', url: 'https://example.com/ssd2' },
    { title: 'Monitor LG 29pol', url: 'https://example.com/monitor' },
  ];

  const result = searchPipeline(products, 'SSD', 0.2);

  check(result.results.length === 2, '2 SSD results');
  check(result.pipeline.query === 'SSD', 'pipeline query correct');
  check(result.pipeline.threshold === 0.2, 'pipeline threshold correct');
  check(result.pipeline.totalProducts === 3, 'pipeline totalProducts correct');
  check(typeof result.results[0]._relevanceScore === 'number', 'results have _relevanceScore');
}

// Group 5: Edge Cases
async function testEdgeCases() {
  process.stdout.write('  5. Edge Cases\n');

  const filterEmpty = filterByQuery([], '');
  check(filterEmpty.results.length === 0, 'empty products returns empty');

  const singleToken = normalizeQuery('SSD');
  check(singleToken.length === 1, 'single token');

  const noProducts = filterByQuery(null, 'SSD', 0.3);
  check(noProducts.results.length === 0, 'null products returns empty');

  const highThreshold = filterByQuery(
    [{ title: 'SSD Samsung', normalizedTitle: 'SSD Samsung' }],
    'SSD Samsung',
    0.9
  );
  check(highThreshold.results.length === 1, 'high threshold keeps relevant');
}

// Group 6: Unit/Synonym Resolution
async function testUnitResolution() {
  process.stdout.write('  6. Unit/Synonym Resolution\n');

  const unitTitles = [
    { title: 'Monitor 29pol LG', normalizedTitle: 'Monitor 29pol LG', brand: 'LG' },
    { title: 'SSD 1TB Samsung', normalizedTitle: 'SSD 1TB Samsung', brand: 'Samsung' },
    { title: 'SSD 2TB Kingston', normalizedTitle: 'SSD 2TB Kingston', brand: 'Kingston' },
  ];

  const filtered = filterByQuery(unitTitles, 'TB', 0.2);
  check(filtered.results.length === 2, '2 TB products kept (1 filtered)');
}

// Group 7: SearchQueryMatcher Export
async function testExports() {
  process.stdout.write('  7. SearchQueryMatcher Export\n');

  check(typeof SearchQueryMatcher === 'object', 'SearchQueryMatcher is object');
  check(typeof SearchQueryMatcher.filterByQuery === 'function', 'filterByQuery is function');
  check(typeof SearchQueryMatcher.scoreProduct === 'function', 'scoreProduct is function');
  check(typeof SearchQueryMatcher.searchPipeline === 'function', 'searchPipeline is function');
  check(typeof SearchQueryMatcher.WEIGHTS === 'object', 'WEIGHTS is object');
  check(typeof SearchQueryMatcher.BRANDS === 'object', 'BRANDS is object');
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

async function runTests() {
  await testQueryNormalization();
  await testProductScoring();
  await testFilterByQuery();
  await testSearchPipeline();
  await testEdgeCases();
  await testUnitResolution();
  await testExports();

  process.stdout.write('\n  Total: ' + totalTests + ' | Passed: ' + passedTests + ' | Failed: ' + failedTests + '\n');

  if (failures.length > 0) {
    process.stdout.write('\n  Failures:\n');
    failures.forEach(({ label, err }) => process.stdout.write('    - ' + label + ': ' + err.message + '\n'));
  }

  module.exports = { totalTests, passedTests, failedTests, failures };
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run and export
runTests().catch((err) => {
  fail('Test runner', err);
  process.stdout.write('\n  Total: ' + totalTests + ' | Failed: ' + failedTests + '\n');
  process.exit(1);
});
