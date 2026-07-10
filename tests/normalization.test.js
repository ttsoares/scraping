/**
 * Normalization Tests
 *
 * Tests all 10 normalizer functions with representative product data
 * from Pichau, KaBuM, and Mercado Livre.
 */

const assert = require('assert');
const {
  normalizeTitle,
  extractBrand,
  extractModel,
  extractStorageCapacity,
  extractMemoryCapacity,
  normalizeCurrency,
  normalizePrice,
  detectAvailability,
  normalizeProduct,
  normalizeProducts,
} = require('../src/providers/normalizer');

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. normalizeTitle
// ---------------------------------------------------------------------------
function testNormalizeTitle() {
  console.log('\n── normalizeTitle ──');

  test("strips leading star markers", () => {
    const input = '⭐ SSD Samsung 500GB';
    const result = normalizeTitle(input);
    assert.strictEqual(result, 'SSD Samsung 500GB', `Expected "SSD Samsung 500GB" got "${result}"`);
  });

  test("removes Avaliação noise", () => {
    const input = 'Placa de ASRock GTX 1650 Avaliação 4,5 de 5';
    const result = normalizeTitle(input);
    assert.ok(!result.includes('Avaliação'), `Avaliação should be removed, got "${result}"`);
  });

  test("removes Selo prefix", () => {
    const input = 'Selo: Produto Destcado SSD Kingston 480GB';
    const result = normalizeTitle(input);
    assert.ok(!result.startsWith('Selo:'), `Selo should be removed, got "${result}"`);
  });

  test("removes Produto Patrocinado prefix", () => {
    const input = 'Produto Patrocinado Ryzen 7 5700X';
    const result = normalizeTitle(input);
    assert.ok(!result.startsWith('Produto Patrocinado'), `Prefix should be removed, got "${result}"`);
  });

  test("removes installment price markers (10x de R$ 100)", () => {
    const input = 'SSD NVMe 1TB 10x de R$ 100,00';
    const result = normalizeTitle(input);
    assert.ok(!result.includes('x de'), `Installment should be removed, got "${result}"`);
  });

  test("removes generation suffix", () => {
    const input = 'iPhone 13 (3ª Geração) 128GB';
    const result = normalizeTitle(input);
    assert.ok(!result.includes('Geração'), `Generation should be removed, got "${result}"`);
  });

  test("collapses multiple spaces", () => {
    const input = 'SSD   Samsung   500GB';
    const result = normalizeTitle(input);
    assert.ok(!result.includes('  '), `Spaces should be collapsed, got "${result}"`);
  });

  test("handles empty input", () => {
    const result = normalizeTitle('');
    assert.strictEqual(result, '');
  });

  test("handles null input", () => {
    const result = normalizeTitle(null);
    assert.strictEqual(result, '');
  });

  test("preserves Unicode characters", () => {
    const input = 'SSD Samsung 500GB com frete grátis*';
    const result = normalizeTitle(input);
    assert.ok(result.includes('grátis'), `Unicode should be preserved, got "${result}"`);
  });
}

// ---------------------------------------------------------------------------
// 2. extractBrand
// ---------------------------------------------------------------------------
function testExtractBrand() {
  console.log('\n── extractBrand ──');

  test("detects Samsung in title", () => {
    const result = extractBrand('SSD Samsung 500GB');
    assert.strictEqual(result, 'Samsung');
  });

  test("detects AMD Ryzen", () => {
    const result = extractBrand('Processador AMD Ryzen 7 5700X');
    assert.strictEqual(result, 'AMD');
  });

  test("detects NVIDIA GeForce", () => {
    const result = extractBrand('GeForce RTX 3060 NVIDIA');
    assert.strictEqual(result, 'NVIDIA');
  });

  test("detects Corsair power supply", () => {
    const result = extractBrand('Fonte Corsair RM850x');
    assert.strictEqual(result, 'Corsair');
  });

  test("returns null for unknown brand", () => {
    const result = extractBrand('Placa mãe genérica B550');
    assert.strictEqual(result, null);
  });

  test("handles case-insensitive detection", () => {
    const result = extractBrand('ssd samsung 500gb');
    assert.strictEqual(result, 'samsung');
  });

  test("handles empty input", () => {
    const result = extractBrand('');
    assert.strictEqual(result, null);
  });

  test("detects Western Digital (multi-word)", () => {
    const result = extractBrand('HD Western Digital 1TB');
    assert.strictEqual(result, 'Western Digital');
  });

  test("detects Cooler Master (multi-word)", () => {
    const result = extractBrand('Gabinete Cooler Master Q300L');
    assert.strictEqual(result, 'Cooler Master');
  });

  test("detects Be Quiet (multi-word)", () => {
    const result = extractBrand('Fonte Be Quiet! 600W');
    assert.strictEqual(result, 'Be Quiet');
  });
}

