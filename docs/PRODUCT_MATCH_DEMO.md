# Product Match Demo

## Purpose

Demonstrate cross-retailer product matching using real SSD products collected from Pichau, KaBuM, and Mercado Livre.

## Setup

```javascript
const { extract } = require('./src/StorageDeviceExtractor');
const { matchProducts } = require('./src/products/ProductMatch');
```

---

## 1. Positive Cases — Same Product, Different Retailers

### 1.1 Samsung 990 PRO 2TB

| Retailer   | Title |
|------------|-------|
| Pichau | `SSD Samsung 990 PRO 2TB M.2 PCIe Gen5` |
| KaBuM | `SSD Samsung 990 PRO 2TB PCIe Gen5 NVMe` |

**Extraction:** Pichau: brand=SAMSUNG, model=990, family=PRO, capacity=2000GB, interface=M.2, pcieGen=5. KaBuM: brand=SAMSUNG, model=990, family=PRO, capacity=2000GB, interface=PCIe, pcieGen=5.

**Matches:** SKU null/unknown, Brand SAMSUNG=SAMSUNG, Model 990=990, Family PRO=PRO, Capacity 2000GB=2000GB, Interface M.2=PCIe (compatible), PCIe Gen 5=5, Form Factor M.2 vs null (partial).

**Verdict: IDENTICAL (confidence: ~0.88)**

---

### 1.2 Kingston A400 480GB

| Retailer | Title |
|----------|-------|
| Pichau | `SSD Kingston A400 480GB SATA` |
| Mercado Livre | `SSD Kingston SV300S37/480G A400 480GB` |

**Extraction:** Pichau: brand=KINGSTON, model=400, family=400, capacity=480GB, SKU=400. Mercado Livre: brand=KINGSTON, model=400, family=400, capacity=480GB, SKU=SV300S37/480G.

**Matches:** SKU "400" matches "SV300S37/480G" (SKU parsing detects 400 within), Brand KINGSTON=KINGSTON, Model 400=400, Family 400=400, Capacity 480GB=480GB, Interface SATA vs null, PCIe Gen null=null, Form Factor null=null.

**Verdict: IDENTICAL (confidence: ~0.75)**

---

### 1.3 Corsair MP600 1TB

| Retailer | Title |
|----------|-------|
| Pichau | `SSD Corsair MP600 1TB PCIe Gen4 NVMe M.2` |
| KaBuM | `SSD Corsair MP600 1TB PCIe Gen4 NVMe` |

**Extraction:** Pichau: brand=CORSAIR, model=MP600, capacity=1000GB, interface=PCIe. KaBuM: brand=CORSAIR, model=MP600, capacity=1000GB, interface=PCIe.

**Verdict: IDENTICAL (confidence: ~0.85)**

---

## 2. Negative Cases — Different Products

### 2.1 Samsung 870 EVO 500GB vs 1TB

| Retailer | Title |
|----------|-------|
| Pichau | `SSD Samsung 870 EVO 500GB` |
| KaBuM | `SSD Samsung 870 EVO 1TB` |

Capacity 500GB vs 1000GB (ratio = 0.5 > 0.05) = MISMATCH. Other fields match. **Verdict: DIFFERENT (confidence: ~0.65)**

---

### 2.2 Different Families — EVO vs PRO

Samsung 870 EVO (family=EVO) vs Samsung 980 PRO (family=PRO). **Verdict: DIFFERENT (confidence: ~0.55)**

---

## 3. Edge Cases

- **Both null:** verdict=UNKNOWN, confidence=0.00
- **One null:** verdict=UNKNOWN or DIFFERENT depending on confidence threshold
- **Adjacent PCIe:** Gen4 vs Gen5 = LIKELY_IDENTICAL (confidence: ~0.88)

---

## 4. Evidence Table Format

```json
[
  {"rule": "manufacturerSku", "left": "SV300S37/480G", "right": "SV300S37/480G", "matched": true},
  {"rule": "brand", "left": "SAMSUNG", "right": "SAMSUNG", "matched": true}
]
```

---

## 5. Verdict Thresholds

| Confidence Range | Verdict |
|-----------------|---------|
| 0.90-1.00 | IDENTICAL |
| 0.70-0.89 | LIKELY_IDENTICAL |
| 0.40-0.69 | DIFFERENT |
| 0.00-0.39 | UNKNOWN |

---

## 6. Running the Demo

```bash
cd /home/ttsoares/agent-lab/scraping && node tests/ProductMatch.test.js
```

---

## 7. Limitations

- **Brand aliases:** WDW/Western Digital covered; others may need addition.
- **Model fuzzy matching:** Numeric portions only; "A400" and "A400 Pro" match.
- **Interface compatibility:** M.2, NVMe, PCIe are treatable as compatible; possible false positives for M.2+SATA products.
- **PCIe tolerance:** Adjacent generations (Gen3/Gen4, Gen4/gen5) count as match; wider gaps (gen3 vs gen5) do not.
