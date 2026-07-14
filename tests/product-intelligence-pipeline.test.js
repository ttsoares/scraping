/*
 * Product Intelligence Pipeline Integration Benchmark
 *
 * Exercises the runtime path:
 * Provider -> Normalizer -> StorageDeviceExtractor -> Canonical Product -> ComparisonEngine
 */

'use strict';

const assert = require('assert');
const { SearchService } = require('../src/services/SearchService');
const { VERDICTS } = require('../src/comparison/ComparisonEngine');

const MATCH_VERDICTS = new Set([VERDICTS.IDENTICAL, VERDICTS.LIKELY_IDENTICAL]);

const leftProducts = [
  {
    id: 'samsung-990-pro-2tb',
    provider: 'pichau',
    title: 'SSD Samsung 990 PRO 2TB M.2 PCIe Gen4 NVMe',
    price: 'R$ 1.499,90',
    url: 'https://benchmark.example/pichau/samsung-990-pro-2tb',
  },
  {
    id: 'kingston-a400-480gb',
    provider: 'pichau',
    title: 'SSD Kingston A400 480GB SATA',
    price: 'R$ 249,90',
    url: 'https://benchmark.example/pichau/kingston-a400-480gb',
  },
  {
    id: 'wd-blue-sn580-1tb',
    provider: 'kabum',
    title: 'SSD WD Blue SN580 1TB NVMe M.2',
    price: 'R$ 479,99',
    url: 'https://benchmark.example/kabum/wd-blue-sn580-1tb',
  },
  {
    id: 'corsair-mp600-1tb',
    provider: 'pichau',
    title: 'SSD Corsair MP600 1TB PCIe Gen4 NVMe',
    price: 'R$ 689,99',
    url: 'https://benchmark.example/pichau/corsair-mp600-1tb',
  },
  {
    id: 'samsung-980-pro-1tb',
    provider: 'terabyte',
    title: 'SSD Samsung 980 PRO 1TB M.2 PCIe Gen3 NVMe',
    price: 'R$ 799,90',
    url: 'https://benchmark.example/terabyte/samsung-980-pro-1tb',
  },
  {
    id: 'samsung-970-evo-500gb',
    provider: 'kabum',
    title: 'SSD Samsung 970 EVO 500GB M.2 NVMe',
    price: 'R$ 449,90',
    url: 'https://benchmark.example/kabum/samsung-970-evo-500gb',
  },
  {
    id: 'kingston-a2000-1tb',
    provider: 'pichau',
    title: 'SSD Kingston A2000 1TB M.2 PCIe NVMe',
    price: 'R$ 399,90',
    url: 'https://benchmark.example/pichau/kingston-a2000-1tb',
  },
  {
    id: 'kingston-kc3000-2tb',
    provider: 'mercadolivre',
    title: 'SSD Kingston KC3000 2TB M.2 PCIe Gen4 NVMe',
    price: 'R$ 949,90',
    url: 'https://benchmark.example/ml/kingston-kc3000-2tb',
  },
  {
    id: 'wd-black-sn850x-2tb',
    provider: 'terabyte',
    title: 'SSD WD Black SN850X 2TB M.2 PCIe Gen4 NVMe',
    price: 'R$ 1.199,90',
    url: 'https://benchmark.example/terabyte/wd-black-sn850x-2tb',
  },
  {
    id: 'wd-green-1tb',
    provider: 'kabum',
    title: 'SSD WD Green 1TB SATA',
    price: 'R$ 349,90',
    url: 'https://benchmark.example/kabum/wd-green-1tb',
  },
  {
    id: 'corsair-mp600-pro-2tb',
    provider: 'pichau',
    title: 'SSD Corsair MP600 PRO 2TB M.2 PCIe Gen4 NVMe',
    price: 'R$ 1.099,90',
    url: 'https://benchmark.example/pichau/corsair-mp600-pro-2tb',
  },
  {
    id: 'corsair-sfU-512gb',
    provider: 'mercadolivre',
    title: 'SSD Corsair SFU 512GB M.2 NVMe',
    price: 'R$ 299,90',
    url: 'https://benchmark.example/ml/corsair-sfu-512gb',
  },
];

