/**
 * ProductMatch Test Suite
 *
 * Tests deterministic cross-retailer product matching for SSDs
 * extracted from Pichau, KaBuM, and MercadoLivre.
 *
 * Covers:
 * - Positive cases: same product from different retailers
 * - Negative cases: different products
 * - Edge cases: null values, ambiguous titles, adjacent generations
 */

'use strict';

const {matchProducts, VERDICTS} = require('../src/products/ProductMatch');
const {extract} = require('../src/StorageDeviceExtractor');
const assert = require('assert');

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    process.stdout.write('  ok ');
  } catch (e) {
    failed++;
    process.stdout.write('  FAIL ');
    console.log();
    console.log('    ' + name + ': ' + e.message);
  }
}

/**
 * Helper: assert that verdict is one of the expected values.
 */
function assertVerdict(result, expected, label) {
  const msg = label + ': expected {' + expected + '}, got ' + result.verdict + ' (confidence=' + result.confidence + ')';
  assert.ok(expected.indexOf(result.verdict) >= 0, msg);
}

/**
 * Helper: assert that confidence is in range.
 */
function assertConfidence(conf, min, max, label) {
  const msg = label + ': expected [' + min + ',' + max + '], got ' + conf;
  assert.ok(conf >= min && conf <= max, msg);
}

// ====================================================================
// 1. POSITIVE CASES - Same product from different retailers
// ====================================================================
console.log('\n--- 1. Positive Cases ---');

test('Samsung 870 EVO 500GB: Pichau vs KaBuM (all fields match)', function() {
  const samsung_pichau = extract('SSD Samsung 870 EVO 500GB 2.5" SATA', {source: 'pichau'});
  const samsung_kabum = extract('SSD Samsung 870 EVO 500GB SATA III 2.5 Polos', {source: 'kabum'});
  const result = matchProducts(samsung_pichau, samsung_kabum);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Samsung 870 EVO');
  assertConfidence(result.confidence, 0.85, 1.0, 'confidence');
  // Show evidence: all should be marked matched
  const allMatched = result.evidence.every(function(e) { return e.matched; });
  assert.ok(allMatched, 'all evidence matched');
});