// ---------------------------------------------------------------------------
// 3. extractModel
// ---------------------------------------------------------------------------
function testExtractModel() {
  console.log('\n── extractModel ──');

  test("extracts Ryzen model number", () => {
    const result = extractModel('AMD Ryzen 7 5700X');
    assert.ok(result && result.includes('5700X'), `Expected model with 5700X, got "${result}"`);
  });

  test("extracts GeForce RTX model", () => {
    const result = extractModel('GeForce RTX 3060 12GB');
    assert.ok(result && result.includes('RTX'), `Expected RTX model, got "${result}"`);
  });

  test("extracts Intel Core i-series", () => {
    const result = extractModel('Intel Core i7-1270');
    assert.ok(result && result.includes('i7'), `Expected i7 model, got "${result}"`);
  });

  test("extracts numeric model like A400", () => {
    const result = extractModel('RTX A400 16GB');
    assert.ok(result && /\d{2,4}/.test(result), `Expected numeric model, got "${result}"`);
  });

  test("handles empty input", () => {
    const result = extractModel('');
    assert.strictEqual(result, null);
  });

  test("handles null input", () => {
    const result = extractModel(null);
    assert.strictEqual(result, null);
  });

  test("extracts SSD model with capacity", () => {
    const result = extractModel('SSD Samsung 870 EVO 500GB');
    assert.ok(result && result.includes('EVO'), `Expected model with EVO, got "${result}"`);
  });
}

// ---------------------------------------------------------------------------
// 4. extractStorageCapacity
// ---------------------------------------------------------------------------
function testExtractStorageCapacity() {
  console.log('\n── extractStorageCapacity ──');

  test("extracts TB values", () => {
    const result = extractStorageCapacity('SSD Samsung 1TB NVMe');
    assert.ok(result && result.includes('TB'), `Expected TB value, got "${result}"`);
  });

  test("extracts mixed decimal TB", () => {
    const result = extractStorageCapacity('SSD 1.92TB NVMe');
    assert.ok(result && result.includes('1.92'), `Expected 1.92TB, got "${result}"`);
  });

  test("extracts GB values", () => {
    const result = extractStorageCapacity('SSD Samsung 500GB');
    assert.ok(result && result.includes('500GB'), `Expected 500GB, got "${result}"`);
  });

  test("returns null when no storage units", () => {
    const result = extractStorageCapacity('Processador AMD Ryzen 7');
    assert.strictEqual(result, null);
  });

  test("handles empty input", () => {
    const result = extractStorageCapacity('');
    assert.strictEqual(result, null);
  });
}

// ---------------------------------------------------------------------------
// 5. extractMemoryCapacity
// ---------------------------------------------------------------------------
function testExtractMemoryCapacity() {
  console.log('\n── extractMemoryCapacity ──');

  test("extracts GB memory with RAM keyword", () => {
    const result = extractMemoryCapacity('Memória RAM DDR4 16GB');
    assert.ok(result && result.includes('16GB'), `Expected 16GB, got "${result}"`);
  });

  test("extracts memory without RAM keyword if numeric GB present", () => {
    const result = extractMemoryCapacity('Placa de vídeo 12GB GDDR6');
    assert.ok(result && result.includes('12GB'), `Expected 12GB, got "${result}"`);
  });

  test("returns null for non-memory objects", () => {
    const result = extractMemoryCapacity('SSD 1TB NVMe');
    assert.strictEqual(result, null);
  });

  test("handles empty input", () => {
    const result = extractMemoryCapacity('');
    assert.strictEqual(result, null);
  });
}

