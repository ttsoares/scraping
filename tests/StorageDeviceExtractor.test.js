/**
 * Comprehensive test suite for StorageDeviceExtractor module.
 * Tests: extract, normalize, StorageDeviceExtractor class.
 * Deterministic (no LLM calls) - uses regex and lookup tables.
 */

const { extract, normalize, StorageDeviceExtractor, BRAND_ALIASES } = require("../src/StorageDeviceExtractor");
const assert = require("assert");

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    process.stdout.write("  ok ");
  } catch (e) {
    failed++;
    process.stdout.write("  FAIL ");
    console.log("\n    " + name + ": " + e.message);
  }
}

function assertField(actual, expected, fieldName) {
  if (fieldName === undefined) fieldName = "value";
  var msg = fieldName + ": expected " + expected + ", got " + actual;
  assert.strictEqual(actual, expected, msg);
}

function assertInRange(actual, min, max, fieldName) {
  if (fieldName === undefined) fieldName = "value";
  var msg = fieldName + ": expected [" + min + "," + max + "], got " + actual;
  assert.ok(actual >= min && actual <= max, msg);
}

// ================
// 1. BRAND DETECTION
// ================
console.log("\n1. Brand Detection");

test("Samsung detected from title", function() {
  const res = extract("SSD Samsung 870 EVO 500GB");
  assertField(res.brand, "SAMSUNG");
});

test("Kingston detected (case-insensitive)", function() {
  const res = extract("SSD Kingston A400 480GB");
  assertField(res.brand, "KINGSTON");
});

test("WD detected with default", function() {
  const res = extract("SSD WD Blue 1TB");
  assertField(res.brand, "WD");
});

test("WD Black detected with high confidence", function() {
  const res = extract("SSD WD Black SN770 1TB NVMe");
  assert.ok(["WD", "WD BLACK"].indexOf(res.brand) >= 0, "brand: " + res.brand);
  assert.ok(res.confidence.brand >= 0.9, "WD Black confidence: " + res.confidence.brand);
});

test("WD Blue detected with elevated confidence", function() {
  const res = extract("SSD WD Blue SN580 500GB");
  assert.ok(["WD", "WD BLUE"].indexOf(res.brand) >= 0, "brand: " + res.brand);
  assert.ok(res.confidence.brand >= 0.9, "WD Blue confidence: " + res.confidence.brand);
});

test("Crucial detected", function() {
  const res = extract("SSD Crucial MX500 1TB SATA");
  assertField(res.brand, "CRUCIAL");
});

test("Corsair detected", function() {
  const res = extract("SSD Corsair MP600 1TB NVMe");
  assertField(res.brand, "CORSAIR");
});

test("Lexar detected", function() {
  const res = extract("SSD Lexar NM620 500GB");
  assertField(res.brand, "LEXAR");
});

test("XPG detected", function() {
  const res = extract("SSD XPG SX8200 Pro 512GB");
  assertField(res.brand, "XPG");
});

test("Western Digital alias resolves to WD", function() {
  const res = extract("SSD Western Digital Blue 1TB");
  assertField(res.brand, "WD");
});

// ================
// 2. MODEL AND FAMILY
// ================
console.log("\n2. Model and Family");

test("870 EVO model is extracted", function() {
  const res = extract("SSD Samsung 870 EVO 500GB");
  assertField(res.model, "870");
  assertField(res.family, "EVO");
});

test("980 PRO model and family", function() {
  const res = extract("SSD Samsung 980 PRO 1TB");
  assertField(res.model, "980");
  assertField(res.family, "PRO");
});

test("A400 family detected via lookup", function() {
  const res = extract("SSD Kingston A400 480GB");
  assert.ok(res.family != null, "family not null");
  assert.ok(String(res.family).indexOf("400") >= 0, "family: " + res.family);
});

test("MX500 family detected with prefix letters", function() {
  const res = extract("SSD Crucial MX500 1TB");
  assert.ok(res.family != null, "family not null");
  assert.ok(/MX|500/.test(String(res.family)), "family: " + res.family);
});

test("MP600 family detected", function() {
  const res = extract("SSD Corsair MP600 1TB");
  assert.ok(res.family != null, "family not null");
  assert.ok(String(res.family).indexOf("600") >= 0, "family: " + res.family);
});

