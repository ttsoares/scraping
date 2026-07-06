
# PichauProvider Robustness Improvements

## Summary of Changes

This document describes the robustness improvements made to PichauProvider to reduce maintenance risk while preserving the public interface.

### 1. Custom Error Types

Added a hierarchy of error classes for meaningful error differentiation:

```
PichauProviderError (base)
├── CloudflareDetected
├── NoProductsFound
├── SearchInputNotFound
├── NavigationError
├── TimeoutError
└── DomChanged
```

**Benefits:**
- Callers can catch specific error types (e.g., `CloudflareDetected`)
- Error debugging is faster (clear error codes: CLOUDFLARE, NO_PRODUCTS, INPUT_NOT_FOUND, etc.)
- Enables better error reporting and monitoring

### 2. Browser Lifecycle Improvements

#### healthCheck()
- Validates browser, context, and page state
- Checks page responsiveness via `document.title`, `window.location.href`, `document.body`
- Prevents silent failures from stale pages

#### ensurePage()
- Fast path: reuses valid page without recreation
- Slow path: properly closes old page before creating new one
- Handles defunct context gracefully

#### shutdown()
- Explicit resource cleanup (page → context → browser)
- Sets references to null after cleanup
- Idempotent (safe to call multiple times)

### 3. Search Flow Enhancements

#### Error Detection
- `checkCloudflare()`: Detects Cloudflare blocks by inspecting page title
- `filterValidProducts()`: Filters out "Ver todas", "Ver todos", and empty-title items

#### Selector Resilience
- Uses data-cy attributes where available (`a[data-cy="list-product"]`)
- Fallback to semantic selectors (`input[placeholder*="procurando"], input[aria-label="Buscar produtos"]`)

#### Price Parsing
- Handles compound prices with multiple R$ values
- Falls back to cleaning full text when R$ detection fails
- Returns null for unparseable prices (graceful degradation)

#### DOM Timing
- Dynamic waitForFunction waits for actual product count > 0
- $$eval retry on zero products (500ms delay)
- Total timeout budget: ~43 seconds (30s input + 30s selector + 10s function + 500ms retry)

### 4. Pagination Verification
- Links are resolved against base URL (handles relative/absolute)
- Map-based deduplication prevents duplicate page entries
- Returns currentPage, pages array, nextPageUrl, hasNextPage

### 5. Error Handling Summary

| Error Type | Code | When Raised | Caller Action |
|------------|------|-------------|---------------|
| CloudflareDetected | CLOUDFLARE | Title contains "Manutenção" or "Pru Pru" | Retry later or clear cookies |
| NoProductsFound | NO_PRODUCTS | Zero products after search retry | Validate query string |
| SearchInputNotFound | INPUT_NOT_FOUND | Search input not visible within 30s | Check page structure |
| NavigationError | NAVIGATION | Page navigation fails or stalls | Check network connectivity |
| TimeoutError | TIMEOUT | Any timeout exceeded (configurable) | Increase timeout threshold |
| DomChanged | DOM_CHANGED | DOM structure doesn't match expectations | Review selectors |
| PichauProviderError | (varies) | Generic provider errors | Inspect message |

## Migration Path

### For Users of PichauProvider

The public interface is preserved:

```javascript
const provider = new PichauProvider();
const result = await provider.search('query');
// result: { query, url, products[], pagination, source }
```

### Breaking Changes

None. All additions are backward-compatible:
- New exports (shutdown, error classes) are optional
- Existing search() signature unchanged
- Result shape unchanged

### For Future Enhancements

The codebase supports:
1. Adding retries per error type
2. Supporting multiple browser contexts for parallel searches
3. Adding network interception strategies without breaking DOM strategy
4. Adding caching layer without affecting public interface

## Limitations and Known Issues

### Current Limitations
1. **Singleton browser**: All searches share one browser instance
   - Mitigation: shutdown() is available for explicit cleanup
   - Future: Support browser pooling if needed

2. **DOM-dependent**: Extracts products via DOM selectors
   - Mitigation: Dynamic waits + retry logic
   - Future: Add network interception as alternative strategy

3. **Single browser**: Limited to one Pichau search at a time
   - Mitigation: Sufficient for most use cases
   - Future: Support concurrent searches with page pooling

4. **No automatic retries**: Single attempt per search phase
   - Mitigation: Dynamic timing reduces race conditions
   - Future: Add configurable retry logic per error type

5. **Fixed selectors**: Relies on specific CSS selectors staying stable
   - Mitigation: Data-cy attributes are least likely to change
   - Future: Add semantic fallback selectors

### Assumptions to Validate

1. **Pichau HTML structure stability**:
   - `a[data-cy="list-product"]` for product cards
   - `h2` elements for product titles
   - `.price_vista` for price values
   - `page=` query parameter for pagination
   - Validate: Monitor Pichau release notes for DOM changes

2. **Cloudflare detection heuristic**:
   - Title-based detection (Manutenção/Pru Pru) is reliable
   - Validate: Check against Cloudflare challenge pages for false positives

3. **Price format stability**:
   - Brazilian format (R$ 1.234,56)
   - Validates: R$ prefix, dotted thousands, comma decimals
   - Future: Validate price extraction for new formats

4. **Navigation method**:
   - Click search input → fill → press Enter triggers RSC navigation
   - Validate: Confirm with Pichau devs if this is the standard path

5. **Result page count**:
   - Typically 36-53 products per page
   - Edge cases may return more/fewer
   - Validation: Verify against different search categories

## Testing Coverage

The test suite (test-robustness.js) validates:

1. **Multiple search categories**: SSD, GPU, CPU, power supply, cases, peripherals
2. **Product count range**: Each category returns 5-100 products
3. **Field completeness**: All products have title, price, url, source
4. **Pagination**: Pagination object present with valid structure
5. **Error handling**: Empty query throws, shutdown works
6. **URL consistency**: All URLs are absolute and valid

Run tests: `node test-robustness.js`

## Technical Debt

### High Priority
1. **Test coverage for failed scenarios**: Add tests for network errors, DOM changes
2. **Validate selectors in production**: Monitor for broken selectors over time
3. **Document error recovery paths**: How to handle each specific error type

### Medium Priority
1. **Add logging**: Instrument with debug logging for production monitoring
2. **Support concurrent searches**: Multiple PichauProvider instances could work in parallel
3. **Add network interception strategy**: Capture RSC payloads to reduce DOM dependency

### Low Priority
1. **Browser pooling**: Reuse browser contexts more efficiently for batch searches
2. **Configurable timeouts**: Allow customization of wait thresholds
3. **Metrics collection**: Track search success rates, product counts, response times

## Version History

### v1.1.0 (Current)
- Added custom error types with error codes
- Added healthCheck() and shutdown() methods
- Improved browser lifecycle (ensurePage() page recreation)
- Added Cloudflare detection (checkCloudflare)
- Added product filtering (filterValidProducts)
- Improved price parsing (compound prices, fallback)
- Comprehensive test suite (test-robustness.js)

### v1.0.0
- Initial PichauProvider implementation
- DOM-based product extraction
- Basic pagination support
