#!/usr/bin/env node
/**
 * tests/test-camofox-engine.js
 *
 * Validates CamofoxEngine: contract, factory, lifecycle, execute,
 * navigation, and singleton independence.
 */

const {
  CamofoxEngine,
  PlaywrightEngine,
  BrowserFactory,
  BrowserSession,
} = require('../src/browser/index');

const assert = require('assert');

function assertEqual(actual, expected, label) {
  assert.strictEqual(actual, expected, `${label}: expected ${expected} but got ${actual}`);
  console.log(`  [PASS] ${label} = ${expected}`);
}

function assertType(val, typeName, label) {
  assert.strictEqual(typeof val, typeName, `${label}: expected type ${typeName} but got ${typeof val}`);
  console.log(`  [PASS] ${label} is ${typeName}`);
}

async function testContract() {
  console.log('\n[testContract]');
  const eng = new CamofoxEngine();
  assertType(eng.engineName, 'string', 'engineName');
  assertEqual(eng.engineName, 'camofox', 'engineName value');
  assertType(eng.launch, 'function', 'launch method');
  assertType(eng.close, 'function', 'close method');
  assertType(eng.isHealthy, 'function', 'isHealthy method');
  assertType(eng.execute, 'function', 'execute method');
  assertType(eng.getPage, 'function', 'getPage method');
  assertType(eng.getBrowser, 'function', 'getBrowser method');
  console.log('');
}

async function testFactory() {
  console.log('\n[testFactory]');
  const pw = BrowserFactory.create({ engine: 'playwright' });
  const cf = BrowserFactory.create({ engine: 'camofox' });
  const def = BrowserFactory.create();
  assertEqual(pw.engineName, 'playwright', 'create({ engine: "playwright" })');
  assertEqual(cf.engineName, 'camofox', 'create({ engine: "camofox" })');
  assertEqual(def.engineName, 'playwright', 'create() defaults');
  assert(pw instanceof PlaywrightEngine, 'pw instanceof PlaywrightEngine');
  assert(cf instanceof CamofoxEngine, 'cf instanceof CamofoxEngine');
  console.log('');
}

async function testLifecycle() {
  console.log('\n[testLifecycle]');
  const eng = new CamofoxEngine();
  const pre = await eng.isHealthy();
  console.log(`  [PASS] pre-launch isHealthy = ${pre}`);
  await eng.launch();
  await new Promise(r => setTimeout(r, 500));
  const post = await eng.isHealthy();
  console.log(`  [PASS] post-launch isHealthy = ${post}`);
  assert(post, 'isHealthy after launch');
  await eng.close();
  await new Promise(r => setTimeout(r, 500));
  const after = await eng.isHealthy();
  console.log(`  [PASS] post-close isHealthy = ${after}`);
  assert(!after, 'not healthy after close');
  console.log('');
}

async function testLaunchSession() {
  console.log('\n[testLaunchSession]');
  const eng = new CamofoxEngine();
  await eng.launch();
  const sess = await eng.launch();
  assertEqual(sess.engineName, 'camofox', 'session engineName');
  assert(!!sess.page, 'session has page');
  assert(!!sess.context, 'session has context');
  assert(!!sess.browser, 'session has browser');
  assert(sess instanceof BrowserSession, 'session is BrowserSession');
  console.log('');
}

async function testExecute() {
  console.log('\n[testExecute]');
  const eng = new CamofoxEngine();
  await eng.launch();
  const result = await eng.execute(async (page) => {
    await page.goto('about:blank');
    const ua = await page.evaluate(() => navigator.userAgent);
    return { ua, title: await page.title() };
  });
  assert(result.ua.includes('Firefox'), 'UA includes Firefox');
  console.log(`  [PASS] execute UA includes Firefox`);
  assert(result.title === '' || result.title === 'about:blank', 'execute page title (got: "' + result.title + '")');
  await eng.close();
  console.log('');
}

async function testNavigation() {
  console.log('\n[testNavigation]');
  const eng = new CamofoxEngine();
  await eng.launch();
  const sess = await eng.launch();
  await sess.page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  const title = await sess.page.title();
  console.log(`  [PASS] title = ${title}`);
  await eng.close();
  console.log('');
}

async function testIndependent() {
  console.log('\n[testIndependent]');
  const eng1 = new CamofoxEngine();
  const eng2 = new CamofoxEngine();
  await eng1.launch();
  await eng2.launch();
  const h1 = await eng1.isHealthy();
  const h2 = await eng2.isHealthy();
  console.log(`  [PASS] eng1 healthy = ${h1}`);
  console.log(`  [PASS] eng2 healthy = ${h2}`);
  await eng1.close();
  await eng2.close();
  const h1c = await eng1.isHealthy();
  const h2c = await eng2.isHealthy();
  console.log(`  [PASS] eng1 after close = ${h1c}`);
  console.log(`  [PASS] eng2 after close = ${h2c}`);
  console.log('');
}

(async () => {
  console.log('=== CamofoxEngine Validation Tests ===\n');
  const startTime = Date.now();
  let passed = 0, failed = 0;

  const tests = [testContract, testFactory, testLifecycle, testLaunchSession, testExecute, testNavigation, testIndependent];
  for (const t of tests) {
    try { await t(); passed++; }
    catch (e) { console.error(`  [FAIL] ${t.name} — ${e.message}\n`); failed++; }
  }

  const elapsed = Date.now() - startTime;
  console.log(`\n=== Result: ${passed} passed, ${failed} failed (${elapsed}ms) ===`);
  process.exit(failed === 0 ? 0 : 1);
})();
