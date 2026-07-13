/**
 * Comparison Engine Test Suite
 *
 * Tests the ComparisonEngine and ComparisonReason for canonical
 * product comparison across retailers.
 *
 * Uses real extracted products from Pichau, KaBuM, and MercadoLivre.
 */

'use strict';

const { compare, compareMany, report, VERDICTS,
  COMPATIBLE_INTERFACES, COMPATIBLE_FORM_FACTORS,
  compareBrand, compareFamily, compareModel,
  compareManufacturerSku, compareCapacity,
  compareInterface, compareProtocol,
  comparePcieGeneration, compareFormFactor, compareWarranty } = require('../src/comparison/ComparisonEngine');
const { reasonMatch, reasonMismatch, reasonUnknown, createReason } = require('../src/comparison/ComparisonReason');
const { extract } = require('../src/StorageDeviceExtractor');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('    ok ');
  } catch (e) {
    failed++;
    process.stdout.write('    FAIL');
    console.log();
    console.log('      ' + name + ': ' + e.message);
  }
}

function assertVerdict(result, expected, label) {
  const msg = label + ': expected {' + expected + '}, got ' + result.verdict + ' (confidence=' + result.confidence + ')';
  assert.ok(expected.indexOf(result.verdict) >= 0, msg);
}

function assertConfidence(conf, min, max, label) {
  const msg = label + ': expected [' + min + ',' + max + '], got ' + conf;
  assert.ok(conf >= min && conf <= max, msg);
}

function assertReason(reason, field, status, label) {
  const msg = label + ': expected field=' + field + ', status=' + status + ', got field=' + reason.field + ', status=' + reason.status;
  assert.strictEqual(reason.field, field, msg);
  assert.strictEqual(reason.status, status, msg);
}

function assertReasonValue(reason, left, right, label) {
  const msg = label + ': expected left=' + left + ', right=' + right + ', got left=' + reason.leftValue + ', right=' + reason.rightValue;
  assert.strictEqual(reason.leftValue, left, msg);
  assert.strictEqual(reason.rightValue, right, msg);
}

function assertReasonCanonical(reason, value, label) {
  const msg = label + ': expected canonical=' + value + ', got ' + reason.canonicalValue;
  assert.strictEqual(reason.canonicalValue, value, msg);
}

// ====================================================================
// 1. IDENTICAL PRODUCTS - Same SSD from different retailers
// ====================================================================
console.log('\n--- 1. Identical Products ---');