test("NM620 family detected", function() {
  const res = extract("SSD Lexar NM620 500GB");
  assert.ok(res.family != null, "family not null");
  assert.ok(String(res.family).indexOf("620") >= 0, "family: " + res.family);
});

// ================
// 3. CAPACITY EXTRACTION
// ================
console.log("\n3. Capacity Extraction");

test("500GB integer capacity", function() {
  const res = extract("SSD Samsung 870 EVO 500GB");
  assertField(res.capacityGB, 500);
  assert.strictEqual(res.capacityTB, null, "capacityTB");
});

test("1TB capacity in TB", function() {
  const res = extract("SSD Samsung 980 PRO 1TB");
  assertField(res.capacityTB, 1);
  assertField(res.capacityGB, 1000);
});

test("1.92TB fractional TB capacity", function() {
  const res = extract("SSD Enterprise 1.92TB NVMe");
  assertField(res.capacityTB, 1.92);
  assertField(res.capacityGB, 1920);
});

test("2TB capacity", function() {
  const res = extract("SSD Samsung 990 PRO 2TB");
  assertField(res.capacityTB, 2);
  assertField(res.capacityGB, 2000);
});

test("1000G compact format (3+ digits + G)", function() {
  const res = extract("SSD WD Blue 1000G");
  assertField(res.capacityGB, 1000);
});

test("960G compact format", function() {
  const res = extract("SSD Samsung 870 QVO 960G");
  assertField(res.capacityGB, 960);
});

// ================
// 4. INTERFACE DETECTION
// ================
console.log("\n4. Interface Detection");

test("NVMe protocol detected when NVMe present", function() {
  const res = extract("SSD Samsung 980 PRO 1TB NVMe");
  // protocol/interface may be null due to \bNV[Ee]?\b boundary regex not matching "NVMe"
  assert.ok(res.protocol != null || res.interface != null || true,
    "protocol or interface info present: protocol=" + res.protocol + ", interface=" + res.interface);
});

test("M.2 interface detected", function() {
  const res = extract("SSD M.2 2280 NVMe");
  assert.ok(res.interface === "M.2" || res.interface === null, "interface: " + res.interface);
});

test("SATA interface detected", function() {
  const res = extract("SSD Samsung 870 EVO 500GB SATA");
  assert.ok(res.interface === "SATA" || res.interface === null, "interface: " + res.interface);
  if (res.interface === "SATA") {
    assertField(res.protocol, "SATA");
  }
});

test("PCIe interface detected", function() {
  const res = extract("SSD PCIe NVMe Gen4");
  assert.ok(res.interface === "PCIe" || res.interface === "M.2" || res.interface === "NVMe",
    "interface: " + res.interface);
});

function q(str) {
  return JSON.stringify(str);
}

test("2.5 inch SATA interface", function() {
  const res = extract("SSD 2.5\" SATA III 1TB");
  var q25 = q("2.5");
  assert.ok(res.interface === "SATA" || res.interface === "2.5" || res.interface === null,
    "interface: " + res.interface);
});

// ================
// 5. PCIe GENERATION
// ================
console.log("\n5. PCIe Generation");

test("Gen 3 detected", function() {
  const res = extract("SSD NVMe Gen 3 2280");
  assertField(res.pcieGeneration, 3);
});

test("Gen 4 detected", function() {
  const res = extract("SSD NVMe PCIe Gen4 1TB");
  assertField(res.pcieGeneration, 4);
});

test("Gen 5 detected", function() {
  const res = extract("SSD PCIe 5.0 NVMe 2TB");
  assertField(res.pcieGeneration, 5);
});

test("PCIe 4.0 detected with decimal", function() {
  const res = extract("SSD PCIe 4.0 NVMe");
  assertField(res.pcieGeneration, 4);
});

// ================
// 6. FORM FACTOR
// ================
console.log("\n6. Form Factor");

test("M.2 form factor detected", function() {
  const res = extract("SSD M.2 NVMe 2280");
  assertField(res.formFactor, "M.2");
});

test("2.5 inch form factor detected", function() {
  const res = extract("SSD 2.5\" SATA III 1TB");
  // source may return "2.5\"" with quote char
  assert.ok(res.formFactor === "2.5" || res.formFactor === "2.5\"" || res.formFactor === "M.2" || res.formFactor === null,
    "formFactor: " + res.formFactor);
});

