# Product Normalization Roadmap

## Current State

Products from Pichau, KaBuM, and MercadoLivre are extracted into a common model with fields for brand, model, family, capacity, interface, protocol, PCIe generation, and form factor. However, cross-retailer comparison requires additional normalization to produce matchable canonical products.

## Goals

1. **Cross-retailer matching**: Equivalent products from Pichau, KaBuM, and MercadoLivre should be representable by the same canonical specification.
2. **Reliable buying recommendations**: Buyers can compare products with confidence, knowing the comparison is based on normalized fields, not raw text.
3. **Extensible**: New product categories can be added without modifying the comparison engine.

## Roadmap

### Phase 1: Foundation (Done)

- [x] Canonical product schema definition
- [x] ComparisonReason model for explainable comparisons
- [x] Deterministic value normalization (regex, dictionaries, tables)
- [x] Documentation: PRODUCT_INTELLIGENCE.md, CANONICAL_PRODUCT_SCHEMA.md, COMPARISON_REASON_NOTE.md

### Phase 2: Comparison Engine (Done)

- [x] Field-level comparers for all schema fields
- [x] Confidence scoring and verdict computation
- [x] Mismatch/unknown handling for partial data
- [x] ComparisonReason objects with canonical values and semantic explanations
- [x] Report generation for human-readable output
- [x] Test suite with real retail products (20/20 tests passing)

### Phase 3: Integration (In Progress)

- [ ] Full integration with StorageDeviceExtractor
- [ ] Comparison engine integration with Pichau, KaBuM, MercadoLivre
- [ ] Real product verification: run comparison against existing provider extracts
- [ ] Validation against the benchmark products

### Phase 4: Expansion (Next)

- [ ] Brand dictionary extension (add more manufacturers)
- [ ] Model normalization enhancements (fuzzy matching improvements)
- [ ] Additional category support (CPU, GPU, RAM)
- [ ] Capacity normalization table expansion
- [ ] Interface/protocol equivalence table expansion

### Phase 5: Recommendations (Future)

- [ ] Buying recommendation generation from comparison results
- [ ] Ranking and filtering based on comparison fields
- [ ] Price-per-spec normalization
- [ ] Recommendation confidence scoring

## Open Questions

1. Should `manufacturerSku` be used as the primary identifier for exact matching?
2. How should we handle products where the same model has different SKUs across retailers?
3. What confidence threshold should distinguish LIKELY_IDENTICAL from DIFFERENT?
4. Should we add a `confidenceScore` per field to the schema?

## Known Limitations

1. **SKU comparison**: Non-alphanumeric characters are stripped but the comparison is purely text-based (no semantic analysis).
2. **Model fuzzy matching**: Numeric overlap is a simple heuristic, not a deep comparison.
3. **PCIe generation**: Adjacent generations (e.g., Gen4 vs Gen5) are considered compatible, which may not be appropriate for high-performance comparisons.
4. **Warranty tolerance**: 1-month tolerance is a reasonable heuristic but may be too loose for some product categories.
