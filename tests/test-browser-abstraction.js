/**
 * Tests for Browser Abstraction Layer.
 *
 * Verifies:
 * 1. BrowserFactory creates PlaywrightEngine
 * 2. PlaywrightEngine implements BrowserEngine interface
 * 3. FailureClassifier classifies errors correctly
 * 4. RetryPolicy calculates delays correctly
 * 5. BrowserExecutor orchestrates execute with retry
 * 6. All components import without error
 */

const assert = require('assert');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Module imports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const { BrowserFactory } = require('../src/browser/BrowserFactory');
const { PlaywrightEngine } = require('../src/browser/PlaywrightEngine');
const { BrowserEngine } = require('../src/browser/BrowserEngine');
const { BrowserSession } = require('../src/browser/BrowserSession');
const { FailureClassifier, FailureCategory } = require('../src/browser/FailureClassifier');
const { RetryPolicy } = require('../src/browser/RetryPolicy');
const { BrowserExecutor } = require('../src/browser/BrowserExecutor');
const { normalizeProducts } = require('../src/providers/normalizer');

let passed = 0;
let failed = 0;
const results = [];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function test(name, fn) {
  const start = Date.now();
  try {
    fn();
    const ms = Date.now() - start;
    passed++;
    results.push({ name, status: 'PASS', ms });
    console.log(`  ${name.padEnd(50)} PASS ${ms}ms`);
  } catch (err) {
    const ms = Date.now() - start;
    failed++;
    results.push({ name, status: 'FAIL', ms, error: err.message });
    console.log(`  ${name.padEnd(50)} FAIL ${err.message} (${ms}ms)`);
  }
}