// ---------------------------------------------------------------------------
// 6. normalizeCurrency
// ---------------------------------------------------------------------------
function testNormalizeCurrency() {
  console.log('\n── normalizeCurrency ──');

  test("returns BRL for R$ prefix", () => {
    const result = normalizeCurrency('R$ 1.299,90');
    assert.strictEqual(result, 'BRL');
  });

  test("returns BRL for Real keyword", () => {
    const result = normalizeCurrency('1200.00 Real');
    assert.strictEqual(result, 'BRL');
  });

  test("returns BRL for empty input", () => {
    const result = normalizeCurrency('');
    assert.strictEqual(result, 'BRL');
  });
}

// ---------------------------------------------------------------------------
// 7. normalizePrice
// ---------------------------------------------------------------------------
function testNormalizePrice() {
  console.log('\n── normalizePrice ──');

  test("parses standard BRL format", () => {
    const result = normalizePrice(1299.90, 'R$ 1.299,90', 'BRL');
    assert.ok(result.currentPrice == 1299.90, `Expected 1299.90, got ${result.currentPrice}`);
    assert.ok(result.originalPrice != null, `Original price should not be null`);
    assert.strictEqual(result.currency, 'BRL');
  });

  test("handles null price with text", () => {
    const result = normalizePrice(null, 'R$ 599,00', 'BRL');
    assert.ok(result.currentPrice == 599.00, `Expected 599.00, got ${result.currentPrice}`);
  });

  test("handles completely null values", () => {
    const result = normalizePrice(null, null, 'BRL');
    assert.strictEqual(result.currentPrice, null);
    assert.strictEqual(result.originalPrice, null);
  });

  test("returns finite numbers only", () => {
    const result = normalizePrice(Infinity, '', 'BRL');
    assert.ok(Number.isFinite(result.currentPrice), 'currentPrice should be finite');
  });

  test("extracts two price values from text", () => {
    const result = normalizePrice(1000, 'R$ 1.000,00  R$ 1.500,00', 'BRL');
    assert.ok(result.currentPrice > 0, `Expected positive currentPrice, got ${result.currentPrice}`);
  });
}

// ---------------------------------------------------------------------------
// 8. detectAvailability
// ---------------------------------------------------------------------------
function testDetectAvailability() {
  console.log('\n── detectAvailability ──');

  test("detects out_of_stock keywords (pt-BR)", () => {
    const result = detectAvailability('SSD Fora de Estoque', null);
    assert.strictEqual(result, 'out_of_stock');
  });

  test("detects out_of_stock sem estoque", () => {
    const result = detectAvailability('HD Sem Estoque', null);
    assert.strictEqual(result, 'out_of_stock');
  });

  test("detects out_of_stock indisponível", () => {
    const result = detectAvailability('Produto Indisponível', null);
    assert.strictEqual(result, 'out_of_stock');
  });

  test("detects esgotado", () => {
    const result = detectAvailability('GeForce RTX 3060 Esgotado', null);
    assert.strictEqual(result, 'out_of_stock');
  });

  test("detects in_stock with valid price", () => {
    const result = detectAvailability('SSD Samsung', 'R$ 599,00');
    assert.strictEqual(result, 'in_stock');
  });

  test("Kabum defaults to in_stock with price text", () => {
    const result = detectAvailability('SSD genérico', 'R$ 450,00', 'kabum');
    assert.strictEqual(result, 'in_stock');
  });

  test("returns unknown for empty input", () => {
    const result = detectAvailability('', null);
    assert.strictEqual(result, 'unknown');
  });
}

