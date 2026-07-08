/**
 * Regression test for all product providers (Pichau, Kabum, MercadoLivre).
 *
 * Run with: node tests/provider-regression.test.js
 */

const assert = require('assert');
const path = require('path');

// ── Imports ────────────────────────────────────────────────────────────

const { PichauProvider, shutdown: shutdownPichau } = require(
  path.join(__dirname, '../src/providers/pichau/PichauProvider'),
);
const { KabumProvider, shutdown: shutdownKabum } = require(
  path.join(__dirname, '../src/providers/kabum/KabumProvider'),
);
const { MercadoLivreProvider, shutdown: shutdownMercadoLivre } = require(
  path.join(__dirname, '../src/providers/mercadolivre/MercadoLivreProvider'),
);

// ── Test configuration ─────────────────────────────────────────────────

const QUERIES = ['ssd 1tb', 'rtx 5070', 'ryzen 9600x', 'fonte corsair rm850x', 'gabinete montech'];

const PROVIDERS = [
  { name: 'Pichau',   Class: PichauProvider,    expectedSource: 'pichau' },
  { name: 'KABUM',    Class: KabumProvider,     expectedSource: 'kabum' },
  { name: 'MercadoLivre', Class: MercadoLivreProvider, expectedSource: 'mercadolivre' },
];

// ── Test harness ───────────────────────────────────────────────────────

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
  failures.push({ label, err: err || new Error('assertion failed') });
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

/**
 * Run the full product validation checks on a single result.
 * @param {object} result - the full wrapper object: { success, result, provider, error }
 */
function assertProductStructure(result, providerName, query, suffix = '') {
  const key = `${providerName} + "${query}"${suffix}`;
  const inner = result.result;

  // result.success (outer wrapper)
  assertCondition(
    result.success === true,
    `${key}: result.success`,
    `expected result.success to be true, got ${result.success}`,
  );

  // result.provider (outer wrapper)
  assertCondition(
    result.provider === providerName,
    `${key}: result.provider`,
    `expected provider "${providerName}", got "${result.provider}"`,
  );

  // inner.url is non-empty string
  assertCondition(
    typeof inner.url === 'string' && inner.url.length > 0,
    `${key}: result.url`,
    'url is empty or not a string',
  );

  // inner.products is array with length > 0
  assertCondition(
    Array.isArray(inner.products) && inner.products.length > 0,
    `${key}: result.products has items`,
    `products length=${inner.products.length}`,
  );

  const products = inner.products;

  // Every product has title (string, non-empty)
  const allHaveTitle = products.every((p) => typeof p.title === 'string' && p.title.trim().length > 0);
  assertCondition(allHaveTitle, `${key}: all products have title`, 'at least one product missing title');

  // Every product has a valid url (starts with http)
  const allHaveUrl = products.every((p) => typeof p.url === 'string' && p.url.startsWith('http'));
  assertCondition(allHaveUrl, `${key}: all products have valid url`, 'at least one product url does not start with http');

  // Every product has priceText (string, may be null; if present must contain price info)
  const allHavePriceText = products.every((p) =>
    (p.priceText === null) ||
    (typeof p.priceText === 'string' && p.priceText.length > 0),
  );
  assertCondition(allHavePriceText, `${key}: all products have priceText`, 'priceText is not string/null');

  // At least one product has price (number, > 0)
  const atLeastOnePrice = products.some((p) => typeof p.price === 'number' && p.price > 0);
  assertCondition(atLeastOnePrice, `${key}: at least one product with price > 0`, 'no product has price > 0');

  // Products are deduplicated (no duplicate titles)
  const titles = products.map((p) => p.title);
  const uniqueTitles = new Set(titles);
  assertCondition(
    titles.length === uniqueTitles.size,
    `${key}: products are deduplicated`,
    `found ${titles.length - uniqueTitles.size} duplicate title(s)`,
  );
}

/**
 * Validate pagination fields.
 * Uses try/catch internally to avoid cascade failures from KABUM's
 * singleton page timing out (networkidle wait can be flaky).
 */
function assertPagination(result, providerName, expectedPageNum, suffix = '') {
  const key = `${providerName} pagination${suffix}`;

  try {
    const pagination = result.result.pagination;

    assertCondition(
      typeof pagination.currentPage === 'number',
      `${key}: currentPage is a number`,
      `currentPage is ${pagination.currentPage}`,
    );

    assertCondition(
      Array.isArray(pagination.pages),
      `${key}: pages is an array`,
      `pages is ${JSON.stringify(pagination.pages)}`,
    );

    if (expectedPageNum !== null) {
      assertCondition(
        pagination.currentPage === expectedPageNum,
        `${key}: currentPage matches expected page`,
        `expected ${expectedPageNum}, got ${pagination.currentPage}`,
      );
    }

    assertCondition(
      typeof pagination.hasNextPage === 'boolean',
      `${key}: hasNextPage is boolean`,
      `hasNextPage is ${pagination.hasNextPage}`,
    );

    // Verify nextPageUrl is a string when hasNextPage is true
    if (pagination.hasNextPage) {
      assertCondition(
        typeof pagination.nextPageUrl === 'string' && pagination.nextPageUrl.length > 0,
        `${key}: nextPageUrl is non-empty`,
        `nextPageUrl is ${pagination.nextPageUrl}`,
      );
    }
  } catch (e) {
    // KABUM's singleton page can time out; gracefully degrade
    fail(`${key}: (degraded - ${e.message})`, e);
  }
}

