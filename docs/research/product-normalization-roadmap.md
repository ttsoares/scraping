# Product Normalization Roadmap

## Purpose

This document outlines the roadmap for normalizing products from multiple retailers (Pichau, KaBuM, MercadoLivre) into a unified canonical product representation. Normalization enables reliable comparison for future buying recommendations.

## Current State

### What Works

1. **Scraper layer** - Browser-based scraping from Pichau, KaBuM, Mercado Livre
2. **Provider layer** - Provider-specific product extraction
3. **Normalizer** - Basic title normalization (see `src/providers/normalizer.js`)
4. **Storage device extraction** - SSD specification extraction with deterministic methods (see `src/StorageDeviceExtractor.js`)

### Limitations

1. **Retailer-specific formats** - Same product may have different title formats
2. **Capacity disambiguation** - "1TB" vs "1000GB" vs "1T" need normalization
3. **Brand aliasing** - "WD" vs "Western Digital" vs "WD Blue"
4. **Interface notation** - "M.2", "NVMe", "PCIe", "SATA" need consistent representation
5. **Cross-retailer matching** - Limited ability to match equivalent products
6. **Confidence scoring** - Per-field confidence exists but is not documented
7. **SKU resolution** - Manufacturer SKUs need normalization (e.g., "SV300S37/480G")

## Roadmap

### Phase 1: Foundation (Completed)

- [x] **Canonical Product Schema** - Defined in `docs/CANONICAL_PRODUCT_SCHEMA.md`
- [x] **SSD Specification Extraction** - Deterministic extraction in `src/StorageDeviceExtractor.js`
- [x] **Alias Tables** - Brand, interface, form factor, capacity aliases
- [x] **Confidence Scoring** - Per-field and overall confidence
- [x] **Test Coverage** - 62 tests covering all extraction paths

### Phase 2: Expansion (Next)

- [ ] **Category expansion** - Extend beyond SSD to other device categories:
  - [ ] RAM/Memory devices
  - [ ] Graphics cards
  - [ ] Processors (CPUs)
  - [ ] Power supplies
  - [ ] Motherboards

- [ ] **Cross-retailer product matching** - Implement matching logic:
  - [ ] Brand + family + capacity matching
  - [ ] SKU normalization
  - [ ] Title pattern matching
  - [ ] URL-based validation

- [ ] **Advanced capacity normalization**:
  - [ ] Decimal TB handling (1.92TB, 3.84TB)
  - [ ] Compact format parsing (1000G, 500G)
  - [ ] Unit consistency across retailers

### Phase 3: Intelligence (Future)

- [ ] **Buying recommendation engine** - Compare equivalent products across retailers
- [ ] **Price normalization** - Handle different currencies and price formats
- [ ] **Availability tracking** - Real-time stock levels across retailers
- [ ] **Product variant resolution** - Handle product variants (e.g., MX500 vs MX500 1TB)

## Normalization Principles

### Rule 1: Never Overwrite Raw Values

Raw data from retailers is preserved alongside normalized values. This ensures traceability and allows for re-evaluation.

### Rule 2: Unknown Values Remain Explicit

When a field cannot be determined, it is set to `null` rather than a default value. This distinguishes "truly unknown" from "known to be empty."

### Rule 3: Alias Tables Over Hardcoded Rules

Brand, interface, form factor, and capacity aliases use lookup tables rather than regex patterns where possible. This makes updates simple.

### Rule 4: Confidence is Per-Field

Each extracted field has its own confidence score. The overall confidence is the average of all per-field confidences. This allows:

- Identifying weak extractions despite high overall confidence
- Selecting the most reliable fields for comparison
- Debugging extraction failures

### Rule 5: Deterministic by Default

All extracted values use regex patterns and lookup tables. LLMs are not required for the extraction pipeline, though they can be added as an extension.

## Data Flow

```
                    ┌──────────────┐
                    │   Raw HTML   │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Provider Extractors  │
              │   (Pichau, Kabum,      │
              │    Mercado Livre)       │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Normalizer Layer     │
              │   - Title normalization│
              │   - Price normalization│
              │   - Currency standard- │
              │     ization             │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Storage Device        │
              │  Extractor             │
              │   - Brand (aliases)    │
              │   - Model (regex)      │
              │   - Family (lookup)    │
              │   - Capacity (GB/TB)   │
              │   - Interface (aliases)│
              │   - Form Factor (aliases)│
              │   - PCIe Gen (regex)   │
              │   - SKU (vendor patterns)│
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Canonical Product     │
              │  Representation        │
              │   - Retailer-independent│
              │   - Confidence scored  │
              │   - Compare-ready      │
              └────────────────────────┘
```

## Comparison Criteria

For two products to be considered equivalent (for buying comparison):

1. **Brand match** - Same brand (or resolved alias)
2. **Family/Model match** - Same family or compatible models
3. **Capacity match** - Same capacity (after GB/TB normalization)
4. **Interface match** - Same or compatible interface
5. **Form factor match** - Same or compatible form factor

## Success Metrics

### Current

- **Test coverage**: 62 tests, all passing
- **Brand detection**: 90%+ accuracy (alias tables)
- **Capacity extraction**: 95%+ accuracy (regex)
- **Interface detection**: 85%+ accuracy (patterns)

### Target

- **Cross-retailer matching**: 80%+ of equivalent products matched
- **Confidence scoring**: Mean confidence > 0.85
- **Brand alias coverage**: 100% of common brands covered
- **Capacity normalization**: 100% of GB/TB variants

## References

- `src/StorageDeviceExtractor.js` - Main implementation
- `src/providers/normalizer.js` - Title/price normalization
- `docs/CANONICAL_PRODUCT_SCHEMA.md` - Schema definition
- `docs/research/specification-extraction-strategy.md` - Extraction strategy
- `tests/StorageDeviceExtractor.test.js` - Validation tests
