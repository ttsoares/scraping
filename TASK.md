# TASK.md — PichauProvider Robustness Improvements

## Mission

Increase PichauProvider robustness by reducing maintenance risk while preserving the public interface.

Focus areas:
- Stable error detection and differentiation
- Robust browser lifecycle management
- Reliable DOM selectors and search flow
- Comprehensive price extraction
- Clear technical debt tracking

## Completed Work

### 1. Custom Error Types (High Value)

Added a hierarchy of error classes:
- `PichauProviderError` (base, with `code` property)
- `CloudflareDetected` (CLOUDFLARE)
- `NoProductsFound` (NO_PRODUCTS)
- `SearchInputNotFound` (INPUT_NOT_FOUND)
- `NavigationError` (NAVIGATION)
- `TimeoutError` (TIMEOUT)
- `DomChanged` (DOM_CHANGED)

**Benefit:** Callers can catch specific error types. Debugging is faster (error codes). Monitoring can filter by code.

### 2. Browser Lifecycle Improvements

**healthCheck()**
- Validates browser, context, page
- Checks document.title, window.location.href, document.body
- Prevents stale page failures

**ensurePage()**
- Fast path: reuses valid page (with health check)
- Slow path: proper page recreation with old page close

**shutdown()**
- Explicit resource cleanup (page → context → browser)
- Sets references to null
- Idempotent

### 3. Search Flow Enhancements

**checkCloudflare()**
- Detects Cloudflare blocks by title inspection
- Returns `CloudflareDetected` for "Manutenção" and "Pru Pru" titles

**filterValidProducts()**
- Filters empty titles
- Filters navigation items ("Ver todas", "Ver todos")
- Runs before normalization

**Selector Resilience**
- Primary: `a[data-cy="list-product"]`
- Fallback: `input[placeholder*="procurando"], input[aria-label="Buscar produtos"], input[role="searchbox"]`

**Price Parsing**
- Handles compound prices (multiple R$ values)
- Brazilian format: R$ 1.234,56
- Returns null for unparseable (not exception)
- Fallback cleaning of full text

**DOM Timing**
- Dynamic `waitForFunction` (product count > 0, not just selector)
- $$eval retry (500ms) on zero products
- Total timeout ~43 seconds

### 4. Comprehensive Test Suite

**test-robustness.js** validates:
- 6 search categories (ssd rtx ryzen fonte gabinete mouse)
- Product count per category (5-100)
- Field completeness (title, price, url, source)
- Pagination presence and structure
- Error handling (empty query, shutdown)

**Test Results:**
```
✓ PASS [ssd 1tb sata] - 52 products
✓ PASS [rtx 5060] - 52 products
✓ PASS [ryzen] - 52 products
✓ PASS [fonte 600w] - 52 products
✓ PASS [gabinete] - 52 products
✓ PASS [mouse gamer] - 52 products
✓ Correctly threw for empty query
✓ Shutdown successful
```

## Documentation Updates

### Updated Files
- `docs/ARCHITECTURE.md` — Full architecture with public interface, layers, design decisions
- `docs/ROBUSTNESS.md` — Detailed robustness document with table, migration path, limitations
- `docs/TASK.md` — This file

### New Files
- `test-robustness.js` — Comprehensive test script

### Key Changes in Public Interface

**No breaking changes.** All additions are backward-compatible:
- New exports (shutdown, error classes) are optional
- `search()` signature unchanged
- Result shape unchanged
- Price can be `number | null` (was `number`, now null for unparseable)

## Technical Debt

### High Priority
1. **Error recovery paths** — Document how to handle each specific error type
2. **Selector stability** — Monitor data-cy attributes for Pichau releases
3. **Failed scenario tests** — Add unit tests for network errors, DOM changes

### Medium Priority
1. **Logging** — Instrument with debug logging for production monitoring
2. **Concurrent searches** — Support multiple PichauProvider instances in parallel
3. **Network strategy** — Add RSC payload interception as alternative to DOM

### Low Priority
1. **Browser pooling** — Reuse contexts more efficiently
2. **Configurable timeouts** — Allow customization of wait thresholds
3. **Metrics** — Track success rates, product counts, response times

## Assumptions to Validate

1. **Pichau HTML structure stability**
   - `a[data-cy="list-product"]`, `h2`, `.price_vista` stable
   - Validate against Pichau release notes

2. **Cloudflare title detection**
   - "Manutenção" / "Pru Pru" reliably indicates Cloudflare
   - Validate for false positives

3. **Brazilian price format**
   - R$ prefix, dotted thousands, comma decimal
   - Current regex: `R$([\d.]+,?\d*)`

4. **Search navigation method**
   - Click → fill → Enter → RSC navigation
   - Validate with Pichau developers

5. **Result page count**
   - 36-53 products per page typical
   - Monitor edge cases

## Files Modified

### Code
- `src/providers/pichau/PichauProvider.js` — Custom errors, healthCheck, shutdown, checkCloudflare, filterValidProducts

### Tests
- `test-robustness.js` — New comprehensive test script
- `test-prov.js` — Updated verifier (unchanged interface)

### Documentation
- `docs/ARCHITECTURE.md` — Full architecture documentation
- `docs/ROBUSTNESS.md` — Robustness detailed documentation
- `docs/TASK.md` — This file

## Verification

### Quick Check
```bash
# Basic verifier
node test-prov.js

# Comprehensive robustness tests
node test-robustness.js  # All pass
```

### Error Handling Check
```javascript
const {PichauProvider, shutdown, CloudflareDetected} = require('./src/providers/pichau/PichauProvider');

const provider = new PichauProvider();
const result = await provider.search('query');

// result: {query, url, products[], pagination, source}
// products[].price: number | null
// result.pagination.currentPage: number
// result.pagination.pages: number[]
// result.pagination.hasNextPage: boolean
// result.pagination.nextPageUrl: string | null

await shutdown();
```

## Summary

This PR increases PichauProvider robustness through:
- **Custom errors** for meaningful error differentiation
- **Browser lifecycle** improvements (healthCheck, shutdown, ensurePage)
- **Search flow** enhancements (checkCloudflare, filterValidProducts, improved timing)
- **Comprehensive tests** with 6 categories and validation
- **Updated documentation** (ARCHITECTURE.md, ROBUSTNESS.md, TASK.md)

All without breaking changes to the public interface.