// ---------------------------------------------------------------------------
// 9. normalizeProduct (single)
// ---------------------------------------------------------------------------
function testNormalizeProduct() {
  console.log('\n── normalizeProduct ──');

  test("produces complete normalized product", () => {
    const raw = {
      title: '⭐ SSD Samsung 870 EVO 500GB',
      price: 599.90,
      priceText: 'R$ 599,90',
      url: 'https://www.pichau.com.br/produto/ssd-samsung',
      source: 'pichau',
      provider: 'pichau',
    };
    const result = normalizeProduct(raw, 'pichau');

    assert.strictEqual(result.provider, 'pichau');
    assert.strictEqual(result.originalTitle, raw.title);
    assert.ok(result.normalizedTitle && result.normalizedTitle !== raw.title, 'Should have normalized title');
    assert.strictEqual(result.brand, 'Samsung');
    assert.ok(result.model && result.model.length > 0, 'Should have model');
    assert.ok(result.storageCapacity && result.storageCapacity.includes('500GB'), 'Should have storage capacity');
    assert.ok(result.currentPrice != null, 'currentPrice should be set');
    assert.strictEqual(result.currency, 'BRL');
    assert.strictEqual(result.availability, 'in_stock');
    assert.strictEqual(result.url, raw.url);
    assert.strictEqual(result.confidence, 1.0);
  });

  test("handles out-of-stock product", () => {
    const raw = {
      title: 'HD Seagate Fora de Estoque 1TB',
      price: null,
      priceText: null,
      url: 'https://www.kabum.com.br/prod/hd-seagate',
      source: 'kabum',
      provider: 'kabum',
    };
    const result = normalizeProduct(raw, 'kabum');
    assert.strictEqual(result.availability, 'out_of_stock');
  });
}

// ---------------------------------------------------------------------------
// 10. normalizeProducts (batch)
// ---------------------------------------------------------------------------
function testNormalizeProducts() {
  console.log('\n── normalizeProducts ──');

  test("normalizes multiple products", () => {
    const products = [
      { title: 'SSD Samsung 500GB', price: 599.90, priceText: 'R$ 599,90', source: 'pichau' },
      { title: 'Fonte Corsair RM850x', price: 850.00, priceText: 'R$ 850,00', source: 'kabum' },
      { title: 'GeForce RTX 3060', price: 2100.00, priceText: 'R$ 2.100,00', source: 'mercadolivre' },
    ];
    const results = normalizeProducts(products, 'pichau');

    assert.ok(Array.isArray(results), 'Result should be an array');
    assert.strictEqual(results.length, 3, 'Should normalize all 3 products');
    assert.ok(results.every(p => p.normalizedTitle && p.normalizedTitle.length > 0));
    assert.ok(results.every(p => p.brand != null), 'All should have brand detected');
  });

  test("handles empty array", () => {
    const results = normalizeProducts([], 'pichau');
    assert.ok(Array.isArray(results) && results.length === 0);
  });

  test("handles null/undefined input", () => {
    const results1 = normalizeProducts(null, 'pichau');
    assert.ok(Array.isArray(results1) && results1.length === 0);

    const results2 = normalizeProducts(undefined, 'pichau');
    assert.ok(Array.isArray(results2) && results2.length === 0);
  });

  test("preserves original data in normalized product", () => {
    const products = [
      { title: 'SSD Samsung 1TB', price: 999.90, priceText: 'R$ 999,90', url: 'https://test.com/prod' },
    ];
    const results = normalizeProducts(products, 'pichau');
    const result = results[0];

    assert.ok(result.originalPriceText && result.originalPriceText.length > 0, 'Should preserve original price text');
    assert.strictEqual(result.priceText, 'R$ 999,90');
    assert.strictEqual(result.url, 'https://test.com/prod');
  });
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   Normalization Tests                               ║');
console.log('╚═══════════════════════════════════════════════════╝');

testNormalizeTitle();
testExtractBrand();
testExtractModel();
testExtractStorageCapacity();
testExtractMemoryCapacity();
testNormalizeCurrency();
testNormalizePrice();
testDetectAvailability();
testNormalizeProduct();
testNormalizeProducts();

console.log('\n╔═══ Resumo ═══');
console.log(`║   Total:  ${total.toString().padEnd(4)} testes`);
console.log(`║   PASS:   ${passed.toString().padEnd(4)}`);
console.log(`║   FAIL:   ${failed.toString().padEnd(4)}`);
console.log('╚═══════════════════════════════════════════════════╝');

if (failed > 0) {
  process.exit(1);
}
