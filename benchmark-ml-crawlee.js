/**
 * Benchmark: MercadoLivreProvider (Playwright) vs MercadoLivreProviderCrawlee (Crawlee)
 *
 * Compares 4 searches across both providers (3 runs each) and reports timing
 * and validation metrics. Results are written to benchmark-ml-crawlee-results.json.
 */

const fs = require('fs');
const path = require('path');

// ── Imports ──────────────────────────────────────────────────────────────────
const { MercadoLivreProvider, shutdown: mlShutdown } = require('./src/providers/mercadolivre/MercadoLivreProvider');
const { MercadoLivreProviderCrawlee, shutdown: mlcShutdown } = require('./src/providers/mercadolivre/MercadoLivreProviderCrawlee');

// ── Configuration ────────────────────────────────────────────────────────────

const QUERIES = ['SSD 1TB', 'RTX 5070', 'Ryzen 9600X', 'Gabinete Montech'];
const RUNS = 3;
const RESULTS_FILE = path.join(__dirname, 'benchmark-ml-crawlee-results.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasValidPrice(products) {
  return products.every(p => {
    const price = p.price;
    return price !== null && price !== undefined && Number.isFinite(price) && price > 0;
  });
}

function hasValidTitle(products) {
  return products.every(p => p.title && p.title.trim().length > 0);
}

function hasValidUrl(products) {
  return products.every(p => p.url && p.url.startsWith('http'));
}

function hasValidPagination(pagination) {
  if (!pagination) return false;
  return (
    typeof pagination.currentPage === 'number' &&
    Array.isArray(pagination.pages) &&
    typeof pagination.hasNextPage === 'boolean'
  );
}

function countUniqueTitles(products) {
  return new Set(products.map(p => p.title)).size;
}

function formatTime(ms) {
  if (ms < 1000) return ms.toFixed(0);
  return ms.toFixed(1);
}

function formatNumber(n) {
  return n.toLocaleString('pt-BR');
}

// ── Benchmark runner ─────────────────────────────────────────────────────────

