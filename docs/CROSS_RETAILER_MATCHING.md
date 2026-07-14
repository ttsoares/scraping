# Cross-Retailer Product Matching

## Overview

This module identifies whether two products from different retailers represent the same physical item. It is retailer-independent and does not rely on LLM calls — only deterministic rules.

## Matching Rules

Each rule compares a single dimension of the product. Rules produce a boolean match and contribute to an overall confidence score.

### 1. Manufacturer SKU (Highest Priority)

Exact string match after normalizing to uppercase and stripping non-alphanumeric characters. Short SKU-like tokens are treated as non-decisive when they conflict with longer manufacturer SKUs, because extractor output can currently promote model/family tokens into `manufacturerSku`.

```
Kingston SV300S37/480G vs Kingston SV300S37/480G → MATCH
Kingston SV300S37/480G vs Kingston SV300S37/500G → NO_MATCH
```

### 2. Brand

Brand names are uppercased and compared. Known aliases are resolved:

- WD ≡ Western Digital
- WD ≡ WD Blue
- Kingston ≡ Kingston Technology

```
WD vs Western Digital → MATCH
Samsung vs SAMSUNG → MATCH (case-insensitive)
```

### 3. Model

Model values are normalized into comparable tokens by removing storage-category noise such as SSD, NVMe, PCIe, SATA, M.2, 2280, and generation labels. A shorter token set may match a longer token set when all normalized tokens are present.

```
870 EVO vs 870 → MATCH
A400 vs A400 → MATCH
SN580 vs SN580 → MATCH
```

### 4. Family

Family is matched by exact string comparison after uppercasing. If one product has a known family and the other is unknown, it is a partial match (not a false positive).

```
EVO vs EVO → MATCH
PRO vs PRO → MATCH
EVO vs PRO → NO_MATCH
```

### 5. Capacity

Capacity is compared in GB with 5% tolerance for rounding differences.

```
500GB vs 500GB → MATCH (ratio = 0.0)
500GB vs 1000GB → NO_MATCH (ratio = 0.5)
480GB vs 485GB → MATCH (ratio = 0.01 < 0.05)
```

### 6. Interface / Protocol

Interface and Protocol are compared with compatibility awareness:

| Interface Pair | Compatible? | Example |
|------------|-------------|-------|
| NVMe ↔ M.2 | Yes | NVMe product vs M.2 product |
| PCIe ↔ M.2 | Yes | PCIe product vs M.2 product |
| PCIe ↔ NVMe | Yes | PCIe product vs NVMe product |
| SATA ↔ SATA | Yes | Identical |
| SATA ↔ NVMe | No | Different protocols |

### 7. PCIe Generation

Adjacent generations count as a match (Gen3 vs Gen4, Gen4 vs Gen5). Exact match is preferred.

```
Gen3 vs Gen3 → MATCH
Gen3 vs Gen4 → MATCH (adjacent)
Gen3 vs Gen5 → NO_MATCH (gap = 2)
Gen4 vs Gen5 → MATCH (adjacent)
```

### 8. Form Factor

Form factors are compared with compatibility for synonymous formats:

| Form Factor Pair | Compatible? |
|-----------------|-------------|
| M.2 ↔ 2280 | Yes |
| 2.5″ ↔ SATA | Yes |
| 2.5″ ↔ 2.5″ | Yes |

## Verdicts

| Verdict | Confidence | Description |
|---------|------------|-------------|
| IDENTICAL | ≥ 0.90 | Very high confidence they are the same product |
| LIKELY_IDENTICAL | 0.70–0.89 | Good confidence, minor differences tolerated |
| DIFFERENT | 0.40–0.69 | Moderate confidence they differ |
| UNKNOWN | < 0.40 | Insufficient data to determine |

## Confidence Calculation

```
match_ratio = match_count / total_rules
penalty = (unknown_rule_count / total_rules) × 0.10
confidence = clamp(match_ratio - penalty, 0, 1)

critical_mismatch_caps:
  brand or long manufacturer SKU mismatch -> confidence <= 0.39
  capacity mismatch -> confidence <= 0.69
  model+family mismatch without SKU match -> confidence <= 0.69
```

Unknown rules (null values) do not penalize as severely as negative rules. One-sided unknown optional specs such as interface, protocol, PCIe generation, and form factor produce `UNKNOWN` reasons rather than hard mismatches.

## Evidence Report

Each match call produces an evidence array where each rule has:

- `rule`: The dimension name (manufacturerSku, brand, model, etc.)
- `matched`: Whether the rule matched (boolean)
- `detail`: Whether the value was present (true) or unknown (false)
- `left`: Left product's value
- `right`: Right product's value

## Example: Samsung 870 EVO 500GB

Pichau title: `SSD Samsung 870 EVO 500GB 2.5″ SATA`
KaBuM title: `SSD Samsung 870 EVO 500GB SATA III 2.5 Polos`

```
Evidence:
  manufacturerSku: null ↔ null      → MATCH (both unknown)
  brand:        SAMSUNG ↔ SAMSUNG  → MATCH (detail=true)
  model:        870     ↔ 870      → MATCH (detail=true)
  family:       EVO     ↔ EVO      → MATCH (detail=true)
  capacity:     500GB   ↔ 500GB    → MATCH (detail=true)
  interface:    null    ↔ null     → MATCH (unknown)
  pcieGeneration: null  ↔ null     → MATCH (unknown)
  formFactor:   2.5″    ↔ 2.5″     → MATCH (detail=true)

Verdict: IDENTICAL (confidence = 1.00)
```

## Implementation

See `src/comparison/ComparisonEngine.js` for the deterministic comparison implementation. `src/products/ProductMatch.js` is a backward-compatible facade that delegates to the comparison engine.

Each comparison function returns a typed result:

```javascript
{
  ruleName: 'manufacturerSku',
  matched: true,
  detail: true,
  label: 'SKU match',
  leftValue: 'SV300S37/480G',
  rightValue: 'SV300S37/480G'
}
```