const rightProducts = [
  {
    id: 'samsung-990-pro-2tb',
    provider: 'mercadolivre',
    title: 'SSD Samsung 990 Pro 2 TB NVMe M.2',
    price: 'R$ 1.599,00',
    url: 'https://benchmark.example/ml/samsung-990-pro-2tb',
  },
  {
    id: 'kingston-a400-480gb',
    provider: 'mercadolivre',
    title: 'SSD Kingston SA400S37/480G A400 480GB SATA',
    price: 'R$ 269,00',
    url: 'https://benchmark.example/ml/kingston-a400-480gb',
  },
  {
    id: 'wd-blue-sn580-1tb',
    provider: 'terabyte',
    title: 'SSD Western Digital Blue SN580 1TB M.2 NVMe',
    price: 'R$ 499,90',
    url: 'https://benchmark.example/terabyte/wd-blue-sn580-1tb',
  },
  {
    id: 'corsair-mp600-1tb',
    provider: 'kabum',
    title: 'SSD Corsair Force MP600 1TB PCIe 4.0 NVMe',
    price: 'R$ 719,99',
    url: 'https://benchmark.example/kabum/corsair-mp600-1tb',
  },
  {
    id: 'samsung-870-evo-1tb',
    provider: 'kabum',
    title: 'SSD Samsung 870 EVO 1TB SATA',
    price: 'R$ 539,99',
    url: 'https://benchmark.example/kabum/samsung-870-evo-1tb',
  },
  {
    id: 'samsung-980-pro-1tb',
    provider: 'kabum',
    title: 'SSD Samsung 980 PRO 1TB NVMe M.2',
    price: 'R$ 829,90',
    url: 'https://benchmark.example/kabum/samsung-980-pro-1tb',
  },
  {
    id: 'samsung-970-evo-500gb',
    provider: 'terabyte',
    title: 'SSD Samsung 970 EVO 500GB M.2 NVMe',
    price: 'R$ 469,90',
    url: 'https://benchmark.example/terabyte/samsung-970-evo-500gb',
  },
  {
    id: 'kingston-a2000-1tb',
    provider: 'kabum',
    title: 'SSD Kingston A2000 1TB M.2 NVMe',
    price: 'R$ 419,90',
    url: 'https://benchmark.example/kabum/kingston-a2000-1tb',
  },
  {
    id: 'kingston-kc3000-2tb',
    provider: 'mercadolivre',
    title: 'SSD Kingston KC3000 2TB PCIe Gen4 NVMe',
    price: 'R$ 979,90',
    url: 'https://benchmark.example/ml/kingston-kc3000-2tb',
  },
  {
    id: 'wd-black-sn850x-2tb',
    provider: 'pichau',
    title: 'SSD Western Digital Black SN850X 2TB NVMe',
    price: 'R$ 1.249,90',
    url: 'https://benchmark.example/pichau/wd-black-sn850x-2tb',
  },
  {
    id: 'wd-green-1tb',
    provider: 'mercadolivre',
    title: 'SSD WD Green 1TB SATA',
    price: 'R$ 369,90',
    url: 'https://benchmark.example/ml/wd-green-1tb',
  },
  {
    id: 'corsair-mp600-pro-2tb',
    provider: 'kabum',
    title: 'SSD Corsair MP600 PRO 2TB PCIe Gen4 NVMe',
    price: 'R$ 1.149,90',
    url: 'https://benchmark.example/kabum/corsair-mp600-pro-2tb',
  },
  {
    id: 'corsair-sfU-512gb',
    provider: 'terabyte',
    title: 'SSD Corsair SFU 512GB M.2 NVMe',
    price: 'R$ 319,90',
    url: 'https://benchmark.example/terabyte/corsair-sfU-512gb',
  },
];

function fakeRepository() {
  return {
    createSearch: async () => {},
    persistRawProducts: async () => {},
    persistNormalizedProducts: async () => {},
    close: async () => {},
  };
}

function productIdFromUrl(url) {
  return url.split('/').pop();
}

function calculateMetrics(results) {
  return results.reduce((metrics, result) => {
    const leftId = productIdFromUrl(result.left.provenance.url);
    const rightId = productIdFromUrl(result.right.provenance.url);
    const expectedMatch = leftId === rightId;
    const actualMatch = MATCH_VERDICTS.has(result.comparison.verdict);

    if (expectedMatch && actualMatch) metrics.truePositives += 1;
    if (!expectedMatch && actualMatch) metrics.falsePositives += 1;
    if (expectedMatch && !actualMatch) metrics.falseNegatives += 1;
    if (!expectedMatch && !actualMatch) metrics.trueNegatives += 1;

    return metrics;
  }, {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 0,
  });
}

(async function run() {
  const service = new SearchService({
    browserExecutor: { execute: async (operation) => operation({}) },
  });
  service.repository = fakeRepository();

  const provider = async () => ({
    products: leftProducts,
    url: 'https://benchmark.example/search?q=ssd',
  });

  const result = await service.search(provider, 'SSD benchmark', 'benchmark', {
    compareAgainst: rightProducts,
  });

  assert.strictEqual(result.error, undefined, result.error && result.error.message);
  assert.strictEqual(result.normalizedProducts.length, leftProducts.length);
  assert.strictEqual(result.canonicalProducts.length, leftProducts.length);
  assert.strictEqual(result.comparisonResults.length, leftProducts.length * rightProducts.length);

  const metrics = calculateMetrics(result.comparisonResults);
  assert.deepStrictEqual(metrics, {
    truePositives: 10,
    falsePositives: 1,
    falseNegatives: 1,
    trueNegatives: 144,
  });

  const rejected = result.comparisonResults.find((pair) => (
    productIdFromUrl(pair.left.provenance.url) === 'samsung-990-pro-2tb'
    && productIdFromUrl(pair.right.provenance.url) === 'samsung-870-evo-1tb'
  ));
  assert.ok(rejected, 'expected rejected Samsung comparison to exist');
  assert.strictEqual(MATCH_VERDICTS.has(rejected.comparison.verdict), false);
  assert.ok(rejected.comparison.differingFields.some((field) => field.field === 'capacity'));

  console.log('Product Intelligence pipeline benchmark passed');
  console.log(JSON.stringify(metrics, null, 2));
})();