async function benchmarkProvider(ProviderClass, label) {
  const provider = new ProviderClass();
  const results = [];

  for (const query of QUERIES) {
    console.log(`\n  ${label} | Query: "${query}"`);
    console.log(`  ${'─'.repeat(50)}`);

    const runResults = [];

    for (let run = 1; run <= RUNS; run++) {
      const t0 = Date.now();
      const response = await provider.search(query);
      const totalTime = Date.now() - t0;

      const r = {
        run,
        query,
        totalTime,
        productsReturned: response.products?.length || 0,
        hasValidPrice: hasValidPrice(response.products || []),
        hasValidTitle: hasValidTitle(response.products || []),
        hasValidUrl: hasValidUrl(response.products || []),
        hasValidPagination: hasValidPagination(response.pagination),
        source: response.source || 'mercadolivre',
        uniqueTitles: countUniqueTitles(response.products || []),
      };

      runResults.push(r);
      console.log(`    Run ${run}: ${formatTime(totalTime)}ms | ${r.productsReturned} products | ${r.uniqueTitles} unique | ${r.hasValidPrice ? '✓price' : '✗price'} | ${r.hasValidUrl ? '✓url' : '✗url'}`);
    }

    // Average the 3 runs
    const avgTime = runResults.reduce((s, r) => s + r.totalTime, 0) / RUNS;
    const avgProducts = runResults.reduce((s, r) => s + r.productsReturned, 0) / RUNS;

    results.push({
      provider: label,
      query,
      avgTime: Math.round(avgTime),
      avgProducts: Math.round(avgProducts),
      minTime: Math.min(...runResults.map(r => r.totalTime)),
      maxTime: Math.max(...runResults.map(r => r.totalTime)),
      productsReturned: runResults[0].productsReturned,
      hasValidPrice: runResults.every(r => r.hasValidPrice),
      hasValidTitle: runResults.every(r => r.hasValidTitle),
      hasValidUrl: runResults.every(r => r.hasValidUrl),
      hasValidPagination: runResults.every(r => r.hasValidPagination),
      source: runResults[0].source,
      uniqueTitles: runResults[0].uniqueTitles,
      allRuns: runResults,
    });
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  Benchmark: MercadoLivreProvider vs MercadoLivreProviderCrawlee');
  console.log('═'.repeat(60));

  console.log('\nQueries: ' + QUERIES.join(', '));
  console.log(`Runs per query: ${RUNS}\n`);

  // ── Runs original provider first, then Crawlee (interleaved results) ──
  console.log('\n┌─ Running MercadoLivreProvider (original)');
  console.log('─'.repeat(50));
  const mlResults = await benchmarkProvider(MercadoLivreProvider, 'ML (Playwright)');
  await mlShutdown();
  console.log('\n  ✓ MercadoLivreProvider completed\n');

  console.log('\n┌─ Running MercadoLivreProviderCrawlee (Crawlee)');
  console.log('─'.repeat(50));
  const mlcResults = await benchmarkProvider(MercadoLivreProviderCrawlee, 'ML Crawlee');
  await mlcShutdown();
  console.log('\n  ✓ MercadoLivreProviderCrawlee completed\n');

  // ── Write results JSON ─────────────────────────────────────────────────
  const overallResults = {
    benchmark: 'MercadoLivreProvider vs MercadoLivreProviderCrawlee',
    date: new Date().toISOString(),
    queries: QUERIES,
    runsPerQuery: RUNS,
    results: mlResults.concat(mlcResults),
    summary: {
      ml: {
        avgTime: Math.round(mlResults.reduce((s, r) => s + r.avgTime, 0) / mlResults.length),
        avgProducts: mlResults.reduce((s, r) => s + r.avgProducts, 0) / mlResults.length,
      },
      mlc: {
        avgTime: Math.round(mlcResults.reduce((s, r) => s + r.avgTime, 0) / mlcResults.length),
        avgProducts: mlcResults.reduce((s, r) => s + r.avgProducts, 0) / mlcResults.length,
      },
    },
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(overallResults, null, 2));
  console.log(`\n  → Results written to ${RESULTS_FILE}`);

  // ── Print summary table ────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  SUMMARY TABLE');
  console.log('═'.repeat(60));
  console.log(`  ${'Provider'.padEnd(24)} | ${'Query'.padEnd(18)} | ${'Time (ms)'.padEnd(10)} | ${'Products'.padEnd(8)} | ${'Unique'.padEnd(7)} | ${'Price'.padEnd(5)} | ${'URLs'.padEnd(4)} | Pagination`);
  console.log('─'.repeat(95));

  for (const r of overallResults.results) {
    console.log(
      `  ${r.provider.padEnd(24)} | ${r.query.padEnd(18)} | ${formatNumber(r.avgTime).padEnd(10)} | ${formatNumber(r.avgProducts).padEnd(8)} | ${formatNumber(r.uniqueTitles).padEnd(7)} | ${r.hasValidPrice ? '✓ yes' : '✗ no  '.padEnd(5)} | ${r.hasValidUrl ? '✓ yes' : '✗ no  '.padEnd(4)} | ${r.hasValidPagination ? 'valid' : 'invalid'}`
    );
  }

  // ── Time comparison ────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SPEED COMPARISON (avg time per query, ↓ favours Crawlee)');
  console.log('─'.repeat(60));

  for (const ml of mlResults) {
    const mlc = mlcResults.find(r => r.query === ml.query);
    if (!mlc) continue;
    const diff = ml.avgTime - mlc.avgTime;
    const pct = ((diff / ml.avgTime) * 100).toFixed(1);
    const arrow = diff > 0 ? '↓' : diff < 0 ? '↑' : '=';
    const mlcLabel = mlc.avgTime < ml.avgTime ? 'faster' : mlc.avgTime > ml.avgTime ? 'slower' : 'equal';
    console.log(`  ${ml.query.padEnd(18)} | ML: ${formatNumber(ml.avgTime).padEnd(10)}ms | Crawler: ${formatNumber(mlc.avgTime).padEnd(10)}ms | ${arrow} ${Math.abs(pct)}% (${mlcLabel})`);
  }

  // ── Overall averages ───────────────────────────────────────────────────
  const overallMl = overallResults.summary.ml;
  const overallMlc = overallResults.summary.mlc;
  const overallDiff = overallMl.avgTime - overallMlc.avgTime;
  const overallPct = ((overallDiff / overallMl.avgTime) * 100).toFixed(1);

  console.log('\n' + '─'.repeat(60));
  console.log(`  OVERALL AVERAGES`);
  console.log(`  ML (Playwright):  ${formatNumber(overallMl.avgTime)}ms avg | ${overallMl.avgProducts.toFixed(1)} avg products`);
  console.log(`  ML Crawlee:       ${formatNumber(overallMlc.avgTime)}ms avg | ${overallMlc.avgProducts.toFixed(1)} avg products`);
  console.log(`  Difference:       ${overallDiff > 0 ? 'Crawlee is' : overallDiff < 0 ? 'ML is' : 'Equal'} ${Math.abs(overallPct)}% ${overallDiff > 0 ? 'faster' : 'slower'}`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