async function testAsync(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    passed++;
    results.push({ name, status: 'PASS', ms });
    console.log(`  ${name.padEnd(50)} PASS ${ms}ms`);
  } catch (err) {
    const ms = Date.now() - start;
    failed++;
    results.push({ name, status: 'FAIL', ms, error: err.message });
    console.log(`  ${name.padEnd(50)} FAIL ${err.message} (${ms}ms)`);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Group 1: Module imports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function testImports() {
  console.log('\n── [1] Module Imports ──');

  test('BrowserEngine is a class', () => {
    assert.strictEqual(typeof BrowserEngine, 'function', 'BrowserEngine should be a class');
    assert.ok(new BrowserEngine());
  });

  test('BrowserSession is a class', () => {
    assert.strictEqual(typeof BrowserSession, 'function', 'BrowserSession should be a class');
    assert.ok(new BrowserSession({}));
  });

  test('PlaywrightEngine extends BrowserEngine', () => {
    assert.ok(new PlaywrightEngine() instanceof BrowserEngine);
  });

  test('FailureClassifier is a class', () => {
    assert.strictEqual(typeof FailureClassifier, 'function');
    assert.ok(new FailureClassifier());
  });

  test('RetryPolicy is a class', () => {
    assert.strictEqual(typeof RetryPolicy, 'function');
    assert.ok(new RetryPolicy());
  });

  test('BrowserExecutor is a class', () => {
    assert.strictEqual(typeof BrowserExecutor, 'function');
    assert.ok(new BrowserExecutor());
  });

  test('BrowserFactory is an object with static create', () => {
    assert.ok(BrowserFactory.create());
  });

  test('normalizeProducts is a function', () => {
    assert.strictEqual(typeof normalizeProducts, 'function');
    const result = normalizeProducts(
      [{ title: 'SSD 1TB Samsung', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.ok(Array.isArray(result));
    assert.ok(result[0].normalizedTitle);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Group 2: FailureClassifier
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function testFailureClassifier() {
  console.log('\n── [2] FailureClassifier ──');

  const fc = new FailureClassifier();

  test('Classifies timeout as retriable', () => {
    const err = new Error('Navigation timeout of 30000ms');
    assert.strictEqual(fc.classify(err), FailureCategory.RETRIABLE);
  });

  test('Classifies network error as retriable', () => {
    const err = new Error('Protocol error: net::ERR_CONNECTION_RESET');
    assert.strictEqual(fc.classify(err), FailureCategory.RETRIABLE);
  });

  test('Classifies cloudflare as retriable', () => {
    const err = new Error('Cloudflare detected');
    assert.strictEqual(fc.classify(err), FailureCategory.RETRIABLE);
  });

  test('Classifies 403 as retriable', () => {
    const err = new Error('Page returned 403');
    assert.strictEqual(fc.classify(err), FailureCategory.RETRIABLE);
  });

  test('Classifies ECONNREFUSED as transient', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1');
    assert.strictEqual(fc.classify(err), FailureCategory.TRANSIENT);
  });

  test('Classifies busy as transient', () => {
    const err = new Error('Page is busy');
    assert.strictEqual(fc.classify(err), FailureCategory.TRANSIENT);
  });

  test('Classifies not found as permanent', () => {
    const err = new Error('Element not found');
    assert.strictEqual(fc.classify(err), FailureCategory.PERMANENT);
  });

  test('Classifies type error as permanent', () => {
    const err = new TypeError('Cannot read property of undefined');
    assert.strictEqual(fc.classify(err), FailureCategory.PERMANENT);
  });

  test('Classifies unknown error as unknown', () => {
    const err = new Error('Some weird issue xyz');
    assert.strictEqual(fc.classify(err), FailureCategory.UNKNOWN);
  });

  test('shouldRetry is true for retriable', () => {
    const err = new Error('Navigation timeout');
    assert.strictEqual(fc.shouldRetry(err), true);
  });

  test('shouldRetry is true for transient', () => {
    const err = new Error('ECONNREFUSED');
    assert.strictEqual(fc.shouldRetry(err), true);
  });

  test('shouldRetry is false for permanent', () => {
    const err = new TypeError('Cannot read property');
    assert.strictEqual(fc.shouldRetry(err), false);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Group 3: RetryPolicy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function testRetryPolicy() {
  console.log('\n── [3] RetryPolicy ──');

  const rp = new RetryPolicy({ maxRetries: 3, baseDelayMs: 100 });

  test('maxRetries is 3', () => {
    assert.strictEqual(rp.maxRetries, 3);
  });

  test('baseDelayMs is 100', () => {
    assert.strictEqual(rp.baseDelayMs, 100);
  });

  test('delay grows exponentially', () => {
    const d0 = rp.delay(0);
    const d1 = rp.delay(1);
    const d2 = rp.delay(2);
    assert.ok(d1 > d0, `delay(1) ${d1} > delay(0) ${d0}`);
    assert.ok(d2 > d1, `delay(2) ${d2} > delay(1) ${d1}`);
  });

  test('delay is capped at maxDelayMs', () => {
    const d10 = rp.delay(10);
    assert.ok(d10 <= rp.maxDelayMs, `delay(10) ${d10} <= maxDelayMs ${rp.maxDelayMs}`);
  });

  test('shouldRetry accepts classified failure reasons only', () => {
    assert.strictEqual(rp.shouldRetry(FailureCategory.RETRIABLE, 0), true);
    assert.strictEqual(rp.shouldRetry(FailureCategory.TRANSIENT, 0), true);
    assert.strictEqual(rp.shouldRetry(FailureCategory.PERMANENT, 0), false);
    assert.strictEqual(rp.shouldRetry(FailureCategory.UNKNOWN, 0), false);
  });

  test('shouldRetry stops at maxRetries', () => {
    const rp2 = new RetryPolicy({ maxRetries: 2 });
    assert.strictEqual(rp2.shouldRetry(FailureCategory.RETRIABLE, 0), true);
    assert.strictEqual(rp2.shouldRetry(FailureCategory.RETRIABLE, 1), true);
    assert.strictEqual(rp2.shouldRetry(FailureCategory.RETRIABLE, 2), false);
  });

  test('RetryPolicy has no classifier dependency', () => {
    assert.strictEqual('classifier' in rp, false);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Group 4: BrowserFactory
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function testBrowserFactory() {
  console.log('\n── [4] BrowserFactory ──');

  test('create() returns PlaywrightEngine', () => {
    const engine = BrowserFactory.create();
    assert.ok(engine instanceof PlaywrightEngine);
    assert.strictEqual(engine.engineName, 'playwright');
  });

  test('create() returns independent instances', () => {
    const a = BrowserFactory.create();
    const b = BrowserFactory.create();
    assert.ok(a !== b);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Group 5: BrowserSession
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function testBrowserSession() {
  console.log('\n── [5] BrowserSession ──');

  test('url() returns empty string when page is null', () => {
    const session = new BrowserSession({
      context: null,
      browser: null,
      engineName: 'test',
      page: null,
    });
    assert.strictEqual(session.url(), '');
  });

  test('url() calls page.url() when available', () => {
    const fakePage = { url: () => 'https://test.com' };
    const session = new BrowserSession({
      page: fakePage,
      context: null,
      browser: null,
      engineName: 'test',
    });
    assert.strictEqual(session.url(), 'https://test.com');
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Group 6: BrowserExecutor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testBrowserExecutor() {
  console.log('\n── [6] BrowserExecutor ──');

  await testAsync('passes classified failure reason to RetryPolicy', async () => {
    const rawError = new Error('Navigation timeout');
    const retryCalls = [];
    let classifiedError = null;
    let launchCount = 0;
    let sessionClosed = false;
    let engineClosed = false;

    const session = {
      close: async () => { sessionClosed = true; },
    };
    const engine = {
      isHealthy: async () => true,
      launch: async () => {
        launchCount++;
        return session;
      },
      close: async () => { engineClosed = true; },
    };
    const executor = new BrowserExecutor({
      factory: { create: async () => engine },
      classifier: {
        classify: (error) => {
          classifiedError = error;
          return FailureCategory.RETRIABLE;
        },
      },
      retryPolicy: {
        maxRetries: 1,
        shouldRetry: (failureReason, retryAttempt) => {
          retryCalls.push([failureReason, retryAttempt]);
          return false;
        },
        delay: () => 0,
      },
    });

    await assert.rejects(
      () => executor.execute(async () => { throw rawError; }),
      (error) => error === rawError
    );

    assert.strictEqual(classifiedError, rawError);
    assert.deepStrictEqual(retryCalls, [[FailureCategory.RETRIABLE, 0]]);
    assert.strictEqual(retryCalls[0][0] instanceof Error, false);
    assert.strictEqual(launchCount, 1);
    assert.strictEqual(sessionClosed, true);
    assert.strictEqual(engineClosed, true);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Group 7: Normalizer integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function testNormalizerIntegration() {
  console.log('\n── [7] Normalizer Integration ──');

  test('normalizeProducts returns array', () => {
    const products = normalizeProducts([], 'pichau');
    assert.ok(Array.isArray(products));
  });

  test('normalizeProducts normalizes title', () => {
    const products = normalizeProducts(
      [{ title: '  SSD 1TB Samsung  **  ', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.ok(products[0].normalizedTitle.includes('SSD 1TB Samsung'));
  });

  test('normalizeProducts detects brand', () => {
    const products = normalizeProducts(
      [{ title: 'SSD Samsung 970 EVO', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.strictEqual(products[0].brand, 'Samsung');
  });

  test('normalizeProducts extracts model', () => {
    const products = normalizeProducts(
      [{ title: 'SSD 970 EVO 1TB', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.ok(products[0].model);
    assert.ok(products[0].model.includes('970'));
  });

  test('normalizeProducts extracts storage', () => {
    const products = normalizeProducts(
      [{ title: 'SSD 1TB Samsung', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.strictEqual(products[0].storageCapacity, '1TB');
  });

  test('normalizeProducts sets currency to BRL', () => {
    const products = normalizeProducts(
      [{ title: 'SSD 1TB', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.strictEqual(products[0].currency, 'BRL');
  });

  test('normalizeProducts normalizes price', () => {
    const products = normalizeProducts(
      [{ title: 'SSD 1TB', price: 1234.56, priceText: 'R$ 1.234,56', url: 'http://x' }],
      'pichau'
    );
    assert.ok(products[0].currentPrice > 0);
  });

  test('normalizeProducts detects availability', () => {
    const products = normalizeProducts(
      [{ title: 'SSD 1TB Samsung', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.ok(['in_stock', 'unknown'].includes(products[0].availability));
  });

  test('normalizeProducts sets confidence', () => {
    const products = normalizeProducts(
      [{ title: 'SSD 1TB', price: 299.90, priceText: 'R$ 299,90', url: 'http://x' }],
      'pichau'
    );
    assert.strictEqual(products[0].confidence, 1.0);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Run all tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Browser Abstraction Tests                      ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('Running...\n');

  testImports();
  testFailureClassifier();
  testRetryPolicy();
  testBrowserFactory();
  testBrowserSession();
  await testBrowserExecutor();
  testNormalizerIntegration();

  const total = passed + failed;
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   Summary                                        ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║   Total:  ${String(total).padEnd(39)}║`);
  console.log(`║   PASS:   ${String(passed).padEnd(39)}║`);
  console.log(`║   FAIL:   ${String(failed).padEnd(39)}║`);
  console.log('╚═══════════════════════════════════════════════════╝');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