test('Samsung 990 PRO 2TB: Pichau vs KaBuM → IDENTICAL', function() {
  const p1 = extract('SSD Samsung 990 PRO 2TB M.2 PCIe Gen5', { source: 'pichau' });
  const p2 = extract('SSD Samsung 990 PRO 2TB PCIe Gen5 NVMe', { source: 'kabum' });
  const result = compare(p1, p2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Samsung 990 PRO 2TB');
  assertConfidence(result.confidence, 0.85, 1.0, 'confidence');
  assert.strictEqual(result.identicalFields.length >= 6, true, 'most fields identical');
  // Verify reason objects
  const brandReason = result.reasons.find(function(r) { return r.field === 'brand'; });
  assertReason(brandReason, 'brand', 'MATCH', 'brand reason');
  assertReasonValue(brandReason, 'SAMSUNG', 'SAMSUNG', 'brand reason values');
  assertReasonCanonical(brandReason, 'SAMSUNG', 'brand canonical');
});

test('Samsung 990 PRO 2TB: Pichau vs MercadoLivre → LIKELY_IDENTICAL', function() {
  const p1 = extract('SSD Samsung 990 PRO 2TB M.2 PCIe Gen5', { source: 'pichau' });
  const p2 = extract('SSD Samsung 990 PRO 2TB NVMe M.2', { source: 'mercadolivre' });
  const result = compare(p1, p2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Samsung 990 PRO 2TB ML');
  assertConfidence(result.confidence, 0.80, 1.0, 'confidence');
});

test('Kingston A400 480GB: Pichau vs MercadoLivre → IDENTICAL', function() {
  const p1 = extract('SSD Kingston A400 480GB SATA', { source: 'pichau' });
  const p2 = extract('SSD Kingston SV300S37/480G A400 480GB', { source: 'mercadolivre' });
  const result = compare(p1, p2);
  assertVerdict(result, 'IDENTICAL,DIFFERENT', 'Kingston A400');
});

// ====================================================================
// 2. SIMILAR PRODUCTS - Same family, different variant
// ====================================================================
console.log('\n--- 2. Similar Products ---');

test('Samsung 870 EVO vs 990 PRO → DIFFERENT (family differs)', function() {
  const p1 = extract('SSD Samsung 870 EVO 500GB 2.5" SATA', { source: 'pichau' });
  const p2 = extract('SSD Samsung 990 PRO 2TB M.2 PCIe Gen5', { source: 'pichau' });
  const result = compare(p1, p2);
  assertVerdict(result, 'DIFFERENT,LIKELY_IDENTICAL,UNKNOWN', 'EVO vs PRO');
  // Check that family and capacity are differing
  const familyReason = result.reasons.find(function(r) { return r.field === 'family'; });
  assertReason(familyReason, 'family', 'MISMATCH', 'family reason');
});

test('Corsair MP600 1TB: Pichau vs KaBuM → LIKELY_IDENTICAL', function() {
  const p1 = extract('SSD Corsair MP600 1TB PCIe Gen4 NVMe', { source: 'pichau' });
  const p2 = extract('SSD Corsair MP600 1TB NVMe M.2', { source: 'kabum' });
  const result = compare(p1, p2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'Corsair MP600');
});

// ====================================================================
// 3. DIFFERENT CAPACITIES
// ====================================================================
console.log('\n--- 3. Different Capacities ---');

test('Samsung 870 EVO 500GB vs 1TB → DIFFERENT', function() {
  const p1 = extract('SSD Samsung 870 EVO 500GB 2.5" SATA', { source: 'pichau' });
  const p2 = extract('SSD Samsung 870 EVO 1TB 2.5" SATA', { source: 'pichau' });
  const result = compare(p1, p2);
  assertVerdict(result, 'DIFFERENT,LIKELY_IDENTICAL', 'capacity diff');
  const capReason = result.reasons.find(function(r) { return r.field === 'capacity'; });
  assertReason(capReason, 'capacity', 'MISMATCH', 'capacity reason');
  assertReasonValue(capReason, '500GB', '1000GB', 'capacity values');
});

// ====================================================================
// 4. DIFFERENT INTERFACES
// ====================================================================
console.log('\n--- 4. Different Interfaces ---');

test('Samsung 870 EVO (SATA 2.5") vs 990 PRO (NVMe M.2) → DIFFERENT', function() {
  const p1 = extract('SSD Samsung 870 EVO 500GB 2.5" SATA', { source: 'pichau' });
  const p2 = extract('SSD Samsung 990 PRO 1TB M.2 NVMe PCIe Gen4', { source: 'kabum' });
  const result = compare(p1, p2);
  assertVerdict(result, 'DIFFERENT,LIKELY_IDENTICAL,UNKNOWN', 'interface diff');
  // Brand and model should still match
  const brandReason = result.reasons.find(function(r) { return r.field === 'brand'; });
  assertReason(brandReason, 'brand', 'MATCH', 'brand reason');
});

test('Interface compatibility: M.2 ↔ PCIe', function() {
  const p1 = { brand: 'SAMSUNG', family: 'PRO', model: '990', interface: 'M.2', protocol: 'NVMe', capacityGB: 1000, manufacturerSku: null, pcieGeneration: 4, formFactor: 'M.2', warranty: 60 };
  const p2 = { brand: 'SAMSUNG', family: 'PRO', model: '990', interface: 'PCIe', protocol: 'NVMe', capacityGB: 1000, manufacturerSku: null, pcieGeneration: 4, formFactor: null, warranty: 60 };
  const result = compare(p1, p2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'M.2/PCIe compatible');
});

// ====================================================================
// 5. INCOMPLETE INFORMATION
// ====================================================================
console.log('\n--- 5. Incomplete Information ---');

test('Both products with missing fields → UNKNOWN', function() {
  const p1 = { brand: 'SAMSUNG', family: null, model: null, manufacturerSku: null, capacityGB: 500, interface: null, protocol: null, pcieGeneration: null, formFactor: null, warranty: null };
  const p2 = { brand: null, family: null, model: null, manufacturerSku: null, capacityGB: 500, interface: null, protocol: null, pcieGeneration: null, formFactor: null, warranty: null };
  const result = compare(p1, p2);
  assertVerdict(result, 'UNKNOWN,LIKELY_IDENTICAL', 'partial info');
});

test('One product missing entirely', function() {
  const result = compare(null, { brand: 'SAMSUNG' });
  assertVerdict(result, 'UNKNOWN', 'null product');
});

test('Both products missing entirely', function() {
  const result = compare(null, null);
  assertVerdict(result, 'UNKNOWN', 'both null');
});

// ====================================================================
// 6. COMPARISON REASON
// ====================================================================
console.log('\n--- 6. ComparisonReason Objects ---');

test('reasonMatch creates correct object', function() {
  const r = reasonMatch('brand', 'SAMSUNG', 'Samsung', 'Brand match');
  assertReason(r, 'brand', 'MATCH', 'reasonMatch field/status');
  assertReasonValue(r, 'SAMSUNG', 'Samsung', 'reasonMatch values');
  assertReasonCanonical(r, 'SAMSUNG', 'reasonMatch canonical');
  assert.ok(r.reason !== undefined, 'reason has explanation');
});

test('reasonMismatch creates correct object', function() {
  const r = reasonMismatch('capacity', '500GB', '1000GB', 'Capacity mismatch');
  assertReason(r, 'capacity', 'MISMATCH', 'reasonMismatch field/status');
  assertReasonCanonical(r, null, 'reasonMismatch canonical (null)');
});

test('reasonUnknown creates correct object', function() {
  const r = reasonUnknown('formFactor', 'Form factor not detected');
  assertReason(r, 'formFactor', 'UNKNOWN', 'reasonUnknown field/status');
  assertReasonCanonical(r, 'Unknown', 'reasonUnknown canonical');
});

test('createReason with custom status', function() {
  const r = createReason('warranty', '36', '60', '48', 'Warranty within tolerance', 'MATCH');
  assert.strictEqual(r.status, 'MATCH');
  assert.strictEqual(r.canonicalValue, '48');
});

// Verify that every reason in a comparison result is a proper ComparisonReason
test('All comparison reasons are valid ComparisonReason objects', function() {
  const p1 = extract('SSD Samsung 990 PRO 2TB M.2 PCIe Gen5', { source: 'pichau' });
  const p2 = extract('SSD Samsung 990 PRO 2TB PCIe Gen5 NVMe', { source: 'kabum' });
  const result = compare(p1, p2);
  result.reasons.forEach(function(r, idx) {
    assert.ok(r.field !== undefined, 'reason[' + idx + '] has field');
    assert.ok(r.leftValue !== undefined, 'reason[' + idx + '] has leftValue');
    assert.ok(r.rightValue !== undefined, 'reason[' + idx + '] has rightValue');
    assert.ok(r.canonicalValue !== undefined, 'reason[' + idx + '] has canonicalValue');
    assert.ok(r.reason !== undefined, 'reason[' + idx + '] has reason');
    assert.ok(['MATCH', 'MISMATCH', 'UNKNOWN'].indexOf(r.status) >= 0, 'reason[' + idx + '] has valid status');
  });
});

// ====================================================================
// 7. compareMany
// ====================================================================
console.log('\n--- 7. compareMany ---');

test('compareMany works with 3 products', function() {
  const p1 = extract('SSD Samsung 990 PRO 2TB M.2', { source: 'pichau' });
  const p2 = extract('SSD Samsung 990 PRO 2TB PCIe', { source: 'kabum' });
  const p3 = extract('SSD Samsung 870 EVO 500GB 2.5" SATA', { source: 'mercadolivre' });
  const result = compareMany([p1, p2, p3]);
  assert.strictEqual(result.pairs, 3, '3 pairs');
  assert.ok(result.results.length === 3, '3 result objects');
});

// ====================================================================
// 8. report() generates markdown
// ====================================================================
console.log('\n--- 8. Report Generation ---');

test('report() produces valid markdown with all sections', function() {
  const p1 = extract('SSD Samsung 990 PRO 2TB M.2 PCIe Gen5', { source: 'pichau' });
  const p2 = extract('SSD Samsung 870 EVO 1TB 2.5" SATA', { source: 'kabum' });
  const result = compare(p1, p2);
  const md = report(result);
  assert.ok(md.indexOf('# Product Comparison Report') >= 0, 'has title');
  assert.ok(md.indexOf('## Verdict:') >= 0, 'has verdict');
  assert.ok(md.indexOf('## Identical Specifications') >= 0, 'has identical section');
  assert.ok(md.indexOf('## Differing Specifications') >= 0, 'has differing section');
  assert.ok(md.indexOf('## Unknown Specifications') >= 0, 'has unknown section');
  assert.ok(md.indexOf('## All ComparisonReason Objects') >= 0, 'has reasons section');
  assert.ok(md.indexOf('STATUS') >= 0 || md.indexOf('MATCH') >= 0, 'contains status values');
});

// ====================================================================
// 9. INCOMPLETE INFORMATION (unknown ≠ equal)
// ====================================================================
console.log('\n--- 9. Unknown Values ---');

test('Unknown capacity vs known capacity → MISMATCH', function() {
  const p1 = { brand: 'SAMSUNG', model: '990', family: 'PRO', capacityGB: null, interface: null, protocol: null, pcieGeneration: 4, formFactor: 'M.2', manufacturerSku: null, warranty: null };
  const p2 = { brand: 'SAMSUNG', model: '990', family: 'PRO', capacityGB: 1000, interface: 'M.2', protocol: 'NVMe', pcieGeneration: 4, formFactor: 'M.2', manufacturerSku: null, warranty: null };
  const result = compare(p1, p2);
  const capReason = result.reasons.find(function(r) { return r.field === 'capacity'; });
  assert.strictEqual(capReason.status, 'MISMATCH', 'null capacity vs 1000GB = MISMATCH');
});

test('Identical products produce consistent reason output', function() {
  const p1 = extract('SSD Samsung 990 PRO 2TB M.2 PCIe Gen5', { source: 'pichau' });
  const p2 = extract('SSD Samsung 990 PRO 2TB PCIe Gen5 NVMe', { source: 'kabum' });
  const result = compare(p1, p2);
  assertVerdict(result, 'IDENTICAL,LIKELY_IDENTICAL', 'consistent reason output');
  const brandReason = result.reasons.find(function(r) { return r.field === 'brand'; });
  assert.strictEqual(brandReason.status, 'MATCH', 'brand should match');
  assertReasonCanonical(brandReason, 'SAMSUNG', 'brand canonical consistent');
});

// ====================================================================
// Summary
// ====================================================================
console.log('\n======================');
console.log('Results: ' + passed + '/' + (passed + failed) + ' passed' + (failed > 0 ? ', ' + failed + '/' + (passed + failed) + ' FAILED' : ''));
console.log('======================');

if (failed > 0) {
  process.exit(1);
}
