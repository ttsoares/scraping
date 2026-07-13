# Why ComparisonReason Over Generic Evidence

## Problem

The existing ProductMatch module uses a generic `evidence` format — a flat array of objects with `rule`, `left`, `right`, `matched`, and `detail`. This works for binary matching decisions but lacks the semantic depth required for **explainable buying recommendations**.

## ComparisonReason Design

A `ComparisonReason` object records five explicit fields:

| Field | Description |
|-------|-------------|
| `field` | The canonical field being compared (e.g., `brand`, `capacity`, `interface`) |
| `leftValue` | The left product's value for this field |
| `rightValue` | The right product's value for this field |
| `canonicalValue` | The resolved canonical value (not just a copy of one side) |
| `reason` | Human-readable semantic explanation (e.g., "Brand alias match") |
| `status` | `MATCH`, `MISMATCH`, or `UNKNOWN` |

## Why ComparisonReason Is Preferred

### 1. Canonical Value Resolution

Generic evidence records raw comparisons (left vs right). ComparisonReason records the **canonical resolution** — the single authoritative value that represents both. This matters for buying recommendations:

```
// Generic evidence approach
{ rule: 'brand', left: 'SAMSUNG', right: 'Samsung', matched: true }

// ComparisonReason approach — same comparison, but with canonical value
// that resolves case differences for downstream consumers
{
  field: 'brand',
  leftValue: 'SAMSUNG',
  rightValue: 'Samsung',
  canonicalValue: 'SAMSUNG',  // resolved, not just copied
  reason: 'Brand match',
  status: 'MATCH'
}
```

A buyer sees "canonical: SAMSUNG" — not two values that happen to match.

### 2. Self-Describing Semantics

The `reason` field captures **why**, not just **what**. This is critical for recommendation surfaces where a buyer needs to understand the match without reading code:

```json
{
  "field": "interface",
  "leftValue": "M.2",
  "rightValue": "PCIe",
  "canonicalValue": "M.2",
  "reason": "Interface compatible (M.2/PCIe)",
  "status": "MATCH"
}
```

Generic evidence would say `{ matched: true, detail: true }` — true because what?
ComparisonReason says "M.2 and PCIe are compatible" — a buyer-level explanation.

### 3. Supports Three-State Logic

Binary `matched: true/false` evidence cannot represent missing data. Three-state logic (`MATCH`, `MISMATCH`, `UNKNOWN`) distinguishes:

| Status | Meaning | Recommendation Impact |
|--------|---------|----------------------|
| `MATCH` | Confirmed similarity | Both products represent the same spec |
| `MISMATCH` | Confirmed difference | Products differ on this field |
| `UNKNOWN` | Data not available | Cannot decide; may need more info |

This matters for incomplete retail extraction: a null `manufacturerSku` should not cause a false mismatch — it should remain `UNKNOWN`.

### 4. Separates Extraction Evidence from Comparison Reasoning

The existing `StorageDeviceExtractor` produces extraction-level confidence scores (e.g., `brand.confidence: 0.9`). These live in the extracted product object. `ComparisonReason` lives at the comparison level, answering a different question:

```
// Extraction level: how confident are we in this value?
extractedProduct.confidence.brand = 0.90

// Comparison level: do the two products match?
ComparisonReason for brand = {
  field: 'brand',
  leftValue: 'SAMSUNG',
  rightValue: 'SAMSUNG',
  canonicalValue: 'SAMSUNG',
  reason: 'Brand match',
  status: 'MATCH'
}
```

### 5. Recommendation-Ready Output

A buying recommendation requires the buyer to understand:
- **Why** two products match (reason)
- **What** they share (canonicalValue)
- **Which** fields differ (status: MISMATCH)
- **Which** fields are missing (status: UNKNOWN)

ComparisonReason carries all four pieces of information in a single object. ProductMatch's generic evidence would need additional logic to answer each question.

## When Generic Evidence Is Sufficient

Generic evidence is adequate for:
- Internal tooling and debugging
- Simple equality checks
- When only the matched/no_match outcome matters

ComparisonReason is preferred for:
- Product comparison surfaces (UI)
- Buying recommendations
- Cross-retailer product matching
- Audit trails for why products were matched

## Conclusion

ComparisonReason extends the evidence concept with explicit canonical resolution
and semantic explanations, making the comparison engine's output directly usable
for buying recommendations without additional transformation.