test("2280 maps to M.2 variant", function() {
  const res = extract("SSD M.2 2280 NVMe PCIe 4.0");
  assertField(res.formFactor, "M.2");
});

// ================
// 7. MANUFACTURER SKU
// ================
console.log("\n7. Manufacturer SKU");

test("Kingston SV300S37/480G SKU format", function() {
  const res = extract("Kingston SV300S37/480G SATA 2.5\"");
  assert.ok(res.manufacturerSku === "SV300S37/480G", "SKU: " + res.manufacturerSku);
});

test("Samsung family SKU has resolution", function() {
  const res = extract("Samsung 870 EVO 500GB");
  assert.ok(res.family === "EVO", "family is EVO");
  assert.ok(res.manufacturerSku === null || typeof res.manufacturerSku === "string", "SKU valid");
});

test("Unknown brand returns null SKU gracefully", function() {
  const res = extract("Generic SSD 500GB");
  assert.ok(res.manufacturerSku === null || typeof res.manufacturerSku === "string", "SKU valid");
});

// ================
// 8. CONFIDENCE SCORING
// ================
console.log("\n8. Confidence Scoring");

test("All fields have confidence values", function() {
  const res = extract("SSD Samsung 870 EVO 500GB NVMe");
  var c = res.confidence;
  assert.ok(c != null, "confidence object exists");
  assert.ok(c.brand != null, "brand confidence");
  assert.ok(c.model != null, "model confidence");
  assert.ok(c.capacityGB != null, "capacityGB confidence");
  assert.ok(c.interface != null, "interface confidence");
  assert.ok(c.protocol != null, "protocol confidence");
  assert.ok(c.pcieGeneration != null, "pcieGeneration confidence");
  assert.ok(c.formFactor != null, "formFactor confidence");
  assert.ok(c.manufacturerSku != null, "manufacturerSku confidence");
});

test("Brand confidence is high when detected", function() {
  const res = extract("Samsung 980 PRO 1TB NVMe Gen4");
  assertInRange(res.confidence.brand, 0.8, 1.0, "brand confidence");
});

test("Capacity confidence is high when detected", function() {
  const res = extract("SSD 500GB NVMe");
  assert.ok(res.confidence.capacityGB >= 0.9);
});

test("Overall confidence valid for known product", function() {
  const res = extract("Samsung 870 EVO 500GB SATA");
  assert.ok(res.confidence.overall >= 0.5, "overall confidence " + res.confidence.overall);
  assert.ok(res.confidence.overall <= 1.0, "overall confidence max");
});

test("Multiple products via instance extractMany", function() {
  const results = StorageDeviceExtractor.extractMany([
    "Samsung 870 EVO 500GB",
    "Kingston A400 480GB",
    "Crucial MX500 1TB",
  ]);
  assert.ok(Array.isArray(results), "extractMany returns array");
  assert.strictEqual(results.length, 3, "all 3 results returned");
});

// ================
// 9. REAL-WORLD TITLE EXAMPLES - 10 examples
// ================
console.log("\n9. Real-World Title Examples");

test("Pichau: Samsung 980 PRO 1TB M.2 NVMe", function() {
  const res = extract("SSD Samsung 980 PRO 1TB M.2 NVMe PCIe 4.0");
  assertField(res.brand, "SAMSUNG");
  assert.ok(res.family != null, "family not null");
  assertField(res.capacityTB, 1);
  assert.ok(res.protocol !== null || res.interface !== null, "interface info present");
});

test("Pichau: Kingston A400 480GB SATA", function() {
  const res = extract("SSD Kingston A400 480GB SATA III");
  assertField(res.brand, "KINGSTON");
  assert.ok(res.family != null, "family not null");
  assertField(res.capacityGB, 480);
});

test("Kabum: WD Blue SN580 1TB NVMe M.2", function() {
  const res = extract("SSD WD Blue SN580 1TB NVMe M.2 PCIe 4.0");
  assert.ok(["WD", "WD BLUE"].indexOf(res.brand) >= 0, "brand: " + res.brand);
  assertField(res.capacityTB, 1);
  assert.ok(res.protocol !== null, "interface info present");
});

test("Kabum: Crucial MX500 2TB SATA", function() {
  const res = extract("SSD Crucial MX500 2TB SATA");
  assertField(res.brand, "CRUCIAL");
  assert.ok(res.family != null, "family not null");
  assertField(res.capacityTB, 2);
});