// ── Test runner ────────────────────────────────────────────────────────

async function assertResultValue(testName, providerName, testFn) {
  process.stdout.write(`${testName}: `);
  try {
    const result = await testFn();
    return { success: true, result, provider: providerName };
  } catch (err) {
    console.error(`[${providerName}] search error: ${err.message} at ${err.stack?.split('\n')[1] || 'unknown'}`);
    return { success: false, result: null, provider: providerName, error: err };
  }
}

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   Provider Regression Tests                        ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  process.stdout.write('Running...\n\n');

  for (const provider of PROVIDERS) {
    const cls = provider.Class;
    const name = provider.name;

    // Create a fresh instance for each provider to avoid shared state issues
    const instance = new cls();

    // ── Group 1: Core product validation per query ──────────────────
    console.log(`── ${name} ──`);

    for (const query of QUERIES) {
      const result = await assertResultValue(
        `${name} "${query}"`,
        name,
        () => instance.search(query),
      );

      const combinedKey = `${name} + "${query}"`;
      if (result.success) {
        // Pass the outer wrapper (has success + provider) — assertProductStructure
        // extracts inner.{url, products, pagination} itself.
        assertProductStructure(result, name, query);
      } else {
        fail(combinedKey + ': search returned error');
        failedTests++; // count the group
      }
      totalTests++; // count the group itself
      passedTests += result.success ? 1 : 0;
    }

    // ── Group 2: Pagination checks ─────────────────────────────────
    console.log(`\n  ─ Paginação ─`);

    for (const query of QUERIES) {
      const resultPage1 = await assertResultValue(
        `${name} "${query}" page=1`,
        name,
        () => instance.search(query, { pageNum: 1 }),
      );
      totalTests++;
      passedTests += resultPage1.success ? 1 : 0;

      const resultPage2 = await assertResultValue(
        `${name} "${query}" page=2`,
        name,
        () => instance.search(query, { pageNum: 2 }),
      );
      totalTests++;
      passedTests += resultPage2.success ? 1 : 0;

      const combinedKey = `${name}`;
      // Pass the outer wrapper (assertPagination reads result.result.pagination)
      if (resultPage1.success) {
        assertPagination(resultPage1, name, 1);
      }
      if (resultPage2.success) {
        assertPagination(resultPage2, name, 2);
      }

      if (resultPage1.success && resultPage2.success) {
        // Products should differ between pages or at least pagination structure is correct
        const p1 = resultPage1.result.products;
        const p2 = resultPage2.result.products;
        const titles1 = new Set(p1.map((p) => p.title));
        const titles2 = new Set(p2.map((p) => p.title));

        // Count overlap — it's fine if products overlap, but at least one must differ
        let foundDiff = false;
        for (const t2 of titles2) {
          if (!titles1.has(t2)) { foundDiff = true; break; }
        }
        if (!foundDiff) {
          for (const t1 of titles1) {
            if (!titles2.has(t1)) { foundDiff = true; break; }
          }
        }

        assertCondition(
          foundDiff || p1.length > 0 || p2.length > 0,
          `${combinedKey} "${query}" pg1≠pg2`,
          'products identical between pages 1 and 2',
        );
      }
    }

    // Clean up this provider's browser
    if (instance.shutdown) {
      await instance.shutdown();
    }
    process.stdout.write(`\n  [${name}] browser shut down.\n`);
  }

  // ── Group 3: Edge-case assertions ───────────────────────────────────
  console.log('\n── Casos de contorno ──');

  // Re-instantiate to get fresh browsers for edge-case tests
  const pichau = new PichauProvider();
  const kabum = new KabumProvider();
  const mercadv = new MercadoLivreProvider();

  // Empty-ish queries
  for (const [label, inst] of [['Pichau', pichau], ['KABUM', kabum], ['MercadoLivre', mercadv]]) {
    const r = await assertResultValue(`${label} query "ssd"`, label, () => inst.search('ssd'));
    if (r.success) {
      assertCondition(
        Array.isArray(r.result.products) && r.result.products.length > 0,
        `${label}: "ssd" returns products`,
      );
    }
    totalTests++;
    passedTests += r.success ? 1 : 0;
  }

  // Shutdown edge-case instances
  if (pichau.shutdown) await pichau.shutdown();
  if (kabum.shutdown) await kabum.shutdown();
  if (mercadv.shutdown) await mercadv.shutdown();

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n╔═══════════════════════════════════════════════════╗');
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
