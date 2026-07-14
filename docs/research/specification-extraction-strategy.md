# Specification Extraction Strategy

## Overview

This document describes the deterministic extraction strategy used by `StorageDeviceExtractor`
to parse retailer product titles into canonical SSD specifications.

## Design Decisions

### Choice of Deterministic Extraction

We use regex-based parsing and lookup tables instead of LLM-based classification because:

1. **Predictability**: Given the same input, the output is always the same.
2. **Performance**: No network latency or token consumption.
3. **Maintainability**: Rules can be read and updated independently.
4. **Context efficiency**: Fits within Ollama's 32K window without requiring LLM calls.

### Three-Layer Architecture

The extraction pipeline follows a three-layer approach:

1. **Raw data** - Original retailer title (never overwritten)
2. **Extracted facts** - Direct regex/lookup results (brand, model, capacity)
3. **Derived facts** - Computed/normalized values (canonical capacity, confidence)

## Extraction Pipeline

```
Step 1: Brand Detection (alias tables)
Step 2: Model & Family Extraction (regex patterns)
Step 3: Capacity Extraction (GB/TB normalization)
Step 4: Interface Detection (NVMe/SATA/PCIe)
Step 5: Form Factor Detection (M.2/2.5")
Step 6: Manufacturer SKU Resolution (brand-specific patterns)
Step 7: Confidence Scoring (per-field + overall)
```

## Extraction Rules

### 1. Brand Detection

- Uses alias tables (case-insensitive)
- Priority order: exact match > compound pattern > fallback
- Examples:
  - `"Samsung"` -> `"SAMSUNG"` (direct alias)
  - `"WD"` -> `"WD"` (alias to self)
  - `"Western Digital"` -> `"WD"` (alias table resolution)
  - `"WD Black"` -> `"WD BLACK"` (compound detection)

### 2. Capacity Extraction

- Regex patterns applied in priority order:

1. TB format: `(\d+\.?\d*)\s*TB\b` -> convert to GB
2. GB format: `(\d+\.?\d*)\s*GB\b` -> direct value
3. Compact format: `(\d{3,4})G\b` -> parse as GB

- TB to GB conversion: multiply by 1000
- Example: `"1.92TB"` -> `capacityGB=1920, capacityTB=1.92`

### 3. Interface Detection

- Pattern matching with alias resolution:

| Pattern | Interface | Protocol |
| ------- | --------- | -------- |
| NVMe | NVMe | NVMe |
| M.2 | M.2 | NVMe or SATA |
| PCIe | PCIe | NVMe |
| SATA | SATA | SATA |

### 4. PCIe Generation

- Priority patterns (first match wins):
  1. `"PCIe 4.0"` -> 4
  2. `"Gen 4"` -> 4
  3. `"Gen4"` -> 4
  4. `"PCIe 4"` -> 4
  5. `"PCIe 5"` -> 5

### 5. Form Factor Detection

- Pattern matching with alias resolution:
  - `M.2` -> `"M.2"`
  - `2.5"` -> `"2.5""`
  - `2280` -> `"M.2"`

## Ambiguous Cases

The following cases have documented ambiguity handling:

### 1. M.2 without interface

When only `"M.2"` is present without `"NVMe"` or `"SATA"`:

- Protocol defaults to `"NVMe"` if NVMe is anywhere in the title
- Otherwise defaults to `"SATA"`

### 2. Capacity without explicit unit

When `"1000G"` or similar compact format is present:

- Parsed as GB
- Confidence: 0.8 (vs 0.95 for explicit GB suffix)

### 3. Brand alias conflicts

When multiple brand aliases could match:

- Priority order in BRAND_ALIASES table
- `"WD Black"` checked before `"WD"`
- Compound brands checked before singleton brands

### 4. Model vs Family

When model and family numbers could overlap:

- Model is the specific identifier (e.g., `"870"`, `"A400"`)
- Family is the broader series (e.g., `"EVO"`, `"PRO"`)
- For Kingston: `"A400"` -> model=`"A400"`, family=`"A400"`
- For Samsung: `"870 EVO"` -> model=`"870"`, family=`"EVO"`

## Vendor-Specific Patterns

### Kingston

- SKU format: `SV300S37/480G` (model+variant/capacity)
- Models: A400, SV300, NV3
- Detected via: `[A-Z][0-9]{2,4}` pattern

### Samsung

- SKU format: `MZ-V8V1T0` (manufacturer prefix)
- Models: 870, 980, 990, 840
- Families: EVO, PRO, PLUS
- Compact capacity: 960G pattern

### Crucial

- SKU format: `CT500MX500SSD1` (manufacturer+capacity+model)
- Models: MX500, BX500, MX300, P3, P5
- Detected via: `[A-Z][0-9]{2,4}` pattern

### WD

- SKU format: `WDSN500G3X01` (WDS prefix + variant)
- Models: SN550, SN570, SN580, SN750, SN850
- Variants: Blue, Black, Red, Purple, Green

### Corsair

- SKU format: `CPP-CSF863` (Corsair product prefix)
- Models: MP600, MP330, MP510
- Detected via: `MP[0-9]+` pattern

### Lexar

- SKU format: `LNM790S048RDN` (Lexar prefix)
- Models: NM620, NM790, LM340
- Detected via: `[A-Z]{2}[0-9]{2,4}` pattern

## Confidence Calculation

### Per-Field Confidence

Each field is assigned a confidence score based on:

- **Direct match** (alias table): 0.95
- **Pattern match** (regex): 0.85 - 0.9
- **Fallback** (default): 0.5 - 0.7

### Overall Confidence

```
confidence.overall = average of all non-null field confidences
```

### Confidence Ranges

| Range | Interpretation |
| ----- | -------------- |
| 0.0 - 0.3 | Low confidence |
| 0.4 - 0.6 | Medium confidence |
| 0.7 - 0.85 | High confidence |
| 0.86 - 1.0 | Very high confidence |

## Test Coverage

The extraction strategy is validated by 62 tests in:
- `tests/StorageDeviceExtractor.test.js`
- `tests/normalization.test.js`

Test groups include:
1. Brand Detection (10 tests)
2. Model and Family (6 tests)
3. Capacity Extraction (6 tests)
4. Interface Detection (5 tests)
5. PCIe Generation (4 tests)
6. Form Factor (3 tests)
7. Manufacturer SKU (3 tests)
8. Confidence Scoring (5 tests)
9. Real-World Titles (10 tests)
10. Edge Cases (10 tests)
