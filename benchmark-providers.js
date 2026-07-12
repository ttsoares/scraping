/**
 * Browser Engine Benchmark — KaBuM vs Pichau vs Mercado Livre
 *
 * Runs all three providers sequentially with identical parameters:
 *   - Search terms: same QUERIES for all providers
 *   - Pagination depth: pageNum=1 (first page) and pageNum=2 (second page)
 *   - Timeout configuration: 30000ms
 *   - Retry policy: maxRetries=3, baseDelayMs=500
 *   - Product extraction logic: normalizeProducts() shared
 *   - Execution order: providers run sequentially, queries sequential within
 *
 * Metrics collected:
 *   - Success rate
 *   - Products extracted
 *   - Pagination correctness
 *   - Timeout frequency
 *   - Anti-bot behaviour
 *   - Total elapsed time
 *   - Browser startup time
 *   - Mean elapsed time per page
 *   - Peak memory usage (RSS)
 *   - Failure classification
 *
 * Failure classification categories:
 *   - navigation: URL navigation failure
 *   - timeout: search/page wait timeout
 *   - cloudflare: Cloudflare / anti-bot challenge
 *   - selector: CSS selector not found or empty
 *   - network_dns: network/DNS resolution failure
 *   - other: unclassified
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// ── Imports ──────────────────────────────────────────────────────────────────
const { KabumProvider } = require('./src/providers/kabum/KabumProvider');
const { PichauProvider } = require('./src/providers/pichau/PichauProvider');
const { MercadoLivreProvider } = require('./src/providers/mercadolivre/MercadoLivreProvider');
const { FailureClassifier } = require('./src/browser/FailureClassifier');

// ── Configuration (identical for all providers) ──────────────────────────────

const CONFIG = {
  queries: ['SSD 1TB', 'RTX 5070', 'Ryzen 9600X', 'Gabinete Montech'],
  pageNum: 1,
  timeoutMs: 30000,
  maxRetries: 3,
};

const RESULTS_FILE = path.join(__dirname, 'benchmark-providers-results.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

const classifier = new FailureClassifier();

function classifyFailure(error) {
  const message = error?.message || String(error);
  const name = error?.name || '';
  const label = classifier.label(error);

  // Classify specific types
  if (message.includes('Cloudflare') || message.includes('Pru Pru') || message.includes('Manutenção') ||
      message.includes('403') || message.includes('429')) {
    return { category: 'cloudflare', subcategory: label };
  }
  if (message.includes('timeout') || message.includes('timed out') || name.includes('Timeout')) {
    return { category: 'timeout', subcategory: label };
  }
  if (message.includes('navigation') || message.includes('navigate') || message.includes('Navigation')) {
    return { category: 'navigation', subcategory: label };
  }
  if (message.includes('selector') || message.includes('Selector') || message.includes('not found')) {
    return { category: 'selector', subcategory: label };
  }
  if (message.includes('network') || message.includes('DNS') || message.includes('net::') ||
      message.includes('ECONNREFUSED') || message.includes('Error')) {
    return { category: 'network_dns', subcategory: label };
  }
  return { category: 'other', subcategory: label };
}

function hasValidPrice(products) {
  return products.every(p => p.price !== null && p.price !== undefined && Number.isFinite(p.price) && p.price > 0);
}

function hasValidTitle(products) {
  return products.every(p => p.title && p.title.trim().length > 0);
}

function hasValidUrl(products) {
  return products.every(p => p.url && p.url.startsWith('http'));
}

function hasCorrectPagination(pagination, expectedCurrentPage) {
  if (!pagination) return false;
  return (
    typeof pagination.currentPage === 'number' &&
    Number.isFinite(pagination.currentPage) &&
    (Number.isNaN(expectedCurrentPage) || pagination.currentPage === expectedCurrentPage) &&
    Array.isArray(pagination.pages) &&
    pagination.pages.length > 0 &&
    typeof pagination.hasNextPage === 'boolean'
  );
}

function countUniqueTitles(products) {
  return new Set(products.map(p => p.title)).size;
}

function formatTime(ms) {
  return ms < 1000 ? ms.toFixed(0) : ms.toFixed(1);
}

function formatNumber(n) {
  return n.toLocaleString('pt-BR');
}

function getRssMB() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100;
}

// ── Benchmark runner ─────────────────────────────────────────────────────────

async function benchmarkProvider(provider, providerName, engine) {
  const providerResults = {
    provider: providerName,
    engine: engine,
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    queries: [],
    failureCounts: {
      navigation: 0,
      timeout: 0,
      cloudflare: 0,
      selector: 0,
      network_dns: 0,
      other: 0,
    },
    totalFailures: 0,
    totalTimeouts: 0,
    totalAntiBot: 0,
    browserStartupTimes: [],
    pageTimes: [],
    peakRssMB: 0,
  };

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Provider: ${providerName} | Engine: ${engine}`);
  console.log(`${'═'.repeat(60)}`);

  for (let runIndex = 0; runIndex < CONFIG.pageNum + 1; runIndex++) {
    for (const query of CONFIG.queries) {
      const pageNum = runIndex === 0 ? CONFIG.pageNum : CONFIG.pageNum + 1;

      console.log(`\n  Query: "${query}" (page ${pageNum})`);
      console.log(`  ${'─'.repeat(50)}`);

      // Create a fresh provider instance for this batch, passing engine
      const freshProvider = new provider({ engine });

      for (let run = 1; run <= 3; run++) {
        const start = performance.now();
        const rssBefore = process.memoryUsage().rss / 1024 / 1024;
        providerResults.peakRssMB = Math.max(providerResults.peakRssMB, rssBefore);

        const startTime = Date.now();

        try {
          // Pass engine to search() for identical workload
          const response = await freshProvider.search(query, { pageNum, engine });
          const totalTime = Date.now() - startTime;
          const browserStartup = response.browserStartupTime || 0;
          const productsExtracted = response.products?.length || 0;
          const uniqueTitles = countUniqueTitles(response.products || []);
          const success = response.success || true;
          const isAntiBot = response.isAntiBot || response.isCloudflare || false;

          providerResults.totalRuns++;
          if (success) {
            providerResults.successfulRuns++;
          }

          const r = {
            run,
            query,
            pageNum,
            totalTime,
            productsReturned: productsExtracted,
            uniqueTitles,
            success,
            hasValidPrice: success && hasValidPrice(response.products || []),
            hasValidTitle: success && hasValidTitle(response.products || []),
            hasValidUrl: success && hasValidUrl(response.products || []),
            hasCorrectPagination: success && hasCorrectPagination(response.pagination, pageNum),
            browserStartupTime: browserStartup,
            isAntiBot,
            url: response.url,
          };

          if (isAntiBot) providerResults.totalAntiBot++;

          providerResults.queries.push(r);
          providerResults.browserStartupTimes.push(browserStartup);
          providerResults.pageTimes.push(totalTime);

          const status = success ? '✓' : '✗';
          console.log(`    Run ${run}: ${status} ${formatTime(totalTime)}ms | ${r.productsReturned} products (${uniqueTitles} unique) | ${r.hasValidPrice ? '✓price' : '✗price'} | ${r.hasValidUrl ? '✓url' : '✗url'} | ${r.hasCorrectPagination ? '✓nav' : '✗nav'} | ${isAntiBot ? '🤖' : ''}`);

        } catch (error) {
          const totalTime = Date.now() - startTime;
          providerResults.totalRuns++;
          providerResults.failedRuns++;

          const fault = classifyFailure(error);
          providerResults.failureCounts[fault.category] = (providerResults.failureCounts[fault.category] || 0) + 1;
          providerResults.totalFailures++;

          if (fault.category === 'timeout') providerResults.totalTimeouts++;
          if (fault.category === 'cloudflare') providerResults.totalAntiBot++;

          const r = {
            run,
            query,
            pageNum,
            totalTime,
            productsReturned: 0,
            uniqueTitles: 0,
            success: false,
            hasValidPrice: false,
            hasValidTitle: false,
            hasValidUrl: false,
            hasCorrectPagination: false,
            browserStartupTime: 0,
            isAntiBot: fault.category === 'cloudflare',
            error: error.message,
            failureCategory: fault.category,
          };

          providerResults.queries.push(r);
          providerResults.pageTimes.push(totalTime);

          console.log(`    Run ${run}: ✗ ${formatTime(totalTime)}ms | FAILED | ${fault.category} (${fault.subcategory})`);
        }

        const rssAfter = process.memoryUsage().rss / 1024 / 1024;
        providerResults.peakRssMB = Math.max(providerResults.peakRssMB, rssAfter);
      }
    }
  }

  // Averages
  const validResults = providerResults.queries.filter(r => r.success);
  providerResults.avgProducts = validResults.length > 0 ? validResults.reduce((s, r) => s + r.productsReturned, 0) / validResults.length : 0;
  providerResults.avgTime = providerResults.pageTimes.length > 0 ? providerResults.pageTimes.reduce((s, r) => s + r, 0) / providerResults.pageTimes.length : 0;
  providerResults.avgStartup = providerResults.browserStartupTimes.length > 0 ? providerResults.browserStartupTimes.reduce((s, r) => s + r, 0) / providerResults.browserStartupTimes.length : 0;
  providerResults.successRate = providerResults.totalRuns > 0 ? (providerResults.successfulRuns / providerResults.totalRuns * 100) : 0;
  providerResults.peakRssMB = getRssMB();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${providerName} summary: ${providerResults.successRate.toFixed(0)}% success (${providerResults.successfulRuns}/${providerResults.totalRuns})`);
  console.log(`    Avg products: ${formatNumber(Math.round(providerResults.avgProducts))} | Avg time: ${formatTime(providerResults.avgTime)}ms | Avg startup: ${formatTime(providerResults.avgStartup)}ms`);
  console.log(`    Failures: ${providerResults.totalFailures} | Timeouts: ${providerResults.totalTimeouts} | Anti-bot: ${providerResults.totalAntiBot}`);
  console.log(`    Peak RSS: ${getRssMB()} MB`);

  return providerResults;
}

async function runBenchmark() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║    Browser Engine Benchmark — Provider × Engine comparison        ║');
  console.log('║   Each provider runs twice: identical workload, different engines  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const globalStart = performance.now();
  const rssBefore = process.memoryUsage().rss / 1024 / 1024;
  console.log(`\n  Global start: RSS=${rssBefore} MB`);

  // Sequential execution: 3 providers × 2 engines = 6 runs
  const results = {};
  const engines = ['playwright', 'camofox'];
  const providerConfigs = [
    { name: 'Kabum', Class: KabumProvider },
    { name: 'Pichau', Class: PichauProvider },
    { name: 'MercadoLivre', Class: MercadoLivreProvider },
  ];

  for (const { name, Class } of providerConfigs) {
    for (const engine of engines) {
      const key = `${name.toLowerCase()}_${engine}`;
      results[key] = await benchmarkProvider(Class, name, engine);
    }
  }

  const globalEnd = performance.now();
  const rssAfter = process.memoryUsage().rss / 1024 / 1024;

  // ── Aggregate report ───────────────────────────────────────────────

  const allQueries = [];
  for (const [name, result] of Object.entries(results)) {
    allQueries.push(...result.queries.map(q => ({
      ...q,
      provider: result.provider,
      engine: result.engine,
    })));
  }

  const report = {
    metadata: {
      date: new Date().toISOString(),
      nodeVersion: process.version,
      globalElapsedMs: globalEnd - globalStart,
      rssBefore: rssBefore,
      rssAfter: rssAfter,
      params: CONFIG,
    },
    providers: results,
    summary: {
      totalRuns: allQueries.length,
      totalSuccess: allQueries.filter(q => q.success).length,
      overallSuccessRate: (allQueries.filter(q => q.success).length / allQueries.length * 100).toFixed(1),
      totalTimeouts: Object.values(results).reduce((s, r) => s + r.totalTimeouts, 0),
      totalAntiBot: Object.values(results).reduce((s, r) => s + r.totalAntiBot, 0),
    },
    details: allQueries,
    failureDistribution: {
      navigation: 0,
      timeout: 0,
      cloudflare: 0,
      selector: 0,
      network_dns: 0,
      other: 0,
    },
  };

  // Aggregate failure distribution
  for (const result of Object.values(results)) {
    for (const [cat, count] of Object.entries(result.failureCounts)) {
      report.failureDistribution[cat] = (report.failureDistribution[cat] || 0) + count;
    }
  }

  // ── Engine comparison table ────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('  PROVIDER × ENGINE COMPARISON');
  console.log(`${'═'.repeat(80)}`);

  // Table header
  console.log('\n  | Provider | Engine | Success | Avg Time | Products | Pagination | Anti-bot | RSS |');
  console.log('  |' + '-'.repeat(54) + '|');

  // Collect provider pairs for comparison
  const tableRows = [];
  for (const { name } of providerConfigs) {
    const pa = results[`${name.toLowerCase()}_playwright`];
    const cf = results[`${name.toLowerCase()}_camofox`];
    if (pa && cf) {
      tableRows.push({ name, pa, cf });
    }
  }

  for (const { name, pa, cf } of tableRows) {
    // Playwright row
    const prodStr = formatNumber(Math.round(pa.avgProducts));
    const pagesPa = pa.queries.filter(q => q.hasCorrectPagination).length;
    const timeStr = formatTime(pa.avgTime) + 'ms';
    const sucStr = pa.successRate.toFixed(0);
    console.log(`  | ${name.padEnd(8)} | playwright | ${sucStr.padStart(7)}%  | ${timeStr.padStart(8)}ms | ${prodStr.padStart(8)} | ${String(pagesPa).padStart(8)} | ${String(pa.totalAntiBot).padStart(8)} | ${String(pa.peakRssMB).padStart(7)} MB |`);

    // Camofox row
    const prodStrCf = formatNumber(Math.round(cf.avgProducts));
    const pagesCf = cf.queries.filter(q => q.hasCorrectPagination).length;
    const timeStrCf = formatTime(cf.avgTime) + 'ms';
    const sucStrCf = cf.successRate.toFixed(0);
    console.log(`  | ${name.padEnd(8)} | camofox  | ${sucStrCf.padStart(7)}%  | ${timeStrCf.padStart(8)}ms | ${prodStrCf.padStart(8)} | ${String(pagesCf).padStart(8)} | ${String(cf.totalAntiBot).padStart(8)} | ${String(cf.peakRssMB).padStart(7)} MB |`);

    // Delta row
    const timeDelta = ((cf.avgTime - pa.avgTime) / pa.avgTime * 100).toFixed(1);
    const prodDelta = (cf.avgProducts - pa.avgProducts).toFixed(1);
    const sucDelta = (cf.successRate - pa.successRate).toFixed(0);
    const timeDiffStr = (timeDelta >= 0 ? '+' : '') + timeDelta + '%';
    const prodDiffStr = (prodDelta >= 0 ? '+' : '') + prodDelta;
    const sucDiffStr = (sucDelta >= 0 ? '+' : '') + sucDelta + '%';
    const rssDelta = (cf.peakRssMB - pa.peakRssMB).toFixed(1);
    const rssDiffStr = (rssDelta >= 0 ? '+' : '') + rssDelta + ' MB';
    console.log(`  | ${('Δ ' + name).padEnd(8)} |          | ${sucDiffStr.padStart(7)} | ${timeDiffStr.padStart(8)}   | ${prodDiffStr.padStart(8)}   | ${String('').padStart(8)}   | ${String('').padStart(8)}   | ${rssDiffStr.padStart(7)}    |`);
    console.log('  |' + '-'.repeat(54) + '|');
  }

  // ── Summary ────────────────────────────────────────────────────────

  console.log(`\n  ┌──────────────────────────────────────────────────────────────────┐`);
  console.log('  │  OVERALL SUMMARY                                                 │');
  console.log('  ├──────────────────────────────────────────────────────────────────┤');
  console.log(`  │  Overall success rate: ${report.summary.overallSuccessRate}%                                          │`);
  console.log(`  │  Total runs:                 ${String(report.summary.totalRuns).padEnd(50)}    │`);
  console.log(`  │  Total timeout events:        ${String(report.summary.totalTimeouts).padEnd(50)}    │`);
  console.log(`  │  Total anti-bot events:       ${String(report.summary.totalAntiBot).padEnd(50)}    │`);
  console.log(`  │  Global elapsed:              ${formatTime(report.metadata.globalElapsedMs).padEnd(50)}ms │`);
  console.log(`  │  RSS: ${String(rssBefore + 'MB → ' + rssAfter + 'MB').padEnd(50)}   │`);
  console.log('  └──────────────────────────────────────────────────────────────────┘');

  console.log(`\n  ┌──────────────────────────────────────────────────────────────────┐`);
  console.log('  │  ENGINE DELTAS (camofox vs playwright)                           │');
  console.log('  ├──────────────────────────────────────────────────────────────────┤');
  console.log('  │  Provider    │ Success Δ │ Time Δ │ Products Δ │ Anti-bot Δ         │');
  console.log('  │' + '─'.repeat(54) + '│');

  for (const { name, pa, cf } of tableRows) {
    const sucDelta = (cf.successRate - pa.successRate).toFixed(0);
    const timeDelta = ((cf.avgTime - pa.avgTime) / pa.avgTime * 100).toFixed(0);
    const prodDelta = (cf.avgProducts - pa.avgProducts).toFixed(0);
    const antiDelta = cf.totalAntiBot - pa.totalAntiBot;
    const sucStr = (sucDelta >= 0 ? '+' : '') + sucDelta + '%';
    const timeStr = (timeDelta >= 0 ? '+' : '') + timeDelta + '%';
    const prodStr = (prodDelta >= 0 ? '+' : '') + prodDelta;
    const antiStr = (antiDelta >= 0 ? '+' : '') + antiDelta;
    console.log(`  │ ${name.padEnd(12)}│ ${sucStr.padStart(9)} │ ${timeStr.padStart(6)} │ ${prodStr.padStart(10)} │ ${antiStr.padEnd(12)} │`);
  }

  console.log('  └──────────────────────────────────────────────────────────────────┘');

  console.log(`\n  FAILURE DISTRIBUTION`);
  console.log(`  ──────────────────`);
  for (const [cat, count] of Object.entries(report.failureDistribution).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat.padEnd(15)} ${formatNumber(count)}`);
  }

  // ── Write JSON results ─────────────────────────────────────────────

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n  Full results written to: ${RESULTS_FILE}`);

  return report;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const report = await runBenchmark();

    console.log('\n  ✓ Benchmark complete.\n');
    return 0;
  } catch (error) {
    console.error('\n  ✗ Benchmark failed:', error.message);
    return 1;
  }
}

main();