test('Samsung 980 PRO 1TB: Pichau vs MercadoLivre (same model)', function() {
  const r1 = extract('SSD Samsung 980 PRO 1TB M.2 NVMe', {source: 'pichau'});
  const r2 = extract('SSD Samsung 980 PRO 1TB NVMe M.2', {source: 'mercadolivre'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL', 'Samsung 980 PRO');
  assertConfidence(result.confidence, 0.8, 1.0, 'confidence');
});

test('Kingston A400 480GB: Pichau vs MercadoLivre (SKU match)', function() {
  const r1 = extract('SSD Kingston A400 480GB SATA', {source: 'pichau'});
  const r2 = extract('SSD Kingston SV300S37/480G A400 480GB', {source: 'mercadolivre'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Kingston A400');
  assert.ok(result.confidence >= 0.7, 'confidence >= 0.7 got ' + result.confidence);
});

test('WD Blue SN580 500GB: Pichau vs MercadoLivre (brand alias)', function() {
  const r1 = extract('SSD WD Blue SN580 500GB NVMe M.2', {source: 'pichau'});
  const r2 = extract('SSD Western Digital Blue SN580 500GB M.2 NVMe', {source: 'mercadolivre'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL', 'WD Blue alias');
  assert.ok(result.confidence >= 0.8, 'WD alias confidence >= 0.8 got ' + result.confidence);
});

test('Corsair MP600 1TB: Pichau vs KaBuM (same model capacity)', function() {
  const r1 = extract('SSD Corsair MP600 1TB PCIe Gen4', {source: 'pichau'});
  const r2 = extract('SSD Corsair MP600 1TB PCIe Gen4 NVMe', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Corsair MP600 1TB');
  assert.ok(result.confidence >= 0.7, 'Corsair confidence >= 0.7 got ' + result.confidence);
});

test('Crucial MX500 1TB: Pichau vs KaBuM (same form factor)', function() {
  const r1 = extract('SSD Crucial MX500 1TB 2.5" SATA', {source: 'pichau'});
  const r2 = extract('SSD Crucial MX500 1TB SATA III', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Crucial MX500');
});

// ====================================================================
// 2. NEGATIVE CASES - Different products
// ====================================================================
console.log('\n--- 2. Negative Cases ---');

test('Different capacity: Samsung 870 EVO 500GB vs 1TB', function() {
  const r1 = extract('SSD Samsung 870 EVO 500GB', {source: 'pichau'});
  const r2 = extract('SSD Samsung 870 EVO 1TB', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  // 500GB vs 1000GB: diff ratio > 0.05 → capacity mismatch
  assertVerdict(result, 'DIFFERENT,LIKELY_IDENTICAL', 'Capacity diff');
  assertConfidence(result.confidence, 0.2, 0.95, 'confidence');
  // Find the capacity evidence
  const capEvidence = result.evidence.find(function(e) { return e.rule === 'capacity'; });
  assert.ok(capEvidence && !capEvidence.matched, 'capacity should NOT match');
});

test('Different generations: Gen3 vs Gen4', function() {
  const r1 = extract('SSD Samsung 870 EVO 500GB PCIe Gen3', {source: 'pichau'});
  const r2 = extract('SSD Samsung 870 EVO 500GB PCIe Gen4', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  // Gen3 vs Gen4: adjacent, so still MATCHED for PCIe gen
  // Should not be IDENTICAL (gen different)
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL,DIFFERENT', 'Gen3 vs Gen4');
});

test('Different families: EVO vs PRO', function() {
  const r1 = extract('SSD Samsung 870 EVO 500GB', {source: 'pichau'});
  const r2 = extract('SSD Samsung 980 PRO 500GB', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'DIFFERENT,LIKELY_IDENTICAL', 'Family diff');
  assertConfidence(result.confidence, 0.3, 0.9, 'confidence');
  const famEvidence = result.evidence.find(function(e) { return e.rule === 'family'; });
  assert.ok(famEvidence, 'family evidence exists');
});

test('Different SKUs: Kingston A400 vs WD Blue', function() {
  const r1 = extract('SSD Kingston A400 480GB SATA', {source: 'pichau'});
  const r2 = extract('SSD WD Blue SN580 500GB', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'UNKNOWN,DIFFERENT', 'Brand/SKU diff');
  assertConfidence(result.confidence, 0.1, 0.6, 'confidence');
});

// ====================================================================
// 3. EDGE CASES
// ====================================================================
console.log('\n--- 3. Edge Cases ---');

test('Both products null', function() {
  const result = matchProducts(null, null);
  assertVerdict(result, 'UNKNOWN', 'null vs null');
});

test('One product null', function() {
  const r = extract('SSD Samsung 870 EVO 500GB', {source: 'pichau'});
  const result = matchProducts(r, null);
  assertVerdict(result, 'UNKNOWN,DIFFERENT', 'one null');
});

test('Empty strings', function() {
  const r = {
    category: 'StorageDevice',
    brand: '',
    model: '',
    family: null,
    manufacturerSku: null,
    capacityGB: null,
    capacityTB: null,
    interface: null,
    protocol: null,
    pcieGeneration: null,
    formFactor: null,
    confidence: {},
  };
  const result = matchProducts(r, r);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'empty vs empty');
});

test('Interface compatibility: NVMe vs M.2', function() {
  const r1 = extract('SSD NVMe 500GB', {source: 'pichau'});
  const r2 = extract('SSD M.2 500GB', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  // M.2 and NVMe are compatible interfaces
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'M.2 vs NVMe');
});

test('Adjacent PCIe generations: Gen4 vs Gen5', function() {
  const r1 = extract('SSD Corsair MP600 PCIe Gen4', {source: 'pichau'});
  const r2 = extract('SSD Corsair MP600 PCIe Gen5', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Gen4 vs Gen5');
});

test('Same manufacturer SKU (exact match)', function() {
  const r1 = extract('Kingston SV300S37/480G', {source: 'pichau'});
  const r2 = extract('Kingston SV300S37/480G A400 480GB', {source: 'mercadolivre'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'exact SKU');
  assert.ok(result.confidence >= 0.7, 'high confidence for exact SKU got ' + result.confidence);
});

test('Confidence scoring: 0 to 1 range', function() {
  const r1 = extract('SSD Samsung 870 EVO 500GB', {source: 'pichau'});
  const r2 = extract('SSD Kingston A400 480GB', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assert.ok(result.confidence >= 0 && result.confidence <= 1, 'confidence in [0,1]');
});

test('Evidence contains all rules', function() {
  const r1 = extract('SSD Samsung 870 EVO 500GB 2.5" SATA', {source: 'pichau'});
  const r2 = extract('SSD Samsung 870 EVO 500GB SATA III', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  const ruleNames = result.evidence.map(function(e) { return e.rule; });
  assert.ok(ruleNames.indexOf('manufacturerSku') >= 0, 'manufacturerSku evidence');
  assert.ok(ruleNames.indexOf('brand') >= 0, 'brand evidence');
  assert.ok(ruleNames.indexOf('model') >= 0, 'model evidence');
  assert.ok(ruleNames.indexOf('family') >= 0, 'family evidence');
  assert.ok(ruleNames.indexOf('capacity') >= 0, 'capacity evidence');
  assert.ok(ruleNames.indexOf('interface') >= 0, 'interface evidence');
});

// ====================================================================
// 4. REAL-WORLD PRODUCT COMPARISONS
// ====================================================================
console.log('\n--- 4. Real-World Examples ---');

test('Real: Samsung 990 PRO 2TB Pichau vs KaBuM', function() {
  const r1 = extract('SSD Samsung 990 PRO 2TB M.2 PCIe Gen5', {source: 'pichau'});
  const r2 = extract('SSD Samsung 990 PRO 2TB PCIe Gen5 NVMe', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Samsung 990 PRO 2TB');
  assertConfidence(result.confidence, 0.85, 1.0, 'confidence');
});

test('Real: Lexar NM790 4TB Pichau vs MercadoLivre', function() {
  const r1 = extract('SSD Lexar NM790 4TB PCIe Gen5', {source: 'pichau'});
  const r2 = extract('SSD Lexar NM790 4TB NVMe M.2', {source: 'mercadolivre'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'DIFFERENT,LIKELY_IDENTICAL', 'Lexar NM790 4TB');
});

test('Real: XPG SX8200 Pro 1TB Pichau vs KaBuM', function() {
  const r1 = extract('SSD XPG SX8200 Pro 1TB PCIe Gen3x4', {source: 'pichau'});
  const r2 = extract('SSD XPG SX8200 Pro 1TB Gen3 NVMe', {source: 'kabum'});
  const result = matchProducts(r1, r2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'XPG SX8200 Pro 1TB');
});

// Summary
console.log('\n======================');
console.log('  Results: ' + passed + '/' + total + ' passed, ' + failed + '/' + total + ' failed');
console.log('======================\n');

if (failed > 0) {
  process.exit(1);
}
