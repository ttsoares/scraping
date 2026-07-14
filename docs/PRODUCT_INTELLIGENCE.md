# Product Intelligence Platform

## Overview

The Product Intelligence platform enables comparison of equivalent products scraped from different retailers (Pichau, KaBuM, MercadoLivre, etc.) by normalizing their raw retailer data into a shared canonical model.

## Architecture

The integrated runtime pipeline is:

```text
Provider
→ Normalizer
→ StorageDeviceExtractor
→ Canonical Product
→ ComparisonEngine
```

Three distinct data layers are preserved:

- **Layer 3: Derived Facts** — Canonical resolutions, confidence scoring, MATCH / MISMATCH / UNKNOWN verdicts
- **Layer 2: Extracted Facts** — Brand, model, family, capacity (normalized), interface, protocol, pcieGeneration, formFactor, confidence scores per field
- **Layer 1: Raw Retailer Data** — Original title strings, retained values from extraction

## Design Principles

- **Retailer-independent**: Canonical model works regardless of source
- **Never overwrite raw values**: Original extraction data always preserved
- **Explicit unknowns**: Missing fields remain `null`, not guessed
- **Deterministic**: Uses regex, dictionaries, and normalization tables (no LLM dependencies)
- **Explainable**: Every comparison carries semantic reasoning

## Runtime Integration

`SearchService.search()` now extracts `canonicalProducts` after product normalization. When `compareAgainst` products are provided in the search options, both sides are converted into canonical storage-device products and compared with `ComparisonEngine.compare()`. The returned `comparisonResults` include pair indexes, canonical products, provenance, verdict, confidence, and `ComparisonReason` records.

`ProductMatch.matchProducts()` remains available as a backward-compatible matching facade, but delegates to `ComparisonEngine` so there is one deterministic comparison implementation.

## Comparison Reason Model

The platform uses `ComparisonReason` objects to record why products match or differ. Each reason carries:

- `field`: The canonical field name
- `leftValue` / `rightValue`: The values compared
- `canonicalValue`: The resolved canonical value (not just a copy of one side)
- `reason`: Human-readable explanation
- `status`: `MATCH`, `MISMATCH`, or `UNKNOWN`

See `COMPARISON_REASON_NOTE.md` for detailed rationale.

## Scope

**In scope:**

- Normalization logic (brand, model, capacity, interface, etc.)
- Canonical product schema
- Cross-retailer product comparison
- Documentation and tests

**Out of scope:**
- Browser engine implementations
- Provider implementations
- Benchmark framework

## Deliverables

- `src/comparison/ComparisonReason.js` — explainable comparison unit
- `src/comparison/ComparisonEngine.js` — field-level comparers and confidence scoring
- `tests/comparison-engine.test.js` — direct deterministic comparison suite
- `tests/product-intelligence-pipeline.test.js` — integration benchmark for provider → normalizer → extractor → comparison
- `COMPARISON_REASON_NOTE.md` — design rationale
- `CANONICAL_PRODUCT_SCHEMA.md` — field reference
- `research/product-normalization-roadmap.md` — implementation roadmap

## Known Value Mappings

| Field | Mapping |
|-------|---------|
| Brand | `WD` <-> `WESTERN DIGITAL` |
| Interface | `M.2` <-> `PCIe` |
| Form Factor | `M.2` <-> `2280`, `2.5" <-> SATA` |