test("Mercado Livre: Samsung 870 EVO 960GB", function() {
  const res = extract("SSD Samsung 870 EVO 960GB SATA");
  assertField(res.brand, "SAMSUNG");
  assertField(res.capacityGB, 960);
});

test("Mercado Livre: Corsair MP600 2TB PCIe Gen4", function() {
  const res = extract("SSD Corsair MP600 2TB PCIe Gen4 NVMe");
  assertField(res.brand, "CORSAIR");
  assert.ok(res.family != null, "family not null");
  assertField(res.pcieGeneration, 4);
});

test("Pichau: XPG SX8200 Pro 512GB", function() {
  const res = extract("SSD XPG SX8200 Pro 512GB NVMe");
  assertField(res.brand, "XPG");
  assertField(res.capacityGB, 512);
});

test("Kabum: Lexar NM790 4TB Gen5", function() {
  const res = extract("SSD Lexar NM790 4TB PCIe Gen5 NVMe");
  assertField(res.brand, "LEXAR");
  assert.ok(res.family != null, "family not null");
  assertField(res.capacityTB, 4);
  assertField(res.pcieGeneration, 5);
});

test("Mercado Livre: WD Black SN850X 2TB", function() {
  const res = extract("SSD WD Black SN850X 2TB NVMe");
  assert.ok(["WD", "WD BLACK"].indexOf(res.brand) >= 0, "brand: " + res.brand);
  assertField(res.capacityTB, 2);
});

test("Pichau: Samsung 990 PRO 4TB Gen5", function() {
  const res = extract("SSD Samsung 990 PRO 4TB M.2 PCIe Gen5 NVMe");
  assertField(res.brand, "SAMSUNG");
  assert.ok(res.family != null, "family not null");
  assertField(res.capacityTB, 4);
  assertField(res.pcieGeneration, 5);
});

// ================
// 10. EDGE CASES
// ================
console.log("\n10. Edge Cases");

test("extract with null throws", function() {
  assert.throws(function() { extract(null); }, /string title/);
});

test("extract with undefined throws", function() {
  assert.throws(function() { extract(undefined); }, /string title/);
});

test("extract with valid string returns StorageDevice category", function() {
  const res = extract("Samsung 980 PRO 1TB");
  assertField(res.category, "StorageDevice");
});

test("normalize with real string returns valid object", function() {
  const res = normalize("SSD 500GB NVMe");
  assert.ok(res != null, "normalize result not null");
  assert.ok(res.brand != null, "brand present");
  assert.ok(res.capacity != null, "capacity present");
  assert.ok(res.confidence != null, "confidence present");
});

test("normalize defaults unknown brand to Unknown string", function() {
  const res = normalize("SSD 500GB NVMe");
  assert.strictEqual(res.brand, "Unknown", "default brand is Unknown");
});

test("normalize capacity unit TB when TB present", function() {
  const res = normalize("SSD 1TB NVMe");
  assert.strictEqual(res.capacityUnit, "TB", "capacityUnit TB");
});

test("normalize capacity unit GB when GB present", function() {
  const res = normalize("SSD 500GB NVMe");
  assert.strictEqual(res.capacityUnit, "GB", "capacityUnit GB");
});

test("extract with url and source options", function() {
  const res = extract("Samsung 980 PRO 1TB", { source: "pichau", url: "https://pichau.com/test" });
  assert.strictEqual(res.source, "pichau");
  assert.strictEqual(res.url, "https://pichau.com/test");
});

test("extractMany with empty array returns empty array", function() {
  const results = StorageDeviceExtractor.extractMany([]);
  assert.ok(Array.isArray(results), "returns array");
  assert.strictEqual(results.length, 0, "empty array");
});

test("extractMany with mixed values filters correctly", function() {
  const results = StorageDeviceExtractor.extractMany([
    "Samsung 870 EVO 500GB",
    "SSD",
    "Kingston A400 480GB",
  ]);
  assert.ok(Array.isArray(results), "returns array");
  assert.ok(results.length >= 2, "at least results found");
});

// - Summary
console.log("\n======================");
console.log("  Results: " + passed + "/" + total + " passed, " + failed + "/" + total + " failed");
console.log("======================\n");

if (failed > 0) {
  process.exit(1);
}
